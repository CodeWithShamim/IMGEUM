/**
 * Server-side chain access for the social endpoints (`/api/badge`, `/api/meta`).
 *
 * These two endpoints exist because link previews and `<img>` embeds are read by crawlers that
 * do not run JavaScript. Everything else in IMGEUM reads the chain from the browser; this is the
 * only server-side reader, and it is read-only — no key material is ever loaded here.
 *
 * Deliberately does NOT import `src/config/giwa.ts`. That module resolves its endpoints through
 * `import.meta.env`, which exists only under Vite; importing it from a serverless function fails
 * at bundle time. The constants below are therefore re-stated, and they read the same env vars
 * the browser build uses, so pointing a deployment at a private RPC moves these endpoints with
 * it. Chain id and default RPC must stay in step with `src/config/giwa.ts` — the fallbacks below
 * are transcribed from the same source (https://docs.giwa.io/get-started/connect-to-giwa.md).
 */
import {createPublicClient, defineChain, http, isAddress, type Abi, type Address} from 'viem';
import registryAbi from '../src/config/abis/EmployerRegistry.json';
import attestorAbi from '../src/config/abis/ArrearsAttestor.json';
import deployments from '../src/config/deployments.json';
import {ERC20_ABI} from '../src/config/erc20';
// Type-only, so this is erased at build time and does not drag `contracts.ts` — and through it
// `giwa.ts` and `import.meta.env` — into a serverless bundle.
import type {Deployment} from '../src/config/contracts';

/**
 * `@types/node` is not a dependency of the web app, and adding the whole Node type surface to a
 * browser project to read two env vars is a poor trade. The Vercel runtime provides `process.env`.
 */
declare const process: {env: Record<string, string | undefined>};

export const CHAIN_ID = 91342;
const DEFAULT_RPC = 'https://sepolia-rpc.giwa.io';
export const EXPLORER = 'https://sepolia-explorer.giwa.io';

const giwaSepolia = defineChain({
  id: CHAIN_ID,
  name: 'GIWA Sepolia',
  nativeCurrency: {name: 'Ether', symbol: 'ETH', decimals: 18},
  rpcUrls: {default: {http: [process.env.VITE_GIWA_RPC_URL ?? DEFAULT_RPC]}},
  blockExplorers: {default: {name: 'GIWA Sepolia Explorer', url: EXPLORER}},
  testnet: true,
});

const client = createPublicClient({
  chain: giwaSepolia,
  // A crawler will not wait around, and a slow preview is a missing preview. Fail fast and let
  // the caller fall back to the generic card rather than holding the request open.
  transport: http(undefined, {batch: true, retryCount: 1, retryDelay: 200, timeout: 4_000}),
});

/**
 * The GIWA deployment, or nothing.
 *
 * Mirrors `getDeployment` in `src/config/contracts.ts`, including its guard: an artifact whose
 * key and `chainId` field disagree has been hand-edited or mis-merged, and its addresses are not
 * trustworthy for either chain. A preview card is not worth reading the wrong contract for.
 */
const entry = (deployments as Record<string, Deployment>)[String(CHAIN_ID)];
const addresses = entry && entry.chainId === CHAIN_ID ? entry : undefined;
export const REGISTRY = addresses?.employerRegistry;
export const ATTESTOR = addresses?.arrearsAttestor;

/** Whether a path segment is a wallet address we can look up at all. */
export function asAddress(raw: string | null | undefined): Address | undefined {
  return raw && isAddress(raw) ? (raw as Address) : undefined;
}

/**
 * A record id from a URL. Mirrors the evidence page's own parser: `BigInt` accepts " 12 ",
 * "0x10" and "-3", none of which are ids here.
 */
export function asRecordId(raw: string | null | undefined): bigint | undefined {
  return raw && /^\d+$/.test(raw) ? BigInt(raw) : undefined;
}

export interface EmployerSnapshot {
  registered: boolean;
  displayName: string;
  upId: string;
  score: number;
  rated: boolean;
  verifiedNow: boolean;
  vaultsOpened: number;
  onTimeCount: number;
  arrearsCount: number;
}

interface RawEmployer {
  upId: string;
  displayName: string;
  registeredAt: bigint;
  vaultsOpened: number;
  onTimeCount: number;
  arrearsCount: number;
  active: boolean;
}

/**
 * Everything the badge and the preview card need.
 *
 * Three separate reads rather than a `multicall`: GIWA's chain definition declares no Multicall3
 * predeploy, and viem throws rather than guessing an address for one. The transport batches, so
 * these still leave as a single JSON-RPC request.
 *
 * Returns `undefined` only when the chain could not be reached — a *registered: false* snapshot
 * is a real answer and renders as "not registered", which is different from a fetch failure and
 * has to stay distinguishable so the caller can decide whether to cache it.
 */
