import {getBlockNumber} from 'wagmi/actions';
import type {Config} from 'wagmi';
import type {QueryClient} from '@tanstack/react-query';

/**
 * Post-write cache reconciliation.
 *
 * A mined transaction is not the same thing as a readable transaction. `waitForTransactionReceipt`
 * resolves as soon as ONE backend behind the RPC URL has the receipt; the `eth_call` a refetch
 * fires a millisecond later is a separate request that may be answered by a backend still one
 * block behind — public endpoints are load-balanced, and the app also has a second (flashblocks)
 * transport to fall back to. The pre-transaction answer then comes back looking perfectly fresh
 * and gets written into the query cache as such, where it stays until something else refetches.
 *
 * That is why the symptom was intermittent: the vault hooks poll every second and quietly papered
 * over the stale read, while `useEmployer`, the arrears lists and `useAllowance` — which do not
 * poll — kept showing pre-transaction numbers indefinitely.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Block until the read path reports a head at or past `target`, so an invalidation issued after
 * this cannot be answered out of a pre-transaction state.
 *
 * `cacheTime: 0` is required: viem memoizes block number for a full polling interval, so the
 * default would answer this from the same cache that is the problem.
 *
 * Returns false on timeout rather than throwing — the transaction has already succeeded by this
 * point, and a slow RPC must not turn into a failure toast. The caller refetches regardless; the
 * worst case is the old behaviour, which the polls then correct.
 */
export async function waitForReadSync(
  config: Config,
  chainId: number,
  target: bigint,
  {tries = 10, delayMs = 200}: {tries?: number; delayMs?: number} = {},
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      const head = await getBlockNumber(config, {chainId, cacheTime: 0});
      if (head >= target) return true;
    } catch {
      // A blip here is not worth surfacing: retry, and give up quietly at the end.
    }
    await sleep(delayMs);
  }
  return false;
}

/**
 * Query keys wagmi uses for chain reads. Invalidating by prefix rather than calling
 * `invalidateQueries()` bare keeps connector/account bookkeeping out of it — those are not
 * chain state, and refetching them after every transaction is a good way to make a wallet
 * reconnect prompt appear out of nowhere.
 */
const READ_KEYS = new Set([
  'readContract',
  'readContracts',
  'balance',
  'blockNumber',
  'block',
  'token',
  'transaction',
  'estimateFeesPerGas',
]);

/**
 * Mark every chain read stale and await the refetch of the mounted ones, so the caller can keep
 * its button in the loading state until the UI actually shows post-transaction numbers.
 *
 * Capped, because "await every refetch" is otherwise bounded only by the transport timeout, and
 * a spinner that outlives the confirmation toast reads as a hung transaction.
 */
export async function refreshChainReads(queryClient: QueryClient, capMs = 4_000): Promise<void> {
  const done = queryClient.invalidateQueries({
    predicate: (query) => {
      const head = query.queryKey[0];
      return typeof head === 'string' && READ_KEYS.has(head);
    },
  });
  await Promise.race([done, sleep(capMs)]);
}
