import {Suspense, lazy, useEffect} from 'react';
import {Routes, Route, useLocation} from 'react-router-dom';
import {AnimatePresence} from 'framer-motion';
import {useTranslation} from 'react-i18next';
import {useLang} from './hooks/useLang';
import {Toaster} from './components/motion/Toaster';
import {Loader} from './components/motion/Loader';

const Landing = lazy(() => import('./pages/Landing'));
const Worker = lazy(() => import('./pages/Worker'));
const Employer = lazy(() => import('./pages/Employer'));
const Evidence = lazy(() => import('./pages/Evidence'));
const Docs = lazy(() => import('./pages/Docs'));
const NotFound = lazy(() => import('./pages/NotFound'));

export function App() {
  const location = useLocation();
  const {lang} = useLang();
  const {t} = useTranslation();

  // Keep <html lang> in sync for accessibility and correct font shaping.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <>
      <Suspense fallback={<Loader label={t('common:status.loading')} />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Landing />} />
            <Route path="/worker" element={<Worker />} />
            <Route path="/employer" element={<Employer />} />
            <Route path="/evidence/:id" element={<Evidence />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
      <Toaster />
    </>
  );
}
