import {http, createConfig, createStorage, fallback} from 'wagmi';
import {injected} from 'wagmi/connectors';
import {giwaSepolia, APP_RPC_HTTP, APP_FLASHBLOCKS_RPC, GIWA_BLOCK_TIME_MS} from './giwa';

/**
 * wagmi config for GIWA Sepolia. The GIWA docs describe the worker view as embeddable in the
 * GIWA Wallet (an in-app tab), so we lead with the injected connector — the wallet the
 * worker already holds — rather than a walletconnect modal. EIP-6963 discovery (on by default)
 * adds every other announced browser wallet alongside it.
 *
 * `chains` deliberately lists GIWA only. That makes every other network an unsupported chain,
 * which is what drives the wrong-network state in the UI — see `useNetwork`.
 */
export const wagmiConfig = createConfig({
  chains: [giwaSepolia],
  connectors: [injected()],
  // Persist the connection so a refresh doesn't drop the wallet mid-flow.
  storage: createStorage({storage: typeof window !== 'undefined' ? window.localStorage : undefined, key: 'imgeum.wagmi'}),
  // Keep wagmi's notion of the active chain glued to the wallet's.
  syncConnectedChain: true,
  transports: {
    // Reads go to the app's own endpoint (env-overridable), with the flashblocks endpoint as a
    // standby: if the standard RPC rate-limits or blips, the UI keeps reading instead of
    // showing an empty vault list. Batching collapses the per-block vault fan-out into one
    // request; the poll cadence is the chain's 1s block time, so retries must stay short.
    [giwaSepolia.id]: fallback(
      [
        http(APP_RPC_HTTP, {batch: true, retryCount: 2, retryDelay: 250, timeout: 10_000}),
        http(APP_FLASHBLOCKS_RPC, {batch: true, retryCount: 1, retryDelay: 250, timeout: 10_000}),
      ],
      {rank: false},
    ),
  },
  pollingInterval: GIWA_BLOCK_TIME_MS,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
