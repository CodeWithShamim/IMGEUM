import {AnimatePresence, motion} from 'framer-motion';
import {useTranslation} from 'react-i18next';
import {useToasts, type ToastKind} from '../../hooks/useToasts';
import {explorerTx} from '../../config/giwa';
import {shortAddress} from '../../lib/format';

const KIND_STYLE: Record<ToastKind, string> = {
  pending: 'border-cheong shadow-hard-cheong',
  success: 'border-nok shadow-hard-nok',
  error: 'border-vermil shadow-hard-vermil',
  info: 'border-dan-gold shadow-hard-gold',
};
const KIND_MARK: Record<ToastKind, string> = {pending: '◐', success: '◆', error: '✕', info: '●'};

/** Toast host — bottom-right stack, each a hard-shadow card with an explorer link. */
export function Toaster() {
  const {t} = useTranslation();
  const {toasts, dismiss} = useToasts();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-2 no-print">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{opacity: 0, x: 40, scale: 0.96}}
            animate={{opacity: 1, x: 0, scale: 1}}
            exit={{opacity: 0, x: 40, scale: 0.96}}
            transition={{type: 'spring', stiffness: 500, damping: 34}}
            className={`rounded border-2 bg-ink-2 p-3 ${KIND_STYLE[toast.kind]}`}
          >
            <div className="flex items-start gap-2">
              <span className={toast.kind === 'pending' ? 'animate-spin' : ''} aria-hidden>
                {KIND_MARK[toast.kind]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-hanji">{toast.message}</p>
                {toast.txHash && (
                  <a
                    href={explorerTx(toast.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block font-mono text-xs text-jade-mist hover:text-cheong"
                  >
                    {shortAddress(toast.txHash, 6)} ↗
                  </a>
                )}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-hanji/40 hover:text-hanji"
                aria-label={t('common:actions.cancel')}
              >
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
