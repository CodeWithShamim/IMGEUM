// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {ArrearsAttestor} from "../src/ArrearsAttestor.sol";
import {WageVault} from "../src/WageVault.sol";
import {IWageVault} from "../src/interfaces/IWageVault.sol";

contract ArrearsAttestorTest is BaseTest {
    /* ------------------------------ attestation ----------------------------- */

    function test_attest_revertsWhenNotBreached() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE); // fully funded, no breach

        _warpPastDeadline(id);
        vm.expectRevert(abi.encodeWithSelector(ArrearsAttestor.NotBreached.selector, id));
        attestor.attestArrears(id);
    }

    function test_attest_revertsBeforeDeadline() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE / 2);
        // period is running, deadline not reached
        vm.warp(block.timestamp + PERIOD / 2);
        vm.expectRevert(abi.encodeWithSelector(ArrearsAttestor.NotBreached.selector, id));
        attestor.attestArrears(id);
    }

    function test_attest_recordsImmutableEvidence() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE / 3);
        _warpPastDeadline(id);

        uint256 expectedShortfall = vault.shortfall(id);
        assertGt(expectedShortfall, 0);

        vm.prank(stranger); // permissionless
        uint256 recId = attestor.attestArrears(id);

        ArrearsAttestor.ArrearsRecord memory r = attestor.getRecord(recId);
        assertEq(r.vaultId, id);
        assertEq(r.employer, employer);
        assertEq(r.worker, worker);
        assertEq(r.shortfall, expectedShortfall);
        assertEq(r.wageAmount, WAGE);
        assertEq(r.fundedAtAttestation, WAGE / 3);
        assertEq(r.employerName, unicode"주식회사 아크메");
        assertEq(r.attester, stranger);
        assertEq(r.attestedAtBlock, block.number);
        assertTrue(r.employerDojangUid != bytes32(0));

        // token minted to the worker, not the caller
        assertEq(attestor.ownerOf(recId), worker);
        assertEq(attestor.recordOfVault(id), recId);
        assertEq(attestor.recordsOfWorker(worker)[0], recId);
        assertEq(attestor.recordsOfEmployer(employer)[0], recId);
    }

    function test_attest_updatesEmployerArrearsHistory() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE / 3);
        _warpPastDeadline(id);
        attestor.attestArrears(id);

        assertEq(registry.getEmployer(employer).arrearsCount, 1);
        assertEq(registry.getEmployer(employer).lastArrearsAt, block.timestamp);
    }

    function test_attest_cannotDoubleAttest() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE / 3);
        _warpPastDeadline(id);
        attestor.attestArrears(id);

        vm.expectRevert(abi.encodeWithSelector(WageVault.AlreadyAttested.selector, id));
        attestor.attestArrears(id);
    }

    function test_attest_marksVaultAndAllowsClose() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE / 3);
        _warpPastDeadline(id);
        attestor.attestArrears(id);

        assertTrue(vault.getVault(id).arrearsAttested);

        // A breached-but-attested vault can now be closed (bookkeeping), and closing it is
        // NOT recorded as on-time.
        vault.closeVault(id);
        assertTrue(vault.getVault(id).closed);
        assertEq(registry.getEmployer(employer).onTimeCount, 0);
    }

    /// @dev After attestation the worker keeps whatever was actually funded — evidence of a
    ///      shortfall does not forfeit the partial wages already escrowed.
    function test_attest_workerStillWithdrawsFundedPortion() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE / 3);
        _warpPastDeadline(id);
        attestor.attestArrears(id);

        vm.prank(worker);
        uint256 got = vault.withdraw(id);
        assertEq(got, WAGE / 3, "earned is 100% at deadline; funded caps it at a third");
    }

    /* ---------------------------- verifyRecord ------------------------------ */

    function test_verifyRecord_livewChecksAndFrozenSnapshot() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE / 3);
        _warpPastDeadline(id);
        uint256 recId = attestor.attestArrears(id);

        (ArrearsAttestor.ArrearsRecord memory r, bool verifiedNow, bytes32 uidNow, uint256 outstanding) =
            attestor.verifyRecord(recId);

        assertTrue(verifiedNow);
        assertEq(uidNow, r.employerDojangUid);
        assertEq(outstanding, vault.shortfall(id));

        // Revoke the employer's Dojang attestation after the fact.
        vm.prank(owner);
        dojang.setVerified(employer, ATTESTER, false);

        (ArrearsAttestor.ArrearsRecord memory r2, bool verifiedNow2, bytes32 uidNow2,) = attestor.verifyRecord(recId);

        // Frozen snapshot is unchanged; live check now reflects revocation.
        assertEq(r2.employerDojangUid, r.employerDojangUid);
        assertTrue(r2.employerDojangUid != bytes32(0));
        assertFalse(verifiedNow2);
        assertEq(uidNow2, bytes32(0));
    }

    /* ------------------------------ soulbound ------------------------------- */

    function test_soulbound_transfersRevert() public {
        uint256 recId = _attestOne();

        vm.prank(worker);
        vm.expectRevert(ArrearsAttestor.Soulbound.selector);
        attestor.transferFrom(worker, stranger, recId);

        vm.prank(worker);
        vm.expectRevert(ArrearsAttestor.Soulbound.selector);
        attestor.approve(stranger, recId);

        vm.prank(worker);
        vm.expectRevert(ArrearsAttestor.Soulbound.selector);
        attestor.setApprovalForAll(stranger, true);
    }

    /* ------------------------------- metadata ------------------------------- */

    function test_tokenURI_isOnChainDataUri() public {
        uint256 recId = _attestOne();
        string memory uri = attestor.tokenURI(recId);
        assertEq(_prefix(uri, 29), "data:application/json;base64,");
    }

    function test_tokenURI_revertsForUnknown() public {
        vm.expectRevert(abi.encodeWithSelector(ArrearsAttestor.NoSuchRecord.selector, uint256(1)));
        attestor.tokenURI(1);
    }

    /* -------------------------------- helpers ------------------------------- */

    function _attestOne() internal returns (uint256) {
        uint256 id = _openVault();
        _fundETH(id, WAGE / 3);
        _warpPastDeadline(id);
        return attestor.attestArrears(id);
    }

    function _prefix(string memory s, uint256 n) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(n);
        for (uint256 i; i < n; ++i) {
            out[i] = b[i];
        }
        return string(out);
    }
}
