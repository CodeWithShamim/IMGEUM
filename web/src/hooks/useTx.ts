import {useCallback, useState} from 'react';
import {useWriteContract, useConfig} from 'wagmi';
import {waitForTransactionReceipt} from 'wagmi/actions';
import {useTranslation} from 'react-i18next';
import {useToasts} from './useToasts';

interface WriteArgs {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

/** Maps a chain/runtime error to a translated errors.* key. */
function errorKey(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes('rejected') || msg.includes('denied')) return 'errors:rejected';
  if (msg.includes('insufficient')) return 'errors:insufficientFunds';
  if (msg.includes('notverified') || msg.includes('not verified')) return 'errors:notVerified';
  if (msg.includes('alreadyregistered')) return 'errors:alreadyRegistered';
  if (msg.includes('notregistered') || msg.includes('employernotregistered')) return 'errors:notRegistered';
  if (msg.includes('notbreached')) return 'errors:notBreached';
  if (msg.includes('alreadyattested')) return 'errors:alreadyAttested';
  if (msg.includes('nothingtowithdraw')) return 'errors:nothingToWithdraw';
  return 'errors:txFailed';
}

/**
 * One-shot contract write with an integrated toast lifecycle:
 * pending → success/error, with the tx hash surfaced for an explorer link.
 * Returns the awaited receipt hash on success (for post-tx navigation), or null.
 */
export function useTx() {
  const {t} = useTranslation();
  const config = useConfig();
  const {writeContractAsync} = useWriteContract();
  const {push, update} = useToasts();
  const [pending, setPending] = useState(false);

  const send = useCallback(
    async (write: WriteArgs, pendingMsg: string, successMsg: string): Promise<`0x${string}` | null> => {
      setPending(true);
      const id = push({kind: 'pending', message: pendingMsg});
      try {
        const hash = await writeContractAsync(write as never);
        update(id, {txHash: hash});
        await waitForTransactionReceipt(config, {hash});
        update(id, {kind: 'success', message: successMsg, txHash: hash});
        setPending(false);
        return hash;
      } catch (err) {
        update(id, {kind: 'error', message: t(errorKey(err))});
        setPending(false);
        return null;
      }
    },
    [config, push, update, writeContractAsync, t],
  );

  return {send, pending};
}
