// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {EmployerRegistry} from "../../src/EmployerRegistry.sol";
import {WageVault} from "../../src/WageVault.sol";
import {ArrearsAttestor} from "../../src/ArrearsAttestor.sol";
import {MockDojangScroll} from "../../src/mocks/MockDojangScroll.sol";
import {GiwaConstants} from "../../src/GiwaConstants.sol";
import {IWageVault} from "../../src/interfaces/IWageVault.sol";
import {VaultHandler} from "./VaultHandler.sol";

/// @notice System-level invariants over randomized multi-vault operation.
contract WageVaultInvariantTest is Test {
    EmployerRegistry internal registry;
    WageVault internal vault;
    ArrearsAttestor internal attestor;
    MockDojangScroll internal dojang;
    VaultHandler internal handler;

    address internal owner = makeAddr("owner");
    address internal employer = makeAddr("inv_employer");
    bytes32 internal constant ATTESTER = GiwaConstants.ATTESTER_TESTNET_FAUCET;

    function setUp() public {
        vm.warp(1_800_000_000);

        dojang = new MockDojangScroll(owner);
        registry = new EmployerRegistry(address(dojang), ATTESTER, owner);
        vault = new WageVault(address(registry), owner);
        attestor = new ArrearsAttestor(address(vault), address(registry), address(dojang), ATTESTER);

        vm.startPrank(owner);
        registry.setRecorder(address(vault), true);
        registry.setRecorder(address(attestor), true);
        vault.setAttestor(address(attestor));
        vm.stopPrank();

        vm.prank(employer);
        dojang.selfVerify(ATTESTER);
        vm.prank(employer);
        registry.register("inv.up.id", "Invariant Co");

        handler = new VaultHandler(vault, attestor, employer);

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = handler.openVault.selector;
        selectors[1] = handler.fund.selector;
        selectors[2] = handler.warp.selector;
        selectors[3] = handler.withdraw.selector;
        selectors[4] = handler.closeVault.selector;
        selectors[5] = handler.attest.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// @dev SOLVENCY: the contract's ETH balance always covers every worker's unwithdrawn
    ///      funded wages. This is the property that makes "one contract, many vaults" safe —
    ///      no vault can ever spend another's escrow.
    function invariant_contractIsSolvent() public view {
        uint256 count = vault.vaultCount();
        uint256 liability;
        for (uint256 id = 1; id <= count; ++id) {
            IWageVault.Vault memory v = vault.getVault(id);
            if (v.token != address(0)) continue;
            // Escrow still owed to the worker = funded - withdrawn (post-close, funded is
            // capped to wageAmount and refunds already left the contract).
            liability += uint256(v.funded) - uint256(v.withdrawn);
        }
        assertGe(address(vault).balance, liability, "vault must hold every worker's funded balance");
    }

    /// @dev Per-vault the three named accounting identities hold at all times.
    function invariant_perVaultAccounting() public view {
        uint256 count = vault.vaultCount();
        for (uint256 id = 1; id <= count; ++id) {
            IWageVault.Vault memory v = vault.getVault(id);
            uint256 earnedNow = vault.earned(id);
            assertLe(v.withdrawn, earnedNow, "withdrawn <= earned");
            assertLe(earnedNow, v.wageAmount, "earned <= wageAmount");
            assertLe(v.withdrawn, v.funded, "withdrawn <= funded");
        }
    }

    /// @dev Conservation: everything deposited is either still escrowed, paid to a worker, or
    ///      refunded to the employer. No ETH is created or destroyed by the protocol.
    function invariant_ethConservation() public view {
        uint256 accountedOut = handler.ghostWithdrawn() + handler.ghostRefunded();
        assertEq(handler.ghostFunded(), address(vault).balance + accountedOut, "funded == held + withdrawn + refunded");
    }

    /// @dev An attested vault always has a recorded arrears entry, and vice versa.
    function invariant_attestationConsistency() public view {
        uint256 count = vault.vaultCount();
        for (uint256 id = 1; id <= count; ++id) {
            bool marked = vault.getVault(id).arrearsAttested;
            bool hasRecord = attestor.recordOfVault(id) != 0;
            assertEq(marked, hasRecord, "arrearsAttested flag <=> evidence record exists");
        }
    }
}
