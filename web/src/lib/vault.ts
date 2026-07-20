/** Shared vault domain types + pure stream math, mirrored from the Solidity for the UI. */

export type Address = `0x${string}`;

export interface Vault {
  id: bigint;
  employer: Address;
  periodStart: bigint;
  closed: boolean;
  arrearsAttested: boolean;
  worker: Address;
  periodEnd: bigint;
  token: Address;
  payoutDeadline: bigint;
  fullyFundedAt: bigint;
  wageAmount: bigint;
  funded: bigint;
  withdrawn: bigint;
}

export type VaultState = 'streaming' | 'settled' | 'breached' | 'pending';

export function vaultState(v: Vault, nowSec: number): VaultState {
  if (v.closed) return 'settled';
  const now = BigInt(Math.floor(nowSec));
  if (v.arrearsAttested) return 'breached';
  if (now > v.payoutDeadline && earnedAt(v, nowSec) > v.funded) return 'breached';
  if (now < v.periodStart) return 'pending';
  return 'streaming';
}

/**
 * Client-side mirror of WageVault._earned, used to interpolate between block reads so the
 * counter moves at 60fps. Never authoritative — the chain is. Kept byte-for-byte equivalent:
 * earned = wage * elapsed / periodLength, clamped to [0, wage].
 */
export function earnedAt(v: Vault, nowSec: number): bigint {
  const now = Math.floor(nowSec);
  const start = Number(v.periodStart);
  const end = Number(v.periodEnd);
  if (now <= start) return 0n;
  if (now >= end) return v.wageAmount;
  const elapsed = BigInt(now - start);
  const length = BigInt(end - start);
  return (v.wageAmount * elapsed) / length;
}

/** Fractional earned for smooth sub-second interpolation (float — display only). */
export function earnedFloat(v: Vault, nowMs: number): number {
  const start = Number(v.periodStart) * 1000;
  const end = Number(v.periodEnd) * 1000;
  const wage = Number(v.wageAmount);
  if (nowMs <= start) return 0;
  if (nowMs >= end) return wage;
  return (wage * (nowMs - start)) / (end - start);
}

export function withdrawableAt(v: Vault, nowSec: number): bigint {
  const earned = earnedAt(v, nowSec);
  const available = earned < v.funded ? earned : v.funded;
  return available > v.withdrawn ? available - v.withdrawn : 0n;
}

export function shortfallAt(v: Vault, nowSec: number): bigint {
  const earned = earnedAt(v, nowSec);
  return earned > v.funded ? earned - v.funded : 0n;
}

/** Wage accrual rate per second, as a float (display only). */
export function ratePerSecond(v: Vault): number {
  const length = Number(v.periodEnd) - Number(v.periodStart);
  if (length <= 0) return 0;
  return Number(v.wageAmount) / length;
}

/** How funding compares to accrual: ahead / on-pace / behind / breached. */
export function fundingPace(v: Vault, nowSec: number): 'ahead' | 'onpace' | 'behind' | 'breached' {
  const now = BigInt(Math.floor(nowSec));
  const earned = earnedAt(v, nowSec);
  if (now > v.payoutDeadline && earned > v.funded) return 'breached';
  if (v.funded >= earned + (v.wageAmount / 100n)) return 'ahead';
  if (v.funded >= earned) return 'onpace';
  return 'behind';
}

/** Normalize a tuple/struct from a viem read into our Vault shape. */
export function toVault(id: bigint, raw: readonly unknown[] | Record<string, unknown>): Vault {
  const r = raw as Record<string, unknown>;
  return {
    id,
    employer: r.employer as Address,
    periodStart: r.periodStart as bigint,
    closed: r.closed as boolean,
    arrearsAttested: r.arrearsAttested as boolean,
    worker: r.worker as Address,
    periodEnd: r.periodEnd as bigint,
    token: r.token as Address,
    payoutDeadline: r.payoutDeadline as bigint,
    fullyFundedAt: r.fullyFundedAt as bigint,
    wageAmount: r.wageAmount as bigint,
    funded: r.funded as bigint,
    withdrawn: r.withdrawn as bigint,
  };
}

export const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000' as Address;
export const isNative = (t: Address) => t === NATIVE_TOKEN;
