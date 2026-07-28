// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";

import {EmployerRegistry} from "../src/EmployerRegistry.sol";
import {WageVault} from "../src/WageVault.sol";
import {ArrearsAttestor} from "../src/ArrearsAttestor.sol";
import {UpIdResolver} from "../src/UpIdResolver.sol";
import {GiwaConstants} from "../src/GiwaConstants.sol";

/// @notice Deploys the full IMGEUM stack against GIWA's REAL identity infrastructure and
///         writes an addresses artifact the frontend consumes directly (never hand-copied —
///         build spec §7).
///
/// @dev There is no mock mode. Identity is always the live DojangScroll
///      (`GiwaConstants.DOJANG_SCROLL`) and the live UPNameRegistry
///      (`GiwaConstants.UP_NAME_REGISTRY`); the script reverts if either has no code on the
///      target chain, so a deployment can never silently claim verification it cannot check.
///      A wallet obtains a real Verified Address attestation for itself at
///      https://sepolia-playground.giwa.io/ ("Dojang 발급"), which is what unlocks
///      `EmployerRegistry.register()`.
///
///      One env switch remains, and both of its values are real attesters:
///
///        ATTESTER_MODE = "faucet" | "upbit"   (default "faucet")
///          faucet -> GIWA TESTNET FAUCET attester. The one a GIWA Sepolia wallet can
///                    actually obtain, so it is the testnet default.
///          upbit  -> UPBIT KOREA attester: a real, KYC'd Korean entity. Mainnet setting.
///
///      Address overrides (`DOJANG_SCROLL`, `UP_NAME_REGISTRY`) exist only so the stack can
///      be deployed onto an anvil *fork* of GIWA for rehearsal — the forked chain carries the
///      same real contracts. They default to the documented addresses.
///
///      Run:
///        forge script script/Deploy.s.sol:Deploy \
///          --rpc-url $GIWA_SEPOLIA_RPC_URL --account deployer --broadcast \
///          --verify --verifier blockscout --verifier-url $BLOCKSCOUT_API_URL
///      (command shape per https://docs.giwa.io/get-started/smart-contract/develop/foundry.md)
contract Deploy is Script {
    error NoCodeAt(string what, address addr);

    function run() external {
        address owner = vm.envOr("PROTOCOL_OWNER", msg.sender);
        string memory attesterMode = vm.envOr("ATTESTER_MODE", string("faucet"));
        address dojang = vm.envOr("DOJANG_SCROLL", GiwaConstants.DOJANG_SCROLL);
        address upNameRegistry = vm.envOr("UP_NAME_REGISTRY", GiwaConstants.UP_NAME_REGISTRY);

        bool upbit = _isUpbit(attesterMode);
        bytes32 attesterId = upbit ? GiwaConstants.ATTESTER_UPBIT_KOREA : GiwaConstants.ATTESTER_TESTNET_FAUCET;

        // Fail before broadcasting anything: a registry pointed at an empty address would
        // accept nobody, and an evidence record whose attestation UID cannot be re-read is
        // worthless in front of a labour office.
        _requireCode("DojangScroll", dojang);
        _requireCode("UPNameRegistry", upNameRegistry);

        vm.startBroadcast();

        // 1. Registry, vault, attestor — all gated on the live Dojang.
        EmployerRegistry registry = new EmployerRegistry(dojang, attesterId, owner);
        WageVault vault = new WageVault(address(registry), owner);
        ArrearsAttestor attestor = new ArrearsAttestor(address(vault), address(registry), dojang, attesterId);

        // 2. Wire permissions.
        registry.setRecorder(address(vault), true);
        registry.setRecorder(address(attestor), true);
        vault.setAttestor(address(attestor));

        // 3. Real up.id resolution over the live UPNameRegistry. Display-only by design:
        //    it decides the `upIdVerified` badge and never routes a single won.
        UpIdResolver upIdResolver = new UpIdResolver(upNameRegistry);
        registry.setUpIdResolver(address(upIdResolver));

        vm.stopBroadcast();

        _writeArtifact(registry, vault, attestor, dojang, address(upIdResolver), upNameRegistry, attesterId, upbit);

        console2.log("IMGEUM deployed to chain", block.chainid);
        console2.log("  EmployerRegistry", address(registry));
        console2.log("  WageVault       ", address(vault));
        console2.log("  ArrearsAttestor ", address(attestor));
        console2.log("  UpIdResolver    ", address(upIdResolver));
        console2.log("  DojangScroll    ", dojang, "(live)");
        console2.log("  UPNameRegistry  ", upNameRegistry, "(live)");
        console2.log("  attester        ", upbit ? "UPBIT_KOREA" : "TESTNET_FAUCET");
    }

    function _writeArtifact(
        EmployerRegistry registry,
        WageVault vault,
        ArrearsAttestor attestor,
        address dojang,
        address upIdResolver,
        address upNameRegistry,
        bytes32 attesterId,
        bool upbit
    ) internal {
        string memory k = "imgeum";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeAddress(k, "employerRegistry", address(registry));
        vm.serializeAddress(k, "wageVault", address(vault));
        vm.serializeAddress(k, "arrearsAttestor", address(attestor));
        vm.serializeAddress(k, "dojangVerifier", dojang);
        vm.serializeAddress(k, "upIdResolver", upIdResolver);
        vm.serializeAddress(k, "upNameRegistry", upNameRegistry);
        vm.serializeBytes32(k, "attesterId", attesterId);
        string memory json = vm.serializeString(k, "attesterMode", upbit ? "upbit" : "faucet");

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("Artifact written to", path);
    }

    function _requireCode(string memory what, address addr) internal view {
        if (addr.code.length == 0) revert NoCodeAt(what, addr);
    }

    function _isUpbit(string memory m) internal pure returns (bool) {
        return keccak256(bytes(m)) == keccak256(bytes("upbit"));
    }
}
