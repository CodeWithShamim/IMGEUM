// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {EmployerRegistry} from "../src/EmployerRegistry.sol";
import {WageVault} from "../src/WageVault.sol";
import {ArrearsAttestor} from "../src/ArrearsAttestor.sol";
import {MockDojangScroll} from "../src/mocks/MockDojangScroll.sol";
import {MockUpIdResolver} from "../src/mocks/MockUpIdResolver.sol";
import {GiwaConstants} from "../src/GiwaConstants.sol";
import {MockERC20} from "./mocks/TestTokens.sol";

/// @notice Shared fixture: a fully wired IMGEUM deployment with one verified employer.
abstract contract BaseTest is Test {
    EmployerRegistry internal registry;
    WageVault internal vault;
    ArrearsAttestor internal attestor;
    MockDojangScroll internal dojang;
    MockUpIdResolver internal upid;
    MockERC20 internal krw;

    address internal owner = makeAddr("owner");
    address internal employer = makeAddr("employer");
    address internal worker = makeAddr("worker");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant ATTESTER = GiwaConstants.ATTESTER_TESTNET_FAUCET;

    uint256 internal constant WAGE = 3_000_000e18; // ~3,000,000 KRW monthly wage
    uint64 internal constant PERIOD = 30 days;
    uint64 internal constant SETTLE = 3 days;

    function setUp() public virtual {
        // A fixed, non-zero start: `block.timestamp == 1` in a fresh EVM makes period
        // arithmetic accidentally pass and hides off-by-one bugs at the lower clamp.
        vm.warp(1_800_000_000);

        dojang = new MockDojangScroll(owner);
        upid = new MockUpIdResolver();
        krw = new MockERC20("KRW Stablecoin", "KRWS", 18);

        registry = new EmployerRegistry(address(dojang), ATTESTER, owner);
        vault = new WageVault(address(registry), owner);
        attestor = new ArrearsAttestor(address(vault), address(registry), address(dojang), ATTESTER);

        vm.startPrank(owner);
        registry.setRecorder(address(vault), true);
        registry.setRecorder(address(attestor), true);
        vault.setAttestor(address(attestor));
        vm.stopPrank();

        _registerEmployer(employer, "acme.up.id", unicode"주식회사 아크메");

        vm.deal(employer, 100 * WAGE);
        vm.deal(stranger, 100 * WAGE);
        krw.mint(employer, 100 * WAGE);
        vm.prank(employer);
        krw.approve(address(vault), type(uint256).max);
    }

    /* ------------------------------- helpers -------------------------------- */

    function _registerEmployer(address who, string memory upId, string memory name) internal {
        vm.prank(who);
        dojang.selfVerify(ATTESTER);
        vm.prank(who);
        registry.register(upId, name);
    }

    /// @dev Opens a native-ETH vault starting now, running for PERIOD, settling SETTLE later.
    function _openVault() internal returns (uint256) {
        return _openVaultFor(worker, WAGE, address(0));
    }

    function _openVaultFor(address w, uint256 amount, address token) internal returns (uint256) {
        uint64 start = uint64(block.timestamp);
        uint64 end = start + PERIOD;
        vm.prank(employer);
        return vault.openVault(w, amount, start, end, end + SETTLE, token);
    }

    function _fundETH(uint256 vaultId, uint256 amount) internal {
        vm.prank(employer);
        vault.fund{value: amount}(vaultId, amount);
    }

    function _fundERC20(uint256 vaultId, uint256 amount) internal {
        vm.prank(employer);
        vault.fund(vaultId, amount);
    }

    /// @dev Advances to just past the payout deadline of a standard vault.
    function _warpPastDeadline(uint256 vaultId) internal {
        vm.warp(vault.getVault(vaultId).payoutDeadline + 1);
    }
}
