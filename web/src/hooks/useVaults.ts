import {useReadContract, useReadContracts} from 'wagmi';
import {useMemo} from 'react';
import {useImgeum} from './useImgeum';
import {toVault, type Address, type Vault} from '../lib/vault';
import {GIWA_BLOCK_TIME_MS} from '../config/giwa';

/** Live-ish refetch interval keyed to GIWA's block time. */
const POLL = GIWA_BLOCK_TIME_MS;

/** All vault IDs assigned to a worker. */
export function useWorkerVaultIds(worker?: Address) {
  const {vault, isDeployed} = useImgeum();
  return useReadContract({
    ...(vault as {address: Address; abi: readonly unknown[]}),
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
        functionName: 'getVault',
        args: [id],
      })),
    [ids, vault],
  );

  const {data, isLoading, refetch} = useReadContracts({
    contracts: contracts as never,
    query: {enabled: isDeployed && (ids?.length ?? 0) > 0, refetchInterval: POLL},
  });

  const vaults = useMemo(() => {
    if (!data || !ids) return [];
    const results = data as ReadonlyArray<{status: string; result?: unknown}>;
    return results
      .map((res, i) => (res.status === 'success' ? toVault(ids[i], res.result as Record<string, unknown>) : null))
      .filter((v): v is Vault => v !== null);
  }, [data, ids]);

  return {vaults, isLoading, refetch};
}

/** A single vault by ID (used by the evidence-linked vault view). */
export function useVault(id?: bigint): {vault?: Vault; isLoading: boolean} {
  const {vault, isDeployed} = useImgeum();
  const {data, isLoading} = useReadContract({
    ...(vault as {address: Address; abi: readonly unknown[]}),
    functionName: 'getVault',
    args: id !== undefined ? [id] : undefined,
    query: {enabled: isDeployed && id !== undefined, refetchInterval: POLL},
  });
  return {vault: data && id !== undefined ? toVault(id, data as Record<string, unknown>) : undefined, isLoading};
}
