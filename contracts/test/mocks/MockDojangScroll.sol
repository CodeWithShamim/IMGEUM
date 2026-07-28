// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IDojangVerifier} from "../../src/interfaces/IDojangVerifier.sol";

/// @title MockDojangScroll
/// @notice TEST-ONLY double for GIWA's DojangScroll.
///
/// @dev This contract is never deployed. It lives under `test/` precisely so that it cannot
///      be: `script/Deploy.s.sol` wires the real DojangScroll at
///      `GiwaConstants.DOJANG_SCROLL` (0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9,
///      https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md) on every chain, and there is
///      no deploy-time switch that can substitute this one. A real Verified Address
///      attestation is obtained by the wallet itself at https://sepolia-playground.giwa.io/.
///
///      Its only job is to let the unit and invariant suites drive the verified/unverified
///      state machine deterministically, without forking. Fork coverage against the real
///      DojangScroll lives in `test/fork/GiwaLive.fork.t.sol`.
contract MockDojangScroll is IDojangVerifier {
    error NotOwner();

    /// @notice The live DojangScroll's own error, reproduced byte for byte.
    /// @dev Selector 0x8a1b950b. Observed on GIWA Sepolia: the real contract raises this from
    ///      `getVerifiedAddressAttestationUid` whenever there is no valid attestation, rather
    ///      than returning bytes32(0) as `IDojangVerifier` documents. An earlier version of
    ///      this double returned 0, and that discrepancy hid a live bug where
    ///      `ArrearsAttestor.verifyRecord` reverted for any employer whose attestation had
    ///      lapsed. Keep this faithful: a double that is kinder than production is a trap.
    error AttestationExpired(bytes32 uid, uint64 expiry);

    event MockVerificationSet(address indexed account, bytes32 indexed attesterId, bool verified, bytes32 uid);

    address public immutable OWNER;

    mapping(address account => mapping(bytes32 attesterId => bool)) private _verified;
    mapping(address account => mapping(bytes32 attesterId => bytes32)) private _uids;

    /// @notice Whether any address may mark itself verified in a test.
    bool public openEnrollment = true;

    constructor(address owner_) {
        OWNER = owner_;
    }

    modifier onlyOwner() {
        if (msg.sender != OWNER) revert NotOwner();
        _;
    }

    /// @notice Grants or revokes mock verification for an account.
    /// @param account The wallet to change.
    /// @param attesterId The attester namespace.
    /// @param verified Whether to mark verified.
    function setVerified(address account, bytes32 attesterId, bool verified) external {
        if (!openEnrollment && msg.sender != OWNER) revert NotOwner();

        _verified[account][attesterId] = verified;
        bytes32 uid = verified ? keccak256(abi.encodePacked(account, attesterId, block.chainid)) : bytes32(0);
        _uids[account][attesterId] = uid;

        emit MockVerificationSet(account, attesterId, verified, uid);
    }

    /// @notice Convenience: verifies the caller.
    /// @param attesterId The attester namespace.
    function selfVerify(bytes32 attesterId) external {
        if (!openEnrollment && msg.sender != OWNER) revert NotOwner();
        _verified[msg.sender][attesterId] = true;
        bytes32 uid = keccak256(abi.encodePacked(msg.sender, attesterId, block.chainid));
        _uids[msg.sender][attesterId] = uid;
        emit MockVerificationSet(msg.sender, attesterId, true, uid);
    }

    /// @notice Restricts or reopens self-enrollment.
    /// @param open Whether anyone may self-verify.
    function setOpenEnrollment(bool open) external onlyOwner {
        openEnrollment = open;
    }

    /// @inheritdoc IDojangVerifier
    function isVerified(address primaryAddress, bytes32 attesterId) external view returns (bool) {
        return _verified[primaryAddress][attesterId];
    }

    /// @inheritdoc IDojangVerifier
    /// @dev Reverts when unverified, exactly as the deployed DojangScroll does. See the
    ///      `AttestationExpired` declaration above for why this asymmetry with `isVerified`
    ///      is reproduced rather than smoothed over.
    function getVerifiedAddressAttestationUid(address primaryAddress, bytes32 attesterId)
        external
        view
        returns (bytes32)
    {
        bytes32 uid = _uids[primaryAddress][attesterId];
        if (!_verified[primaryAddress][attesterId]) {
            revert AttestationExpired(uid, uint64(block.timestamp));
        }
        return uid;
    }
}
