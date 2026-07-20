import {motion} from 'framer-motion';
import type {ReactNode} from 'react';
import {EASE} from './ease';
import {usePrefersReducedMotion} from '../../hooks/usePrefersReducedMotion';

/**
 * Route transition wrapper: a row of roof-tile shapes slides down to cover, then lifts to
 * reveal the next route (spec §6). Same motif everywhere = identity. 350ms total.
 * Under reduced motion it degrades to a plain opacity fade.
 */
export function TileWipe({children}: {children: ReactNode}) {
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return (
      <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: 0.15}}>
        {children}
      </motion.div>
    );
  }

  const tiles = 8;
  return (
    <>
      <motion.div className="relative" initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: 0.18}}>
        {children}
      </motion.div>
      {/* Covering tiles: sweep down (enter), then out (handled by AnimatePresence exit). */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-40 flex"
        initial={{opacity: 1}}
        animate={{opacity: 0}}
        transition={{duration: 0, delay: 0.35}}
        aria-hidden
      >
        {Array.from({length: tiles}).map((_, i) => (
          <motion.div
            key={i}
            className="h-full flex-1 dancheong-band-v"
            initial={{scaleY: 1}}
            animate={{scaleY: 0}}
            transition={{duration: 0.35, ease: EASE, delay: i * 0.02}}
            style={{transformOrigin: 'top'}}
          />
        ))}
      </motion.div>
    </>
  );
}
