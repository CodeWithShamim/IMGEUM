import {useTranslation} from 'react-i18next';
import type {Lang} from '../i18n';

/** Convenience wrapper exposing the active language as a typed value + a setter. */
export function useLang(): {lang: Lang; setLang: (l: Lang) => void; toggle: () => void} {
  const {i18n} = useTranslation();
  const lang = (i18n.resolvedLanguage === 'en' ? 'en' : 'ko') as Lang;
  const setLang = (l: Lang) => {
    void i18n.changeLanguage(l);
    if (typeof document !== 'undefined') document.documentElement.lang = l;
  };
  return {lang, setLang, toggle: () => setLang(lang === 'ko' ? 'en' : 'ko')};
}
