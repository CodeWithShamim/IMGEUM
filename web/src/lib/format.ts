import {formatUnits} from 'viem';
import type {Lang} from '../i18n';

/**
 * Locale-aware formatting. Numbers/dates/currency go through Intl with the active locale, so
 * KO renders ₩ with Korean digit grouping and EN renders its own conventions (spec §6.5).
 */

const localeTag = (lang: Lang) => (lang === 'ko' ? 'ko-KR' : 'en-US');

/** Format a bigint token amount (18 decimals) as a compact decimal string. */
export function formatToken(value: bigint, decimals = 18, maxFrac = 4): string {
  const raw = formatUnits(value, decimals);
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString(undefined, {maximumFractionDigits: maxFrac});
}

/** High-precision token format for the ticking wage counter (keeps small per-second motion visible). */
export function formatTokenPrecise(value: bigint, decimals = 18, frac = 6): string {
  const n = Number(formatUnits(value, decimals));
  return n.toLocaleString(undefined, {minimumFractionDigits: frac, maximumFractionDigits: frac});
}

/**
 * Approximate KRW value of an ETH amount for display.
 * NOTE: the rate here is a display placeholder. Production sources it from the Upbit Oracle
 * (https://docs.giwa.io/giwa-ecosystem/upbit-oracle.md). Wired as a single constant so the
 * swap is one line. Never used for on-chain accounting — display only.
 */
export const ETH_KRW_PLACEHOLDER = 4_500_000;

export function formatKRW(ethValue: bigint, lang: Lang, decimals = 18): string {
  const eth = Number(formatUnits(ethValue, decimals));
  const krw = Math.round(eth * ETH_KRW_PLACEHOLDER);
  return new Intl.NumberFormat(localeTag(lang), {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(krw);
}

export function formatDate(unixSeconds: number | bigint, lang: Lang): string {
  const ms = Number(unixSeconds) * 1000;
  return new Intl.DateTimeFormat(localeTag(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function formatDateShort(unixSeconds: number | bigint, lang: Lang): string {
  const ms = Number(unixSeconds) * 1000;
  return new Intl.DateTimeFormat(localeTag(lang), {year: 'numeric', month: 'short', day: 'numeric'}).format(
    new Date(ms),
  );
}

export function shortAddress(addr?: string, size = 4): string {
  if (!addr) return '';
  return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
}

/** Number 0-1000 → a palette color token for the solvency score. */
export function scoreColor(score: number): {text: string; bg: string; ring: string} {
  if (score >= 800) return {text: 'text-nok', bg: 'bg-nok', ring: 'ring-nok'};
  if (score >= 500) return {text: 'text-dan-gold', bg: 'bg-dan-gold', ring: 'ring-dan-gold'};
  return {text: 'text-vermil', bg: 'bg-vermil', ring: 'ring-vermil'};
}
