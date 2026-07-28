import {useMemo} from 'react';
import {useReadContract, useReadContracts} from 'wagmi';
import {useImgeum} from './useImgeum';
import {ACTIVE_CHAIN} from '../config/giwa';
import type {Address} from '../lib/vault';

/**
 * Reverse resolution: address → `name.up.id`, read from the deployed UpIdResolver over GIWA's
 * live UPNameRegistry.
 *
 * The resolver does the trust work, not this hook. `reverse` returns "" unless the address
 * holds a name that is currently active — a lapsed or unissued name is indistinguishable from
 * no name at all — so anything non-empty coming back is safe to render as an identity. It also
 * returns the full name including the suffix, so it round-trips straight back into `resolve`.
 *
 * Names are effectively static, and the same address shows up in many places at once (a vault
 * list, a directory row, the nav). Reads are cached hard and TanStack Query dedupes identical
 * keys, so ten chips for one employer cost one RPC call.
 */
const NAME_STALE_MS = 5 * 60_000;

const nameQuery = {staleTime: NAME_STALE_MS, gcTime: 30 * 60_000, retry: 1} as const;

/** The single-address case: one name, or undefined. */
export function useUpId(address?: Address): {name?: string; isLoading: boolean} {
  const {resolver, isDeployed} = useImgeum();
  const enabled = isDeployed && !!resolver && !!address;

  const {data, isLoading} = useReadContract({
    address: resolver?.address as Address,
    abi: resolver?.abi as readonly unknown[],
    chainId: ACTIVE_CHAIN.id,
    functionName: 'reverse',
    args: address ? [address] : undefined,
    query: {...nameQuery, enabled},
  });

  const name = (data as string | undefined) || undefined;
  return {name, isLoading: enabled && isLoading};
}

/**
 * The list case: resolve many addresses in one batched multicall-style fan-out.
 *
 * Returns a lookup keyed by lowercased address, because addresses arrive from the chain in
 * mixed checksum casing and a caller comparing them raw would miss.
 */
export function useUpIds(addresses: readonly Address[]): {names: Record<string, string>; isLoading: boolean} {
  const {resolver, isDeployed} = useImgeum();

  // De-duplicate before hitting the wire: a directory page routinely lists the same employer
  // behind several rows.
  const unique = useMemo(() => {
    const seen = new Map<string, Address>();
    for (const a of addresses) if (a) seen.set(a.toLowerCase(), a);
    return [...seen.values()];
  }, [addresses]);

  const contracts = useMemo(
    () =>
      unique.map((addr) => ({
        address: resolver?.address as Address,
        abi: resolver?.abi as readonly unknown[],
        chainId: ACTIVE_CHAIN.id,
        functionName: 'reverse',
        args: [addr],
      })),
    [unique, resolver],
  );

  const {data, isLoading} = useReadContracts({
    contracts: contracts as never,
    query: {...nameQuery, enabled: isDeployed && !!resolver && unique.length > 0},
  });

  const names = useMemo(() => {
    const out: Record<string, string> = {};
    const results = (data as ReadonlyArray<{status: string; result?: unknown}> | undefined) ?? [];
    results.forEach((res, i) => {
      const name = res.status === 'success' ? ((res.result as string) || '') : '';
      if (name) out[unique[i].toLowerCase()] = name;
    });
    return out;
  }, [data, unique]);

  return {names, isLoading: unique.length > 0 && isLoading};
}
