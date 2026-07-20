import type {ReactNode} from 'react';

type Tone = 'nok' | 'gold' | 'vermil' | 'cheong' | 'muted';

const TONE: Record<Tone, string> = {
  nok: 'bg-nok/15 text-nok border-nok/40',
  gold: 'bg-dan-gold/15 text-dan-gold border-dan-gold/40',
  vermil: 'bg-vermil/15 text-vermil border-vermil/40',
  cheong: 'bg-cheong/15 text-jade-mist border-cheong/50',
  muted: 'bg-hanji/10 text-hanji/70 border-hanji/20',
};

export function Badge({tone = 'muted', children}: {tone?: Tone; children: ReactNode}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
