import {useCallback, useEffect, useSyncExternalStore} from 'react';
import {useAccount, useConfig} from 'wagmi';
import {getAccount, switchChain as switchChainAction} from 'wagmi/actions';
import type {Config} from 'wagmi';
import {ACTIVE_CHAIN, ADD_CHAIN_PARAMS} from '../config/giwa';

/**
 * Single source of truth for "is the wallet actually on GIWA?".
 *
 * The subtlety that makes this a module rather than a one-liner: `useChainId()` reports the
 * chain wagmi is *configured* to talk to, not the chain the wallet is on. wagmi refuses to
 * move its configured chain to a network that isn't in `chains` ("If chain is not configured,
 * then don't switch over to it"), so with GIWA as the only configured chain `useChainId()`
 * returns 91342 permanently — including for a wallet sitting on Ethereum mainnet. Comparing
 * against it can never detect a wrong network. `useAccount().chainId` is the connection's
 * real chain, and is what everything here reads.
 *
 * The switch state lives at module scope because `useTx` pulls this hook into every component
 * that can sign. Per-instance state would mean a vault list with eight rows firing eight
 * `wallet_switchEthereumChain` prompts, seven of which MetaMask answers with "Request already
 * pending" (-32002).
 */

let switching = false;
/** `${address}:${wrongChainId}` we have already auto-prompted for. */
let attemptedKey: string | null = null;
let inFlight: Promise<boolean> | null = null;

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const setSwitching = (v: boolean) => {
  if (switching === v) return;
  switching = v;
  for (const l of listeners) l();
};

/** Ask the wallet for GIWA, adding the network if it has never seen it. Never throws. */
export async function requestGiwaSwitch(config: Config): Promise<boolean> {
  if (getAccount(config).chainId === ACTIVE_CHAIN.id) return true;
  if (inFlight) return inFlight;

  setSwitching(true);
  inFlight = (async () => {
    try {
      // Resolves only after the connector has seen the wallet's `chainChanged`, so wagmi's
      // account state is already up to date here — no post-switch settle delay needed.
      const chain = await switchChainAction(config, {
        chainId: ACTIVE_CHAIN.id,
        // Explicit, so the wallet is offered the public GIWA endpoints rather than whatever
        // RPC this deployment happens to read through.
        addEthereumChainParameter: ADD_CHAIN_PARAMS(),
      });
      return chain.id === ACTIVE_CHAIN.id || getAccount(config).chainId === ACTIVE_CHAIN.id;
    } catch {
      return false;
    } finally {
      inFlight = null;
      setSwitching(false);
    }
  })();

  return inFlight;
}

export function useNetwork() {
  const config = useConfig();
  const {isConnected, chainId: walletChainId, address, status} = useAccount();
  const isSwitching = useSyncExternalStore(
    subscribe,
    () => switching,
    () => false,
  );

  const onGiwa = walletChainId === ACTIVE_CHAIN.id;
  const isWrongNetwork = isConnected && walletChainId !== undefined && !onGiwa;

  /**
   * Auto-switch on connect and on reconnect. Fires at most once per (account, wrong chain)
   * pair: a user who declines the prompt gets the banner instead of an unclosable loop of
   * wallet popups, and only a fresh account or a move to a different wrong chain re-asks.
   */
  useEffect(() => {
    if (status !== 'connected') return;
    if (onGiwa) {
      // Back on GIWA — forget the attempt so a later manual detour is corrected once more.
      attemptedKey = null;
      return;
    }
    if (!isWrongNetwork) return;
    const key = `${address}:${walletChainId}`;
    if (attemptedKey === key) return;
    attemptedKey = key;
    void requestGiwaSwitch(config);
  }, [config, status, onGiwa, isWrongNetwork, address, walletChainId]);

  /**
   * Gate for anything that signs. Resolves true only when the wallet is verifiably on GIWA,
   * so a caller can bail before building a transaction.
   */
  const ensureNetwork = useCallback(() => requestGiwaSwitch(config), [config]);

  return {
    chainId: ACTIVE_CHAIN.id,
    walletChainId,
    isConnected,
    onGiwa,
    isWrongNetwork,
    isSwitching,
    ensureNetwork,
  };
}
