import {motion} from 'framer-motion';
import {useTranslation} from 'react-i18next';
import {useLang} from '../../hooks/useLang';
import {LANGS} from '../../i18n';

/**
 * Persistent KO/EN switch — a dancheong-striped pill, active language in dan-gold (spec §6.5).
 * The sliding highlight is the only moving part; text stays put so there's no layout jump.
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
            onClick={() => setLang(l)}
            aria-pressed={active}
            className="relative z-10 px-2.5 py-1 text-xs font-bold uppercase"
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
