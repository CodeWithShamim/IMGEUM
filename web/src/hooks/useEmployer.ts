import {useReadContract} from 'wagmi';
import {useImgeum} from './useImgeum';
import type {Address} from '../lib/vault';

export interface EmployerProfile {
  upId: string;
  displayName: string;
  dojangUid: `0x${string}`;
  registeredAt: bigint;
  vaultsOpened: number;
  onTimeCount: number;
  arrearsCount: number;
  lastArrearsAt: bigint;
  upIdVerified: boolean;
  active: boolean;
}

/** Employer profile + solvency score + live Dojang status. */
export function useEmployer(address?: Address) {
  const {registry, isDeployed, attesterId, dojang} = useImgeum();
  const enabled = isDeployed && !!address;

  const profile = useReadContract({
    ...(registry as {address: Address; abi: readonly unknown[]}),
    functionName: 'getEmployer',
    args: address ? [address] : undefined,
    query: {enabled},
  });

  const score = useReadContract({
    ...(registry as {address: Address; abi: readonly unknown[]}),
    functionName: 'solvencyScore',
    args: address ? [address] : undefined,
    query: {enabled},
  });

  const verifiedNow = useReadContract({
    ...(registry as {address: Address; abi: readonly unknown[]}),
    functionName: 'isCurrentlyDojangVerified',
    args: address ? [address] : undefined,
    query: {enabled},
  });

  const p = profile.data as EmployerProfile | undefined;
  const [scoreVal, rated] = (score.data as [number, boolean] | undefined) ?? [0, false];

  return {
    profile: p,
    isRegistered: p?.active ?? false,
    score: Number(scoreVal),
    rated,
    verifiedNow: (verifiedNow.data as boolean | undefined) ?? false,
    attesterId,
    dojang,
    isLoading: profile.isLoading,
    refetch: () => {
      void profile.refetch();
      void score.refetch();
      void verifiedNow.refetch();
    },
  };
}
