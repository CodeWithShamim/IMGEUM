# IMGEUM contracts — Foundry workflow.
# Chain constants and the verification flow follow the official GIWA docs; see .env.example.
-include .env
export

.PHONY: help install build test test-fuzz coverage snapshot fmt slither clean \
        deploy-testnet deploy-testnet-live verify-env

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	forge install

build: ## Compile contracts
	forge build

test: ## Run the full test suite
	forge test -vv

test-fuzz: ## Run only fuzz + invariant suites with the CI profile (2048 runs)
	FOUNDRY_PROFILE=ci forge test --match-path "test/*fuzz*" -vv
	FOUNDRY_PROFILE=ci forge test --match-path "test/invariant/*" -vv

coverage: ## Line/branch coverage for src contracts
	forge coverage --no-match-coverage "(test|mock|Mock)"

snapshot: ## Gas snapshot
	forge snapshot

fmt: ## Format Solidity
	forge fmt

slither: ## Static analysis (requires slither installed)
	slither . --config-file slither.config.json

clean: ## Remove build artifacts
	forge clean

verify-env: ## Fail early if required deploy env vars are missing
	@test -n "$(GIWA_SEPOLIA_RPC_URL)" || (echo "GIWA_SEPOLIA_RPC_URL unset — copy .env.example to .env" && exit 1)
	@echo "env OK: RPC=$(GIWA_SEPOLIA_RPC_URL)"

# Demo deploy: MockDojangScroll + faucet attester. Registers work at the booth.
deploy-testnet: verify-env ## Deploy to GIWA Sepolia (demo / mock Dojang)
	DOJANG_MODE=mock ATTESTER_MODE=faucet forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(GIWA_SEPOLIA_RPC_URL) \
		--account deployer \
		--broadcast \
		--verify \
		--verifier blockscout \
		--verifier-url $(BLOCKSCOUT_API_URL)

# Production-shaped deploy: real DojangScroll predeploy + faucet attester (swap to upbit for mainnet).
deploy-testnet-live: verify-env ## Deploy to GIWA Sepolia against the real DojangScroll
	DOJANG_MODE=live ATTESTER_MODE=faucet forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(GIWA_SEPOLIA_RPC_URL) \
		--account deployer \
		--broadcast \
		--verify \
		--verifier blockscout \
		--verifier-url $(BLOCKSCOUT_API_URL)
