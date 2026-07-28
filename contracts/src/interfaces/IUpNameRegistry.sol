// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IUpNameRegistry
/// @notice The subset of GIWA's real UPNameRegistry ("Upbit Web3 Names") that IMGEUM reads.
/// @dev Address: `GiwaConstants.UP_NAME_REGISTRY`
///      (0x091D00004f21eb2Fc30964A8a4995692d9b49628), listed at
///      https://docs.giwa.io/network-information/contracts.md and used by the GIWA Playground
///      (https://sepolia-playground.giwa.io/) to issue `username.up.id` names.
///
///      Semantics confirmed by reading the deployed contract on GIWA Sepolia:
///        - It is an ERC-721 whose `name()` is "Upbit Web3 Names" / `symbol()` "UPNAME".
///        - `register(string label)` takes the BARE label ("hanuel"), not "hanuel.up.id".
///        - `tokenId == uint256(keccak256(bytes(label)))`, so a label maps to its token
///          without any registry lookup.
///        - `getLabel(bytes32 labelHash)` returns the label back.
///        - `ownedTokenId(address)` / `hasActiveName(address)` give reverse resolution;
///          one name per address, with a `gracePeriod()` after Dojang verification lapses.
///        - `ownerOf` on an unregistered id returns `address(0)` rather than reverting.
///        - The registry itself gates on the same `dojangScroll()` and `attesterId()` IMGEUM
///          uses, so a name and an employer registration attest to the same identity.
///
///      Only view functions are declared here: IMGEUM never registers names on a worker's or
///      employer's behalf. Name issuance happens in the GIWA Playground, off IMGEUM's path.
interface IUpNameRegistry {
    /// @notice ERC-721 owner of `tokenId`, or `address(0)` if unregistered.
    function ownerOf(uint256 tokenId) external view returns (address owner);

    /// @notice The token id of the name currently held by `owner`, or 0 if none.
    function ownedTokenId(address owner) external view returns (uint256 tokenId);

    /// @notice Whether `owner` holds a name that is currently active (not lapsed/revoked).
    function hasActiveName(address owner) external view returns (bool active);

    /// @notice The bare label behind `labelHash` (== `bytes32(tokenId)`), or "" if unknown.
    function getLabel(bytes32 labelHash) external view returns (string memory label);
}
