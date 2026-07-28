// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2} from "forge-std/Test.sol";

import {EmployerRegistry} from "../../src/EmployerRegistry.sol";
import {WageVault} from "../../src/WageVault.sol";
import {ArrearsAttestor} from "../../src/ArrearsAttestor.sol";
import {UpIdResolver} from "../../src/UpIdResolver.sol";
import {GiwaConstants} from "../../src/GiwaConstants.sol";
import {IDojangVerifier} from "../../src/interfaces/IDojangVerifier.sol";
import {IUpNameRegistry} from "../../src/interfaces/IUpNameRegistry.sol";
import {IEmployerRegistry} from "../../src/interfaces/IEmployerRegistry.sol";
import {IWageVault} from "../../src/interfaces/IWageVault.sol";

/// @notice Integration coverage against the REAL GIWA Sepolia chain state.
///
/// @dev The unit suites prove the logic; this suite proves the wiring — that IMGEUM's
///      assumptions about GIWA's live identity contracts are actually true today, not just
///      true of a double we wrote. Everything asserted here is read from the deployed
///      DojangScroll and UPNameRegistry at fork time.
///
///      Run with `make test-fork`. Set SKIP_FORK_TESTS=1 to opt out when offline; the suite
///      then skips rather than failing on a network error.
contract GiwaLiveForkTest is Test {
    /// @dev A wallet that completed the "Dojang 발급" + "UP ID 발급" flow at
    ///      https://sepolia-playground.giwa.io/ and therefore holds BOTH a real TESTNET
    ///      FAUCET Verified Address attestation and the real up.id name below. Discovered by
    ///      reading `register(string)` calls to UPNameRegistry on GIWA Sepolia, not invented.
    ///      If this wallet's verification ever lapses these tests fail loudly, which is the
    ///      correct signal: our gating assumption would have changed.
    address internal constant VERIFIED_HOLDER = 0xFc414158c398194033b01321aB2E04ae854693b0;
    string internal constant VERIFIED_HOLDER_NAME = "ut2kw8kq.up.id";

    bytes32 internal constant ATTESTER = GiwaConstants.ATTESTER_TESTNET_FAUCET;

    uint256 internal constant WAGE = 0.01 ether;
    uint64 internal constant PERIOD = 30 days;
    uint64 internal constant SETTLE = 3 days;

    EmployerRegistry internal registry;
    WageVault internal vault;
    ArrearsAttestor internal attestor;
    UpIdResolver internal resolver;

    address internal owner = makeAddr("owner");
    address internal worker = makeAddr("worker");
    address internal unverified = makeAddr("unverified");

    function setUp() public {
        if (vm.envOr("SKIP_FORK_TESTS", false)) vm.skip(true);

        vm.createSelectFork(vm.envOr("GIWA_SEPOLIA_RPC_URL", string("https://sepolia-rpc.giwa.io")));

        // The whole point of removing mock mode: these must be real contracts.
        assertGt(GiwaConstants.DOJANG_SCROLL.code.length, 0, "DojangScroll has no code");
        assertGt(GiwaConstants.UP_NAME_REGISTRY.code.length, 0, "UPNameRegistry has no code");

        resolver = new UpIdResolver(GiwaConstants.UP_NAME_REGISTRY);
        registry = new EmployerRegistry(GiwaConstants.DOJANG_SCROLL, ATTESTER, owner);
        vault = new WageVault(address(registry), owner);
        attestor = new ArrearsAttestor(address(vault), address(registry), GiwaConstants.DOJANG_SCROLL, ATTESTER);

        vm.startPrank(owner);
        registry.setRecorder(address(vault), true);
        registry.setRecorder(address(attestor), true);
        vault.setAttestor(address(attestor));
        registry.setUpIdResolver(address(resolver));
        vm.stopPrank();
    }

    /* ---------------------------- live Dojang reads --------------------------- */

    /// @dev The gate itself, read straight from the deployed DojangScroll.
    function test_liveDojang_verifiesRealHolder() public view {
        IDojangVerifier dojang = IDojangVerifier(GiwaConstants.DOJANG_SCROLL);

        assertTrue(dojang.isVerified(VERIFIED_HOLDER, ATTESTER), "holder lost its faucet attestation");
        assertFalse(dojang.isVerified(unverified, ATTESTER), "a random address must not be verified");

        bytes32 uid = dojang.getVerifiedAddressAttestationUid(VERIFIED_HOLDER, ATTESTER);
        assertTrue(uid != bytes32(0), "verified holder must have a non-zero EAS attestation UID");
        console2.log("live attestation UID:");
        console2.logBytes32(uid);
    }

    /// @dev The UPNameRegistry gates on the same DojangScroll and attester IMGEUM does, so a
    ///      up.id name and an IMGEUM employer registration attest to the same identity.
    function test_liveUpNameRegistry_sharesOurIdentityRoot() public view {
        (, bytes memory scroll) = GiwaConstants.UP_NAME_REGISTRY.staticcall(abi.encodeWithSignature("dojangScroll()"));
        (, bytes memory attesterId) = GiwaConstants.UP_NAME_REGISTRY.staticcall(abi.encodeWithSignature("attesterId()"));

        assertEq(abi.decode(scroll, (address)), GiwaConstants.DOJANG_SCROLL);
        assertEq(abi.decode(attesterId, (bytes32)), ATTESTER);
    }

    /* --------------------------- live up.id resolution ------------------------ */

    function test_liveResolver_reverseAndForward() public view {
        assertEq(resolver.reverse(VERIFIED_HOLDER), VERIFIED_HOLDER_NAME);
        assertEq(resolver.resolve(VERIFIED_HOLDER_NAME), VERIFIED_HOLDER);
    }

    function test_liveResolver_rejectsUnownedName() public view {
        assertEq(resolver.resolve("definitelynotregistered0xzz.up.id"), address(0));
        assertEq(resolver.reverse(unverified), "");
    }

    /// @dev The name belongs to its holder and to nobody else — the property the
    ///      `upIdVerified` badge rests on.
    function test_liveResolver_nameIsNotClaimableByAnyoneElse() public view {
        assertTrue(resolver.resolve(VERIFIED_HOLDER_NAME) != unverified);
    }

    /* ----------------------------- gated registration ------------------------- */

    function test_register_succeedsForLiveVerifiedHolder() public {
        vm.prank(VERIFIED_HOLDER);
        registry.register(VERIFIED_HOLDER_NAME, unicode"주식회사 임금");

        IEmployerRegistry.Employer memory e = registry.getEmployer(VERIFIED_HOLDER);
        assertTrue(e.active, "employer must be active");
        assertTrue(e.upIdVerified, "real up.id name must verify against the live registry");
        assertEq(e.upId, VERIFIED_HOLDER_NAME);

        // The snapshotted UID must be the one EAS actually holds, so a labour office can
        // re-read the attestation without trusting IMGEUM.
        bytes32 live =
            IDojangVerifier(GiwaConstants.DOJANG_SCROLL).getVerifiedAddressAttestationUid(VERIFIED_HOLDER, ATTESTER);
        assertEq(e.dojangUid, live, "snapshotted UID must match the live EAS attestation");
    }

    /// @dev With mock mode gone there is no self-enroll path: an unverified wallet is simply
    ///      refused, on the live chain, with no way around it.
    function test_register_revertsForUnverifiedWallet() public {
        vm.expectRevert(abi.encodeWithSelector(EmployerRegistry.NotDojangVerified.selector, unverified));
        vm.prank(unverified);
        registry.register("someone.up.id", "Unverified Co");
    }

    /// @dev Claiming a name you do not hold registers fine but earns no badge — a squatted
    ///      label can never present as verified.
    function test_register_squattedNameIsNotUpIdVerified() public {
        vm.prank(VERIFIED_HOLDER);
        registry.register("someoneelse.up.id", unicode"주식회사 임금");

        assertFalse(registry.getEmployer(VERIFIED_HOLDER).upIdVerified, "squatted name must not verify");
    }

    /* ------------------------- full lifecycle on live chain ------------------- */

    /// @dev Happy path, executed against real GIWA state: register -> open -> fund -> stream
    ///      -> withdraw -> settle.
    function test_lifecycle_fundedVaultPaysWorker() public {
        uint256 vaultId = _registerAndOpen();

        vm.deal(VERIFIED_HOLDER, WAGE * 2);
        vm.prank(VERIFIED_HOLDER);
        vault.fund{value: WAGE}(vaultId, WAGE);

        // Stream accrues with real block timestamps.
        vm.warp(block.timestamp + PERIOD / 2);
        uint256 half = vault.earned(vaultId);
        assertApproxEqRel(half, WAGE / 2, 0.01e18, "half the period should accrue ~half the wage");

        vm.prank(worker);
        uint256 paid = vault.withdraw(vaultId);
        assertEq(paid, half, "worker withdraws exactly what accrued");
        assertEq(worker.balance, paid);

        // Run to the end and take the rest.
        vm.warp(block.timestamp + PERIOD);
        vm.prank(worker);
        vault.withdraw(vaultId);
        assertEq(worker.balance, WAGE, "worker ends the period whole");

        // A fully funded vault is not arrears, even past the deadline.
        vm.warp(vault.getVault(vaultId).payoutDeadline + 1);
        vm.expectRevert(abi.encodeWithSelector(ArrearsAttestor.NotBreached.selector, vaultId));
        attestor.attestArrears(vaultId);
    }

    /// @dev The killer feature, on the live chain: an underfunded vault past its deadline
    ///      mints a permanent evidence record citing the employer's REAL Dojang attestation.
    function test_lifecycle_underfundedVaultProducesRealEvidence() public {
        uint256 vaultId = _registerAndOpen();

        // Read the live UID now, before warping: GIWA faucet attestations carry roughly a
        // one-month expiry, and the deadline warp below lands past it.
        bytes32 liveUid =
            IDojangVerifier(GiwaConstants.DOJANG_SCROLL).getVerifiedAddressAttestationUid(VERIFIED_HOLDER, ATTESTER);

        vm.deal(VERIFIED_HOLDER, WAGE);
        vm.prank(VERIFIED_HOLDER);
        vault.fund{value: WAGE / 4}(vaultId, WAGE / 4);

        vm.warp(vault.getVault(vaultId).payoutDeadline + 1);

        // Anyone may attest — that is the point.
        vm.prank(unverified);
        uint256 recordId = attestor.attestArrears(vaultId);

        ArrearsAttestor.ArrearsRecord memory r = attestor.getRecord(recordId);
        assertEq(r.employer, VERIFIED_HOLDER);
        assertEq(r.worker, worker);
        assertEq(r.shortfall, WAGE - WAGE / 4, "shortfall must be wage minus what was funded");
        assertEq(r.employerUpId, VERIFIED_HOLDER_NAME);

        // The evidence cites the live EAS attestation, re-checkable independently.
        assertEq(r.employerDojangUid, liveUid, "evidence must cite the real attestation UID");

        // Soulbound: the worker holds a token they cannot move.
        assertEq(attestor.ownerOf(recordId), worker);
        vm.expectRevert();
        vm.prank(worker);
        attestor.transferFrom(worker, unverified, recordId);
    }

    /* --------------------- evidence outlives the identity --------------------- */

    /// @dev Regression test for a bug that only mock mode could hide. The deployed
    ///      DojangScroll REVERTS from `getVerifiedAddressAttestationUid` once an attestation
    ///      lapses — GIWA faucet attestations run about a month — while `isVerified` merely
    ///      returns false. Before `ArrearsAttestor._liveDojangUid` guarded that call, an
    ///      employer letting their verification expire would have made `verifyRecord`
    ///      unreadable for every arrears record naming them: the labour-office evidence page
    ///      would go blank exactly when the worker needed it.
    function test_verifyRecord_survivesEmployerAttestationExpiry() public {
        uint256 vaultId = _registerAndOpen();

        vm.deal(VERIFIED_HOLDER, WAGE);
        vm.prank(VERIFIED_HOLDER);
        vault.fund{value: WAGE / 4}(vaultId, WAGE / 4);

        vm.warp(vault.getVault(vaultId).payoutDeadline + 1);
        uint256 recordId = attestor.attestArrears(vaultId);

        // Push well past any plausible attestation expiry, then confirm the live reads have
        // in fact gone sour on the real contract.
        vm.warp(block.timestamp + 365 days);
        IDojangVerifier dojang = IDojangVerifier(GiwaConstants.DOJANG_SCROLL);
        assertFalse(dojang.isVerified(VERIFIED_HOLDER, ATTESTER), "attestation should have lapsed by now");
        vm.expectRevert();
        dojang.getVerifiedAddressAttestationUid(VERIFIED_HOLDER, ATTESTER);

        // The evidence page still reads.
        (ArrearsAttestor.ArrearsRecord memory r, bool verifiedNow, bytes32 uidNow, uint256 outstanding) =
            attestor.verifyRecord(recordId);

        assertFalse(verifiedNow, "employer is no longer verified");
        assertEq(uidNow, bytes32(0), "no live UID to report");
        assertTrue(r.employerDojangUid != bytes32(0), "the frozen snapshot must survive");
        assertEq(outstanding, WAGE - WAGE / 4, "the debt is still outstanding");
    }

    /* -------------------------------- helpers -------------------------------- */

    function _registerAndOpen() internal returns (uint256 vaultId) {
        vm.prank(VERIFIED_HOLDER);
        registry.register(VERIFIED_HOLDER_NAME, unicode"주식회사 임금");

        uint64 start = uint64(block.timestamp);
        uint64 end = start + PERIOD;
        vm.prank(VERIFIED_HOLDER);
        vaultId = vault.openVault(worker, WAGE, start, end, end + SETTLE, address(0));
    }
}
