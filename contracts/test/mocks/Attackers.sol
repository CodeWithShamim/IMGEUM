// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {WageVault} from "../../src/WageVault.sol";

/// @notice A worker contract that re-enters `withdraw` from its ETH receive hook.
/// @dev Proves the nonReentrant guard plus checks-effects-interactions ordering hold on the
///      native-ETH path, which is the only place IMGEUM hands control to an arbitrary address
///      before a transaction completes.
contract ReentrantWorker {
    WageVault public immutable VAULT;
    uint256 public vaultId;
    uint256 public reenterAttempts;
    bool public reenterSucceeded;
    bool private _armed;

    constructor(WageVault vault_) {
        VAULT = vault_;
    }

    function arm(uint256 vaultId_) external {
        vaultId = vaultId_;
        _armed = true;
    }

    function attack() external returns (uint256) {
        return VAULT.withdraw(vaultId);
    }

    receive() external payable {
        if (!_armed) return;
        _armed = false;
        reenterAttempts++;
        try VAULT.withdraw(vaultId) {
            reenterSucceeded = true;
        } catch {
            reenterSucceeded = false;
        }
    }
}

/// @notice A worker contract that rejects ETH outright.
/// @dev Confirms a worker who cannot receive ETH fails loudly on their own withdrawal rather
///      than stranding the vault or blocking anyone else's.
contract RejectingWorker {
    WageVault public immutable VAULT;

    constructor(WageVault vault_) {
        VAULT = vault_;
    }

    function withdraw(uint256 vaultId) external returns (uint256) {
        return VAULT.withdraw(vaultId);
    }

    receive() external payable {
        revert("no ETH");
    }
}
