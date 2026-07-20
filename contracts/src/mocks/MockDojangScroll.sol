// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IDojangVerifier} from "../interfaces/IDojangVerifier.sol";

/// @title MockDojangScroll
/// @notice Stand-in for GIWA's DojangScroll, for local tests and the GIWA Sepolia demo.
///
/// @dev THIS IS THE SWAP POINT — read this before demoing anything.
///
///      The real DojangScroll is live on GIWA Sepolia at
///      0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9
///      (https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md) and IMGEUM's contracts
///      call it through the identical `IDojangVerifier` interface. Nothing in
///      EmployerRegistry or ArrearsAttestor knows which of the two it is talking to.
///
///      This mock exists for exactly one reason: a Verified Address attestation is issued to
///      a *person* by Upbit Korea after real KYC. A demo wallet on a testnet cannot obtain
///      one on demand, so a live-Dojang deployment would leave the demo unable to register a
///      single employer.
///
///      Deployment policy, enforced in script/Deploy.s.sol:
///        - DOJANG_MODE=live  -> wires the real DojangScroll address above. Use this for any
///                               deployment whose registrations are meant to mean something.
///        - DOJANG_MODE=mock  -> deploys this contract. Demo only.
///      The deploy script writes the chosen mode into deployments/<chainId>.json, and the
///      frontend reads it and renders an explicit "MOCK VERIFICATION" banner on every
///      employer badge and evidence page. The demo never silently claims real KYC.
contract MockDojangScroll is IDojangVerifier {
    error NotOwner();

    event MockVerificationSet(address indexed account, bytes32 indexed attesterId, bool verified, bytes32 uid);

    address public immutable OWNER;

    mapping(address account => mapping(bytes32 attesterId => bool)) private _verified;
    mapping(address account => mapping(bytes32 attesterId => bytes32)) private _uids;

    /// @notice Anyone may self-verify in the demo. Set false to restrict to the owner.
    /// @dev Open by default so a judge can register an employer from their own wallet at the
    ///      demo booth without us pre-seeding their address.
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
    function getVerifiedAddressAttestationUid(address primaryAddress, bytes32 attesterId)
        external
        view
        returns (bytes32)
    {
        return _uids[primaryAddress][attesterId];
    }
}
