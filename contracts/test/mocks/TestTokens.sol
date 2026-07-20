// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Plain ERC-20 wage token, standing in for a KRW stablecoin.
/// @dev Follows the token shape in https://docs.giwa.io/get-started/smart-contract/issue-a-token.md
contract MockERC20 is ERC20 {
    uint8 private immutable _DECIMALS;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _DECIMALS = d;
    }

    function decimals() public view override returns (uint8) {
        return _DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice ERC-20 that burns a fee on every transfer.
/// @dev Exists to prove `WageVault.fund` credits the measured balance delta rather than the
///      declared amount. Without that, a vault paid in a fee-charging token would report
///      itself fully funded while holding less than it owes.
contract FeeOnTransferERC20 is ERC20 {
    uint256 public feeBps;

    constructor(uint256 feeBps_) ERC20("Fee Token", "FEE") {
        feeBps = feeBps_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFeeBps(uint256 bps) external {
        feeBps = bps;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0) || feeBps == 0) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = (value * feeBps) / 10_000;
        super._update(from, to, value - fee);
        super._update(from, address(0xdead), fee);
    }
}

/// @notice ERC-20 whose transfers can be made to fail on demand.
contract RevertingERC20 is ERC20 {
    bool public failTransfers;

    constructor() ERC20("Reverting", "RVT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFailTransfers(bool v) external {
        failTransfers = v;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        require(!failTransfers, "RVT: transfer disabled");
        return super.transfer(to, value);
    }
}
