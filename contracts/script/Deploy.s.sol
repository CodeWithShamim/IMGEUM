// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";

import {EmployerRegistry} from "../src/EmployerRegistry.sol";
import {WageVault} from "../src/WageVault.sol";
import {ArrearsAttestor} from "../src/ArrearsAttestor.sol";
import {MockDojangScroll} from "../src/mocks/MockDojangScroll.sol";
import {MockUpIdResolver} from "../src/mocks/MockUpIdResolver.sol";
import {GiwaConstants} from "../src/GiwaConstants.sol";

/// @notice Deploys the full IMGEUM stack to GIWA Sepolia and writes an addresses artifact
///         the frontend consumes directly (never hand-copied — build spec §7).
///
/// @dev Two env-driven switches keep the mainnet swap a one-file change:
///
///        DOJANG_MODE  = "live" | "mock"   (default "mock" on a testnet)
///          live -> wires the real DojangScroll at GiwaConstants.DOJANG_SCROLL and gates on
///                  the real attester.
///          mock -> deploys MockDojangScroll with open self-enrollment so a demo wallet can
///                  obtain verification at the booth. The artifact records dojangMode so the
///                  frontend can render an explicit "MOCK VERIFICATION" banner.
///
///        ATTESTER_MODE = "faucet" | "upbit" (default "faucet" on testnet)
///          Which Dojang attester the registry accepts. On GIWA Sepolia a demo wallet can
///          realistically hold the testnet-faucet attester, not an Upbit-Korea KYC one.
///
///      Run:
///        forge script script/Deploy.s.sol:Deploy \
///          --rpc-url $GIWA_SEPOLIA_RPC_URL --account deployer --broadcast \
///          --verify --verifier blockscout --verifier-url $BLOCKSCOUT_API_URL
///      (command shape per https://docs.giwa.io/get-started/smart-contract/develop/foundry.md)
contract Deploy is Script {
    function run() external {
        address owner = vm.envOr("PROTOCOL_OWNER", msg.sender);
        string memory dojangMode = vm.envOr("DOJANG_MODE", string("mock"));
        string memory attesterMode = vm.envOr("ATTESTER_MODE", string("faucet"));

        bytes32 attesterId =
            _isUpbit(attesterMode) ? GiwaConstants.ATTESTER_UPBIT_KOREA : GiwaConstants.ATTESTER_TESTNET_FAUCET;

        vm.startBroadcast();

        // 1. Dojang verifier: real predeploy or a demo mock.
        address dojang;
        bool mock = _isMock(dojangMode);
        if (mock) {
            dojang = address(new MockDojangScroll(owner));
        } else {
            dojang = GiwaConstants.DOJANG_SCROLL;
        }

        // 2. Registry, vault, attestor.
        EmployerRegistry registry = new EmployerRegistry(dojang, attesterId, owner);
        WageVault vault = new WageVault(address(registry), owner);
        ArrearsAttestor attestor = new ArrearsAttestor(address(vault), address(registry), dojang, attesterId);

        // 3. Wire permissions.
        registry.setRecorder(address(vault), true);
        registry.setRecorder(address(attestor), true);
        vault.setAttestor(address(attestor));

        // 4. up.id: no published GIWA Sepolia resolver yet, so ship a demo mock in mock mode
        //    and leave it disabled (address(0)) in live mode — see IUpIdResolver docs.
        address upid = address(0);
        if (mock) {
            upid = address(new MockUpIdResolver());
            registry.setUpIdResolver(upid);
        }

        vm.stopBroadcast();

        _writeArtifact(registry, vault, attestor, dojang, upid, attesterId, mock);

        console2.log("IMGEUM deployed to chain", block.chainid);
        console2.log("  EmployerRegistry", address(registry));
        console2.log("  WageVault       ", address(vault));
        console2.log("  ArrearsAttestor ", address(attestor));
        console2.log("  DojangVerifier  ", dojang, mock ? "(MOCK)" : "(live)");
    }

    function _writeArtifact(
        EmployerRegistry registry,
        WageVault vault,
        ArrearsAttestor attestor,
        address dojang,
        address upid,
        bytes32 attesterId,
        bool mock
    ) internal {
        string memory k = "imgeum";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeAddress(k, "employerRegistry", address(registry));
        vm.serializeAddress(k, "wageVault", address(vault));
        vm.serializeAddress(k, "arrearsAttestor", address(attestor));
        vm.serializeAddress(k, "dojangVerifier", dojang);
        vm.serializeAddress(k, "upIdResolver", upid);
        vm.serializeBytes32(k, "attesterId", attesterId);
        string memory json = vm.serializeBool(k, "dojangMock", mock);

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("Artifact written to", path);
    }

    function _isMock(string memory m) internal pure returns (bool) {
        return keccak256(bytes(m)) == keccak256(bytes("mock"));
    }

    function _isUpbit(string memory m) internal pure returns (bool) {
        return keccak256(bytes(m)) == keccak256(bytes("upbit"));
    }
}
