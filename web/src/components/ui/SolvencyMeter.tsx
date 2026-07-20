import {motion} from 'framer-motion';
import {useTranslation} from 'react-i18next';
import {scoreColor} from '../../lib/format';

/**
 * Pay-reliability score 0–1000 as a segmented dancheong beam that fills to the score.
 * Color encodes trust: green high, gold mid, vermilion low.
 */
export function SolvencyMeter({score, rated, size = 'md'}: {score: number; rated: boolean; size?: 'sm' | 'md'}) {
  const {t} = useTranslation();
  const pct = Math.max(0, Math.min(100, (score / 1000) * 100));
  const c = scoreColor(score);
  const segments = 10;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-hanji/50">
          {t('common:labels.solvencyScore')}
        </span>
        {rated ? (
          <span className={`font-display font-bold tnum ${c.text} ${size === 'md' ? 'text-2xl' : 'text-lg'}`}>
            {score}
            <span className="ml-1 text-xs text-hanji/40">/ 1000</span>
          </span>
        ) : (
          <span className="text-xs font-semibold text-hanji/50">{t('employer:score.unrated')}</span>
        )}
      </div>
      <div className="mt-2 flex gap-0.5" aria-hidden>
        {Array.from({length: segments}).map((_, i) => {
          const filled = rated && pct >= (i + 1) * (100 / segments) - 5;
          return (
            <motion.div
              key={i}
              initial={{scaleY: 0.4, opacity: 0.3}}
              animate={{scaleY: filled ? 1 : 0.4, opacity: filled ? 1 : 0.25}}
              transition={{delay: i * 0.03, type: 'spring', stiffness: 300, damping: 24}}
              className={`h-3 flex-1 origin-bottom rounded-sm ${filled ? c.bg : 'bg-hanji/15'}`}
            />
          );
        })}
      </div>
    </div>
  );
}
