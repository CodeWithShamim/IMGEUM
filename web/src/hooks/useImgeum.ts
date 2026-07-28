import {getDeployment, abis} from '../config/contracts';
import {ACTIVE_CHAIN} from '../config/giwa';

/**
 * Central access to the active deployment + ABIs. Returns undefined addresses when IMGEUM
 * isn't deployed on the active chain, so callers can render a "not deployed" state instead
 * of firing reads at a zero address.
 *
 * Deliberately keyed to `ACTIVE_CHAIN`, not to the wallet's chain: the public views (evidence,
 * a worker's vault list) must render GIWA data whether the visitor's wallet is on the wrong
 * network or absent entirely. Signing is where the wallet's chain matters — see `useTx`.
 */
export function useImgeum() {
  const deployment = getDeployment(ACTIVE_CHAIN.id);

  return {
    chainId: ACTIVE_CHAIN.id,
    deployment,
    isDeployed: !!deployment,
    attesterId: deployment?.attesterId,
    attesterMode: deployment?.attesterMode,
    registry: deployment
      ? ({address: deployment.employerRegistry, abi: abis.employerRegistry} as const)
      : undefined,
    vault: deployment ? ({address: deployment.wageVault, abi: abis.wageVault} as const) : undefined,
    attestor: deployment
      ? ({address: deployment.arrearsAttestor, abi: abis.arrearsAttestor} as const)
      : undefined,
    resolver: deployment
      ? ({address: deployment.upIdResolver, abi: abis.upIdResolver} as const)
      : undefined,
    dojang: deployment?.dojangVerifier,
    upIdResolver: deployment?.upIdResolver,
    upNameRegistry: deployment?.upNameRegistry,
  };
}
