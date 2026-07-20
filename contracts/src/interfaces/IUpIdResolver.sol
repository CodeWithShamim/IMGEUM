// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IUpIdResolver
/// @notice Minimal forward/reverse resolution for Upbit Web3 Names (`name.up.id`).
/// @dev Source: https://docs.giwa.io/giwa-ecosystem/up-id.md
///
///      What the docs establish:
///      - up.id names are ENS subdomains of the `up.id` domain, registered "over the ENS
///        protocol", so "all libraries and tools that support ENS" resolve them. In practice
///        the frontend resolves via viem's ENS helpers against the ENS Universal Resolver —
///        no IMGEUM-specific contract is involved on the read path.
///      - Names are issued only to Verified Address holders, are non-transferable SBTs, and
///        are immutable once registered (30-day grace period if verification lapses).
///
///      What the docs do NOT publish (as of the build date): a resolver contract address on
///      GIWA Sepolia, or a Solidity interface. Per build spec §2 we therefore define this
///      thin interface ourselves and ship MockUpIdResolver behind it for the demo.
///
///      IMPORTANT — this is deliberately NOT on the critical path. Because a up.id name is
///      immutable and non-transferable but the *resolver deployment* is not yet public,
///      EmployerRegistry stores the employer's up.id string as a self-declared display
///      label and marks it `upIdVerified = false` when no resolver is configured. Wage
///      routing, funding, withdrawal and arrears attestation all key off raw addresses and
///      never off a name. A wrong or squatted name can therefore never misdirect money — the
///      worst case is a cosmetically wrong label, which the UI renders in an unverified
///      state. See ARCHITECTURE.md § "up.id integration and its swap point".
interface IUpIdResolver {
    /// @notice Forward-resolves a full up.id name to an address.
    /// @param name The full name, e.g. "hanuel.up.id".
    /// @return owner The resolved address, or address(0) if unregistered.
    function resolve(string calldata name) external view returns (address owner);

    /// @notice Reverse-resolves an address to its primary up.id name.
    /// @param addr The address to look up.
    /// @return name The primary name, or "" if none is set.
    function reverse(address addr) external view returns (string memory name);
}
