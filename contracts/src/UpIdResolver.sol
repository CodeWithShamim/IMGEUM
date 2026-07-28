// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IUpIdResolver} from "./interfaces/IUpIdResolver.sol";
import {IUpNameRegistry} from "./interfaces/IUpNameRegistry.sol";

/// @title UpIdResolver
/// @author IMGEUM (임금 프로토콜)
/// @notice Real up.id name resolution, backed by GIWA's live UPNameRegistry.
///
/// @dev This contract replaces the former demo mock outright. It is a pure, stateless read
///      adapter: it owns no storage, has no owner, and can never write. It translates between
///      the two representations that differ across the boundary —
///
///        IMGEUM stores the FULL name  ("hanuel.up.id")   — what a worker reads on a payslip.
///        UPNameRegistry keys on the LABEL ("hanuel")     — `tokenId == keccak256(label)`.
///
///      Resolution is deliberately strict. `resolve` returns `address(0)` — never a
///      best-effort guess — unless all of the following hold:
///        1. the name ends in exactly ".up.id" and has a single non-empty label with no
///           further dots (no "a.b.up.id", which up.id does not issue);
///        2. `ownerOf(keccak256(label))` is non-zero;
///        3. that owner's `ownedTokenId` still points back at this very token (rejects a
///           stale forward entry after a transfer or re-issue);
///        4. `hasActiveName(owner)` is true (rejects a name lapsed past its grace period
///           because the holder's Dojang verification expired).
///
///      Why so strict: `EmployerRegistry` turns this answer into the `upIdVerified` badge a
///      worker sees next to their employer's name. A false positive there is a phishing
///      surface. A false negative is a missing badge — money still moves, because every
///      IMGEUM value path keys off raw addresses and never off a name.
///
///      Case sensitivity: labels are hashed exactly as given, matching the registry's own
///      `register(string)`. IMGEUM does not normalise, because normalising differently from
///      the registry would silently resolve to the wrong token.
contract UpIdResolver is IUpIdResolver {
    /// @notice Thrown when constructed against the zero address.
    error ZeroRegistry();

    /// @notice The live Upbit Web3 Names registry this resolver reads.
    /// @dev Immutable: repointing name resolution is exactly the kind of change that should
    ///      require a redeploy and a `setUpIdResolver` call the owner has to sign for.
    IUpNameRegistry public immutable REGISTRY;

    /// @dev The only suffix up.id issues. Source: https://docs.giwa.io/giwa-ecosystem/up-id.md
    bytes6 private constant SUFFIX = ".up.id";
    uint256 private constant SUFFIX_LEN = 6;

    /// @param registry The UPNameRegistry address (`GiwaConstants.UP_NAME_REGISTRY`).
    constructor(address registry) {
        if (registry == address(0)) revert ZeroRegistry();
        REGISTRY = IUpNameRegistry(registry);
    }

    /// @inheritdoc IUpIdResolver
    /// @dev Every registry call is wrapped in `try`. `EmployerRegistry._checkUpId` already
    ///      guards against a reverting resolver, but a resolver that returns `address(0)`
    ///      instead of reverting keeps the failure mode identical whether the registry is
    ///      healthy, upgraded behind its proxy, or gone.
    function resolve(string calldata name) external view returns (address owner) {
        bytes memory label = _label(bytes(name));
        if (label.length == 0) return address(0);

        uint256 tokenId = uint256(keccak256(label));

        try REGISTRY.ownerOf(tokenId) returns (address holder) {
            if (holder == address(0)) return address(0);

            // The forward entry must agree with the reverse index...
            try REGISTRY.ownedTokenId(holder) returns (uint256 owned) {
                if (owned != tokenId) return address(0);
            } catch {
                return address(0);
            }

            // ...and the name must not have lapsed.
            try REGISTRY.hasActiveName(holder) returns (bool active) {
                return active ? holder : address(0);
            } catch {
                return address(0);
            }
        } catch {
            return address(0);
        }
    }

    /// @inheritdoc IUpIdResolver
    /// @dev Returns the full name ("hanuel.up.id"), not the bare label, so callers can render
    ///      it verbatim and feed it straight back into `resolve` for a round trip.
    function reverse(address addr) external view returns (string memory name) {
        if (addr == address(0)) return "";

        try REGISTRY.hasActiveName(addr) returns (bool active) {
            if (!active) return "";
        } catch {
            return "";
        }

        uint256 tokenId;
        try REGISTRY.ownedTokenId(addr) returns (uint256 owned) {
            if (owned == 0) return "";
            tokenId = owned;
        } catch {
            return "";
        }

        try REGISTRY.getLabel(bytes32(tokenId)) returns (string memory label) {
            if (bytes(label).length == 0) return "";
            return string.concat(label, ".up.id");
        } catch {
            return "";
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                                  INTERNAL                                  */
    /* -------------------------------------------------------------------------- */

    /// @dev Extracts the bare label from a full up.id name, or returns "" if `full` is not a
    ///      well-formed single-label `<label>.up.id`. Byte-wise on purpose: labels are ASCII
    ///      in the registry, and a UTF-8-aware pass would cost gas on a view path that
    ///      `register()` sits behind.
    /// @param full The full name as stored by EmployerRegistry, e.g. "hanuel.up.id".
    /// @return label The bare label, e.g. "hanuel", or empty on any malformed input.
    function _label(bytes memory full) private pure returns (bytes memory label) {
        if (full.length <= SUFFIX_LEN) return ""; // "" or ".up.id" alone: no label.

        uint256 labelLen = full.length - SUFFIX_LEN;

        // Suffix must match exactly, byte for byte.
        for (uint256 i = 0; i < SUFFIX_LEN; ++i) {
            if (full[labelLen + i] != SUFFIX[i]) return "";
        }

        // The label itself must contain no dot — up.id issues one level only.
        label = new bytes(labelLen);
        for (uint256 i = 0; i < labelLen; ++i) {
            bytes1 c = full[i];
            if (c == 0x2e) return ""; // '.'
            label[i] = c;
        }
    }
}
