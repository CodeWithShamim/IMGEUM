// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {EmployerRegistry} from "../src/EmployerRegistry.sol";
import {IEmployerRegistry} from "../src/interfaces/IEmployerRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract EmployerRegistryTest is BaseTest {
    address internal e2 = makeAddr("employer2");

    /* ----------------------------- registration ----------------------------- */

    function test_register_gatedOnDojang() public {
        vm.prank(e2);
        vm.expectRevert(abi.encodeWithSelector(EmployerRegistry.NotDojangVerified.selector, e2));
        registry.register("e2.up.id", "E2");
    }

    function test_register_succeedsWhenVerified() public {
        vm.prank(e2);
        dojang.selfVerify(ATTESTER);

        vm.prank(e2);
        registry.register("e2.up.id", unicode"이투 주식회사");

        IEmployerRegistry.Employer memory e = registry.getEmployer(e2);
        assertTrue(e.active);
        assertEq(e.displayName, unicode"이투 주식회사");
        assertEq(e.upId, "e2.up.id");
        assertTrue(registry.isRegistered(e2));
    }

    /// @dev The registration-time UID must be snapshotted, not read live — an evidence page
    ///      has to cite the attestation that existed when the vault opened.
    function test_register_snapshotsDojangUid() public {
        bytes32 expected = dojang.getVerifiedAddressAttestationUid(employer, ATTESTER);
        assertTrue(expected != bytes32(0));
        assertEq(registry.dojangUidOf(employer), expected);

        vm.prank(owner);
        dojang.setVerified(employer, ATTESTER, false);

        // Snapshot survives revocation; the live check reflects it.
        assertEq(registry.dojangUidOf(employer), expected);
        assertFalse(registry.isCurrentlyDojangVerified(employer));
    }

    function test_register_revertsOnDoubleRegistration() public {
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(EmployerRegistry.AlreadyRegistered.selector, employer));
        registry.register("x.up.id", "X");
    }

    function test_register_rejectsEmptyAndOversizedStrings() public {
        vm.prank(e2);
        dojang.selfVerify(ATTESTER);

        vm.prank(e2);
        vm.expectRevert(EmployerRegistry.EmptyString.selector);
        registry.register("e2.up.id", "");

        string memory tooLong = new string(257);
        vm.prank(e2);
        vm.expectRevert(EmployerRegistry.StringTooLong.selector);
        registry.register("e2.up.id", tooLong);
    }

    function test_updateProfile_requiresRegistration() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(EmployerRegistry.NotRegistered.selector, stranger));
        registry.updateProfile("a.up.id", "A");
    }

    function test_updateProfile_changesMetadataOnly() public {
        vm.prank(employer);
        registry.updateProfile("acme2.up.id", unicode"아크메 2");

        IEmployerRegistry.Employer memory e = registry.getEmployer(employer);
        assertEq(e.displayName, unicode"아크메 2");
        assertEq(e.vaultsOpened, 0);
        assertTrue(e.active);
    }

    /* -------------------------------- up.id --------------------------------- */

    function test_upId_unverifiedWhenNoResolverConfigured() public view {
        assertFalse(registry.getEmployer(employer).upIdVerified);
    }

    function test_upId_verifiedWhenResolverAgrees() public {
        vm.prank(owner);
        registry.setUpIdResolver(address(upid));

        vm.prank(e2);
        upid.claim("e2.up.id");
        vm.prank(e2);
        dojang.selfVerify(ATTESTER);
        vm.prank(e2);
        registry.register("e2.up.id", "E2");

        assertTrue(registry.getEmployer(e2).upIdVerified);
    }

    function test_upId_notVerifiedWhenNameBelongsToSomeoneElse() public {
        vm.prank(owner);
        registry.setUpIdResolver(address(upid));

        vm.prank(stranger);
        upid.claim("squatted.up.id");

        vm.prank(e2);
        dojang.selfVerify(ATTESTER);
        vm.prank(e2);
        registry.register("squatted.up.id", "Impostor");

        // Registration still succeeds — a name is cosmetic — but is flagged unverified.
        assertTrue(registry.isRegistered(e2));
        assertFalse(registry.getEmployer(e2).upIdVerified);
    }

    /// @dev A hostile or broken resolver must never be able to brick payroll registration.
    function test_upId_hostileResolverCannotBlockRegistration() public {
        AlwaysRevertingResolver bad = new AlwaysRevertingResolver();
        vm.prank(owner);
        registry.setUpIdResolver(address(bad));

        vm.prank(e2);
        dojang.selfVerify(ATTESTER);
        vm.prank(e2);
        registry.register("e2.up.id", "E2");

        assertTrue(registry.isRegistered(e2));
        assertFalse(registry.getEmployer(e2).upIdVerified);
    }

    /* ------------------------------- recorders ------------------------------ */

    function test_recorders_rejectUnauthorisedCallers() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(EmployerRegistry.NotRecorder.selector, stranger));
        registry.recordArrears(employer);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(EmployerRegistry.NotRecorder.selector, stranger));
        registry.recordOnTime(employer);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(EmployerRegistry.NotRecorder.selector, stranger));
        registry.recordVaultOpened(employer);
    }

    function test_setRecorder_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        registry.setRecorder(stranger, true);
    }

    function test_setRecorder_rejectsZero() public {
        vm.prank(owner);
        vm.expectRevert(EmployerRegistry.ZeroAddress.selector);
        registry.setRecorder(address(0), true);
    }

    function test_recorder_revertsForUnregisteredEmployer() public {
        vm.prank(owner);
        registry.setRecorder(address(this), true);

        vm.expectRevert(abi.encodeWithSelector(EmployerRegistry.NotRegistered.selector, stranger));
        registry.recordOnTime(stranger);
    }

    /* ----------------------------- solvency score ---------------------------- */

    function test_score_unratedWithNoHistory() public view {
        (uint16 score, bool rated) = registry.solvencyScore(employer);
        assertEq(score, 0);
        assertFalse(rated);
    }

    function test_score_perfectHistory() public {
        _record(3, 0);
        (uint16 score, bool rated) = registry.solvencyScore(employer);
        assertEq(score, 1000);
        assertTrue(rated);
    }

    function test_score_unratedBelowMinimumSettled() public {
        _record(2, 0);
        (uint16 score, bool rated) = registry.solvencyScore(employer);
        assertEq(score, 1000);
        assertFalse(rated, "two settled vaults is not enough history to rate");
    }

    /// @dev The core reason the score has two terms: a long clean history must not let a
    ///      fresh breach hide. 19 on-time + 1 arrears is a 950 ratio, but the breach is today.
    function test_score_freshBreachDominatesLongCleanHistory() public {
        _record(19, 0);
        (uint16 before,) = registry.solvencyScore(employer);
        assertEq(before, 1000);

        _record(0, 1);
        (uint16 after_,) = registry.solvencyScore(employer);

        assertEq(after_, 650, "950 ratio - 300 full recency penalty");
        assertLt(after_, before);
    }

    function test_score_recencyPenaltyDecaysLinearlyToZero() public {
        _record(19, 0);
        _record(0, 1);

        uint64 window = registry.RECENCY_WINDOW();

        (uint16 atZero,) = registry.solvencyScore(employer);
        assertEq(atZero, 650);

        vm.warp(block.timestamp + window / 2);
        (uint16 atHalf,) = registry.solvencyScore(employer);
        assertEq(atHalf, 800, "half the 300 penalty has decayed");

        vm.warp(block.timestamp + window / 2);
        (uint16 atFull,) = registry.solvencyScore(employer);
        assertEq(atFull, 950, "penalty fully decayed; ratio term remains permanently");
    }

    function test_score_flooredAtZero() public {
        _record(0, 1);
        (uint16 score,) = registry.solvencyScore(employer);
        assertEq(score, 0, "0 ratio minus penalty must floor at 0, not underflow");
    }

    /// @dev Score must always land inside [0, SCORE_SCALE] for any history and any elapsed time.
    function testFuzz_score_alwaysInRange(uint8 onTime, uint8 arrears, uint32 elapsed) public {
        onTime = uint8(bound(onTime, 0, 40));
        arrears = uint8(bound(arrears, 0, 40));

        _record(onTime, arrears);
        vm.warp(block.timestamp + elapsed);

        (uint16 score, bool rated) = registry.solvencyScore(employer);
        assertLe(score, registry.SCORE_SCALE());
        assertEq(rated, uint256(onTime) + uint256(arrears) >= registry.MIN_SETTLED_FOR_RATING());
    }

    /// @dev More arrears must never raise a score, holding on-time count fixed.
    function testFuzz_score_monotonicInArrears(uint8 onTime, uint8 arrears) public {
        onTime = uint8(bound(onTime, 1, 20));
        arrears = uint8(bound(arrears, 1, 20));

        _record(onTime, arrears);
        (uint16 a,) = registry.solvencyScore(employer);

        _record(0, 1);
        (uint16 b,) = registry.solvencyScore(employer);

        assertLe(b, a);
    }

    /* ------------------------------- directory ------------------------------ */

    function test_employersPaged() public {
        vm.prank(e2);
        dojang.selfVerify(ATTESTER);
        vm.prank(e2);
        registry.register("e2.up.id", "E2");

        assertEq(registry.employerCount(), 2);

        address[] memory page = registry.employersPaged(0, 1);
        assertEq(page.length, 1);
        assertEq(page[0], employer);

        page = registry.employersPaged(1, 10);
        assertEq(page.length, 1);
        assertEq(page[0], e2);

        assertEq(registry.employersPaged(5, 10).length, 0);
    }

    /* -------------------------------- helper -------------------------------- */

    /// @dev Drives history directly through an authorised recorder so score tests do not
    ///      have to simulate whole pay periods.
    function _record(uint256 onTime, uint256 arrears) internal {
        vm.prank(owner);
        registry.setRecorder(address(this), true);
        for (uint256 i; i < onTime; ++i) {
            registry.recordOnTime(employer);
        }
        for (uint256 i; i < arrears; ++i) {
            registry.recordArrears(employer);
        }
    }
}

contract AlwaysRevertingResolver {
    function resolve(string calldata) external pure returns (address) {
        revert("nope");
    }

    function reverse(address) external pure returns (string memory) {
        revert("nope");
    }
}
