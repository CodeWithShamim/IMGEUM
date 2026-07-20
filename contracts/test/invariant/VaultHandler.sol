// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";

import {WageVault} from "../../src/WageVault.sol";
import {ArrearsAttestor} from "../../src/ArrearsAttestor.sol";
import {IWageVault} from "../../src/interfaces/IWageVault.sol";

/// @notice Drives WageVault through randomized fund/withdraw/close/attest sequences on a set
///         of native-ETH vaults, tracking ghost totals the invariant suite checks against.
contract VaultHandler is CommonBase, StdCheats, StdUtils {
    WageVault public immutable vault;
    ArrearsAttestor public immutable attestor;
    address public immutable employer;

    uint256[] public vaultIds;
    mapping(uint256 => address) public workerOf;

    // Ghost accounting.
    uint256 public ghostFunded; // total ETH ever deposited
    uint256 public ghostWithdrawn; // total ETH ever paid to workers
    uint256 public ghostRefunded; // total ETH refunded to employer on close

    uint64 internal constant PERIOD = 30 days;
    uint64 internal constant SETTLE = 3 days;

    constructor(WageVault vault_, ArrearsAttestor attestor_, address employer_) {
        vault = vault_;
        attestor = attestor_;
        employer = employer_;
        vm.deal(employer, type(uint192).max);
    }

    function _pickVault(uint256 seed) internal view returns (uint256 id, bool ok) {
        if (vaultIds.length == 0) return (0, false);
        return (vaultIds[seed % vaultIds.length], true);
    }

    function openVault(uint256 wageSeed) external {
        uint256 wage = bound(wageSeed, 1e6, 1e28);
        address worker = address(uint160(uint256(keccak256(abi.encode(wageSeed, vaultIds.length, "w")))));
        if (worker == address(0) || worker == employer) return;

        uint64 start = uint64(block.timestamp);
        uint64 end = start + PERIOD;
        vm.prank(employer);
        try vault.openVault(worker, wage, start, end, end + SETTLE, address(0)) returns (uint256 id) {
            vaultIds.push(id);
            workerOf[id] = worker;
        } catch {}
    }

    function fund(uint256 seed, uint256 amtSeed) external {
        (uint256 id, bool ok) = _pickVault(seed);
        if (!ok) return;
        IWageVault.Vault memory v = vault.getVault(id);
        if (v.closed) return;

        uint256 amt = bound(amtSeed, 1, uint256(v.wageAmount));
        vm.prank(employer);
        try vault.fund{value: amt}(id, amt) {
            ghostFunded += amt;
        } catch {}
    }

    function warp(uint256 dtSeed) external {
        vm.warp(block.timestamp + bound(dtSeed, 1 hours, 10 days));
    }

    function withdraw(uint256 seed) external {
        (uint256 id, bool ok) = _pickVault(seed);
        if (!ok) return;
        address worker = workerOf[id];
        uint256 w = vault.withdrawable(id);
        if (w == 0) return;

        uint256 before = worker.balance;
        vm.prank(worker);
        try vault.withdraw(id) {
            ghostWithdrawn += worker.balance - before;
        } catch {}
    }

    function closeVault(uint256 seed) external {
        (uint256 id, bool ok) = _pickVault(seed);
        if (!ok) return;
        IWageVault.Vault memory v = vault.getVault(id);
        if (v.closed || block.timestamp < v.periodEnd) return;

        uint256 before = employer.balance;
        try vault.closeVault(id) {
            ghostRefunded += employer.balance - before;
        } catch {}
    }

    function attest(uint256 seed) external {
        (uint256 id, bool ok) = _pickVault(seed);
        if (!ok) return;
        if (!vault.isBreached(id)) return;
        try attestor.attestArrears(id) {} catch {}
    }

    function vaultCount() external view returns (uint256) {
        return vaultIds.length;
    }
}