export async function readEmployer(address: Address): Promise<EmployerSnapshot | undefined> {
  if (!REGISTRY) return undefined;
  const base = {address: REGISTRY, abi: registryAbi as Abi} as const;
  try {
    const [profile, score, verified] = await Promise.allSettled([
      client.readContract({...base, functionName: 'getEmployer', args: [address]}),
      client.readContract({...base, functionName: 'solvencyScore', args: [address]}),
      client.readContract({...base, functionName: 'isCurrentlyDojangVerified', args: [address]}),
    ]);

    // `getEmployer` is the one that decides whether this address exists at all; the other two
    // are allowed to fail independently without sinking the whole card.
    if (profile.status !== 'fulfilled') return undefined;
    const p = profile.value as unknown as RawEmployer;
    const [scoreVal, rated] = (score.status === 'fulfilled'
      ? (score.value as unknown as [number, boolean])
      : [0, false]) as [number, boolean];

    return {
      // An unregistered address reads back as a zeroed struct, so `active` is the registration
      // test — not a non-empty name, which a registered employer is free to leave blank.
      registered: !!p.active,
      displayName: p.displayName ?? '',
      upId: p.upId ?? '',
      score: Number(scoreVal ?? 0),
      rated: !!rated,
      verifiedNow: verified.status === 'fulfilled' ? !!verified.value : false,
      vaultsOpened: Number(p.vaultsOpened ?? 0),
      onTimeCount: Number(p.onTimeCount ?? 0),
      arrearsCount: Number(p.arrearsCount ?? 0),
    };
  } catch {
    return undefined;
  }
}

export interface RecordSnapshot {
  recordId: bigint;
  employerName: string;
  vaultId: bigint;
  shortfall: bigint;
  token: Address;
  attestedAt: bigint;
  outstanding: bigint;
  verifiedNow: boolean;
}

/** The frozen arrears record behind an `/evidence/:id` link. */
export async function readRecord(recordId: bigint): Promise<RecordSnapshot | undefined> {
  if (!ATTESTOR || recordId === 0n) return undefined;
  try {
    const data = (await client.readContract({
      address: ATTESTOR,
      abi: attestorAbi as Abi,
      functionName: 'verifyRecord',
      args: [recordId],
    })) as unknown as [
      {
        vaultId: bigint;
        token: Address;
        shortfall: bigint;
        attestedAt: bigint;
        employerName: string;
      },
      boolean,
      `0x${string}`,
      bigint,
    ];
    const [rec, verifiedNow, , outstanding] = data;
    return {
      recordId,
      employerName: rec.employerName ?? '',
      vaultId: rec.vaultId,
      shortfall: rec.shortfall,
      token: rec.token,
      attestedAt: rec.attestedAt,
      outstanding,
      verifiedNow,
    };
  } catch {
    return undefined;
  }
}

const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';

/**
 * Symbol and decimals for a wage token, for the one number that appears in a link preview.
 *
 * Decimals are read rather than assumed for the same reason `useToken` reads them: a six-decimal
 * stablecoin rendered at eighteen is wrong by a factor of a trillion, and a preview card is
 * quoted and screenshotted. A token that answers neither call yields `undefined`, and the caller
 * leaves the amount out of the description entirely rather than printing a guess.
 */
export async function readToken(token: Address): Promise<{symbol: string; decimals: number} | undefined> {
  if (token.toLowerCase() === NATIVE_TOKEN) return {symbol: 'ETH', decimals: 18};
  try {
    const [symbol, decimals] = await Promise.all([
      client.readContract({address: token, abi: ERC20_ABI, functionName: 'symbol'}),
      client.readContract({address: token, abi: ERC20_ABI, functionName: 'decimals'}),
    ]);
    return {symbol: String(symbol), decimals: Number(decimals)};
  } catch {
    return undefined;
  }
}

/** Resolve `/evidence/vault-12` as well as `/evidence/7`, exactly as the page itself does. */
export async function resolveRecordId(raw: string): Promise<bigint | undefined> {
  if (!raw.startsWith('vault-')) return asRecordId(raw);
  const vaultId = asRecordId(raw.slice('vault-'.length));
  if (vaultId === undefined || !ATTESTOR) return undefined;
  try {
    const id = (await client.readContract({
      address: ATTESTOR,
      abi: attestorAbi as Abi,
      functionName: 'recordOfVault',
      args: [vaultId],
    })) as bigint;
    return id === 0n ? undefined : id;
  } catch {
    return undefined;
  }
}

/** Score band, matching `scoreColor` in `src/lib/format.ts` so a badge never contradicts the app. */
export function scoreHex(score: number): string {
  if (score >= 800) return '#C6FF00';
  if (score >= 500) return '#FFB300';
  return '#FF5C5C';
}

export const PALETTE = {
  ink: '#0E0B16',
  ink2: '#161227',
  ink3: '#211B38',
  hanji: '#F7F2E7',
  gold: '#FFB300',
  vermil: '#FF5C5C',
  /** Acid lime — action and verified, per the palette note in `tailwind.config.ts`. */
  cheong: '#C6FF00',
} as const;
