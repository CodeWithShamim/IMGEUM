import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from '../locales/en/common.json';
import enLanding from '../locales/en/landing.json';
import enWorker from '../locales/en/worker.json';
import enEmployer from '../locales/en/employer.json';
import enEvidence from '../locales/en/evidence.json';
import enDocs from '../locales/en/docs.json';
import enErrors from '../locales/en/errors.json';

import koCommon from '../locales/ko/common.json';
import koLanding from '../locales/ko/landing.json';
import koWorker from '../locales/ko/worker.json';
import koEmployer from '../locales/ko/employer.json';
import koEvidence from '../locales/ko/evidence.json';
import koDocs from '../locales/ko/docs.json';
import koErrors from '../locales/ko/errors.json';

export const NS = ['common', 'landing', 'worker', 'employer', 'evidence', 'docs', 'errors'] as const;
export const LANGS = ['ko', 'en'] as const;
export type Lang = (typeof LANGS)[number];

const resources = {
  en: {
    common: enCommon,
    landing: enLanding,
    worker: enWorker,
    employer: enEmployer,
    evidence: enEvidence,
    docs: enDocs,
    errors: enErrors,
  },
  ko: {
    common: koCommon,
    landing: koLanding,
    worker: koWorker,
    employer: koEmployer,
    evidence: koEvidence,
    docs: koDocs,
    errors: koErrors,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Primary market is Korea — KO is the default, EN the fallback (spec §6.5).
    fallbackLng: 'ko',
    supportedLngs: LANGS as unknown as string[],
    ns: NS as unknown as string[],
    defaultNS: 'common',
    interpolation: {escapeValue: false},
    detection: {
      // URL ?lang= → localStorage → browser → default KO.
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'imgeum.lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
