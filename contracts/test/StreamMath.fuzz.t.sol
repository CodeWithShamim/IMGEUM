// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {IWageVault} from "../src/interfaces/IWageVault.sol";

/// @notice Fuzz the stream accounting identities the whole protocol rests on.
/// @dev These are the invariants named in the build spec:
///        withdrawn <= earned <= wageAmount
///        funded    >= withdrawn
///      expressed as properties over randomized amounts, periods, and funding schedules.
contract StreamMathFuzzTest is BaseTest {
    /// @dev earned() is monotonic non-decreasing in time and never exceeds wageAmount.
    function testFuzz_earned_monotonicAndCapped(uint128 amount, uint32 period, uint32 t1, uint32 t2) public {
        amount = uint128(bound(amount, 1, type(uint128).max));
        period = uint32(bound(period, 1 hours, uint32(vault.MAX_PERIOD())));
        uint256 dt1 = bound(t1, 0, period + 10 days);
        uint256 dt2 = bound(t2, dt1, period + 10 days);

        uint64 start = uint64(block.timestamp);
        uint64 end = start + period;
        vm.prank(employer);
        uint256 id = vault.openVault(worker, amount, start, end, end + SETTLE, address(0));

        vm.warp(start + dt1);
        uint256 e1 = vault.earned(id);
        vm.warp(start + dt2);
        uint256 e2 = vault.earned(id);

        assertLe(e1, e2, "earned must be monotonic in time");
        assertLe(e2, amount, "earned must never exceed wageAmount");
        if (block.timestamp >= end) assertEq(e2, amount, "earned == wage after period end");
    }

    /// @dev The central safety property: after an arbitrary interleaving of funds and
    ///      withdrawals, `withdrawn <= earned <= wageAmount` and `funded >= withdrawn`.
    function testFuzz_invariantsHoldAcrossFundWithdraw(
        uint128 amount,
        uint32 period,
        uint32[5] memory steps,
        uint128[5] memory funds
    ) public {
        amount = uint128(bound(amount, 1e6, 1e30));
        period = uint32(bound(period, 1 days, uint32(vault.MAX_PERIOD())));

        // Up to `amount` may be funded on each of the 5 steps, so the employer needs headroom
        // for 5x plus slack — otherwise the test itself reverts with OutOfFunds.
        vm.deal(employer, uint256(amount) * 6);

        uint64 start = uint64(block.timestamp);
        uint64 end = start + period;
        vm.prank(employer);
        uint256 id = vault.openVault(worker, amount, start, end, end + SETTLE, address(0));

        for (uint256 i; i < 5; ++i) {
            vm.warp(block.timestamp + bound(steps[i], 0, period / 4));

            uint256 f = bound(funds[i], 0, amount);
            if (f > 0 && !vault.getVault(id).closed) {
                vm.prank(employer);
                vault.fund{value: f}(id, f);
            }

            uint256 w = vault.withdrawable(id);
            if (w > 0) {
                vm.prank(worker);
                vault.withdraw(id);
            }

            IWageVault.Vault memory v = vault.getVault(id);
            uint256 earnedNow = vault.earned(id);

            assertLe(v.withdrawn, earnedNow, "withdrawn <= earned");
            assertLe(earnedNow, v.wageAmount, "earned <= wageAmount");
            assertLe(v.withdrawn, v.funded, "withdrawn <= funded");
        }
    }

    /// @dev A worker can never extract more in total than min(earned, funded) at any point.
    function testFuzz_cannotWithdrawMoreThanFunded(uint128 amount, uint32 fundFraction, uint32 elapsed) public {
        amount = uint128(bound(amount, 1e6, 1e30));
        uint256 fundAmt = bound(fundFraction, 0, amount);
        vm.deal(employer, amount);

        uint64 start = uint64(block.timestamp);
        uint64 end = start + PERIOD;
        vm.prank(employer);
        uint256 id = vault.openVault(worker, amount, start, end, end + SETTLE, address(0));

        if (fundAmt > 0) {
            vm.prank(employer);
            vault.fund{value: fundAmt}(id, fundAmt);
        }

        vm.warp(start + bound(elapsed, 0, 2 * PERIOD));

        uint256 w = vault.withdrawable(id);
        if (w > 0) {
            vm.prank(worker);
            vault.withdraw(id);
        }
        assertLe(vault.getVault(id).withdrawn, fundAmt, "cannot withdraw beyond funded");
    }

    /// @dev shortfall is exactly earned - funded (floored), and zero once fully funded.
    function testFuzz_shortfallConsistency(uint128 amount, uint32 fundFraction, uint32 elapsed) public {
        amount = uint128(bound(amount, 1e6, 1e30));
        uint256 fundAmt = bound(fundFraction, 0, amount);
        vm.deal(employer, amount);

        uint64 start = uint64(block.timestamp);
        uint64 end = start + PERIOD;
        vm.prank(employer);
        uint256 id = vault.openVault(worker, amount, start, end, end + SETTLE, address(0));

        if (fundAmt > 0) {
            vm.prank(employer);
            vault.fund{value: fundAmt}(id, fundAmt);
        }
        vm.warp(start + bound(elapsed, 0, 2 * PERIOD));

        uint256 earnedNow = vault.earned(id);
        uint256 expected = earnedNow > fundAmt ? earnedNow - fundAmt : 0;
        assertEq(vault.shortfall(id), expected);
        if (fundAmt >= amount) assertEq(vault.shortfall(id), 0, "fully funded => no shortfall ever");
    }
}
