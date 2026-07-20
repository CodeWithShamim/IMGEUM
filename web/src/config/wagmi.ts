import {http, createConfig} from 'wagmi';
import {injected} from 'wagmi/connectors';
import {giwaSepolia} from './giwa';

/**
 * wagmi config for GIWA Sepolia. The GIWA docs describe the worker view as embeddable in the
 * GIWA Wallet (an in-app tab), so we lead with the injected connector — the wallet the
 * worker already holds — rather than a walletconnect modal.
 */
export const wagmiConfig = createConfig({
  chains: [giwaSepolia],
  connectors: [injected()],
  transports: {
    [giwaSepolia.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
