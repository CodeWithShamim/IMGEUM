<div align="center">

# IMGEUM · 임금 프로토콜

**Proof-of-solvency payroll and wage-arrears evidence, built on the GIWA chain.**

Make employer solvency _visible before payday_ — and non-payment _provable in one transaction_.

`English` · [`한국어`](./README.ko.md)

Built on [GIWA](https://giwa.io) (OP Stack L2 by Upbit/Dunamu) · Submitted to the **GASOK** accelerator

</div>

---

## The problem

Korea has one of the highest wage-arrears (임금체불) rates in the OECD. In 2023, unpaid wages
exceeded **₩1.78 trillion**, affecting **over 275,000 workers** ([고용노동부 / Ministry of Employment
and Labor, 2023 statistics](https://www.moel.go.kr)). The workers hit hardest — factory staff,
delivery riders, part-timers, foreign laborers — discover their employer can't pay only when
payday fails, and then spend months assembling evidence for the labor office.

## The solution

IMGEUM has two layers:

1. **Streaming wage escrow.** A Dojang-verified employer opens a time-locked vault per worker per
   pay period and funds it continuously. The worker watches their earned balance accrue in real
   time — GIWA's 1-second blocks make the counter genuinely _alive_.
2. **Arrears attestation (the killer feature).** If the vault is underfunded at the payout
   deadline, **anyone** can call `attestArrears()`, minting an immutable, timestamped, on-chain
   evidence record and a soulbound evidence token to the worker. The worker exports a
   court/labor-office-ready evidence page — no wallet required to read it. **This layer has
   standalone value: it works even when employers refuse to cooperate.**

Plus: **verified employers** (Dojang Verified Address), **human-readable identity** (Upbit Web3
Names, `name.up.id`), and a public **pay-reliability score** employers can show in job postings.

---

## Features

- ⏱️ **Live wage stream** — earned wages tick every frame; a `VaultFunded` event fires a gold
  particle burst so you _feel_ GIWA's block speed.
- 🧾 **Trustless evidence** — every arrears record follows GIWA's OnchainVerifiable pattern and
  stores the employer's Dojang attestation UID, re-checkable directly against EAS.
- 🔒 **Soulbound proof** — evidence tokens are non-transferable and cannot be burned.
- 🌏 **Fully bilingual (KO / EN)** — first-class Korean, not a translation afterthought. CI fails
  on any untranslated string.
- 🎨 **Neo-Dancheong design system** — the vivid five-color palette of Korean temple roofs,
  digitized. Ties directly to GIWA's roof-tile identity.
- 💸 **ETH + ERC-20** wage tokens, fee-on-transfer safe.

---

## Giwa criteria mapping

| Criterion                     | How IMGEUM answers it                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Why GIWA specifically**     | The product is only legible on a fast chain. GIWA's **1-second blocks** + **Flashblocks** (200ms preconfirmations) make a per-second wage stream real, not cosmetic. **Dojang Verified Address** gives employer identity a worker can trust; **up.id** gives human-readable addressing. None of this composes on a 12-second L1. |
| **Originality**               | Not another DeFi primitive. A wage-arrears _evidence_ protocol targeting a specific, documented Korean social problem — with an evidence layer that delivers value even at zero employer adoption.                                                                                                                               |
| **Feasibility**               | Contracts complete, 74 tests green (unit + fuzz + invariant, >95% line coverage), one-command testnet deploy, full bilingual frontend that builds with zero TypeScript errors.                                                                                                                                                   |
| **Market demand**             | ₩1.78T in annual arrears, 275,000+ workers/year (MOEL 2023). Labor offices, unions, and migrant-worker advocates are concrete first users.                                                                                                                                                                                       |
| **GIWA Wallet embeddability** | The `/worker` view is designed as a wallet in-app tab: mobile-first, injected-connector-first, one primary action (withdraw), live stream front-and-center.                                                                                                                                                                      |

---

## Monorepo layout

```
imgeum/
├── contracts/          Foundry project (Solidity ^0.8.28, OpenZeppelin v5)
│   ├── src/            EmployerRegistry · WageVault · ArrearsAttestor · GiwaConstants
│   │   ├── interfaces/ IDojangVerifier · IUpIdResolver · I{EmployerRegistry,WageVault}
│   │   └── mocks/      MockDojangScroll · MockUpIdResolver (demo swap points)
│   ├── test/           unit · fuzz · invariant suites
│   ├── script/         Deploy.s.sol (env-driven, writes deployments/<chainId>.json)
│   └── Makefile        make test / coverage / deploy-testnet
└── web/                Vite + React 18 + TS + Tailwind + wagmi/viem + framer-motion
    ├── src/config/     giwa.ts (every constant traced to a doc URL) · abis/ · deployments.json
    ├── src/locales/    en/ + ko/ × 7 namespaces
    ├── src/components/  ui/ · motion/ · wage/ · layout/
    ├── src/pages/      Landing · Worker · Employer · Evidence · Docs
    └── scripts/        sync-contracts.mjs · check-i18n.mjs
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the contract-by-contract design rationale, stream
math + tested invariants, trust model, and threat model.

---

## Quickstart

### Contracts

```bash
cd contracts
make install          # forge install
make test             # 74 tests: unit + fuzz + invariant
make coverage         # >95% lines on the three core contracts

# Deploy to GIWA Sepolia (demo mode: mock Dojang so a booth wallet can register)
cp .env.example .env  # then: cast wallet import deployer --interactive
make deploy-testnet
```

The deploy command follows GIWA's official Foundry flow verbatim
([docs](https://docs.giwa.io/get-started/smart-contract/develop/foundry)):
`forge script … --verify --verifier blockscout --verifier-url $BLOCKSCOUT_API_URL`.

### Web

```bash
cd web
pnpm install
node scripts/sync-contracts.mjs   # copy ABIs + addresses from Foundry artifacts (never hand-copied)
pnpm dev                          # http://localhost:5173
pnpm check:i18n                   # EN/KO parity + no hardcoded strings (CI gate)
pnpm build                        # tsc + vite, zero TS errors
```

---

## Environment variables

### `contracts/.env`

| Var                    | Purpose                                     | Default / source                                                                                 |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GIWA_SEPOLIA_RPC_URL` | Deploy RPC                                  | `https://sepolia-rpc.giwa.io` ([connect docs](https://docs.giwa.io/get-started/connect-to-giwa)) |
| `BLOCKSCOUT_API_URL`   | Verification endpoint                       | `https://sepolia-explorer.giwa.io/api`                                                           |
| `BLOCKSCOUT_API_KEY`   | Verification key                            | from the explorer                                                                                |
| `DOJANG_MODE`          | `mock` (demo) or `live` (real DojangScroll) | `mock`                                                                                           |
| `ATTESTER_MODE`        | `faucet` (testnet) or `upbit` (production)  | `faucet`                                                                                         |
| `PROTOCOL_OWNER`       | Contract owner (multisig in prod)           | deployer                                                                                         |

### `web/.env` (all optional — app runs with none)

| Var                             | Purpose         | Default                   |
| ------------------------------- | --------------- | ------------------------- |
| `VITE_GIWA_RPC_URL`             | Read RPC        | official GIWA Sepolia RPC |
| `VITE_GIWA_FLASHBLOCKS_RPC_URL` | Flashblocks RPC | official flashblocks RPC  |

---

## Tech stack

**Contracts** — Solidity ^0.8.28 · Foundry · OpenZeppelin v5 (Ownable2Step, ReentrancyGuard,
SafeERC20, Pausable, ERC721) · Slither config included.

**Frontend** — Vite · React 18 · TypeScript (strict) · TailwindCSS v3 (custom Neo-Dancheong
theme) · framer-motion · wagmi + viem (`defineChain` from the official connect docs) · TanStack
Query · Zustand · react-router · react-i18next.

---

## Roadmap (mapped to GASOK phases)

- **Phase 1 — MVP (Jun–Jul):** ✅ contracts + tests + bilingual app; testnet deploy; full demo path.
- **Phase 2 — Productize (Aug–Sep):** swap mock Dojang → live DojangScroll; client-side ENS
  resolution for up.id; Upbit Oracle for live KRW display; contract audit (Giwa builder package);
  GIWA Wallet tab integration.
- **KPI targets:** monthly funded vaults · active workers · attestations minted · transaction volume.

---

## Definition of done (spec §9) — status

- ✅ Contracts compile; 74 tests pass (unit + fuzz + invariant); >95% line coverage on core.
- ✅ One-command testnet deploy + Blockscout verification wired per GIWA docs.
- ✅ Full demo path implemented: register → open vault → fund → stream → withdraw → arrears → evidence.
- ✅ Zero TypeScript errors; landing chunk ~2 KB gzip (Lighthouse-friendly, code-split).
- ✅ Every page in KO **and** EN; CI string-check passes (zero untranslated strings).
- ✅ Every chain constant traceable to an official GIWA doc URL in code comments.
- ⏳ Live testnet deployment + verified contracts: run `make deploy-testnet` with a funded deployer.

---

## License

MIT © IMGEUM contributors.
