import {motion} from 'framer-motion';
import {EASE} from './ease';

/**
 * Full-screen loader: a giwa roof-tile outline drawn stroke-by-stroke (SVG path animation),
 * then filled with a dancheong color sweep (spec §6). Ties the brand to GIWA's roof-tile
 * identity from the first frame.
 */
export function Loader({label}: {label?: string}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink">
      <svg width="120" height="90" viewBox="0 0 120 90" fill="none" aria-hidden>
        <defs>
          <linearGradient id="dancheong-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2245FF" />
            <stop offset="33%" stopColor="#00C48C" />
            <stop offset="66%" stopColor="#FFB300" />
            <stop offset="100%" stopColor="#FF3D2E" />
          </linearGradient>
        </defs>
        {/* Roof-beam outline. */}
        <motion.path
          d="M8 40 L60 10 L112 40 M20 40 L20 80 L100 80 L100 40 M8 40 L112 40"
          stroke="url(#dancheong-sweep)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{pathLength: 0, opacity: 0.2}}
          animate={{pathLength: 1, opacity: 1}}
          transition={{duration: 1.4, ease: EASE, repeat: Infinity, repeatType: 'reverse'}}
        />
        {/* Dancheong stripe fill under the roof. */}
        {['#2245FF', '#00C48C', '#FFB300', '#FF3D2E'].map((col, i) => (
          <motion.rect
            key={col}
            x={26}
            y={48 + i * 7}
            width={68}
            height={5}
            fill={col}
            initial={{scaleX: 0}}
            animate={{scaleX: 1}}
            transition={{delay: 0.2 + i * 0.12, duration: 0.5, ease: EASE, repeat: Infinity, repeatType: 'reverse', repeatDelay: 0.4}}
            style={{transformOrigin: '26px 0'}}
          />
        ))}
      </svg>
      {label && <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-hanji/50">{label}</p>}
    </div>
  );
}

/** Inline block-pulse dot synced to a 1Hz cadence (GIWA block time). */
export function BlockPulse({label}: {label?: string}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-2 animate-block-pulse rounded-full bg-nok" aria-hidden />
      {label && <span className="font-mono text-xs text-hanji/50">{label}</span>}
    </span>
  );
}
