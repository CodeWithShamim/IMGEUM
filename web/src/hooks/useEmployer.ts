import {useReadContract} from 'wagmi';
import {useImgeum} from './useImgeum';
import {ACTIVE_CHAIN, GIWA_BLOCK_TIME_MS} from '../config/giwa';
import type {Address} from '../lib/vault';

/**
 * Slower than the vault poll on purpose. None of this moves per block — a counter changes when a
 * vault settles, the score when it is recalculated, Dojang status when an attestation is issued
 * or revoked — but all three can be moved by someone who is not the person looking at the screen
 * (a worker filing arrears, an attester revoking), which is why it polls at all instead of
 * relying on the post-transaction refresh.
 */
const PROFILE_POLL = GIWA_BLOCK_TIME_MS * 10;

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

  // Pinned to GIWA (see useVaults) so the console still reads correctly while the wallet is
  // parked on another network.
  const profile = useReadContract({
    ...(registry as {address: Address; abi: readonly unknown[]}),
    chainId: ACTIVE_CHAIN.id,
    functionName: 'getEmployer',
    args: address ? [address] : undefined,
    query: {enabled, refetchInterval: PROFILE_POLL},
  });

  const score = useReadContract({
    ...(registry as {address: Address; abi: readonly unknown[]}),
    chainId: ACTIVE_CHAIN.id,
    functionName: 'solvencyScore',
    args: address ? [address] : undefined,
    query: {enabled, refetchInterval: PROFILE_POLL},
  });

  const verifiedNow = useReadContract({
    ...(registry as {address: Address; abi: readonly unknown[]}),
    chainId: ACTIVE_CHAIN.id,
    functionName: 'isCurrentlyDojangVerified',
    args: address ? [address] : undefined,
    query: {enabled, refetchInterval: PROFILE_POLL},
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
