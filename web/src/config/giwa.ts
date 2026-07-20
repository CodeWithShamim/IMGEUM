import {defineChain} from 'viem';

/**
 * GIWA chain configuration — the single source of truth for every chain constant.
 *
 * EVERY value below is transcribed from an official GIWA documentation page and annotated
 * with the exact URL. Nothing here is remembered or guessed. Any page also exists as
 * markdown by appending `.md`, and supports live Q&A via `?ask=<question>`.
 *
 * Mainnet swap: GIWA mainnet is documented as "현재 개발 중" (in development) with no public
 * connection parameters yet. When it ships, add a `giwaMainnet` chain here and switch
 * `ACTIVE_CHAIN`; nothing else in the app hardcodes a chain id or RPC.
 */

// Source: https://docs.giwa.io/get-started/connect-to-giwa.md
export const GIWA_SEPOLIA_CHAIN_ID = 91342;
const GIWA_SEPOLIA_RPC_HTTP = 'https://sepolia-rpc.giwa.io';
// Source: https://docs.giwa.io/network-information/flashblocks.md
// 200ms preconfirmations; query with the "pending" tag for the latest flashblock state.
const GIWA_SEPOLIA_FLASHBLOCKS_RPC = 'https://sepolia-rpc-flashblocks.giwa.io';
// Source: https://docs.giwa.io/get-started/connect-to-giwa.md
const GIWA_SEPOLIA_EXPLORER = 'https://sepolia-explorer.giwa.io';

/**
 * Block time in milliseconds.
 * Source: https://docs.giwa.io/network-information/diffs-ethereum-giwa.md — GIWA targets 1s
 * blocks (Ethereum: 12s). This drives the frontend poll cadence and the client-side
 * interpolation budget for the wage counter.
 */
export const GIWA_BLOCK_TIME_MS = 1000;

// Allow overriding the RPC via env (docs note the public endpoints are rate-limited and not
// for production), but default to the official one so a fresh clone works out of the box.
const RPC_HTTP = import.meta.env.VITE_GIWA_RPC_URL ?? GIWA_SEPOLIA_RPC_HTTP;
const FLASHBLOCKS_RPC = import.meta.env.VITE_GIWA_FLASHBLOCKS_RPC_URL ?? GIWA_SEPOLIA_FLASHBLOCKS_RPC;

/** viem chain definition for GIWA Sepolia, built from the connect docs. */
export const giwaSepolia = defineChain({
  id: GIWA_SEPOLIA_CHAIN_ID,
  name: 'GIWA Sepolia',
  nativeCurrency: {name: 'Ether', symbol: 'ETH', decimals: 18},
  rpcUrls: {
    default: {http: [RPC_HTTP]},
    flashblocks: {http: [FLASHBLOCKS_RPC]},
  },
  blockExplorers: {
    default: {name: 'GIWA Sepolia Explorer', url: GIWA_SEPOLIA_EXPLORER},
  },
  testnet: true,
});

export const ACTIVE_CHAIN = giwaSepolia;

/** External GIWA ecosystem links used across the UI and docs. */
export const GIWA_LINKS = {
  faucet: 'https://faucet.giwa.io/',
  explorer: GIWA_SEPOLIA_EXPLORER,
  docs: 'https://docs.giwa.io',
  connectDocs: 'https://docs.giwa.io/get-started/connect-to-giwa',
  dojangDocs: 'https://docs.giwa.io/giwa-ecosystem/dojang',
  verifiedAddressDocs: 'https://docs.giwa.io/giwa-ecosystem/dojang/verified-address',
  upIdDocs: 'https://docs.giwa.io/giwa-ecosystem/up-id',
  flashblocksDocs: 'https://docs.giwa.io/network-information/flashblocks',
  onchainVerifiableDocs: 'https://docs.giwa.io/get-started/smart-contract/onchainverifiable',
  feesDocs: 'https://docs.giwa.io/network-information/transaction-fees',
} as const;

/**
 * Dojang identifiers, for optional client-side pre-checks and deep links into the explorer.
 * Source: https://docs.giwa.io/giwa-ecosystem/dojang/contracts.md
 */
export const DOJANG = {
  scroll: '0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9',
  eas: '0x4200000000000000000000000000000000000021',
  attesterUpbitKorea: '0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034',
  attesterTestnetFaucet: '0xaa92f8c143657dde575de430aecaea6ca91f2e6072339b16932d426895d8d678',
  schemaVerifiedAddress: '0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08',
} as const;

/** Build an explorer URL for a tx / address / attestation. */
export const explorerTx = (hash: string) => `${GIWA_SEPOLIA_EXPLORER}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${GIWA_SEPOLIA_EXPLORER}/address/${addr}`;
