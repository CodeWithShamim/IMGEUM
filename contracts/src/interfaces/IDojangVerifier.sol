// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IDojangVerifier
/// @notice The subset of GIWA's DojangScroll that IMGEUM depends on.
/// @dev Sources:
///      - https://docs.giwa.io/giwa-ecosystem/dojang.md
///      - https://docs.giwa.io/giwa-ecosystem/dojang/verified-address.md
///      - https://docs.giwa.io/get-started/smart-contract/onchainverifiable.md
///
///      The OnchainVerifiable page defines the canonical gating interface as:
///
///          interface IVerifier {
///              function isVerified(address addr, DojangAttesterId attesterId)
///                  external view returns (bool);
///          }
///
///      `DojangAttesterId` is a `bytes32` user-defined value type in GIWA's own sources; we
///      declare it as plain `bytes32` so IMGEUM has no compile-time dependency on a GIWA
///      package that is not yet published to npm/soldeer. The ABI encoding is identical, so
///      this interface is call-compatible with the deployed DojangScroll at
///      GiwaConstants.DOJANG_SCROLL.
///
///      DEVIATION FROM BUILD SPEC (§3), flagged per the "docs win" rule:
///      the spec assumed `register(bytes proofOfDojangVerification, ...)` — i.e. the employer
///      submits a proof blob. The docs show Dojang verification is a *pull* check: the
///      contract reads DojangScroll directly for `msg.sender`. There is no proof to pass, and
///      accepting one would be strictly less safe (a caller could submit someone else's
///      proof). EmployerRegistry.register() therefore takes no proof argument.
interface IDojangVerifier {
    /// @notice Returns whether `primaryAddress` holds a live Verified Address attestation
    ///         issued by `attesterId`.
    /// @param primaryAddress The wallet being checked.
    /// @param attesterId The Dojang attester identifier (e.g. GiwaConstants.ATTESTER_UPBIT_KOREA).
    /// @return verified True if a non-revoked, non-expired attestation exists.
    function isVerified(address primaryAddress, bytes32 attesterId) external view returns (bool verified);

    /// @notice Returns the EAS attestation UID backing `primaryAddress`'s verification.
    /// @dev IMGEUM snapshots this UID into every arrears record so a labour office can
    ///      independently re-read the attestation from EAS
    ///      (GiwaConstants.EAS `.getAttestation(uid)`) without trusting IMGEUM.
    /// @param primaryAddress The wallet being checked.
    /// @param attesterId The Dojang attester identifier.
    /// @return uid The attestation UID, or bytes32(0) if unverified.
    function getVerifiedAddressAttestationUid(address primaryAddress, bytes32 attesterId)
        external
        view
        returns (bytes32 uid);
}
