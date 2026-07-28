import {useMemo} from 'react';
import {useReadContract, useReadContracts} from 'wagmi';
import {useImgeum} from './useImgeum';
import {ACTIVE_CHAIN, GIWA_BLOCK_TIME_MS} from '../config/giwa';
import type {Address} from '../lib/vault';

/**
 * Only the INDEXES poll. A record, once attested, is immutable by design — re-reading one can
 * never return anything different, so `useArrearsRecords` deliberately has no interval. What
 * changes is whether a new id has been appended, and that is nearly always appended by the other
 * party: a worker files, and the employer's console has to notice without a reload.
 */
const INDEX_POLL = GIWA_BLOCK_TIME_MS * 10;

/** One immutable arrears record, as `ArrearsAttestor.getRecord` returns it. */
export interface ArrearsRecord {
  vaultId: bigint;
  employer: Address;
  worker: Address;
  token: Address;
  wageAmount: bigint;
  fundedAtAttestation: bigint;
  shortfall: bigint;
  periodStart: bigint;
  periodEnd: bigint;
  payoutDeadline: bigint;
  attestedAt: bigint;
  attestedAtBlock: bigint;
  employerDojangUid: `0x${string}`;
  employerUpId: string;
  employerName: string;
  attester: Address;
}

/** A record plus the id its evidence page lives at. */
export type ArrearsRecordView = ArrearsRecord & {recordId: bigint};

const CHAIN = ACTIVE_CHAIN.id;

/**
 * Every arrears record naming an employer.
 *
 * Deliberately readable by anyone, for anyone — this is a public index of who did not pay, and
 * both the employer's own console and the public employer profile read it through here. An
 * employer being able to see what has been filed against them is not a courtesy; a record they
 * cannot see is one they cannot settle.
 */
export function useEmployerArrearsIds(employer?: Address) {
  const {attestor, isDeployed} = useImgeum();
  return useReadContract({
    ...(attestor as {address: Address; abi: readonly unknown[]}),
    chainId: CHAIN,
    functionName: 'recordsOfEmployer',
    args: employer ? [employer] : undefined,
    query: {enabled: isDeployed && !!employer, refetchInterval: INDEX_POLL},
  });
}

/** Every arrears record a worker holds evidence for. */
export function useWorkerArrearsIds(worker?: Address) {
  const {attestor, isDeployed} = useImgeum();
  return useReadContract({
    ...(attestor as {address: Address; abi: readonly unknown[]}),
    chainId: CHAIN,
    functionName: 'recordsOfWorker',
    args: worker ? [worker] : undefined,
    query: {enabled: isDeployed && !!worker, refetchInterval: INDEX_POLL},
  });
}

/** Batch-read full records for a set of ids, newest first. */
export function useArrearsRecords(ids?: readonly bigint[]): {
  records: ArrearsRecordView[];
  isLoading: boolean;
} {
  const {attestor, isDeployed} = useImgeum();

  const contracts = useMemo(
    () =>
      (ids ?? []).map((id) => ({
        address: attestor?.address as Address,
        abi: attestor?.abi as readonly unknown[],
        chainId: CHAIN,
        functionName: 'getRecord',
        args: [id],
      })),
    [ids, attestor],
  );

  const {data, isLoading} = useReadContracts({
    contracts: contracts as never,
    query: {enabled: isDeployed && (ids?.length ?? 0) > 0},
  });

  const records = useMemo(() => {
    if (!data || !ids) return [];
    const results = data as ReadonlyArray<{status: string; result?: unknown}>;
    return results
      .map((res, i) =>
        res.status === 'success'
          ? ({...(res.result as ArrearsRecord), recordId: ids[i]} as ArrearsRecordView)
          : null,
      )
      .filter((r): r is ArrearsRecordView => r !== null)
      // Most recent first: the record that matters is the one just filed.
      .sort((a, b) => Number(b.attestedAt - a.attestedAt));
  }, [data, ids]);

  return {records, isLoading: (ids?.length ?? 0) > 0 && isLoading};
}
