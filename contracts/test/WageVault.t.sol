// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {WageVault} from "../src/WageVault.sol";
import {IWageVault} from "../src/interfaces/IWageVault.sol";
import {IEmployerRegistry} from "../src/interfaces/IEmployerRegistry.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockERC20, FeeOnTransferERC20, RevertingERC20} from "./mocks/TestTokens.sol";
import {ReentrantWorker, RejectingWorker} from "./mocks/Attackers.sol";

contract WageVaultTest is BaseTest {
    /* ------------------------------- openVault ------------------------------ */

    function test_openVault_recordsAndEmits() public {
        uint256 id = _openVault();
        assertEq(id, 1);
        assertEq(vault.vaultCount(), 1);

        IWageVault.Vault memory v = vault.getVault(id);
        assertEq(v.employer, employer);
        assertEq(v.worker, worker);
        assertEq(v.wageAmount, WAGE);
        assertEq(v.funded, 0);

        assertEq(registry.getEmployer(employer).vaultsOpened, 1);
        assertEq(vault.vaultsOfEmployer(employer)[0], 1);
        assertEq(vault.vaultsOfWorker(worker)[0], 1);
    }

    function test_openVault_requiresRegisteredEmployer() public {
        uint64 start = uint64(block.timestamp);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(WageVault.EmployerNotRegistered.selector, stranger));
        vault.openVault(worker, WAGE, start, start + PERIOD, start + PERIOD + SETTLE, address(0));
    }

    function test_openVault_rejectsBadArguments() public {
        uint64 t = uint64(block.timestamp);
        vm.startPrank(employer);

        vm.expectRevert(WageVault.InvalidWorker.selector);
        vault.openVault(address(0), WAGE, t, t + PERIOD, t + PERIOD + SETTLE, address(0));

        vm.expectRevert(WageVault.InvalidWorker.selector);
        vault.openVault(employer, WAGE, t, t + PERIOD, t + PERIOD + SETTLE, address(0));

        vm.expectRevert(WageVault.InvalidWageAmount.selector);
        vault.openVault(worker, 0, t, t + PERIOD, t + PERIOD + SETTLE, address(0));

        // periodEnd not in the future
        vm.expectRevert(WageVault.InvalidPeriod.selector);
        vault.openVault(worker, WAGE, t - 100, t - 1, t + SETTLE, address(0));

        // period too long
        vm.expectRevert(WageVault.PeriodTooLong.selector);
        vault.openVault(worker, WAGE, t, t + 400 days, t + 400 days + SETTLE, address(0));

        // deadline before periodEnd
        vm.expectRevert(WageVault.InvalidDeadline.selector);
        vault.openVault(worker, WAGE, t, t + PERIOD, t + PERIOD - 1, address(0));

        // settlement window too long
        vm.expectRevert(WageVault.InvalidDeadline.selector);
        vault.openVault(worker, WAGE, t, t + PERIOD, t + PERIOD + 31 days, address(0));

        vm.stopPrank();
    }

    /* --------------------------------- fund --------------------------------- */

    function test_fund_native_creditsAndStampsFullyFunded() public {
        uint256 id = _openVault();

        _fundETH(id, WAGE / 2);
        assertEq(vault.getVault(id).funded, WAGE / 2);
        assertEq(vault.getVault(id).fullyFundedAt, 0);

        _fundETH(id, WAGE / 2);
        assertEq(vault.getVault(id).funded, WAGE);
        assertEq(vault.getVault(id).fullyFundedAt, block.timestamp);
    }

    function test_fund_native_rejectsValueMismatch() public {
        uint256 id = _openVault();
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(WageVault.NativeValueMismatch.selector, WAGE, WAGE - 1));
        vault.fund{value: WAGE - 1}(id, WAGE);
    }

    function test_fund_erc20_rejectsStrayNativeValue() public {
        uint256 id = _openVaultFor(worker, WAGE, address(krw));
        vm.prank(employer);
        vm.expectRevert(WageVault.UnexpectedNativeValue.selector);
        vault.fund{value: 1}(id, WAGE);
    }

    function test_fund_anyoneCanFund() public {
        uint256 id = _openVault();
        vm.prank(stranger);
        vault.fund{value: WAGE}(id, WAGE);
        assertEq(vault.getVault(id).funded, WAGE);
    }

    function test_fund_rejectsZero() public {
        uint256 id = _openVault();
        vm.prank(employer);
        vm.expectRevert(WageVault.ZeroFundAmount.selector);
        vault.fund(id, 0);
    }

    /// @dev The whole point of measuring a balance delta: a fee token must credit only what
    ///      actually arrived, or a vault could claim to be funded while holding less.
    function test_fund_feeOnTransfer_creditsActualReceived() public {
        FeeOnTransferERC20 fee = new FeeOnTransferERC20(100); // 1%
        fee.mint(employer, 10 * WAGE);
        vm.prank(employer);
        fee.approve(address(vault), type(uint256).max);

        uint256 id = _openVaultFor(worker, WAGE, address(fee));
        vm.prank(employer);
        vault.fund(id, WAGE);

        assertEq(vault.getVault(id).funded, WAGE - (WAGE / 100), "credited net of fee");
    }

    /* ------------------------------ stream math ----------------------------- */

    function test_earned_isLinearAndClamped() public {
        uint256 id = _openVault();
        assertEq(vault.earned(id), 0);

        vm.warp(block.timestamp + PERIOD / 2);
        assertApproxEqAbs(vault.earned(id), WAGE / 2, 1e18);

        vm.warp(block.timestamp + PERIOD); // well past end
        assertEq(vault.earned(id), WAGE, "clamped at wageAmount");
    }

    function test_earned_zeroBeforeStart() public {
        uint64 start = uint64(block.timestamp) + 1 days;
        vm.prank(employer);
        uint256 id = vault.openVault(worker, WAGE, start, start + PERIOD, start + PERIOD + SETTLE, address(0));
        assertEq(vault.earned(id), 0);
    }

    function test_withdrawable_isMinOfEarnedAndFunded() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE / 4); // funded a quarter

        vm.warp(block.timestamp + PERIOD / 2); // earned half
        // withdrawable is limited by funding, not accrual
        assertEq(vault.withdrawable(id), WAGE / 4);

        _fundETH(id, WAGE); // now fully funded
        assertApproxEqAbs(vault.withdrawable(id), WAGE / 2, 1e18);
    }

    /* ------------------------------- withdraw ------------------------------- */

    function test_withdraw_transfersAndAccounts() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE);
        vm.warp(block.timestamp + PERIOD / 2);

        uint256 balBefore = worker.balance;
        uint256 expected = vault.withdrawable(id);

        vm.prank(worker);
        uint256 got = vault.withdraw(id);

        assertEq(got, expected);
        assertEq(worker.balance - balBefore, expected);
        assertEq(vault.getVault(id).withdrawn, expected);
        assertEq(vault.withdrawable(id), 0, "nothing left immediately after");
    }

    function test_withdraw_onlyWorker() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE);
        vm.warp(block.timestamp + PERIOD);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(WageVault.NotWorker.selector, id, stranger));
        vault.withdraw(id);
    }

    function test_withdraw_revertsWhenNothingAvailable() public {
        uint256 id = _openVault();
        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(WageVault.NothingToWithdraw.selector, id));
        vault.withdraw(id);
    }

    function test_withdraw_erc20Path() public {
        uint256 id = _openVaultFor(worker, WAGE, address(krw));
        _fundERC20(id, WAGE);
        vm.warp(block.timestamp + PERIOD);

        vm.prank(worker);
        vault.withdraw(id);
        assertEq(krw.balanceOf(worker), WAGE);
    }

    function test_withdraw_incrementallyOverStream() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE);

        uint256 totalOut;
        for (uint256 i; i < 4; ++i) {
            vm.warp(block.timestamp + PERIOD / 4);
            vm.prank(worker);
            totalOut += vault.withdraw(id);
        }
        assertApproxEqAbs(totalOut, WAGE, 4);
        assertEq(vault.getVault(id).withdrawn, totalOut);
    }

    /* ----------------------------- reentrancy ------------------------------- */

    function test_withdraw_reentrancyIsBlocked() public {
        ReentrantWorker attacker = new ReentrantWorker(vault);
        uint256 id = _openVaultFor(address(attacker), WAGE, address(0));
        _fundETH(id, WAGE);
        vm.warp(block.timestamp + PERIOD);

        attacker.arm(id);
        attacker.attack();

        // The re-entrant call was attempted and rejected; the attacker got exactly one payout.
        assertEq(attacker.reenterAttempts(), 1);
        assertFalse(attacker.reenterSucceeded());
        assertEq(address(attacker).balance, WAGE);
        assertEq(vault.getVault(id).withdrawn, WAGE);
    }

    function test_withdraw_rejectingWorkerFailsOnlyItself() public {
        RejectingWorker rw = new RejectingWorker(vault);
        uint256 id = _openVaultFor(address(rw), WAGE, address(0));
        _fundETH(id, WAGE);
        vm.warp(block.timestamp + PERIOD);

        vm.expectRevert(); // Address.sendValue bubbles the failed send
        rw.withdraw(id);
    }

    /* ------------------------------ closeVault ------------------------------ */

    function test_close_onTimeRecordsHistoryAndRefundsDust() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE + 1 ether); // overfund by dust

        vm.warp(block.timestamp + PERIOD + 1);
        uint256 empBefore = employer.balance;

        vault.closeVault(id);

        assertTrue(vault.getVault(id).closed);
        assertEq(employer.balance - empBefore, 1 ether, "dust refunded");
        assertEq(registry.getEmployer(employer).onTimeCount, 1);
    }

    function test_close_permissionlessAndBlockedBeforePeriodEnd() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE);

        vm.expectRevert(abi.encodeWithSelector(WageVault.PeriodNotEnded.selector, id));
        vault.closeVault(id);

        vm.warp(block.timestamp + PERIOD + 1);
        vm.prank(stranger); // anyone
        vault.closeVault(id);
        assertTrue(vault.getVault(id).closed);
    }

    function test_close_revertsWithUnsettledShortfallAfterDeadline() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE / 2);

        _warpPastDeadline(id);
        vm.expectRevert(abi.encodeWithSelector(WageVault.UnsettledShortfall.selector, id, WAGE / 2));
        vault.closeVault(id);
    }

    /// @dev A top-up after the deadline must NOT restore an on-time record.
    function test_close_lateFullFundingIsNotOnTime() public {
        uint256 id = _openVault();
        _warpPastDeadline(id);
        _fundETH(id, WAGE); // fully funded, but late

        vault.closeVault(id);
        assertTrue(vault.getVault(id).closed);
        assertEq(registry.getEmployer(employer).onTimeCount, 0, "late funding is not on-time");
    }

    function test_close_doubleCloseReverts() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE);
        vm.warp(block.timestamp + PERIOD + 1);
        vault.closeVault(id);
        vm.expectRevert(abi.encodeWithSelector(WageVault.VaultIsClosed.selector, id));
        vault.closeVault(id);
    }

    function test_withdraw_worksAfterClose() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE);
        vm.warp(block.timestamp + PERIOD + 1);
        vault.closeVault(id);

        // Worker never withdrew during the period; must still be able to claim it all.
        vm.prank(worker);
        uint256 got = vault.withdraw(id);
        assertEq(got, WAGE);
    }

    /* -------------------------------- pausing ------------------------------- */

    function test_pause_blocksOpenAndFundButNotWithdraw() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE);
        vm.warp(block.timestamp + PERIOD / 2);

        vm.prank(owner);
        vault.pause();

        uint64 t = uint64(block.timestamp);
        vm.prank(employer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.openVault(worker, WAGE, t, t + PERIOD, t + PERIOD + SETTLE, address(0));

        vm.prank(employer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.fund{value: 1}(id, 1);

        // Withdrawals remain open — a pause must never strand earned wages.
        vm.prank(worker);
        uint256 got = vault.withdraw(id);
        assertGt(got, 0);
    }

    function test_pause_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.pause();
    }

    /* ------------------------------- attestor ------------------------------- */

    function test_setAttestor_isWriteOnce() public {
        vm.prank(owner);
        vm.expectRevert(WageVault.AttestorAlreadySet.selector);
        vault.setAttestor(stranger);
    }

    function test_markArrears_onlyAttestor() public {
        uint256 id = _openVault();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(WageVault.NotAttestor.selector, stranger));
        vault.markArrears(id);
    }

    /* ------------------------------ view guards ----------------------------- */

    function test_views_revertOnUnknownVault() public {
        vm.expectRevert(abi.encodeWithSelector(WageVault.NoSuchVault.selector, uint256(999)));
        vault.earned(999);
        vm.expectRevert(abi.encodeWithSelector(WageVault.NoSuchVault.selector, uint256(0)));
        vault.getVault(0);
    }

    function test_snapshot_matchesIndividualViews() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE);
        vm.warp(block.timestamp + PERIOD / 3);

        (, uint256 e, uint256 w, uint256 s) = vault.vaultSnapshot(id);
        assertEq(e, vault.earned(id));
        assertEq(w, vault.withdrawable(id));
        assertEq(s, vault.shortfall(id));
    }
}
