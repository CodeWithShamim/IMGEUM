// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IUpNameRegistry} from "../../src/interfaces/IUpNameRegistry.sol";

/// @title MockUpNameRegistry
/// @notice TEST-ONLY double for GIWA's live UPNameRegistry.
///
/// @dev Never deployed. `src/UpIdResolver.sol` always points at the real registry at
///      `GiwaConstants.UP_NAME_REGISTRY`; this double exists so the adapter's branches —
///      lapsed names, a reverse index that disagrees with the forward one, a registry that
///      reverts outright — can be driven deterministically without forking.
///
///      Behaviour is copied from the deployed contract as observed on GIWA Sepolia:
///        - `tokenId == uint256(keccak256(bytes(label)))`, labels are bare ("hanuel").
///        - `ownerOf` on an unregistered id returns `address(0)` rather than reverting.
contract MockUpNameRegistry is IUpNameRegistry {
    mapping(uint256 tokenId => address) private _owners;
    mapping(address owner => uint256) private _owned;
    mapping(bytes32 labelHash => string) private _labels;
    mapping(address owner => bool) private _inactive;

    /// @notice When true, every view reverts — simulates a broken or migrated registry.
    bool public bricked;

    /// @notice Issues `label` to `owner`, exactly as `register(string)` would.
    function issue(address owner, string memory label) external returns (uint256 tokenId) {
        tokenId = uint256(keccak256(bytes(label)));
        _owners[tokenId] = owner;
        _owned[owner] = tokenId;
        _labels[bytes32(tokenId)] = label;
    }

    /// @notice Marks `owner`'s name lapsed (Dojang verification expired past the grace period).
    function setLapsed(address owner, bool lapsed) external {
        _inactive[owner] = lapsed;
    }

    /// @notice Points the forward entry for `label` at `owner` WITHOUT updating the reverse
    ///         index — the stale-forward-entry case `UpIdResolver.resolve` must reject.
    function setForwardOnly(string memory label, address owner) external {
        _owners[uint256(keccak256(bytes(label)))] = owner;
    }

    /// @notice Makes every view revert.
    function setBricked(bool b) external {
        bricked = b;
    }

    modifier live() {
        require(!bricked, "registry bricked");
        _;
    }

    /// @inheritdoc IUpNameRegistry
    function ownerOf(uint256 tokenId) external view live returns (address) {
        return _owners[tokenId];
    }

    /// @inheritdoc IUpNameRegistry
    function ownedTokenId(address owner) external view live returns (uint256) {
        return _owned[owner];
    }

    /// @inheritdoc IUpNameRegistry
    function hasActiveName(address owner) external view live returns (bool) {
        return _owned[owner] != 0 && !_inactive[owner];
    }

    /// @inheritdoc IUpNameRegistry
    function getLabel(bytes32 labelHash) external view live returns (string memory) {
        return _labels[labelHash];
    }
}
