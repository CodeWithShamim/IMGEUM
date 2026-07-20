// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IEmployerRegistry} from "./interfaces/IEmployerRegistry.sol";
import {IDojangVerifier} from "./interfaces/IDojangVerifier.sol";
import {IUpIdResolver} from "./interfaces/IUpIdResolver.sol";

/// @title EmployerRegistry
/// @author IMGEUM (임금 프로토콜)
/// @notice Dojang-gated employer identity plus the public on-time-payment history that
///         backs an employer's portable solvency score.
/// @dev Implements GIWA's OnchainVerifiable pattern
///      (https://docs.giwa.io/get-started/smart-contract/onchainverifiable.md): registration
///      is gated by a pull-check against DojangScroll's `isVerified`, with no proof blob
///      accepted from the caller.
contract EmployerRegistry is IEmployerRegistry, Ownable2Step {
    /* -------------------------------------------------------------------------- */
    /*                                   ERRORS                                   */
    /* -------------------------------------------------------------------------- */

    error NotDojangVerified(address employer);
    error AlreadyRegistered(address employer);
    error NotRegistered(address employer);
    error NotRecorder(address caller);
    error EmptyString();
    error StringTooLong();
    error ZeroAddress();

    /* -------------------------------------------------------------------------- */
    /*                                  CONSTANTS                                 */
    /* -------------------------------------------------------------------------- */

    /// @notice Maximum byte length for `upId` and `displayName`.
    /// @dev Bounded so a hostile employer cannot bloat evidence-page reads or make
    ///      `getEmployer` prohibitively expensive for the wallet-less verifier view.
    ///      256 bytes comfortably fits a Korean company name (3 bytes/char in UTF-8).
    uint256 internal constant MAX_STRING_BYTES = 256;

    /// @notice Denominator of the solvency score. Scores run 0-1000.
    uint16 public constant SCORE_SCALE = 1000;

    /// @notice Window over which a recent arrears event carries an extra penalty.
    /// @dev 90 days: roughly three Korean monthly pay cycles, so an employer must string
    ///      together a full quarter of clean payroll before the recency penalty fully decays.
    uint64 public constant RECENCY_WINDOW = 90 days;

    /// @notice Maximum extra penalty applied for an arrears event that just happened.
    /// @dev Applied on top of the ratio term and decayed linearly to zero across
    ///      RECENCY_WINDOW. 300/1000 is deliberately harsh: an employer with a perfect
    ///      lifetime ratio who misses payroll today still drops to 700, because a worker
    ///      deciding whether to take a job cares far more about last month than last year.
    uint16 public constant MAX_RECENCY_PENALTY = 300;

    /// @notice Minimum settled vaults before a score is considered meaningful.
    /// @dev Below this the `rated` flag returns false and the UI shows "이력 부족 / Unrated"
    ///      rather than a flattering 1000 earned from a single self-dealt vault.
    uint32 public constant MIN_SETTLED_FOR_RATING = 3;

    /* -------------------------------------------------------------------------- */
    /*                                   STORAGE                                  */
    /* -------------------------------------------------------------------------- */

    /// @notice The Dojang verifier (DojangScroll) registration is gated on.
    /// @dev Immutable: repointing this would let an owner retroactively change what
    ///      "verified" meant for already-registered employers.
    IDojangVerifier public immutable DOJANG;

    /// @notice The Dojang attester whose Verified Address attestations are accepted.
    /// @dev Immutable for the same reason as DOJANG. On GIWA Sepolia this is the testnet
    ///      faucet attester; on mainnet, Upbit Korea. See GiwaConstants.
    bytes32 public immutable ATTESTER_ID;

    /// @notice Optional up.id resolver. address(0) disables on-chain name confirmation.
    /// @dev Mutable precisely because up.id has no published GIWA Sepolia resolver yet:
    ///      this is the documented swap point. Setting it only affects the cosmetic
    ///      `upIdVerified` flag; it can never redirect funds.
    IUpIdResolver public upIdResolver;

    mapping(address employer => Employer profile) private _employers;
    mapping(address recorder => bool allowed) public isRecorder;

    /// @notice All registered employers, for indexing the directory view without an indexer.
    address[] private _employerList;

    /* -------------------------------------------------------------------------- */
    /*                                  MODIFIERS                                 */
    /* -------------------------------------------------------------------------- */

    /// @dev The OnchainVerifiable gate, transcribed from GIWA's documented pattern.
    modifier onlyDojangVerified() {
        if (!DOJANG.isVerified(msg.sender, ATTESTER_ID)) revert NotDojangVerified(msg.sender);
        _;
    }

    modifier onlyRecorder() {
        if (!isRecorder[msg.sender]) revert NotRecorder(msg.sender);
        _;
    }

    /* -------------------------------------------------------------------------- */
    /*                                 CONSTRUCTOR                                */
    /* -------------------------------------------------------------------------- */

    /// @param dojang DojangScroll address (GiwaConstants.DOJANG_SCROLL on GIWA Sepolia).
    /// @param attesterId Accepted Dojang attester identifier.
    /// @param initialOwner Protocol owner (multisig in production).
    constructor(address dojang, bytes32 attesterId, address initialOwner) Ownable(initialOwner) {
        if (dojang == address(0)) revert ZeroAddress();
        DOJANG = IDojangVerifier(dojang);
        ATTESTER_ID = attesterId;
    }

    /* -------------------------------------------------------------------------- */
    /*                                REGISTRATION                                */
    /* -------------------------------------------------------------------------- */

    /// @inheritdoc IEmployerRegistry
    /// @notice Registers `msg.sender` as an employer, gated on a live Dojang Verified Address.
    /// @dev Snapshots the EAS attestation UID so evidence pages can cite the exact
    ///      attestation that was live at registration time, even if it is later revoked.
    /// @param upId Self-declared Upbit Web3 Name (display only — never used to route funds).
    /// @param displayName Company name shown to workers and on evidence pages.
    function register(string calldata upId, string calldata displayName) external onlyDojangVerified {
        if (_employers[msg.sender].active) revert AlreadyRegistered(msg.sender);
        _checkString(displayName);
        _checkString(upId);

        bytes32 uid = DOJANG.getVerifiedAddressAttestationUid(msg.sender, ATTESTER_ID);

        Employer storage e = _employers[msg.sender];
        e.upId = upId;
        e.displayName = displayName;
        e.dojangUid = uid;
        e.registeredAt = uint64(block.timestamp);
        e.upIdVerified = _checkUpId(upId, msg.sender);
        e.active = true;

        _employerList.push(msg.sender);

        emit EmployerRegistered(msg.sender, upId, displayName, uid);
    }

    /// @inheritdoc IEmployerRegistry
    /// @notice Updates display metadata. History and score are untouched.
    /// @dev Intentionally NOT re-gated on Dojang: an employer who loses verification must
    ///      still be able to correct their name on an outstanding evidence record. The
    ///      evidence page renders live verification status separately, so a lapsed employer
    ///      cannot launder their way back into a "verified" badge by editing a string.
    /// @param upId New up.id name.
    /// @param displayName New company display name.
    function updateProfile(string calldata upId, string calldata displayName) external {
        Employer storage e = _employers[msg.sender];
        if (!e.active) revert NotRegistered(msg.sender);
        _checkString(displayName);
        _checkString(upId);

        e.upId = upId;
        e.displayName = displayName;
        e.upIdVerified = _checkUpId(upId, msg.sender);

        emit EmployerProfileUpdated(msg.sender, upId, displayName, e.upIdVerified);
    }

    /* -------------------------------------------------------------------------- */
    /*                              HISTORY RECORDING                             */
    /* -------------------------------------------------------------------------- */

    /// @inheritdoc IEmployerRegistry
    /// @notice Records that `employer` opened a vault. Called by WageVault.
    /// @param employer The employer opening the vault.
    function recordVaultOpened(address employer) external onlyRecorder {
        Employer storage e = _employers[employer];
        if (!e.active) revert NotRegistered(employer);
        unchecked {
            e.vaultsOpened += 1;
        }
        _emitHistory(employer, e);
    }

    /// @inheritdoc IEmployerRegistry
    /// @notice Records a fully-funded, on-deadline settlement. Called by WageVault.
    /// @param employer The employer who paid on time.
    function recordOnTime(address employer) external onlyRecorder {
        Employer storage e = _employers[employer];
        if (!e.active) revert NotRegistered(employer);
        unchecked {
            e.onTimeCount += 1;
        }
        _emitHistory(employer, e);
    }

    /// @inheritdoc IEmployerRegistry
    /// @notice Records a wage-arrears breach. Called by ArrearsAttestor.
    /// @param employer The employer in breach.
    function recordArrears(address employer) external onlyRecorder {
        Employer storage e = _employers[employer];
        if (!e.active) revert NotRegistered(employer);
        unchecked {
            e.arrearsCount += 1;
        }
        e.lastArrearsAt = uint64(block.timestamp);
        _emitHistory(employer, e);
    }

    /* -------------------------------------------------------------------------- */
    /*                                    ADMIN                                   */
    /* -------------------------------------------------------------------------- */

    /// @notice Authorises or revokes a contract permitted to write payment history.
    /// @param recorder The WageVault or ArrearsAttestor address.
    /// @param allowed Whether it may record.
    function setRecorder(address recorder, bool allowed) external onlyOwner {
        if (recorder == address(0)) revert ZeroAddress();
        isRecorder[recorder] = allowed;
        emit RecorderSet(recorder, allowed);
    }

    /// @notice Sets the up.id resolver used to confirm self-declared names.
    /// @dev Pass address(0) to disable name confirmation (the GIWA Sepolia default until
    ///      up.id publishes a resolver). Affects only the cosmetic `upIdVerified` flag.
    /// @param resolver The resolver address, or address(0).
    function setUpIdResolver(address resolver) external onlyOwner {
        upIdResolver = IUpIdResolver(resolver);
        emit UpIdResolverSet(resolver);
    }

    /* -------------------------------------------------------------------------- */
    /*                                    VIEWS                                   */
    /* -------------------------------------------------------------------------- */

    /// @inheritdoc IEmployerRegistry
    /// @notice Whether `employer` has an active registration.
    /// @param employer Address to check.
    /// @return True if registered.
    function isRegistered(address employer) external view returns (bool) {
        return _employers[employer].active;
    }

    /// @inheritdoc IEmployerRegistry
    /// @notice Full employer profile.
    /// @param employer Address to read.
    /// @return The stored profile.
    function getEmployer(address employer) external view returns (Employer memory) {
        return _employers[employer];
    }

    /// @inheritdoc IEmployerRegistry
    /// @notice The Dojang attestation UID snapshotted at registration.
    /// @param employer Address to read.
    /// @return The EAS attestation UID.
    function dojangUidOf(address employer) external view returns (bytes32) {
        return _employers[employer].dojangUid;
    }

    /// @notice Whether `employer` is verified by Dojang *right now*.
    /// @dev Live re-check, distinct from the registration-time snapshot. The evidence page
    ///      shows both: "verified when the vault opened" and "still verified today".
    /// @param employer Address to check.
    /// @return True if currently verified.
    function isCurrentlyDojangVerified(address employer) external view returns (bool) {
        return DOJANG.isVerified(employer, ATTESTER_ID);
    }

    /// @notice Number of registered employers.
    /// @return Count of entries in the directory.
    function employerCount() external view returns (uint256) {
        return _employerList.length;
    }

    /// @notice Paginated employer directory.
    /// @dev Paginated rather than returning the whole array: the directory grows unbounded
    ///      and an eth_call returning every employer would eventually exceed RPC gas caps.
    /// @param offset Start index.
    /// @param limit Maximum entries to return.
    /// @return page Employer addresses in registration order.
    function employersPaged(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 total = _employerList.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _employerList[i];
        }
    }

    /// @inheritdoc IEmployerRegistry
    /// @notice Deterministic pay-reliability score for `employer`, 0-1000.
    ///
    /// @dev FORMULA (fully deterministic, no oracle, no owner input):
    ///
    ///        settled = onTimeCount + arrearsCount
    ///        if settled == 0            -> (0, rated = false)
    ///
    ///        base    = SCORE_SCALE * onTimeCount / settled        // lifetime on-time ratio
    ///
    ///        age     = now - lastArrearsAt
    ///        penalty = age >= RECENCY_WINDOW || lastArrearsAt == 0
    ///                    ? 0
    ///                    : MAX_RECENCY_PENALTY * (RECENCY_WINDOW - age) / RECENCY_WINDOW
    ///
    ///        score   = base > penalty ? base - penalty : 0
    ///        rated   = settled >= MIN_SETTLED_FOR_RATING
    ///
    ///      Two terms, because one is not enough. The ratio alone lets an employer with
    ///      200 clean periods absorb a fresh missed payroll almost invisibly (995/1000) —
    ///      exactly the signal a worker needs and would not see. The recency term alone
    ///      would erase all long-run reputation. Together: a fresh breach costs ~300 points
    ///      immediately and that cost decays linearly to zero over 90 days, while the ratio
    ///      term keeps a permanent, un-decaying record of the breach.
    ///
    ///      Integer division truncates in both terms, which biases the score *downward*
    ///      (base rounds down, penalty rounds down but is subtracted). Rounding against the
    ///      employer is the correct direction for a worker-protection metric.
    ///
    ///      Deliberately NOT weighted by wage size: weighting by amount would let an
    ///      employer dilute a real breach with many trivial self-dealt vaults. Counting
    ///      periods makes that attack cost a full pay period of elapsed time each.
    ///
    /// @param employer Address to score.
    /// @return score The 0-1000 score.
    /// @return rated False when there is too little history to be meaningful.
    function solvencyScore(address employer) public view returns (uint16 score, bool rated) {
        Employer storage e = _employers[employer];
        uint256 settled = uint256(e.onTimeCount) + uint256(e.arrearsCount);
        if (settled == 0) return (0, false);

        uint256 base = (uint256(SCORE_SCALE) * uint256(e.onTimeCount)) / settled;

        uint256 penalty;
        uint64 last = e.lastArrearsAt;
        if (last != 0) {
            uint256 age = block.timestamp - last;
            if (age < RECENCY_WINDOW) {
                penalty = (uint256(MAX_RECENCY_PENALTY) * (RECENCY_WINDOW - age)) / RECENCY_WINDOW;
            }
        }

        score = uint16(base > penalty ? base - penalty : 0);
        rated = settled >= MIN_SETTLED_FOR_RATING;
    }

    /* -------------------------------------------------------------------------- */
    /*                                  INTERNAL                                  */
    /* -------------------------------------------------------------------------- */

    /// @dev Confirms a self-declared up.id name resolves to `claimant`.
    ///      Returns false (rather than reverting) when no resolver is configured, when the
    ///      name is empty, or when the resolver reverts — an unavailable name service must
    ///      never block payroll. The `try` guard matters: `upIdResolver` is owner-set and a
    ///      misconfigured or hostile resolver could otherwise brick registration entirely.
    function _checkUpId(string calldata name, address claimant) internal view returns (bool) {
        IUpIdResolver resolver = upIdResolver;
        if (address(resolver) == address(0) || bytes(name).length == 0) return false;
        try resolver.resolve(name) returns (address owner) {
            return owner == claimant;
        } catch {
            return false;
        }
    }

    /// @dev Rejects empty and oversized metadata strings.
    function _checkString(string calldata s) internal pure {
        uint256 len = bytes(s).length;
        if (len == 0) revert EmptyString();
        if (len > MAX_STRING_BYTES) revert StringTooLong();
    }

    /// @dev Emits the post-update history event with a freshly computed score.
    function _emitHistory(address employer, Employer storage e) internal {
        (uint16 score,) = solvencyScore(employer);
        emit HistoryRecorded(employer, e.onTimeCount, e.arrearsCount, score);
    }
}
