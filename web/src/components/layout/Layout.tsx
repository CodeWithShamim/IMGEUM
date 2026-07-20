import type {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {Nav} from './Nav';
import {RoofRail} from './RoofRail';
import {GIWA_LINKS} from '../../config/giwa';
import {useImgeum} from '../../hooks/useImgeum';
import {Badge} from '../ui/Badge';

/** App shell: roof rail + nav + content + footer. `rail` sets the rotated rail label. */
export function Layout({children, rail}: {children: ReactNode; rail?: string}) {
  const {t} = useTranslation();
  const {isMock} = useImgeum();

  return (
    <div className="min-h-screen bg-ink">
      <RoofRail label={rail ?? t('common:brand')} />
      <Nav />

      {isMock && (
        <div className="border-b border-dan-gold/30 bg-dan-gold/10 px-4 py-1.5 text-center lg:pl-10 no-print">
          <span className="inline-flex items-center gap-2 text-xs text-dan-gold">
            <Badge tone="gold">{t('common:status.mock')}</Badge>
            {t('common:status.mockNote')}
          </span>
        </div>
      )}

      <main className="lg:pl-10">{children}</main>

      <footer className="mt-20 border-t-2 border-ink lg:pl-10 no-print">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-lg font-extrabold">{t('common:brand')}</div>
            <div className="text-xs text-hanji/50">{t('common:footer.rights')}</div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-hanji/60">
            <span>{t('common:footer.builtFor')}</span>
            <a href={GIWA_LINKS.docs} target="_blank" rel="noreferrer" className="hover:text-cheong">
              {t('common:footer.docsLink')}
            </a>
            <a href={GIWA_LINKS.faucet} target="_blank" rel="noreferrer" className="hover:text-dan-gold">
              {t('common:footer.faucet')}
            </a>
            <a href={GIWA_LINKS.explorer} target="_blank" rel="noreferrer" className="hover:text-nok">
              {t('common:footer.explorer')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
