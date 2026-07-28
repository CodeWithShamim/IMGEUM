// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {UpIdResolver} from "../src/UpIdResolver.sol";
import {GiwaConstants} from "../src/GiwaConstants.sol";
import {MockUpNameRegistry} from "./mocks/MockUpNameRegistry.sol";

/// @notice Unit coverage for the real up.id adapter.
/// @dev The adapter's contract with the rest of IMGEUM is: never revert, and never return a
///      non-zero address that isn't the live, active holder of that exact name. Everything
///      below is a way of trying to break one of those two promises.
///      Live-chain coverage against the real registry is in test/fork/GiwaLive.fork.t.sol.
contract UpIdResolverTest is Test {
    MockUpNameRegistry internal registry;
    UpIdResolver internal resolver;

    address internal hanuel = makeAddr("hanuel");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        registry = new MockUpNameRegistry();
        resolver = new UpIdResolver(address(registry));
        registry.issue(hanuel, "hanuel");
    }

    /* ------------------------------- construction ---------------------------- */

    function test_constructor_storesRegistry() public view {
        assertEq(address(resolver.REGISTRY()), address(registry));
    }

    function test_constructor_revertsOnZeroRegistry() public {
        vm.expectRevert(UpIdResolver.ZeroRegistry.selector);
        new UpIdResolver(address(0));
    }

    /* --------------------------------- resolve ------------------------------- */

    function test_resolve_returnsHolder() public view {
        assertEq(resolver.resolve("hanuel.up.id"), hanuel);
    }

    function test_resolve_unregisteredName() public view {
        assertEq(resolver.resolve("nobody.up.id"), address(0));
    }

    /// @dev A bare label is not a name. Accepting it would let "hanuel" and "hanuel.up.id"
    ///      both verify, and the registry only ever issues the suffixed form to a worker's eye.
    function test_resolve_rejectsBareLabel() public view {
        assertEq(resolver.resolve("hanuel"), address(0));
    }

    function test_resolve_rejectsWrongSuffix() public {
        registry.issue(hanuel, "hanuel.up");
        assertEq(resolver.resolve("hanuel.up.io"), address(0));
        assertEq(resolver.resolve("hanuel.up"), address(0));
        assertEq(resolver.resolve("hanuel.upid"), address(0));
    }

    /// @dev up.id issues one level only. A nested name must not resolve, or "pay.acme.up.id"
    ///      could be presented as if it belonged to "acme.up.id".
    function test_resolve_rejectsNestedLabel() public {
        registry.issue(stranger, "pay.acme");
        assertEq(resolver.resolve("pay.acme.up.id"), address(0));
    }

    function test_resolve_rejectsSuffixOnlyAndEmpty() public view {
        assertEq(resolver.resolve(".up.id"), address(0));
        assertEq(resolver.resolve(""), address(0));
        assertEq(resolver.resolve("up.id"), address(0));
    }

    /// @dev Labels are hashed exactly as the registry hashes them, so case matters.
    function test_resolve_isCaseSensitive() public view {
        assertEq(resolver.resolve("Hanuel.up.id"), address(0));
    }

    /// @dev A lapsed name (Dojang verification expired past the grace period) must stop
    ///      conferring a verified badge immediately.
    function test_resolve_rejectsLapsedName() public {
        registry.setLapsed(hanuel, true);
        assertEq(resolver.resolve("hanuel.up.id"), address(0));
    }

    /// @dev Forward entry says `stranger` holds "ghost"; the reverse index disagrees. The
    ///      adapter must trust neither half on its own.
    function test_resolve_rejectsStaleForwardEntry() public {
        registry.setForwardOnly("ghost", stranger);
        assertEq(resolver.resolve("ghost.up.id"), address(0));
    }

    function test_resolve_returnsZeroWhenRegistryReverts() public {
        registry.setBricked(true);
        assertEq(resolver.resolve("hanuel.up.id"), address(0));
    }

    /* --------------------------------- reverse ------------------------------- */

    function test_reverse_returnsFullName() public view {
        assertEq(resolver.reverse(hanuel), "hanuel.up.id");
    }

    function test_reverse_unnamedAddress() public view {
        assertEq(resolver.reverse(stranger), "");
    }

    function test_reverse_zeroAddress() public view {
        assertEq(resolver.reverse(address(0)), "");
    }

    function test_reverse_lapsedName() public {
        registry.setLapsed(hanuel, true);
        assertEq(resolver.reverse(hanuel), "");
    }

    function test_reverse_returnsEmptyWhenRegistryReverts() public {
        registry.setBricked(true);
        assertEq(resolver.reverse(hanuel), "");
    }

    /* -------------------------------- round trip ----------------------------- */

    /// @dev `reverse` must emit exactly the form `resolve` accepts, so a UI can display the
    ///      name it got back and IMGEUM can re-verify that same string later.
    function testFuzz_roundTrip(address holder, string calldata label) public {
        vm.assume(holder != address(0));
        bytes memory raw = bytes(label);
        vm.assume(raw.length > 0 && raw.length < 64);
        for (uint256 i = 0; i < raw.length; ++i) {
            vm.assume(raw[i] != 0x2e); // no dots: the registry does not issue nested labels
        }

        registry.issue(holder, label);

        string memory full = resolver.reverse(holder);
        assertEq(full, string.concat(label, ".up.id"));
        assertEq(resolver.resolve(full), holder);
    }

    /// @dev No input, however malformed, may revert: `EmployerRegistry.register()` sits
    ///      directly behind this call, and payroll must not be blockable by a bad name.
    function testFuzz_resolveNeverReverts(string calldata name) public view {
        resolver.resolve(name);
    }

    /* ------------------------------- constants ------------------------------- */

    /// @dev Guards the documented address against an accidental edit.
    ///      Source: https://docs.giwa.io/network-information/contracts.md
    function test_upNameRegistryConstant() public pure {
        assertEq(GiwaConstants.UP_NAME_REGISTRY, 0x091D00004f21eb2Fc30964A8a4995692d9b49628);
    }
}
