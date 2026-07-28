import {useCallback, useMemo} from 'react';
import {useReadContract, useReadContracts} from 'wagmi';
import {ERC20_ABI} from '../config/erc20';
import {ACTIVE_CHAIN} from '../config/giwa';
import {NATIVE_TOKEN, isNative, type Address} from '../lib/vault';
import {formatKRW, formatToken} from '../lib/format';
import {useLang} from './useLang';

export interface TokenMeta {
  address: Address;
  symbol: string;
  decimals: number;
  native: boolean;
  /** Metadata actually came back from a contract (or the token is native ETH). */
  known: boolean;
  isLoading: boolean;
}

const NATIVE_META: TokenMeta = {
  address: NATIVE_TOKEN,
  symbol: ACTIVE_CHAIN.nativeCurrency.symbol,
  decimals: ACTIVE_CHAIN.nativeCurrency.decimals,
  native: true,
  known: true,
  isLoading: false,
};

/**
 * Symbol + decimals for a wage token.
 *
 * Decimals are the reason this exists rather than assuming 18. A vault denominated in a
 * six-decimal stablecoin whose amounts are parsed and rendered at eighteen is not a cosmetic
 * bug — it is off by a factor of a trillion, in a number a worker is owed. Everything that
 * parses user input or formats a vault balance goes through the token's own decimals.
 *
 * Token metadata never changes, so it is cached for the session.
 */
export function useToken(address?: Address): TokenMeta {
  const target = address ?? NATIVE_TOKEN;
  const erc20 = !!address && !isNative(address);

  const {data, isLoading} = useReadContracts({
    contracts: [
      {address: target, abi: ERC20_ABI, chainId: ACTIVE_CHAIN.id, functionName: 'symbol'},
      {address: target, abi: ERC20_ABI, chainId: ACTIVE_CHAIN.id, functionName: 'decimals'},
    ] as never,
    query: {enabled: erc20, staleTime: Infinity, gcTime: Infinity, retry: 1},
  });

  return useMemo(() => {
    if (!erc20) return NATIVE_META;
    const results = data as ReadonlyArray<{status: string; result?: unknown}> | undefined;
    const symbol = results?.[0]?.status === 'success' ? (results[0].result as string) : '';
    const decimals = results?.[1]?.status === 'success' ? Number(results[1].result) : undefined;

    // A contract that answers neither `symbol` nor `decimals` is not a token this app should
    // let anyone denominate wages in, whatever else it may be.
    const known = !!symbol && decimals !== undefined;
    return {
      address: target,
      symbol: symbol || '',
      decimals: decimals ?? 18,
      native: false,
      known,
      isLoading,
    };
  }, [data, erc20, isLoading, target]);
}

/**
 * A formatter bound to one token, for every place that renders a vault amount.
 *
 * Native amounts keep their KRW display (the whole app speaks won to a Korean worker); token
 * amounts render in their own units and symbol, because converting an arbitrary ERC-20 to won
 * would require a price this app does not have. The previous behaviour — formatting every
 * non-native amount at 18 decimals and labelling it "KRW" — was wrong on both counts.
 */
export function useAmountFormat(token: Address): (value: bigint) => string {
  const {lang} = useLang();
  const meta = useToken(token);

  return useCallback(
    (value: bigint) => {
      if (meta.native) return formatKRW(value, lang);
      const amount = formatToken(value, meta.decimals, 4, lang);
      return meta.symbol ? `${amount} ${meta.symbol}` : amount;
    },
    [lang, meta.decimals, meta.native, meta.symbol],
  );
}

/** Current allowance granted to `spender`, plus a refetch for after an approval lands. */
export function useAllowance(token: Address, owner?: Address, spender?: Address) {
  const erc20 = !isNative(token);
  const enabled = erc20 && !!owner && !!spender;

  const {data, refetch, isLoading} = useReadContract({
    address: token,
    abi: ERC20_ABI,
    chainId: ACTIVE_CHAIN.id,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: {enabled},
  });

  return {
    allowance: (data as bigint | undefined) ?? 0n,
    /** Native vaults are funded with `msg.value`; there is nothing to approve. */
    needed: erc20,
    isLoading: enabled && isLoading,
    refetch: () => void refetch(),
  };
}
