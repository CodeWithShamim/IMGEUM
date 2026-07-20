// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IEmployerRegistry
/// @notice Read + recorder surface of the employer identity and solvency-history registry.
interface IEmployerRegistry {
    /// @notice A registered employer's profile and payment history.
    /// @param upId Self-declared Upbit Web3 Name, e.g. "acme.up.id". Display only.
    /// @param displayName Human-readable company name shown in the UI and on evidence pages.
    /// @param dojangUid EAS attestation UID proving Dojang Verified Address at registration time.
    /// @param registeredAt Unix timestamp of registration.
    /// @param vaultsOpened Lifetime count of vaults this employer has opened.
    /// @param onTimeCount Vaults closed fully funded by the payout deadline.
    /// @param arrearsCount Vaults that produced an arrears attestation.
    /// @param lastArrearsAt Timestamp of the most recent arrears attestation (0 if never).
    /// @param upIdVerified Whether `upId` was confirmed against a live up.id resolver.
    /// @param active Whether the profile exists and has not been deactivated.
    struct Employer {
        string upId;
        string displayName;
        bytes32 dojangUid;
        uint64 registeredAt;
        uint32 vaultsOpened;
        uint32 onTimeCount;
        uint32 arrearsCount;
        uint64 lastArrearsAt;
        bool upIdVerified;
        bool active;
    }

    /// @notice Emitted when an employer completes Dojang-gated registration.
    event EmployerRegistered(address indexed employer, string upId, string displayName, bytes32 dojangUid);

    /// @notice Emitted when an employer updates their display metadata.
    event EmployerProfileUpdated(address indexed employer, string upId, string displayName, bool upIdVerified);

    /// @notice Emitted when the owner authorises or revokes a history-recording contract.
    event RecorderSet(address indexed recorder, bool allowed);

    /// @notice Emitted when the up.id resolver address is changed (address(0) disables checks).
    event UpIdResolverSet(address indexed resolver);

    /// @notice Emitted whenever an employer's payment history changes.
    /// @param employer The employer whose history moved.
    /// @param onTimeCount New lifetime on-time count.
    /// @param arrearsCount New lifetime arrears count.
    /// @param score The recomputed solvency score, 0-1000.
    event HistoryRecorded(address indexed employer, uint32 onTimeCount, uint32 arrearsCount, uint16 score);

    function register(string calldata upId, string calldata displayName) external;
    function updateProfile(string calldata upId, string calldata displayName) external;

    function recordVaultOpened(address employer) external;
    function recordOnTime(address employer) external;
    function recordArrears(address employer) external;

    function isRegistered(address employer) external view returns (bool);
    function getEmployer(address employer) external view returns (Employer memory);
    function solvencyScore(address employer) external view returns (uint16 score, bool rated);
    function dojangUidOf(address employer) external view returns (bytes32);
}
