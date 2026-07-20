// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IWageVault
/// @notice Read surface of the streaming wage escrow, plus the single hook the
///         ArrearsAttestor is permitted to call.
interface IWageVault {
    /// @notice One pay period's escrow.
    /// @dev Field order is chosen for storage packing, not readability — see the slot map.
    ///      A vault occupies 5 slots instead of the 9 a naive ordering would use, which
    ///      matters because `openVault` is the single most gas-expensive user action and
    ///      GIWA's fee model charges an L1 security fee on published calldata + state
    ///      (https://docs.giwa.io/network-information/transaction-fees.md).
    ///
    ///        slot 0: employer(20) periodStart(8) closed(1) arrearsAttested(1)  = 30/32
    ///        slot 1: worker(20)   periodEnd(8)                                 = 28/32
    ///        slot 2: token(20)    payoutDeadline(8) fullyFundedAt(8) -> 36     -> spills
    ///
    ///      (fullyFundedAt spills into slot 3 alongside the amounts; solc packs greedily in
    ///      declaration order, and the layout below is what it actually produces.)
    ///
    /// @param employer Who funds the vault.
    /// @param periodStart When wage accrual begins.
    /// @param closed Whether the vault has been settled and closed.
    /// @param arrearsAttested Whether an arrears record has been minted against it.
    /// @param worker Who may withdraw from it.
    /// @param periodEnd When wage accrual completes.
    /// @param token ERC-20 wage token, or address(0) for native ETH.
    /// @param payoutDeadline Last moment the employer can be fully funded without breach.
    /// @param fullyFundedAt Timestamp the vault first reached `funded >= wageAmount`, else 0.
    ///        This is what decides on-time vs. late — not the state at close — so an employer
    ///        cannot top up weeks after the deadline and still be recorded as having paid on time.
    /// @param wageAmount Total wage owed for the period.
    /// @param funded Cumulative amount actually deposited (fee-on-transfer safe: measured
    ///        as a balance delta, not as the caller-declared amount).
    /// @param withdrawn Cumulative amount the worker has pulled.
    struct Vault {
        address employer;
        uint64 periodStart;
        bool closed;
        bool arrearsAttested;
        address worker;
        uint64 periodEnd;
        address token;
        uint64 payoutDeadline;
        uint64 fullyFundedAt;
        uint128 wageAmount;
        uint128 funded;
        uint128 withdrawn;
    }

    event VaultOpened(
        uint256 indexed vaultId,
        address indexed employer,
        address indexed worker,
        address token,
        uint256 wageAmount,
        uint64 periodStart,
        uint64 periodEnd,
        uint64 payoutDeadline
    );
    event VaultFunded(uint256 indexed vaultId, address indexed funder, uint256 amount, uint256 totalFunded);
    event Withdrawn(uint256 indexed vaultId, address indexed worker, uint256 amount, uint256 totalWithdrawn);
    event VaultClosed(uint256 indexed vaultId, bool onTime, uint256 refundedToEmployer);
    event VaultMarkedArrears(uint256 indexed vaultId, uint256 shortfall);
    event AttestorSet(address indexed attestor);

    function getVault(uint256 vaultId) external view returns (Vault memory);
    function vaultCount() external view returns (uint256);
    function earned(uint256 vaultId) external view returns (uint256);
    function withdrawable(uint256 vaultId) external view returns (uint256);
    function shortfall(uint256 vaultId) external view returns (uint256);
    function isBreached(uint256 vaultId) external view returns (bool);

    /// @notice Flags a vault as attested. Callable only by the configured ArrearsAttestor.
    function markArrears(uint256 vaultId) external returns (uint256 shortfallAmount);
}
