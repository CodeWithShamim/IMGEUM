// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IUpIdResolver} from "../interfaces/IUpIdResolver.sol";

/// @title MockUpIdResolver
/// @notice Stand-in for up.id name resolution on GIWA Sepolia.
///
/// @dev SWAP POINT. up.id names are ENS subdomains of `up.id`
///      (https://docs.giwa.io/giwa-ecosystem/up-id.md), so the production read path is plain
///      ENS resolution — the frontend uses viem's ENS helpers and this contract disappears
///      entirely. On-chain, `EmployerRegistry.setUpIdResolver(address(0))` disables name
///      confirmation, which is the correct production setting once ENS resolution moves to
///      the client.
///
///      Names here mirror up.id's real semantics: immutable and non-transferable once
///      claimed, so a demo cannot show a behaviour the real system would not allow.
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
