import {useEffect, useRef, useState} from 'react';
import {usePrefersReducedMotion} from '../../hooks/usePrefersReducedMotion';

/**
 * Spring-physics number roll-up for stats. Tabular-mono digits so nothing jitters.
 * Not used for the per-frame wage counter (that's WageStream) — this is for settling stats.
 */
export function NumberRoll({
  value,
  format,
  className = '',
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef<number>();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const dur = 700;
    const a = from.current;
    const b = value;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(a + (b - a) * eased);
      if (k < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, reduced]);

  return <span className={`tnum ${className}`}>{format(display)}</span>;
}
