import {useChainId} from 'wagmi';
import {getDeployment, abis} from '../config/contracts';

/**
 * Central access to the active deployment + ABIs. Returns undefined addresses when IMGEUM
 * isn't deployed on the connected chain, so callers can render a "not deployed" state instead
 * of firing reads at a zero address.
 */
export function useImgeum() {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);

  return {
    deployment,
    isDeployed: !!deployment,
    isMock: deployment?.dojangMock ?? false,
    attesterId: deployment?.attesterId,
    registry: deployment
      ? ({address: deployment.employerRegistry, abi: abis.employerRegistry} as const)
      : undefined,
    vault: deployment ? ({address: deployment.wageVault, abi: abis.wageVault} as const) : undefined,
    attestor: deployment
      ? ({address: deployment.arrearsAttestor, abi: abis.arrearsAttestor} as const)
      : undefined,
    dojang: deployment?.dojangVerifier,
    upIdResolver: deployment?.upIdResolver,
  };
}
