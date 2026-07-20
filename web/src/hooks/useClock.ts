import {useEffect, useRef, useState} from 'react';
import {usePrefersReducedMotion} from './usePrefersReducedMotion';

/**
 * A high-frequency clock for interpolating the wage counter between block reads.
 * Returns performance-now-ish milliseconds, updated on requestAnimationFrame (~60fps) unless
 * the user prefers reduced motion, in which case it falls back to a 1s tick.
 */
export function useAnimationClock(): number {
  const reduced = usePrefersReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const raf = useRef<number>();

  useEffect(() => {
    if (reduced) {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }
    const loop = () => {
      setNow(Date.now());
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [reduced]);

  return now;
}

/** A plain 1Hz clock (seconds) for non-animated live values. */
export function useSecondsClock(): number {
  const [sec, setSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return sec;
}
