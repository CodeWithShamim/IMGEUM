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
│   ├── src/            EmployerRegistry · WageVault · ArrearsAttestor · UpIdResolver · GiwaConstants
│   │   └── interfaces/ IDojangVerifier · IUpIdResolver · IUpNameRegistry · I{EmployerRegistry,WageVault}
│   ├── test/           unit · fuzz · invariant · fork (live GIWA Sepolia) suites
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
make test             # 117 tests: unit + fuzz + invariant + live-chain fork
make test-fork        # only the fork suite, against real GIWA Sepolia state
make coverage         # >95% lines on the three core contracts

# Deploy to GIWA Sepolia. Identity is always GIWA's live DojangScroll + UPNameRegistry —
# there is no mock mode, and the script reverts if either has no code on the target chain.
cp .env.example .env  # then: cast wallet import deployer --interactive
make deploy-testnet-dry   # simulate against live chain state first
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
| `ATTESTER_MODE`        | `faucet` (testnet) or `upbit` (production)  | `faucet`                                                                                         |
| `PROTOCOL_OWNER`       | Contract owner (multisig in prod)           | deployer                                                                                         |

### `web/.env` (all optional — app runs with none)

| Var                             | Purpose         | Default                   |
| ------------------------------- | --------------- | ------------------------- |
| `VITE_GIWA_RPC_URL`             | Read RPC        | official GIWA Sepolia RPC |
| `VITE_GIWA_FLASHBLOCKS_RPC_URL` | Flashblocks RPC | official flashblocks RPC  |

---

## Live deployment — GIWA Sepolia (chain 91342)

