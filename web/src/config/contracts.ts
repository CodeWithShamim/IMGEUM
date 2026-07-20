import type {Abi, Address} from 'viem';
import EmployerRegistryAbi from './abis/EmployerRegistry.json';
import WageVaultAbi from './abis/WageVault.json';
import ArrearsAttestorAbi from './abis/ArrearsAttestor.json';
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
  dojangVerifier: Address;
  upIdResolver: Address;
  attesterId: `0x${string}`;
  dojangMock: boolean;
}

const all = deployments as Record<string, Deployment>;

// Prefer the GIWA Sepolia deployment; fall back to any local (31337) for dev.
export function getDeployment(chainId?: number): Deployment | undefined {
  if (chainId && all[String(chainId)]) return all[String(chainId)];
  return all[String(GIWA_SEPOLIA_CHAIN_ID)] ?? Object.values(all)[0];
}

export const abis = {
  employerRegistry: EmployerRegistryAbi as Abi,
  wageVault: WageVaultAbi as Abi,
  arrearsAttestor: ArrearsAttestorAbi as Abi,
} as const;
