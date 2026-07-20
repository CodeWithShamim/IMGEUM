// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {IWageVault} from "./interfaces/IWageVault.sol";
import {IEmployerRegistry} from "./interfaces/IEmployerRegistry.sol";

/// @title WageVault
/// @author IMGEUM (임금 프로토콜)
/// @notice Streaming wage escrow. An employer opens one vault per worker per pay period and
///         funds it continuously; the worker's earned balance accrues linearly with time and
///         is withdrawable the moment it is both accrued and funded.
///
/// @dev ARCHITECTURE NOTE — one contract with vault structs, not a factory of clones.
///      The build spec offered both; this is the struct approach, and the justification is
///      three-fold:
///
///      1. Gas. Opening a vault is a struct write into 5 packed slots (~120k gas) versus a
///         CREATE2 clone deploy (~200k+) plus its own constructor writes. On GIWA the L1
///         security fee is charged on data published to Ethereum
///         (https://docs.giwa.io/network-information/transaction-fees.md), so avoiding a
///         per-vault deployment is a real, recurring saving — payroll opens vaults every
///         single pay cycle, forever.
///
///      2. Indexing. The frontend's live stream watches `VaultFunded` / `Withdrawn` events.
///         With a factory, each vault is a distinct address and `watchContractEvent` must
///         either track an unbounded, growing address set or fall back to a topic-only log
///         filter. With one contract, the entire protocol is one address and one ABI —
///         which also means one contract to verify on the GIWA Sepolia explorer and one
///         address for a labour office to check.
///
///      3. Auditability. A single contract has a single storage layout and a single
///         upgrade/pause surface. A factory multiplies the trusted-code surface by the
///         number of template versions ever deployed.
///
///      The cost of this choice is that vaults share a contract balance. That is handled by
///      strict per-vault accounting (`funded`/`withdrawn`) plus fee-on-transfer-safe balance
///      -delta measurement on deposit, so one vault can never spend another's escrow. The
///      invariant suite asserts exactly this (`sum(funded - withdrawn) <= contract balance`).
contract WageVault is IWageVault, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /* -------------------------------------------------------------------------- */
    /*                                   ERRORS                                   */
    /* -------------------------------------------------------------------------- */

    error EmployerNotRegistered(address employer);
    error InvalidWorker();
    error InvalidWageAmount();
    error InvalidPeriod();
    error InvalidDeadline();
    error PeriodTooLong();
    error NoSuchVault(uint256 vaultId);
    error VaultIsClosed(uint256 vaultId);
    error NotWorker(uint256 vaultId, address caller);
    error NothingToWithdraw(uint256 vaultId);
    error PeriodNotEnded(uint256 vaultId);
    error UnsettledShortfall(uint256 vaultId, uint256 shortfallAmount);
    error NotAttestor(address caller);
    error AttestorAlreadySet();
    error AlreadyAttested(uint256 vaultId);
    error NativeValueMismatch(uint256 expected, uint256 received);
    error UnexpectedNativeValue();
    error ZeroFundAmount();
    error NoDepositReceived();
    error ZeroAddress();

    /* -------------------------------------------------------------------------- */
    /*                                  CONSTANTS                                  */
    /* -------------------------------------------------------------------------- */

    /// @notice Sentinel for a native-ETH vault.
    address public constant NATIVE = address(0);

    /// @notice Longest permitted accrual period.
    /// @dev 370 days covers an annual contract plus slack. The bound exists so that
    ///      `wageAmount * elapsed` cannot be pushed toward overflow by an absurd period, and
    ///      so a worker cannot be locked into a decade-long stream by a malformed input.
    uint64 public constant MAX_PERIOD = 370 days;

    /// @notice Longest permitted gap between period end and payout deadline.
    /// @dev Korea's Labor Standards Act requires settlement within 14 days of the end of
    ///      employment absent agreement; 30 days gives room for ordinary monthly payroll
    ///      cycles without letting an employer set a deadline so distant that the arrears
    ///      signal becomes useless.
    uint64 public constant MAX_SETTLEMENT_WINDOW = 30 days;

    /* -------------------------------------------------------------------------- */
    /*                                   STORAGE                                  */
    /* -------------------------------------------------------------------------- */

    /// @notice The employer registry this vault reports payment history to.
    IEmployerRegistry public immutable REGISTRY;

    /// @notice The ArrearsAttestor permitted to flag vaults as breached.
    /// @dev Write-once (see `setAttestor`). Deployment is circular — the attestor needs the
    ///      vault address in its constructor — so this is set in a second transaction and
    ///      then frozen forever.
    address public attestor;

    mapping(uint256 vaultId => Vault) private _vaults;
    uint256 private _vaultCount;

    /// @notice Vault IDs opened by each employer, for dashboard reads without an indexer.
    mapping(address employer => uint256[] vaultIds) private _employerVaults;

    /// @notice Vault IDs assigned to each worker.
    mapping(address worker => uint256[] vaultIds) private _workerVaults;

    /* -------------------------------------------------------------------------- */
    /*                                  MODIFIERS                                 */
    /* -------------------------------------------------------------------------- */

    modifier exists(uint256 vaultId) {
        if (vaultId == 0 || vaultId > _vaultCount) revert NoSuchVault(vaultId);
        _;
    }

    /* -------------------------------------------------------------------------- */
    /*                                 CONSTRUCTOR                                */
    /* -------------------------------------------------------------------------- */

    /// @param registry The EmployerRegistry address.
    /// @param initialOwner Protocol owner (multisig in production).
    constructor(address registry, address initialOwner) Ownable(initialOwner) {
        if (registry == address(0)) revert ZeroAddress();
        REGISTRY = IEmployerRegistry(registry);
    }

    /* -------------------------------------------------------------------------- */
    /*                                    ADMIN                                   */
    /* -------------------------------------------------------------------------- */

    /// @notice Sets the ArrearsAttestor. Callable exactly once.
    /// @dev Write-once rather than owner-mutable: the attestor is the only address that can
    ///      mark a vault breached, and a swappable attestor would let an owner install a
    ///      no-op contract and quietly disable the entire evidence layer — the one property
    ///      workers are relying on. One shot, then immutable.
    /// @param newAttestor The ArrearsAttestor address.
    function setAttestor(address newAttestor) external onlyOwner {
        if (attestor != address(0)) revert AttestorAlreadySet();
        if (newAttestor == address(0)) revert ZeroAddress();
        attestor = newAttestor;
        emit AttestorSet(newAttestor);
    }

    /// @notice Pauses vault creation and funding.
    /// @dev Deliberately does NOT pause `withdraw` or `closeVault`. A pause is an
    ///      operational lever for the protocol owner; it must never become a way to strand
    ///      a worker's already-earned wages. Withdrawals are permanently un-pausable.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resumes vault creation and funding.
    function unpause() external onlyOwner {
        _unpause();
    }

    /* -------------------------------------------------------------------------- */
    /*                                 VAULT FLOW                                 */
    /* -------------------------------------------------------------------------- */

    /// @notice Opens a wage vault for one worker over one pay period.
    /// @dev Does not require any funding up front — an employer may open the vault at the
    ///      start of the period and stream deposits into it. That is the point: the worker
    ///      can watch funding keep pace with accrual (or fail to) in real time, instead of
    ///      discovering the shortfall on payday.
    /// @param worker The worker entitled to withdraw.
    /// @param wageAmount Total wage for the period, in `token` base units.
    /// @param periodStart Accrual start (may be in the past to backfill a period underway).
    /// @param periodEnd Accrual end. Must be strictly after `periodStart` and in the future.
    /// @param payoutDeadline Latest full-funding time without breach. Must be >= periodEnd.
    /// @param token ERC-20 wage token, or address(0) for native ETH.
    /// @return vaultId The new vault's ID (1-indexed).
    function openVault(
        address worker,
        uint256 wageAmount,
        uint64 periodStart,
        uint64 periodEnd,
        uint64 payoutDeadline,
        address token
    ) external whenNotPaused returns (uint256 vaultId) {
        if (!REGISTRY.isRegistered(msg.sender)) revert EmployerNotRegistered(msg.sender);
        if (worker == address(0) || worker == msg.sender) revert InvalidWorker();
        if (wageAmount == 0 || wageAmount > type(uint128).max) revert InvalidWageAmount();
        if (periodEnd <= periodStart || periodEnd <= block.timestamp) revert InvalidPeriod();
        if (periodEnd - periodStart > MAX_PERIOD) revert PeriodTooLong();
        if (payoutDeadline < periodEnd || payoutDeadline - periodEnd > MAX_SETTLEMENT_WINDOW) {
            revert InvalidDeadline();
        }
        if (token != NATIVE && token.code.length == 0) revert ZeroAddress();

        unchecked {
            vaultId = ++_vaultCount;
        }

        Vault storage v = _vaults[vaultId];
        v.employer = msg.sender;
        v.periodStart = periodStart;
        v.worker = worker;
        v.periodEnd = periodEnd;
        v.token = token;
        v.payoutDeadline = payoutDeadline;
        // casting to 'uint128' is safe because `wageAmount > type(uint128).max` reverts above.
        // forge-lint: disable-next-line(unsafe-typecast)
        v.wageAmount = uint128(wageAmount);

        _employerVaults[msg.sender].push(vaultId);
        _workerVaults[worker].push(vaultId);

        REGISTRY.recordVaultOpened(msg.sender);

        emit VaultOpened(vaultId, msg.sender, worker, token, wageAmount, periodStart, periodEnd, payoutDeadline);
    }

    /// @notice Deposits wages into a vault. Anyone may fund (a parent company, a guarantor).
    /// @dev Fee-on-transfer safe: `funded` is credited with the measured balance delta, not
    ///      the caller-declared `amount`. Crediting the declared amount on a fee-charging
    ///      token would let a vault report itself fully funded while holding less than it
    ///      owes — the exact failure this protocol exists to make impossible.
    /// @param vaultId The vault to fund.
    /// @param amount Amount to deposit. For native vaults this must equal `msg.value`.
    function fund(uint256 vaultId, uint256 amount) external payable exists(vaultId) nonReentrant whenNotPaused {
        Vault storage v = _vaults[vaultId];
        if (v.closed) revert VaultIsClosed(vaultId);
        if (amount == 0) revert ZeroFundAmount();

        uint256 credited;
        if (v.token == NATIVE) {
            if (msg.value != amount) revert NativeValueMismatch(amount, msg.value);
            credited = amount;
        } else {
            if (msg.value != 0) revert UnexpectedNativeValue();
            IERC20 t = IERC20(v.token);
            uint256 before = t.balanceOf(address(this));
            t.safeTransferFrom(msg.sender, address(this), amount);
            credited = t.balanceOf(address(this)) - before;
            if (credited == 0) revert NoDepositReceived();
        }

        uint256 total = uint256(v.funded) + credited;
        if (total > type(uint128).max) revert InvalidWageAmount();
        // casting to 'uint128' is safe because the bound is checked on the line above.
        // forge-lint: disable-next-line(unsafe-typecast)
        v.funded = uint128(total);

        // Stamp the moment the vault first became whole. This, not the state at close, is
        // what `closeVault` reads to decide on-time — so a late top-up cannot buy back a
        // clean record.
        if (v.fullyFundedAt == 0 && total >= v.wageAmount) {
            v.fullyFundedAt = uint64(block.timestamp);
        }

        emit VaultFunded(vaultId, msg.sender, credited, total);
    }

    /// @notice Withdraws everything currently accrued and funded.
    /// @dev Pull-payment, checks-effects-interactions, reentrancy-guarded. Never pausable.
    /// @param vaultId The vault to withdraw from.
    /// @return amount The amount transferred to the worker.
    function withdraw(uint256 vaultId) external exists(vaultId) nonReentrant returns (uint256 amount) {
        Vault storage v = _vaults[vaultId];
        if (msg.sender != v.worker) revert NotWorker(vaultId, msg.sender);

        amount = _withdrawable(v);
        if (amount == 0) revert NothingToWithdraw(vaultId);

        // EFFECTS before INTERACTIONS.
        uint256 total = uint256(v.withdrawn) + amount;
        // casting to 'uint128' is safe because `_withdrawable` returns at most
        // `min(earned, funded) - withdrawn`, so `total <= max(earned, funded) <= uint128.max`
        // (both `wageAmount` and `funded` are themselves bounded to uint128 on write).
        // forge-lint: disable-next-line(unsafe-typecast)
        v.withdrawn = uint128(total);

        emit Withdrawn(vaultId, msg.sender, amount, total);

        _payOut(v.token, msg.sender, amount);
    }

    /// @notice Settles and closes a vault after its accrual period has ended.
    /// @dev Permissionless: anyone may close. Closing is purely a bookkeeping action — it
    ///      records the employer's on-time result and returns any overfunding — and leaving
    ///      it to the employer alone would let a defaulting employer withhold the arrears
    ///      record from their own public history simply by never calling it.
    ///
    ///      A vault with an outstanding shortfall cannot be closed until it has been
    ///      attested, which is what forces every breach through the evidence layer.
    ///
    ///      Closing never touches the worker's unwithdrawn balance; `withdraw` keeps working
    ///      on a closed vault for as long as there is anything left to claim.
    /// @param vaultId The vault to close.
    function closeVault(uint256 vaultId) external exists(vaultId) nonReentrant {
        Vault storage v = _vaults[vaultId];
        if (v.closed) revert VaultIsClosed(vaultId);
        if (block.timestamp < v.periodEnd) revert PeriodNotEnded(vaultId);

        uint256 owed = v.wageAmount;
        uint256 funded_ = v.funded;

        // Still short and not yet on the record -> must be attested first.
        if (funded_ < owed && !v.arrearsAttested) {
            if (block.timestamp <= v.payoutDeadline) revert PeriodNotEnded(vaultId);
            revert UnsettledShortfall(vaultId, owed - funded_);
        }

        bool onTime = v.fullyFundedAt != 0 && v.fullyFundedAt <= v.payoutDeadline;

        v.closed = true;

        uint256 refund = funded_ > owed ? funded_ - owed : 0;
        if (refund != 0) {
            // casting to 'uint128' is safe because `owed` is read from `v.wageAmount`, a uint128.
            // forge-lint: disable-next-line(unsafe-typecast)
            v.funded = uint128(owed);
        }

        if (onTime) REGISTRY.recordOnTime(v.employer);

        emit VaultClosed(vaultId, onTime, refund);

        if (refund != 0) _payOut(v.token, v.employer, refund);
    }

    /// @inheritdoc IWageVault
    /// @notice Flags a vault as having a recorded arrears attestation.
    /// @dev Only the write-once ArrearsAttestor may call this. Returns the shortfall so the
    ///      attestor and the vault agree on one number, computed once, in one place.
    /// @param vaultId The breached vault.
    /// @return shortfallAmount Accrued-but-unfunded wages at this moment.
    function markArrears(uint256 vaultId) external exists(vaultId) returns (uint256 shortfallAmount) {
        if (msg.sender != attestor) revert NotAttestor(msg.sender);
        Vault storage v = _vaults[vaultId];
        if (v.arrearsAttested) revert AlreadyAttested(vaultId);

        shortfallAmount = _shortfall(v);
        v.arrearsAttested = true;

        emit VaultMarkedArrears(vaultId, shortfallAmount);
    }

    /* -------------------------------------------------------------------------- */
    /*                                    VIEWS                                   */
    /* -------------------------------------------------------------------------- */

    /// @inheritdoc IWageVault
    /// @notice Wages accrued so far, ignoring whether they are funded.
    /// @dev Linear stream: `wageAmount * elapsed / periodLength`, clamped to [0, wageAmount].
    ///      Multiplication precedes division so truncation costs at most 1 wei. This is the
    ///      number the frontend interpolates between blocks — GIWA's 1-second blocks
    ///      (https://docs.giwa.io/network-information/diffs-ethereum-giwa.md) mean the
    ///      on-chain value moves visibly every block rather than every 12 seconds.
    /// @param vaultId The vault to read.
    /// @return Accrued wage in token base units.
    function earned(uint256 vaultId) external view exists(vaultId) returns (uint256) {
        return _earned(_vaults[vaultId]);
    }

    /// @inheritdoc IWageVault
    /// @notice Amount the worker can withdraw right now: `min(earned, funded) - withdrawn`.
    /// @param vaultId The vault to read.
    /// @return Withdrawable amount in token base units.
    function withdrawable(uint256 vaultId) external view exists(vaultId) returns (uint256) {
        return _withdrawable(_vaults[vaultId]);
    }

    /// @inheritdoc IWageVault
    /// @notice Accrued-but-unfunded wages: `earned - funded`, floored at zero.
    /// @param vaultId The vault to read.
    /// @return The shortfall in token base units.
    function shortfall(uint256 vaultId) external view exists(vaultId) returns (uint256) {
        return _shortfall(_vaults[vaultId]);
    }

    /// @inheritdoc IWageVault
    /// @notice Whether the vault is past its payout deadline with wages still unfunded.
    /// @dev This is the precondition ArrearsAttestor enforces before minting evidence.
    /// @param vaultId The vault to read.
    /// @return True if attestable.
    function isBreached(uint256 vaultId) external view exists(vaultId) returns (bool) {
        Vault storage v = _vaults[vaultId];
        return block.timestamp > v.payoutDeadline && _shortfall(v) > 0;
    }

    /// @inheritdoc IWageVault
    /// @notice Full vault record.
    /// @param vaultId The vault to read.
    /// @return The stored vault.
    function getVault(uint256 vaultId) external view exists(vaultId) returns (Vault memory) {
        return _vaults[vaultId];
    }

    /// @inheritdoc IWageVault
    /// @notice Total vaults ever opened. IDs run 1..vaultCount().
    /// @return The count.
    function vaultCount() external view returns (uint256) {
        return _vaultCount;
    }

    /// @notice Vault IDs opened by an employer.
    /// @param employer The employer to read.
    /// @return Vault IDs in creation order.
    function vaultsOfEmployer(address employer) external view returns (uint256[] memory) {
        return _employerVaults[employer];
    }

    /// @notice Vault IDs assigned to a worker.
    /// @param worker The worker to read.
    /// @return Vault IDs in creation order.
    function vaultsOfWorker(address worker) external view returns (uint256[] memory) {
        return _workerVaults[worker];
    }

    /// @notice Batch read of the live stream figures for one vault.
    /// @dev One RPC round trip instead of four. The worker page polls this every second, so
    ///      collapsing it matters for the rate-limited public GIWA RPC
    ///      (https://docs.giwa.io/get-started/connect-to-giwa.md notes the public endpoints
    ///      are rate limited and unsuitable for production traffic).
    /// @param vaultId The vault to read.
    /// @return vault The stored vault.
    /// @return earnedNow Wages accrued so far.
    /// @return withdrawableNow Amount claimable right now.
    /// @return shortfallNow Accrued-but-unfunded wages.
    function vaultSnapshot(uint256 vaultId)
        external
        view
        exists(vaultId)
        returns (Vault memory vault, uint256 earnedNow, uint256 withdrawableNow, uint256 shortfallNow)
    {
        Vault storage v = _vaults[vaultId];
        return (v, _earned(v), _withdrawable(v), _shortfall(v));
    }

    /* -------------------------------------------------------------------------- */
    /*                                  INTERNAL                                  */
    /* -------------------------------------------------------------------------- */

    /// @dev Linear accrual, clamped at both ends.
    function _earned(Vault storage v) internal view returns (uint256) {
        uint64 start = v.periodStart;
        if (block.timestamp <= start) return 0;

        uint64 end = v.periodEnd;
        if (block.timestamp >= end) return v.wageAmount;

        // `end > start` is enforced at open, and `start < block.timestamp < end` here, so
        // both subtractions are safe and the quotient is strictly less than wageAmount.
        uint256 elapsed = block.timestamp - start;
        uint256 length = uint256(end) - start;
        return (uint256(v.wageAmount) * elapsed) / length;
    }

    /// @dev `min(earned, funded) - withdrawn`, floored at zero.
    ///      Floored rather than asserted non-negative because a fee-on-transfer token can in
    ///      principle reduce `funded` relative to what was already withdrawn under an
    ///      earlier, higher balance; the floor keeps that from reverting every later read.
    function _withdrawable(Vault storage v) internal view returns (uint256) {
        uint256 accrued = _earned(v);
        uint256 funded_ = v.funded;
        uint256 available = accrued < funded_ ? accrued : funded_;
        uint256 taken = v.withdrawn;
        return available > taken ? available - taken : 0;
    }

    /// @dev `earned - funded`, floored at zero.
    function _shortfall(Vault storage v) internal view returns (uint256) {
        uint256 accrued = _earned(v);
        uint256 funded_ = v.funded;
        return accrued > funded_ ? accrued - funded_ : 0;
    }

    /// @dev Single exit point for value leaving the contract, native or ERC-20.
    function _payOut(address token, address to, uint256 amount) internal {
        if (token == NATIVE) {
            Address.sendValue(payable(to), amount);
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}
