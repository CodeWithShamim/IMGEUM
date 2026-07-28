import {useMemo} from 'react';
import {useReadContract, useReadContracts} from 'wagmi';
import {useImgeum} from './useImgeum';
import {useUpIds} from './useUpId';
import {ACTIVE_CHAIN} from '../config/giwa';
import type {EmployerProfile} from './useEmployer';
import type {Address} from '../lib/vault';

export interface DirectoryEntry {
  address: Address;
  profile: EmployerProfile;
  score: number;
  rated: boolean;
  verifiedNow: boolean;
  /** Live `name.up.id`, when the address holds an active one. */
  upIdName?: string;
}

const CHAIN = ACTIVE_CHAIN.id;

/**
 * The public employer directory.
 *
 * The pay-reliability score has been computed on-chain since the first deployment, but until
 * now only the employer themselves could read it — which is precisely backwards. The score
 * exists so a worker can check a company BEFORE taking the job; that requires an index anyone
 * can page through without a wallet, which is what this is.
 *
 * Paged at the contract, not fetched whole: `employersPaged` exists so a registry with ten
 * thousand companies in it does not have to be pulled into a browser to show twenty-four.
 */
export function useEmployerDirectory(page: number, pageSize = 24) {
  const {registry, isDeployed} = useImgeum();

  const countRead = useReadContract({
    ...(registry as {address: Address; abi: readonly unknown[]}),
    chainId: CHAIN,
    functionName: 'employerCount',
    query: {enabled: isDeployed},
  });
  const total = Number((countRead.data as bigint | undefined) ?? 0n);

  const pageRead = useReadContract({
    ...(registry as {address: Address; abi: readonly unknown[]}),
    chainId: CHAIN,
    functionName: 'employersPaged',
    args: [BigInt(page * pageSize), BigInt(pageSize)],
    query: {enabled: isDeployed && total > 0},
  });
  const addresses = useMemo(() => ((pageRead.data as Address[] | undefined) ?? []), [pageRead.data]);

  // Profile, score and live Dojang status for the visible page, in one fan-out.
  const contracts = useMemo(
    () =>
      addresses.flatMap((addr) => [
        {
          address: registry?.address as Address,
          abi: registry?.abi as readonly unknown[],
          chainId: CHAIN,
          functionName: 'getEmployer',
          args: [addr],
        },
        {
          address: registry?.address as Address,
          abi: registry?.abi as readonly unknown[],
          chainId: CHAIN,
          functionName: 'solvencyScore',
          args: [addr],
        },
        {
          address: registry?.address as Address,
          abi: registry?.abi as readonly unknown[],
          chainId: CHAIN,
          functionName: 'isCurrentlyDojangVerified',
          args: [addr],
        },
      ]),
    [addresses, registry],
  );

  const details = useReadContracts({
    contracts: contracts as never,
    query: {enabled: isDeployed && addresses.length > 0},
  });

  const {names} = useUpIds(addresses);

  const entries = useMemo(() => {
    const results = details.data as ReadonlyArray<{status: string; result?: unknown}> | undefined;
    if (!results) return [];
    const out: DirectoryEntry[] = [];
    addresses.forEach((address, i) => {
      const profileRes = results[i * 3];
      const scoreRes = results[i * 3 + 1];
      const verifiedRes = results[i * 3 + 2];
      if (profileRes?.status !== 'success') return;
      const [score, rated] = (scoreRes?.status === 'success'
        ? (scoreRes.result as [number, boolean])
        : [0, false]) as [number, boolean];
      out.push({
        address,
        profile: profileRes.result as EmployerProfile,
        score: Number(score),
        rated,
        verifiedNow: verifiedRes?.status === 'success' ? (verifiedRes.result as boolean) : false,
        upIdName: names[address.toLowerCase()],
      });
    });
    return out;
  }, [addresses, details.data, names]);

  return {
    entries,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    isLoading: countRead.isLoading || pageRead.isLoading || details.isLoading,
  };
}

/**
 * Sorts a directory page for display: highest rated first, unrated last.
 *
 * Unrated is not the same as bad, and must not be presented as the bottom of a ranking — an
 * employer with two clean pay periods simply has not settled enough of them for the contract
 * to rate. They sort after the rated ones, in registration order, rather than being scored 0.
 */
export function sortByReliability(entries: DirectoryEntry[]): DirectoryEntry[] {
  return [...entries].sort((a, b) => {
    if (a.rated !== b.rated) return a.rated ? -1 : 1;
    if (a.rated && b.rated) return b.score - a.score;
    return Number(a.profile.registeredAt - b.profile.registeredAt);
  });
}
