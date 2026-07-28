// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {WageVault} from "../src/WageVault.sol";

/// @notice Regressions for the audit findings fixed in this change.
contract AuditRegressions is BaseTest {
    address internal evilEmployer = makeAddr("evilEmployer");
    address internal evilWorker = makeAddr("evilWorker");

    /* ----------------------------------------------------------------------- */
    /*      Evidence metadata cannot be forged by the employer it accuses       */
    /* ----------------------------------------------------------------------- */

    /// @dev The attack: a display name that closes the "Employer" trait and injects an earlier
    ///      "Shortfall" trait reading zero. The document stayed valid JSON, so renderers showed
    ///      it — and a reader taking the first match saw a breach of nothing.
    function test_tokenURI_employerCannotInjectTraits() public {
        string memory evilName = 'Acme","value":"x"},{"trait_type":"Shortfall","value":"0"},{"trait_type":"z';
        string memory uri = _attestWithEmployerName(evilName);

        // The injected trait cannot appear: every quote the employer supplied is now escaped,
        // so the whole payload is one JSON string value.
        assertFalse(_contains(uri, '{"trait_type":"Shortfall","value":"0"}'), "injected trait present");
        // The real shortfall is still reported.
        assertTrue(_contains(uri, string.concat('"Shortfall","value":"', vm.toString(WAGE), '"')), "real shortfall lost");
        // And the name survives, escaped rather than dropped.
        assertTrue(_contains(uri, 'Acme\\"'), "name not escaped");
    }

    /// @dev The cruder variant: a lone quote made the metadata invalid JSON, so the evidence
    ///      rendered nowhere at all.
    function test_tokenURI_loneQuoteKeepsMetadataValid() public {
        string memory uri = _attestWithEmployerName('a"b');
        assertTrue(_contains(uri, 'a\\"b'), "quote not escaped");
    }

    /// @dev Backslashes must not escape the closing quote either.
    function test_tokenURI_backslashIsEscaped() public {
        string memory uri = _attestWithEmployerName("a\\");
        assertTrue(_contains(uri, "a\\\\"), "backslash not escaped");
    }

    /// @dev C0 control bytes are forbidden unescaped in JSON strings.
    function test_tokenURI_controlByteIsEscaped() public {
        string memory uri = _attestWithEmployerName(string(abi.encodePacked("a", bytes1(0x0a), "b")));
        assertTrue(_contains(uri, "a\\u000ab"), "control byte not escaped");
    }

    /// @dev Korean names are multi-byte UTF-8 and must pass through untouched.
    function test_tokenURI_koreanNameSurvivesEscaping() public {
        string memory uri = _attestWithEmployerName(unicode"주식회사 아크메");
        assertTrue(_contains(uri, unicode"주식회사 아크메"), "korean name mangled");
    }

    /* ----------------------------------------------------------------------- */
    /*                    closeVault reports the real blocker                   */
    /* ----------------------------------------------------------------------- */

    /// @dev Between periodEnd and payoutDeadline with wages missing, the blocker is the
    ///      shortfall — not the period, which has demonstrably ended.
    function test_close_underfundedBeforeDeadlineReportsShortfall() public {
        uint256 id = _openVault();
        _fundETH(id, WAGE / 4);
        vm.warp(vault.getVault(id).periodEnd + 1);

        vm.expectRevert(abi.encodeWithSelector(WageVault.UnsettledShortfall.selector, id, WAGE - WAGE / 4));
        vault.closeVault(id);
    }

    /* ----------------------------------------------------------------------- */
    /*                       directory paging cannot panic                      */
    /* ----------------------------------------------------------------------- */

    /// @dev `offset + limit` overflowed for a caller passing max as "give me everything".
    function test_employersPaged_hugeLimitDoesNotOverflow() public view {
        address[] memory page = registry.employersPaged(0, type(uint256).max);
        assertEq(page.length, registry.employerCount());
    }

    /* -------------------------------- helpers ------------------------------- */

    /// @dev Registers an employer under `name`, breaches a vault, and returns the DECODED
    ///      evidence JSON — the bytes a wallet or marketplace actually parses.
    function _attestWithEmployerName(string memory name) internal returns (string memory) {
        _registerEmployer(evilEmployer, "evil.up.id", name);
        vm.deal(evilEmployer, 10 * WAGE);

        uint64 start = uint64(block.timestamp);
        uint64 end = start + PERIOD;
        vm.prank(evilEmployer);
        uint256 id = vault.openVault(evilWorker, WAGE, start, end, end + SETTLE, address(0));

        _warpPastDeadline(id);
        string memory uri = attestor.tokenURI(attestor.attestArrears(id));

        string memory json = _decodeDataUri(uri);
        emit log_string(json);
        return json;
    }

    /// @dev Strips `data:application/json;base64,` and base64-decodes the remainder.
    function _decodeDataUri(string memory uri) internal pure returns (string memory) {
        bytes memory u = bytes(uri);
        uint256 prefix = bytes("data:application/json;base64,").length;
        bytes memory enc = new bytes(u.length - prefix);
        for (uint256 i = prefix; i < u.length; ++i) {
            enc[i - prefix] = u[i];
        }
        return string(_base64Decode(enc));
    }

    function _base64Decode(bytes memory data) internal pure returns (bytes memory) {
        uint256 len = data.length;
        if (len == 0) return "";
        uint256 pad = 0;
        if (data[len - 1] == "=") pad++;
        if (len > 1 && data[len - 2] == "=") pad++;

        bytes memory out = new bytes((len / 4) * 3 - pad);
        uint256 n;
        uint256 buffer;
        uint256 bits;
        for (uint256 i; i < len; ++i) {
            if (data[i] == "=") break;
            buffer = (buffer << 6) | _b64Value(uint8(data[i]));
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out[n++] = bytes1(uint8(buffer >> bits));
            }
        }
        return out;
    }

    function _b64Value(uint8 c) private pure returns (uint256) {
        if (c >= 0x41 && c <= 0x5a) return c - 0x41; // A-Z
        if (c >= 0x61 && c <= 0x7a) return c - 0x61 + 26; // a-z
        if (c >= 0x30 && c <= 0x39) return c - 0x30 + 52; // 0-9
        if (c == 0x2b) return 62; // +
        if (c == 0x2f) return 63; // /
        revert("bad base64");
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0 || n.length > h.length) return false;
        for (uint256 i; i <= h.length - n.length; ++i) {
            bool hit = true;
            for (uint256 j; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    hit = false;
                    break;
                }
            }
            if (hit) return true;
        }
        return false;
    }
}
