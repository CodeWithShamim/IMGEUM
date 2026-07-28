import {useReadContract, useReadContracts} from 'wagmi';
import {useMemo, useRef} from 'react';
import {useImgeum} from './useImgeum';
import {toVault, type Address, type Vault} from '../lib/vault';
import {GIWA_BLOCK_TIME_MS, ACTIVE_CHAIN} from '../config/giwa';

/** Live-ish refetch interval keyed to GIWA's block time. */
const POLL = GIWA_BLOCK_TIME_MS;

/**
 * Every read is pinned to GIWA explicitly. wagmi would otherwise route it through whatever
 * chain the config currently points at, which makes vault data quietly dependent on wallet
 * state; these views must show the same numbers to a wallet on the wrong network, and to a
 * visitor with no wallet at all.
 */
const CHAIN = ACTIVE_CHAIN.id;

/** All vault IDs assigned to a worker. */
export function useWorkerVaultIds(worker?: Address) {
  const {vault, isDeployed} = useImgeum();
  return useReadContract({
    ...(vault as {address: Address; abi: readonly unknown[]}),
    chainId: CHAIN,
    functionName: 'vaultsOfWorker',
    args: worker ? [worker] : undefined,
    query: {enabled: isDeployed && !!worker, refetchInterval: POLL},
  });
}

/** All vault IDs opened by an employer. */
export function useEmployerVaultIds(employer?: Address) {
  const {vault, isDeployed} = useImgeum();
  return useReadContract({
    ...(vault as {address: Address; abi: readonly unknown[]}),
    chainId: CHAIN,
    functionName: 'vaultsOfEmployer',
    args: employer ? [employer] : undefined,
    query: {enabled: isDeployed && !!employer, refetchInterval: POLL},
  });
}

/** Batch-read full vault structs for a set of IDs. */
export function useVaults(ids?: readonly bigint[]): {vaults: Vault[]; isLoading: boolean; refetch: () => void} {
  const {vault, isDeployed} = useImgeum();
  const contracts = useMemo(
    () =>
      (ids ?? []).map((id) => ({
        address: vault?.address as Address,
        abi: vault?.abi as readonly unknown[],
        chainId: CHAIN,
        functionName: 'getVault',
        args: [id],
      })),
    [ids, vault],
  );

  const {data, isLoading, refetch} = useReadContracts({
    contracts: contracts as never,
    query: {enabled: isDeployed && (ids?.length ?? 0) > 0, refetchInterval: POLL},
  });

  // Last known good struct per vault id.
  //
  // `useReadContracts` reports per-call outcomes, and a call that failed for RPC reasons is
  // indistinguishable here from one that failed for contract reasons — both arrive as
  // `status: 'failure'`. Dropping those, which is what this did, meant a single rate-limited
  // response inside the batch erased a vault from the worker's list mid-poll: their wages
  // disappeared off the screen for a second and came back. Every id in this list came from the
  // contract's own index, so `getVault` cannot legitimately fail for one; holding the previous
  // value is strictly better than showing nothing.
  const lastGood = useRef(new Map<string, Vault>());

  const vaults = useMemo(() => {
    if (!data || !ids) return [];
    const results = data as ReadonlyArray<{status: string; result?: unknown}>;
    const cache = lastGood.current;
    return results
      .map((res, i) => {
        const key = ids[i].toString();
        if (res.status === 'success') {
          const vault = toVault(ids[i], res.result as Record<string, unknown>);
          cache.set(key, vault);
          return vault;
        }
        return cache.get(key) ?? null;
      })
      .filter((v): v is Vault => v !== null);
  }, [data, ids]);

  return {vaults, isLoading, refetch};
}

/** A single vault by ID (used by the evidence-linked vault view). */
export function useVault(id?: bigint): {vault?: Vault; isLoading: boolean} {
  const {vault, isDeployed} = useImgeum();
  const {data, isLoading} = useReadContract({
    ...(vault as {address: Address; abi: readonly unknown[]}),
    chainId: CHAIN,
    functionName: 'getVault',
    args: id !== undefined ? [id] : undefined,
    query: {enabled: isDeployed && id !== undefined, refetchInterval: POLL},
  });
  return {vault: data && id !== undefined ? toVault(id, data as Record<string, unknown>) : undefined, isLoading};
}