All four contracts are deployed and source-verified, wired to GIWA's **real** identity
infrastructure. There is no mock mode: registration is gated on the live DojangScroll, and a
wallet obtains its own Verified Address at [the GIWA
Playground](https://sepolia-playground.giwa.io/) ("Dojang 발급").

| Contract | Address |
| --- | --- |
| `EmployerRegistry` | [`0xc7919F673f9886Eec01511ce66B7fBD23EA835E5`](https://sepolia-explorer.giwa.io/address/0xc7919F673f9886Eec01511ce66B7fBD23EA835E5) |
| `WageVault` | [`0xf563E78ED45dDd8d324729aB37634d56800a839B`](https://sepolia-explorer.giwa.io/address/0xf563E78ED45dDd8d324729aB37634d56800a839B) |
| `ArrearsAttestor` | [`0xc123985c09a0a9f3FC9077b5aB40B59dec9B4f4b`](https://sepolia-explorer.giwa.io/address/0xc123985c09a0a9f3FC9077b5aB40B59dec9B4f4b) |
| `UpIdResolver` | [`0x9Bd42BfE3802B5419A75976E0cE0814ADF685404`](https://sepolia-explorer.giwa.io/address/0x9Bd42BfE3802B5419A75976E0cE0814ADF685404) |

Read against GIWA's own contracts, not ours:

| GIWA contract | Address | Role |
| --- | --- | --- |
| `DojangScroll` | `0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9` | Employer identity gate |
| `UPNameRegistry` | `0x091D00004f21eb2Fc30964A8a4995692d9b49628` | `name.up.id` resolution |
| Attester | `TESTNET_FAUCET` | Which Verified Address attestations count |

---

## Security

Four vulnerabilities were found and fixed by moving off mock mode and onto the live chain.
Each has a working exploit preserved as a regression test in
[`contracts/test/Exploits.t.sol`](./contracts/test/Exploits.t.sol).

| # | Issue | Impact | Fix |
| --- | --- | --- | --- |
| 1 | `getVerifiedAddressAttestationUid` **reverts** on the live DojangScroll for expired/revoked attestations, where `isVerified` returns `false` | An employer letting verification lapse blanked `verifyRecord` — the labour-office evidence page — for every arrears record naming them | Guarded read (`ArrearsAttestor._liveDojangUid`); the frozen snapshot outlives the identity |
| 2 | No minimum pay period | A perfect, `rated` solvency score of 1000 farmable in **6 seconds** with 1-wei vaults to a controlled wallet | `WageVault.MIN_PERIOD`, measured from `block.timestamp` so backdating cannot buy the time back |
| 3 | `setRecorder(attestor, false)` | One owner transaction permanently disabled arrears attestation, routing around the write-once `setAttestor` guarantee | Recorder grants are irrevocable; `attestArrears` also records history best-effort |
| 4 | `_safeMint` + pausable `fund` | Smart-account workers could **never** receive evidence; and a pause manufactured arrears against employers who were paying on time | `_mint` (the token is soulbound anyway); `fund` is no longer pausable |

`make test` runs 117 tests — unit, fuzz, invariant, and a fork suite executed against live
GIWA Sepolia state.

---

## Tech stack

**Contracts** — Solidity ^0.8.28 · Foundry · OpenZeppelin v5 (Ownable2Step, ReentrancyGuard,
SafeERC20, Pausable, ERC721) · Slither config included.

**Frontend** — Vite · React 18 · TypeScript (strict) · TailwindCSS v3 (custom Neo-Dancheong
theme) · framer-motion · wagmi + viem (`defineChain` from the official connect docs) · TanStack
Query · Zustand · react-router · react-i18next.

---

## Roadmap (mapped to GASOK phases)

Status marks are literal. **✅** is in `main` and exercised by a test or a running screen.
**🚧** means the contract or component exists but the user-facing path does not.
**⬜** is not started.

### Phase 1 — MVP (Jun–Jul) ✅

- ✅ Four contracts deployed and source-verified on GIWA Sepolia against the **live**
  DojangScroll and UPNameRegistry — no mock mode remains in the tree.
- ✅ Unit + fuzz + invariant + live-chain fork suites green; >95% line coverage on the three
  core contracts; four exploits found and frozen as regression tests
  ([`contracts/test/Exploits.t.sol`](./contracts/test/Exploits.t.sol)).
- ✅ Full demo path: register → open vault → fund → stream → withdraw → arrears → evidence.
- ✅ Bilingual KO/EN across every page, with `pnpm check:i18n` as a CI gate.
- ✅ Wrong-network detection and one-prompt chain switching
  ([`web/src/hooks/useNetwork.ts`](./web/src/hooks/useNetwork.ts)) — `useChainId()` reports the
  *configured* chain, never the wallet's, so this needed its own module.

### Phase 2 — Productize (Aug–Sep) 🚧

**Identity — make `name.up.id` the way people are addressed, not a footnote**

- ✅ Forward resolution: an employer types `worker.up.id` into the open-vault form and it
  resolves through `UpIdResolver.resolve` before the transaction is built.
- 🚧 Reverse resolution. [`AddressChip`](./web/src/components/ui/AddressChip.tsx) already accepts
  a `upId` prop and nothing in the app passes it, so every address — including the employer a
  worker most needs to recognise — renders as hex. Needs a `useUpId(address)` hook over
  `UpIdResolver.reverse`, wired into `VaultCard` and the evidence page.

**Reputation as a public good**

- 🚧 Public employer directory (`/employers`). `employersPaged` and `solvencyScore` are both in
  the ABI, but [`useEmployer.ts`](./web/src/hooks/useEmployer.ts) only ever reads the *connected*
  employer's score. A worker cannot look an employer up before taking the job — which is the
  half of the pay-reliability pitch that does not exist yet.
- ⬜ Per-employer public profile: score, funded-vault history, and arrears records via
  `ArrearsAttestor.recordsOfEmployer` (currently unused by the app).

**Money**

- 🚧 ERC-20 wage vaults. `WageVault.openVault` already takes a token address and the contract is
  SafeERC20- and fee-on-transfer-safe; the form hardcodes the native token and `parseEther`.
  Needs a token selector, decimals-aware parsing, and an allowance step ahead of `fund`.
- ⬜ Upbit Oracle for KRW. Every won figure in the app — including on the labour-office evidence
  page — currently derives from `ETH_KRW_PLACEHOLDER` in
  [`web/src/lib/format.ts`](./web/src/lib/format.ts). It is isolated to one constant on purpose.
  Highest correctness stakes on this list: an evidence page is meant to be handed to a labour
  office, so a placeholder rate does not belong on it.

**Chain-speed claims, actually exercised**

- ⬜ Flashblocks preconfirmations. The endpoint is configured today only as a *fallback*
  transport ([`web/src/config/wagmi.ts`](./web/src/config/wagmi.ts)). Reading pending-block state
  after `fund`/`withdraw` would make the 200 ms claim in `/docs` something the app demonstrates
  rather than describes.

**Hardening**

- ⬜ Contract audit (GIWA builder package).
- ⬜ Extend `pnpm check:i18n` to fail on keys referenced by `t()` but missing from a locale file.
  It checks EN/KO parity and hardcoded JSX strings today, which means a key absent from *both*
  files passes CI and renders as its own raw identifier in the UI.

### Phase 3 — Distribution (Oct–Dec) ⬜

- GIWA Wallet in-app tab. `/worker` is already built mobile-first, injected-connector-first,
  one-primary-action for exactly this; the remaining work is their embedding contract.
- Mainnet deploy with `PROTOCOL_OWNER` set to a multisig.
- Labour-office and union pilot: evidence-page layout reviewed by a practising 노무사 (certified
  labour attorney), plus a PDF export alongside the existing print path.
- Batch vault opening for employers running payroll across many workers.

**KPI targets:** monthly funded vaults · active workers · attestations minted · transaction volume.

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
