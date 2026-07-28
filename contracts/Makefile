# IMGEUM contracts — Foundry workflow.
# Chain constants and the verification flow follow the official GIWA docs; see .env.example.
-include .env
export

.PHONY: help install build test test-fork test-fuzz coverage snapshot fmt slither clean \
        deploy-testnet deploy-testnet-dry deploy-mainnet verify-env

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	forge install

build: ## Compile contracts
	forge build

test: ## Run the full test suite (fork tests skip without GIWA_SEPOLIA_RPC_URL)
	forge test -vv

test-fork: ## Run only the fork suite against live GIWA Sepolia
	forge test --match-path "test/fork/*" -vvv

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

# Which `cast wallet import` keystore account signs a deploy. Overridable, because the account
# name is a property of the machine doing the deploying, not of this repo:
#   make deploy-testnet DEPLOY_ACCOUNT=myaccount
DEPLOY_ACCOUNT ?= deployer

verify-env: ## Fail early if required deploy env vars are missing
	@test -n "$(GIWA_SEPOLIA_RPC_URL)" || (echo "GIWA_SEPOLIA_RPC_URL unset — copy .env.example to .env" && exit 1)
	@echo "env OK: RPC=$(GIWA_SEPOLIA_RPC_URL)"

# Testnet deploy: real DojangScroll + real UPNameRegistry, gated on the TESTNET FAUCET
# attester (the one a GIWA Sepolia wallet can obtain at https://sepolia-playground.giwa.io/).
deploy-testnet: verify-env ## Deploy to GIWA Sepolia against the live Dojang + up.id
	ATTESTER_MODE=faucet forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(GIWA_SEPOLIA_RPC_URL) \
		--account $(DEPLOY_ACCOUNT) \
		--broadcast \
		--verify \
		--verifier blockscout \
		--verifier-url $(BLOCKSCOUT_API_URL)

# Dry run against the live chain state — simulates, never broadcasts.
deploy-testnet-dry: verify-env ## Simulate the GIWA Sepolia deploy without broadcasting
	ATTESTER_MODE=faucet forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(GIWA_SEPOLIA_RPC_URL) \
		$(if $(DEPLOYER_ADDRESS),--sender $(DEPLOYER_ADDRESS),)

# Mainnet-shaped deploy: gated on the UPBIT KOREA attester (real KYC'd Korean entities).
deploy-mainnet: verify-env ## Deploy gated on the Upbit Korea attester
	ATTESTER_MODE=upbit forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(GIWA_SEPOLIA_RPC_URL) \
		--account $(DEPLOY_ACCOUNT) \
		--broadcast \
		--verify \
		--verifier blockscout \
		--verifier-url $(BLOCKSCOUT_API_URL)
