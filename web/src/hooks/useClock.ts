import {useEffect, useState} from 'react';

/**
 * There is deliberately no per-frame clock hook here.
 *
 * One used to live in this file — a `useAnimationClock` that called `setNow(Date.now())` from a
 * requestAnimationFrame loop. Any component reading it re-rendered sixty times a second, which
 * is what WageStream was doing while its own comments described the opposite. A 60fps clock
 * expressed as React state cannot be anything else, so the fix was not to tune it but to keep
 * the frame loop off the render path entirely: WageStream now runs one rAF that writes the
 * counter's `textContent` directly and reads live values through refs.
 *
 * The rule that leaves behind: per-frame animation belongs in the component that animates,
 * driven by rAF and refs. Shared clocks are for values slow enough to be state — which, at
 * GIWA's 1s block time, means `useSecondsClock` below.
 */

/** A plain 1Hz clock (seconds) for non-animated live values. */
export function useSecondsClock(): number {
  const [sec, setSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return sec;
}
