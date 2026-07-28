import {useCallback, useState} from 'react';
import {useAccount, useWriteContract, useConfig} from 'wagmi';
import {waitForTransactionReceipt} from 'wagmi/actions';
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  TransactionExecutionError,
} from 'viem';
import {useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {useToasts} from './useToasts';
import {useNetwork} from './useNetwork';
import {ACTIVE_CHAIN} from '../config/giwa';
import {refreshChainReads, waitForReadSync} from '../lib/sync';

interface WriteArgs {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

/**
 * Solidity custom errors → translated `errors.*` keys. Matched on the decoded error name from
 * the revert data, which is exact; the string sniffing below is only a fallback for reverts
 * that never reach the ABI decoder (RPC-level failures, wallet-level rejections).
 */
const REVERT_KEYS: Record<string, string> = {
  NotDojangVerified: 'errors:notVerified',
  AlreadyRegistered: 'errors:alreadyRegistered',
  NotRegistered: 'errors:notRegistered',
  EmployerNotRegistered: 'errors:notRegistered',
  NotBreached: 'errors:notBreached',
  AlreadyAttested: 'errors:alreadyAttested',
  NothingToWithdraw: 'errors:nothingToWithdraw',
  InvalidWorker: 'errors:invalidWorker',
  InvalidWageAmount: 'errors:invalidAmount',
  // Raised by `openVault` for a wage token that is neither native ETH nor a contract. The form
  // already blocks this by requiring `symbol`/`decimals` to answer, so reaching it means the
  // address stopped being a contract between the check and the signature — or the wallet is
  // pointed somewhere the token does not exist.
  InvalidToken: 'errors:invalidToken',
  ZeroFundAmount: 'errors:invalidAmount',
  InvalidPeriod: 'errors:invalidPeriod',
  PeriodTooShort: 'errors:invalidPeriod',
  PeriodTooLong: 'errors:invalidPeriod',
  PeriodNotEnded: 'errors:invalidPeriod',
  InvalidDeadline: 'errors:invalidDeadline',
  InsufficientBalance: 'errors:insufficientFunds',
  NativeValueMismatch: 'errors:invalidAmount',
  NoDepositReceived: 'errors:invalidAmount',
  UnsettledShortfall: 'errors:unsettledShortfall',
  VaultIsClosed: 'errors:vaultClosed',
  NoSuchVault: 'errors:noSuchVault',
  NoSuchRecord: 'errors:noSuchVault',
  NotWorker: 'errors:notWorker',
  EnforcedPause: 'errors:paused',
};

/** Maps a chain/runtime error to a translated errors.* key. */
export function errorKey(err: unknown): string {
  if (err instanceof BaseError) {
    // Wallet-level "no thanks" — never surface this as a failure.
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return 'errors:rejected';

    // Signed and broadcast, just not mined inside our window: the hash is still good, so this
    // must not read as "failed".
    if (err.name === 'WaitForTransactionReceiptTimeoutError') return 'errors:txTimeout';

    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name && REVERT_KEYS[name]) return REVERT_KEYS[name];
      if (name) return 'errors:txFailed';
    }

    // viem raises this when the wallet's chain drifts between our guard and the signature.
    if (err.walk((e) => e instanceof TransactionExecutionError && /chain/i.test(e.details ?? '')))
      return 'errors:wrongNetwork';
  }

  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes('rejected') || msg.includes('denied') || msg.includes('4001')) return 'errors:rejected';
  if (msg.includes('chain mismatch') || msg.includes('does not match the target chain'))
    return 'errors:wrongNetwork';
  if (msg.includes('insufficient funds') || msg.includes('exceeds the balance'))
    return 'errors:insufficientFunds';
  for (const [name, key] of Object.entries(REVERT_KEYS)) {
    if (msg.includes(name.toLowerCase())) return key;
  }
  return 'errors:txFailed';
}

/**
 * One-shot contract write with an integrated toast lifecycle:
 * pending → success/error, with the tx hash surfaced for an explorer link.
 * Returns the awaited receipt hash on success (for post-tx navigation), or null.
 *
 * Every write is pinned to GIWA twice over. First the wallet is asked to switch if it isn't
 * there; then `chainId` is passed down to viem, which re-reads the wallet's chain immediately
 * before signing and refuses to sign on a mismatch. Without the second guard a wallet sitting
 * on, say, Ethereum mainnet would happily sign `fund()` against the GIWA vault address on
 * mainnet — a real transfer, to an address that means nothing there.
 *
 * A confirmed write also refreshes the read cache before it reports done — see `lib/sync`. Every
 * caller used to be responsible for refetching the one hook it happened to hold a handle to,
 * which meant a successful transaction updated part of the screen and left the rest showing
 * pre-transaction state: `fund` never refreshed the employer's score or counters, `openVault`
 * never refreshed the vault ID list the new vault had just been added to, and `attestArrears`
 * never refreshed the arrears lists at all.
 */
export function useTx() {
  const {t} = useTranslation();
  const config = useConfig();
  const queryClient = useQueryClient();
  const {isConnected} = useAccount();
  const {ensureNetwork} = useNetwork();
  const {writeContractAsync} = useWriteContract();
  const {push, update} = useToasts();
  const [pending, setPending] = useState(false);

  const send = useCallback(
    async (write: WriteArgs, pendingMsg: string, successMsg: string): Promise<`0x${string}` | null> => {
      if (!isConnected) {
        push({kind: 'error', message: t('errors:notConnected')});
        return null;
      }

      setPending(true);
      const id = push({kind: 'pending', message: pendingMsg});
      try {
        // Ask before building anything: a declined switch should cost the user one prompt,
        // not a wallet popup for a transaction that cannot land.
        if (!(await ensureNetwork())) {
          update(id, {kind: 'error', message: t('errors:wrongNetwork')});
          setPending(false);
          return null;
        }

        const hash = await writeContractAsync({...write, chainId: ACTIVE_CHAIN.id} as never);
        update(id, {txHash: hash});
        const receipt = await waitForTransactionReceipt(config, {
          hash,
          chainId: ACTIVE_CHAIN.id,
          confirmations: 1,
          // GIWA targets 1s blocks; a tx still unmined after 2 minutes is stuck, not slow.
          timeout: 120_000,
        });
        if (receipt.status === 'reverted') {
          update(id, {kind: 'error', message: t('errors:txFailed'), txHash: hash});
          setPending(false);
          return null;
        }
        // The transaction is settled, so say so now — the cache work below is the UI catching
        // up, not part of whether the write succeeded.
        update(id, {kind: 'success', message: successMsg, txHash: hash});

        // Hold the button in its loading state across the refresh. It costs a few hundred
        // milliseconds and it is the difference between "paid" appearing next to the old
        // balance and appearing next to the new one.
        //
        // Contained, because the write is already final: nothing that happens while refreshing a
        // cache may reach the catch below and relabel a confirmed transaction as failed. The
        // fallback is the polls, which is what this code path had before.
        try {
          await waitForReadSync(config, ACTIVE_CHAIN.id, receipt.blockNumber);
          await refreshChainReads(queryClient);
        } catch {
          /* stale UI for one poll interval, never a false failure */
        }

        setPending(false);
        return hash;
      } catch (err) {
        update(id, {kind: 'error', message: t(errorKey(err))});
        setPending(false);
        return null;
      }
    },
    [config, queryClient, ensureNetwork, isConnected, push, update, writeContractAsync, t],
  );

  return {send, pending};
}
