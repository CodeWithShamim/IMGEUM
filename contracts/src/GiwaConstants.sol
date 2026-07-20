// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title GiwaConstants
/// @author IMGEUM (임금 프로토콜)
/// @notice Canonical GIWA chain + Dojang addresses and identifiers.
/// @dev EVERY value in this file is transcribed from an official GIWA documentation page,
///      and each is annotated with the exact URL it came from. Nothing here is from memory.
///      Any page can be re-read as markdown by appending `.md`, or queried with `?ask=<question>`.
///
///      These are `internal constant`s rather than immutables so that they are inlined at
///      compile time (no storage, no constructor arguments to get wrong) while remaining
///      overridable per deployment: every consumer contract takes the address as a constructor
///      argument and merely *defaults* to these values in the deploy script. That keeps the
///      mainnet swap a one-file change, as required by the build spec.
library GiwaConstants {
    /* -------------------------------------------------------------------------- */
    /*                                   CHAIN                                    */
    /* -------------------------------------------------------------------------- */

    /// @notice GIWA Sepolia testnet chain ID.
    /// @dev Source: https://docs.giwa.io/get-started/connect-to-giwa.md
    ///      Listed there as "GIWA 세폴리아(Sepolia)", chain ID 91342, currency ETH.
    uint256 internal constant GIWA_SEPOLIA_CHAIN_ID = 91342;

    /// @notice Block time target on GIWA, in seconds.
    /// @dev Source: https://docs.giwa.io/network-information/diffs-ethereum-giwa.md
    ///      GIWA produces blocks every 1 second (Ethereum: 12 seconds).
    ///      This is what makes a per-second wage stream legible on-chain rather than cosmetic:
    ///      `earned()` advances by a visible amount between consecutive blocks.
    uint64 internal constant GIWA_BLOCK_TIME = 1;

    /// @notice Block gas limit on GIWA.
    /// @dev Source: https://docs.giwa.io/network-information/diffs-ethereum-giwa.md (60,000,000).
    uint256 internal constant GIWA_BLOCK_GAS_LIMIT = 60_000_000;

    /* -------------------------------------------------------------------------- */
    /*                          DOJANG / EAS (GIWA SEPOLIA)                       */
    /* -------------------------------------------------------------------------- */

    /// @notice DojangScroll — the convenience read contract for Dojang attestations.
    /// @dev Source: https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md
    ///      Exposes `isVerified(address,bytes32)` and
    ///      `getVerifiedAddressAttestationUid(address,bytes32)`.
    ///      See https://docs.giwa.io/giwa-ecosystem/dojang/verified-address.md
    address internal constant DOJANG_SCROLL = 0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9;

    /// @notice Ethereum Attestation Service predeploy on GIWA.
    /// @dev Source: https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md
    address internal constant EAS = 0x4200000000000000000000000000000000000021;

    /// @notice EAS SchemaRegistry predeploy on GIWA.
    /// @dev Source: https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md
    address internal constant SCHEMA_REGISTRY = 0x4200000000000000000000000000000000000020;

    /// @notice AttestationIndexer — resolves (recipient, schema, attester) to an attestation UID.
    /// @dev Source: https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md
    address internal constant ATTESTATION_INDEXER = 0x9C9Bf29880448aB39795a11b669e22A0f1d790ec;

    /// @notice AddressDojangResolver — the EAS resolver backing Verified Address attestations.
    /// @dev Source: https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md
    address internal constant ADDRESS_DOJANG_RESOLVER = 0x692009FE206C3F897867F6BF7B5B45506B747F9e;

    /* -------------------------------------------------------------------------- */
    /*                             ATTESTER IDENTIFIERS                           */
    /* -------------------------------------------------------------------------- */

    /// @notice Attester ID for UPBIT KOREA — the production identity issuer.
    /// @dev Source: https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md
    ///      This is the attester IMGEUM gates employer registration on in production:
    ///      an Upbit-Korea Verified Address means a real, KYC'd Korean entity.
    bytes32 internal constant ATTESTER_UPBIT_KOREA = 0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034;

    /// @notice Attester ID for the GIWA TESTNET FAUCET issuer.
    /// @dev Source: https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md
    ///      On GIWA Sepolia this is the attester a demo wallet can realistically obtain,
    ///      so the testnet deployment gates on this one. See ARCHITECTURE.md § "Dojang swap".
    bytes32 internal constant ATTESTER_TESTNET_FAUCET =
        0xaa92f8c143657dde575de430aecaea6ca91f2e6072339b16932d426895d8d678;

    /* -------------------------------------------------------------------------- */
    /*                                 SCHEMA UIDS                                */
    /* -------------------------------------------------------------------------- */

    /// @notice EAS schema UID for the Verified Address attestation.
    /// @dev Source: https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md
    bytes32 internal constant SCHEMA_VERIFIED_ADDRESS =
        0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08;

    /// @notice EAS schema UID for the Verified Balance attestation.
    /// @dev Source: https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md
    ///      Not consumed by v1, but recorded here: a future "employer proved payroll runway"
    ///      feature reads this schema. See ARCHITECTURE.md § Roadmap.
    bytes32 internal constant SCHEMA_VERIFIED_BALANCE =
        0x77bf88ca262cc63e1b185dccd870aacc5320b8987ef6c7169920f265fe6ab5e9;
}
