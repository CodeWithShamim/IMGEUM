import {motion} from 'framer-motion';
import type {ReactNode} from 'react';

type Variant = 'cheong' | 'gold' | 'vermil' | 'nok' | 'ghost';

const VARIANT: Record<Variant, string> = {
  cheong: 'bg-cheong text-hanji border-ink shadow-hard-ink',
  gold: 'bg-dan-gold text-ink border-ink shadow-hard-ink',
  vermil: 'bg-vermil text-hanji border-ink shadow-hard-ink',
  nok: 'bg-nok text-ink border-ink shadow-hard-ink',
  ghost: 'bg-transparent text-hanji border-hanji/40 shadow-none hover:border-hanji',
};

interface Props {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Hard-shadow button. On press the 2px offset shadow "collapses" as the button translates
 * into it — the signature micro-interaction (spec §6). transform-only, 60fps.
 */
export function Button({
  children,
  onClick,
  variant = 'cheong',
  type = 'button',
  disabled,
  loading,
  full,
  className = '',
  ...aria
}: Props) {
  const isGhost = variant === 'ghost';
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-label={aria['aria-label']}
      whileHover={disabled || isGhost ? undefined : {x: -1, y: -1}}
      whileTap={disabled ? undefined : {x: 2, y: 2, boxShadow: '0px 0px 0 0 #0E0B16'}}
      transition={{type: 'spring', stiffness: 700, damping: 30}}
      className={[
        'inline-flex items-center justify-center gap-2 rounded border-2 px-5 py-3',
        'font-display font-bold uppercase tracking-wide text-sm',
        'disabled:opacity-40 disabled:cursor-not-allowed select-none',
        VARIANT[variant],
        full ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {loading && (
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </motion.button>
  );
}
