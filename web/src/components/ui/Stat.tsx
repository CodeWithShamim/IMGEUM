import type {ReactNode} from 'react';

/**
 * A labeled figure. Deliberately NOT the banned "big-number-small-centered-label stat row":
 * label sits above in rotated caps on a hairline, value is left-aligned display type.
 */
export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'gold' | 'nok' | 'vermil' | 'cheong';
}) {
  const toneClass = {
    default: 'text-hanji',
    gold: 'text-dan-gold',
    nok: 'text-nok',
    vermil: 'text-vermil',
    cheong: 'text-jade-mist',
  }[tone];
  return (
    <div className="border-l-2 border-hanji/15 pl-3">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-hanji/50">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold tnum ${toneClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-hanji/50 tnum">{sub}</div>}
    </div>
  );
}
