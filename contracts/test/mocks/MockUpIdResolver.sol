// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IUpIdResolver} from "../../src/interfaces/IUpIdResolver.sol";

/// @title MockUpIdResolver
/// @notice TEST-ONLY double for up.id name resolution.
///
/// @dev Never deployed. Production resolution goes through `src/UpIdResolver.sol`, which
///      reads the real UPNameRegistry at `GiwaConstants.UP_NAME_REGISTRY`
///      (https://docs.giwa.io/network-information/contracts.md).
///
///      This double exists so the EmployerRegistry suite can exercise the
///      resolved / not-resolved / resolver-reverts branches without forking. Its semantics
///      mirror up.id's: one name per address, immutable and non-transferable once claimed —
///      a test can never show behaviour the real registry would not allow.
contract MockUpIdResolver is IUpIdResolver {
    error NameTaken(string name);
    error AlreadyNamed(address owner);
    error EmptyName();

    event NameClaimed(string name, address indexed owner);

    mapping(bytes32 nameHash => address) private _forward;
    mapping(address owner => string) private _reverse;

    /// @notice Claims a name for the caller. One name per address, permanently.
    /// @param name Full up.id name, e.g. "hanuel.up.id".
    function claim(string calldata name) external {
        if (bytes(name).length == 0) revert EmptyName();
        bytes32 h = keccak256(bytes(name));
        if (_forward[h] != address(0)) revert NameTaken(name);
        if (bytes(_reverse[msg.sender]).length != 0) revert AlreadyNamed(msg.sender);

        _forward[h] = msg.sender;
        _reverse[msg.sender] = name;

        emit NameClaimed(name, msg.sender);
    }

    /// @inheritdoc IUpIdResolver
    function resolve(string calldata name) external view returns (address) {
        return _forward[keccak256(bytes(name))];
    }

    /// @inheritdoc IUpIdResolver
    function reverse(address addr) external view returns (string memory) {
        return _reverse[addr];
    }
}
