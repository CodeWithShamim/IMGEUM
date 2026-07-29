import {motion} from 'framer-motion';
import {useTranslation} from 'react-i18next';
import {useLang} from '../../hooks/useLang';
import {LANGS} from '../../i18n';

/**
 * Persistent KO/EN switch — a dancheong-striped pill, active language in dan-gold (spec §6.5).
 * The sliding highlight is the only moving part; text stays put so there's no layout jump.
 *
 * Nothing here can guarantee that on its own, though: the control is only as stable as the bar
 * it sits in, and it was the surrounding nav — not this component — that used to slide it out
 * from under the pointer on every switch. See the layout note in `Nav`.
 */
export function LangToggle() {
  const {t} = useTranslation();
  const {lang, setLang} = useLang();

  return (
    <div
      role="group"
      aria-label={t('common:lang.switchTo')}
      className="relative inline-flex items-center rounded border-2 border-ink bg-ink-2 p-0.5"
    >
      {LANGS.map((l) => {
        const active = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={active}
            // Fixed width, not padding: "KO" and "EN" measure a hair apart, and the pill has to
            // be the one element on the page that does not move when you press it.
            className="relative z-10 w-9 py-1 text-center text-xs font-bold uppercase"
          >
            {active && (
              <motion.span
                layoutId="lang-pill"
                transition={{type: 'spring', stiffness: 500, damping: 34}}
                className="absolute inset-0 -z-10 rounded bg-dan-gold"
              />
            )}
            <span className={active ? 'text-ink' : 'text-hanji/60'}>{t(`common:lang.${l}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
