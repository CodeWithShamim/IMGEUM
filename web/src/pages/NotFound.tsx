import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {Layout} from '../components/layout/Layout';
import {Button} from '../components/ui/Button';

export default function NotFound() {
  const {t} = useTranslation();
  return (
    <Layout>
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-32 text-center">
        <div className="font-display text-mega font-black text-dan-gold">404</div>
        <p className="mt-4 text-hanji/60">{t('common:brand')} · {t('common:tagline')}</p>
        <Link to="/" className="mt-8">
          <Button variant="gold">{t('common:nav.home')}</Button>
        </Link>
      </div>
    </Layout>
  );
}
