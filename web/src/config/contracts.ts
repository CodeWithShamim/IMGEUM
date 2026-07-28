import type {Abi, Address} from 'viem';
import EmployerRegistryAbi from './abis/EmployerRegistry.json';
import WageVaultAbi from './abis/WageVault.json';
import ArrearsAttestorAbi from './abis/ArrearsAttestor.json';
import UpIdResolverAbi from './abis/UpIdResolver.json';
import deployments from './deployments.json';
import {GIWA_SEPOLIA_CHAIN_ID} from './giwa';

/**
 * Contract addresses + ABIs, both sourced from Foundry artifacts by scripts/sync-contracts.mjs.
 * Neither is ever hand-copied. If a deployment for the active chain is missing, the UI shows a
 * "not deployed" state rather than crashing with a bad address.
 */

export interface Deployment {
  chainId: number;
  employerRegistry: Address;
  wageVault: Address;
  arrearsAttestor: Address;
  /** Always GIWA's live DojangScroll — there is no mock deployment mode. */
  dojangVerifier: Address;
  /** IMGEUM's read adapter over the live UPNameRegistry. */
  upIdResolver: Address;
  /** GIWA's live UPNameRegistry, behind `upIdResolver`. */
  upNameRegistry: Address;
  attesterId: `0x${string}`;
  /** Which real Dojang attester registration is gated on. */
  attesterMode: 'faucet' | 'upbit';
}

const all = deployments as Record<string, Deployment>;

/**
 * The deployment for one chain, or undefined.
 *
 * Never falls back to another chain's addresses, and that restriction is the whole point.
 * `sync-contracts.mjs` merges every file in `contracts/deployments/` into one object keyed by
 * chain id, so a local anvil run drops a `31337` entry in alongside GIWA's. The previous
 * `?? Object.values(all)[0]` meant that on a checkout where the GIWA entry was absent — a fresh
 * clone that deployed locally first, or an artifact lost to a rebase — every hook would silently
 * receive the ANVIL addresses while `useTx` pinned the signature to GIWA. The result is not a
 * failed read: it is `fund()` sending real ETH to a GIWA address that holds no code, with the
 * UI reporting success because the transaction itself succeeded.
 *
 * A missing deployment must present as missing. `isDeployed` is false, every page renders its
 * "not deployed" state, and nothing can be signed — which is what the callers of this function
 * have always documented themselves as expecting.
 */
export function getDeployment(chainId?: number): Deployment | undefined {
  const found = all[String(chainId ?? GIWA_SEPOLIA_CHAIN_ID)];
  // Guard the artifact against itself: a file whose key and `chainId` field disagree has been
  // hand-edited or mis-merged, and its addresses are not trustworthy for either chain.
  if (!found || found.chainId !== (chainId ?? GIWA_SEPOLIA_CHAIN_ID)) return undefined;
  return found;
}

export const abis = {
  employerRegistry: EmployerRegistryAbi as Abi,
  wageVault: WageVaultAbi as Abi,
  arrearsAttestor: ArrearsAttestorAbi as Abi,
  upIdResolver: UpIdResolverAbi as Abi,
} as const;
