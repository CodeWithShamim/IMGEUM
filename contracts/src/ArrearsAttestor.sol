// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

import {IWageVault} from "./interfaces/IWageVault.sol";
import {IEmployerRegistry} from "./interfaces/IEmployerRegistry.sol";
import {IDojangVerifier} from "./interfaces/IDojangVerifier.sol";

/// @title ArrearsAttestor
/// @author IMGEUM (임금 프로토콜)
/// @notice Mints permanent, timestamped on-chain evidence that a wage vault was underfunded
///         at its payout deadline — the record a worker takes to the Ministry of Employment
///         and Labor (고용노동부) instead of spending months assembling paperwork.
///
/// @dev This is the standalone-value layer. Even if no employer ever voluntarily streams
///      wages through IMGEUM, an attested arrears record is a trustlessly verifiable
///      artifact: a third party reads `getRecord`, re-checks the employer's Dojang
///      attestation against EAS themselves, and needs to trust neither IMGEUM nor the worker.
///
///      Follows GIWA's OnchainVerifiable pattern
///      (https://docs.giwa.io/get-started/smart-contract/onchainverifiable.md). Note the
///      direction of the gate is inverted from the usual example: the docs gate *actions* on
///      the caller being verified. Here, attestation must be permissionless — a worker who
///      has been stiffed is exactly the person least likely to hold an Upbit KYC
///      attestation, and gating on the caller would hand employers a veto. So verification
///      is applied to the *subject* (the employer) and recorded as evidence metadata, not
///      used to gate the call.
contract ArrearsAttestor is ERC721, ReentrancyGuard {
    using Strings for uint256;
    using Strings for address;

    /* -------------------------------------------------------------------------- */
    /*                                   ERRORS                                   */
    /* -------------------------------------------------------------------------- */

    error NotBreached(uint256 vaultId);
    error NoSuchRecord(uint256 recordId);
    error Soulbound();
    error ZeroAddress();

    /* -------------------------------------------------------------------------- */
    /*                                    TYPES                                   */
    /* -------------------------------------------------------------------------- */

    /// @notice An immutable snapshot of a wage-arrears breach.
    /// @dev Every field is captured at attestation time and never mutated. Storing the
    ///      employer's identity strings and Dojang UID by value — rather than reading the
    ///      registry live — is deliberate: an employer who later renames themselves or lets
    ///      their attestation lapse must not be able to alter what the evidence says. The
    ///      evidence page renders both this frozen snapshot and a live re-check, side by side.
    /// @param vaultId The breached vault.
    /// @param employer The employer in breach.
    /// @param worker The worker owed wages.
    /// @param token Wage token (address(0) = native ETH).
    /// @param wageAmount Total wage contracted for the period.
    /// @param fundedAtAttestation Amount actually escrowed when the breach was recorded.
    /// @param shortfall Accrued-but-unfunded wages: the sum claimed.
    /// @param periodStart Accrual start.
    /// @param periodEnd Accrual end.
    /// @param payoutDeadline The deadline that was missed.
    /// @param attestedAt Block timestamp of attestation.
    /// @param attestedAtBlock Block number of attestation.
    /// @param employerDojangUid EAS attestation UID for the employer, frozen at this moment.
    /// @param employerUpId Employer's up.id at this moment.
    /// @param employerName Employer's display name at this moment.
    /// @param attester Whoever triggered the attestation.
    struct ArrearsRecord {
        uint256 vaultId;
        address employer;
        address worker;
        address token;
        uint256 wageAmount;
        uint256 fundedAtAttestation;
        uint256 shortfall;
        uint64 periodStart;
        uint64 periodEnd;
        uint64 payoutDeadline;
        uint64 attestedAt;
        uint256 attestedAtBlock;
        bytes32 employerDojangUid;
        string employerUpId;
        string employerName;
        address attester;
    }

    /* -------------------------------------------------------------------------- */
    /*                                   EVENTS                                   */
    /* -------------------------------------------------------------------------- */

    /// @notice Emitted when a breach is permanently recorded.
    /// @param recordId The evidence record / soulbound token ID.
    /// @param vaultId The breached vault.
    /// @param employer The employer in breach.
    /// @param worker The worker owed wages.
    /// @param shortfall The sum claimed.
    /// @param attestedAt Block timestamp.
    event ArrearsAttested(
        uint256 indexed recordId,
        uint256 indexed vaultId,
        address indexed employer,
        address worker,
        uint256 shortfall,
        uint64 attestedAt
    );

    /* -------------------------------------------------------------------------- */
    /*                                   STORAGE                                  */
    /* -------------------------------------------------------------------------- */

    /// @notice The wage escrow whose vaults this contract attests against.
    IWageVault public immutable VAULT;

    /// @notice The employer registry, read for identity metadata and written for history.
    IEmployerRegistry public immutable REGISTRY;

    /// @notice Dojang verifier, used for the live re-check in `verifyRecord`.
    IDojangVerifier public immutable DOJANG;

    /// @notice The Dojang attester whose attestations are considered authoritative.
    bytes32 public immutable ATTESTER_ID;

    mapping(uint256 recordId => ArrearsRecord) private _records;
    mapping(uint256 vaultId => uint256 recordId) public recordOfVault;
    mapping(address worker => uint256[] recordIds) private _workerRecords;
    mapping(address employer => uint256[] recordIds) private _employerRecords;

    uint256 private _recordCount;

    /* -------------------------------------------------------------------------- */
    /*                                 CONSTRUCTOR                                */
    /* -------------------------------------------------------------------------- */

    /// @param vault The WageVault address.
    /// @param registry The EmployerRegistry address.
    /// @param dojang DojangScroll address.
    /// @param attesterId Accepted Dojang attester identifier.
    constructor(address vault, address registry, address dojang, bytes32 attesterId)
        ERC721(unicode"IMGEUM Arrears Evidence", "IMGEUM-EVD")
    {
        if (vault == address(0) || registry == address(0) || dojang == address(0)) revert ZeroAddress();
        VAULT = IWageVault(vault);
        REGISTRY = IEmployerRegistry(registry);
        DOJANG = IDojangVerifier(dojang);
        ATTESTER_ID = attesterId;
    }

    /* -------------------------------------------------------------------------- */
    /*                                 ATTESTATION                                */
    /* -------------------------------------------------------------------------- */

    /// @notice Records a wage-arrears breach and mints the worker a soulbound evidence token.
    ///
    /// @dev Permissionless by design — callable by the worker, a union rep, a labour
    ///      advocate, or an automated watcher. Requiring the worker to call it would mean a
    ///      worker without gas, without a wallet, or under pressure from their employer
    ///      cannot create the record, which is precisely the population this exists for.
    ///      There is nothing to grief: the preconditions are objective on-chain facts
    ///      (past deadline, funded < accrued), the record can only be created once per
    ///      vault, and the evidence token always mints to the worker regardless of caller.
    ///
    ///      Checks-effects-interactions: the vault is marked (external call to a contract we
    ///      deployed and whose `markArrears` is single-writer and non-reentrant), state is
    ///      written, then `_safeMint` runs last since it can hand control to the worker.
    ///
    /// @param vaultId The vault to attest against.
    /// @return recordId The new evidence record / token ID.
    function attestArrears(uint256 vaultId) external nonReentrant returns (uint256 recordId) {
        if (!VAULT.isBreached(vaultId)) revert NotBreached(vaultId);

        IWageVault.Vault memory v = VAULT.getVault(vaultId);

        // Marks the vault and returns the canonical shortfall. Reverts if already attested,
        // which is what makes this function idempotent-by-revert rather than duplicating
        // evidence for the same breach.
        uint256 shortfallAmount = VAULT.markArrears(vaultId);

        IEmployerRegistry.Employer memory e = REGISTRY.getEmployer(v.employer);

        unchecked {
            recordId = ++_recordCount;
        }

        _records[recordId] = ArrearsRecord({
            vaultId: vaultId,
            employer: v.employer,
            worker: v.worker,
            token: v.token,
            wageAmount: v.wageAmount,
            fundedAtAttestation: v.funded,
            shortfall: shortfallAmount,
            periodStart: v.periodStart,
            periodEnd: v.periodEnd,
            payoutDeadline: v.payoutDeadline,
            attestedAt: uint64(block.timestamp),
            attestedAtBlock: block.number,
            employerDojangUid: e.dojangUid,
            employerUpId: e.upId,
            employerName: e.displayName,
            attester: msg.sender
        });

        recordOfVault[vaultId] = recordId;
        _workerRecords[v.worker].push(recordId);
        _employerRecords[v.employer].push(recordId);

        REGISTRY.recordArrears(v.employer);

        emit ArrearsAttested(recordId, vaultId, v.employer, v.worker, shortfallAmount, uint64(block.timestamp));

        _safeMint(v.worker, recordId);
    }

    /* -------------------------------------------------------------------------- */
    /*                             TRUSTLESS VERIFICATION                         */
    /* -------------------------------------------------------------------------- */

    /// @notice Everything a third party needs to judge an evidence record, in one call.
    ///
    /// @dev This is the OnchainVerifiable surface a labour office or court-appointed expert
    ///      reads. It returns the frozen record alongside a *live* Dojang re-check, and
    ///      deliberately does not collapse them into a single boolean: "this employer was a
    ///      verified Korean entity when they failed to pay" and "this employer is still
    ///      verified today" are different claims, and conflating them would let a revoked
    ///      attestation silently invalidate genuine historical evidence.
    ///
    ///      Nothing here is IMGEUM-attested. `employerDojangUid` can be fed straight into
    ///      EAS (`0x4200000000000000000000000000000000000021`, per
    ///      https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md) via `getAttestation(uid)`
    ///      to confirm the identity independently of this contract.
    ///
    /// @param recordId The evidence record.
    /// @return record The immutable snapshot.
    /// @return employerVerifiedNow Whether the employer holds a live Dojang attestation now.
    /// @return dojangUidNow The employer's current attestation UID (0 if none).
    /// @return stillOutstanding Shortfall remaining on the vault at this moment.
    function verifyRecord(uint256 recordId)
        external
        view
        returns (ArrearsRecord memory record, bool employerVerifiedNow, bytes32 dojangUidNow, uint256 stillOutstanding)
    {
        record = _requireRecord(recordId);
        employerVerifiedNow = DOJANG.isVerified(record.employer, ATTESTER_ID);
        dojangUidNow = DOJANG.getVerifiedAddressAttestationUid(record.employer, ATTESTER_ID);
        stillOutstanding = VAULT.shortfall(record.vaultId);
    }

    /* -------------------------------------------------------------------------- */
    /*                                    VIEWS                                   */
    /* -------------------------------------------------------------------------- */

    /// @notice Reads an evidence record.
    /// @param recordId The record to read.
    /// @return The immutable snapshot.
    function getRecord(uint256 recordId) external view returns (ArrearsRecord memory) {
        return _requireRecord(recordId);
    }

    /// @notice Total evidence records minted. IDs run 1..recordCount().
    /// @return The count.
    function recordCount() external view returns (uint256) {
        return _recordCount;
    }

    /// @notice Evidence record IDs held by a worker.
    /// @param worker The worker to read.
    /// @return Record IDs in attestation order.
    function recordsOfWorker(address worker) external view returns (uint256[] memory) {
        return _workerRecords[worker];
    }

    /// @notice Evidence record IDs filed against an employer.
    /// @param employer The employer to read.
    /// @return Record IDs in attestation order.
    function recordsOfEmployer(address employer) external view returns (uint256[] memory) {
        return _employerRecords[employer];
    }

    /* -------------------------------------------------------------------------- */
    /*                                  SOULBOUND                                 */
    /* -------------------------------------------------------------------------- */

    /// @notice Evidence tokens are soulbound: mintable, never transferable.
    ///
    /// @dev WHY SOULBOUND. The token asserts "this specific person was not paid." That
    ///      claim is only true of one address, so a transferable token would be a forgeable
    ///      one — a market in second-hand wage claims where anyone could hold evidence of a
    ///      breach they never suffered, which would destroy the record's evidentiary value
    ///      the moment a labour office noticed it was possible. It is also a defence for the
    ///      worker: a non-transferable claim cannot be bought out cheaply by an employer, nor
    ///      demanded as a condition of a settlement.
    ///
    ///      Implemented by overriding `_update`, so mints (`from == address(0)`) pass and
    ///      every other movement — including burns and operator transfers — reverts. Burning
    ///      is blocked too: evidence a worker can be pressured into destroying is not
    ///      evidence.
    /// @param to Recipient.
    /// @param tokenId Token being moved.
    /// @param auth Authorised spender per ERC721.
    /// @return The previous owner.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    /// @notice Disabled: evidence tokens are soulbound.
    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    /// @notice Disabled: evidence tokens are soulbound.
    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    /* -------------------------------------------------------------------------- */
    /*                                  METADATA                                  */
    /* -------------------------------------------------------------------------- */

    /// @notice Fully on-chain, bilingual (KO/EN) token metadata.
    /// @dev Rendered as a base64 data URI with no external host. An evidence record whose
    ///      metadata lived on IPFS or an IMGEUM server would be evidence that expires when a
    ///      pin drops or a company folds; this one outlives the protocol.
    /// @param tokenId The evidence record ID.
    /// @return A base64-encoded `application/json` data URI.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        ArrearsRecord memory r = _requireRecord(tokenId);

        string memory json = string.concat(
            '{"name":"',
            unicode"임금체불 증빙 #",
            tokenId.toString(),
            unicode" / Wage Arrears Evidence #",
            tokenId.toString(),
            '","description":"',
            unicode"IMGEUM 프로토콜이 발행한 임금체불 증빙 기록입니다. 지급 기한까지 급여가 예치되지 않았음을 온체인에 영구 기록합니다. ",
            "On-chain evidence that wages were not escrowed by the payout deadline. Non-transferable.",
            '","attributes":[',
            '{"trait_type":"Employer","value":"',
            r.employerName,
            '"},',
            '{"trait_type":"Employer Address","value":"',
            r.employer.toHexString(),
            '"},',
            '{"trait_type":"Shortfall","value":"',
            r.shortfall.toString(),
            '"},',
            '{"trait_type":"Payout Deadline","display_type":"date","value":',
            uint256(r.payoutDeadline).toString(),
            "},",
            '{"trait_type":"Attested At","display_type":"date","value":',
            uint256(r.attestedAt).toString(),
            "},",
            '{"trait_type":"Vault ID","value":"',
            r.vaultId.toString(),
            '"}]}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    /* -------------------------------------------------------------------------- */
    /*                                  INTERNAL                                  */
    /* -------------------------------------------------------------------------- */

    /// @dev Loads a record, reverting on an unknown ID.
    function _requireRecord(uint256 recordId) internal view returns (ArrearsRecord memory) {
        if (recordId == 0 || recordId > _recordCount) revert NoSuchRecord(recordId);
        return _records[recordId];
    }
}
