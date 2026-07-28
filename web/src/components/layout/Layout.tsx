import type {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {Nav} from './Nav';
import {NetworkBanner} from './NetworkBanner';
import {RoofRail} from './RoofRail';
import {GIWA_LINKS, explorerAddress} from '../../config/giwa';
import {useImgeum} from '../../hooks/useImgeum';
import type {Address} from '../../lib/vault';

/** App shell: roof rail + nav + content + footer. `rail` sets the rotated rail label. */
export function Layout({children, rail}: {children: ReactNode; rail?: string}) {
  const {t} = useTranslation();

  return (
    <div className="min-h-screen bg-ink">
      <RoofRail label={rail ?? t('common:brand')} />
      <Nav />
      <div className="lg:pl-10">
        <NetworkBanner />
      </div>

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
        <ContractLinks />
      </footer>
    </div>
  );
}

/**
 * Every deployed address, deep-linked to the GIWA explorer, on every page.
 *
 * The same list the docs page carries, but a worker reading their wage stream or a labour
 * officer reading an evidence page shouldn't have to navigate to the docs to check what the
 * app is actually talking to. Includes the GIWA contracts IMGEUM depends on — DojangVerifier
 * and UPNameRegistry — because the identity claims are only as checkable as those are.
 */
function ContractLinks() {
  const {t} = useTranslation();
  const {deployment, isDeployed} = useImgeum();
  if (!isDeployed || !deployment) return null;

  const rows: [string, Address][] = [
    ['EmployerRegistry', deployment.employerRegistry],
    ['WageVault', deployment.wageVault],
    ['ArrearsAttestor', deployment.arrearsAttestor],
    ['DojangVerifier', deployment.dojangVerifier],
    ['UpIdResolver', deployment.upIdResolver],
    ['UPNameRegistry', deployment.upNameRegistry],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hanji/10 pt-4 text-xs">
        <span className="font-semibold uppercase tracking-[0.2em] text-hanji/40">
          {t('common:footer.contracts')}
        </span>
        {rows.map(([name, addr]) => (
          <a
            key={name}
            href={explorerAddress(addr)}
            target="_blank"
            rel="noreferrer"
            title={addr}
            className="font-mono text-hanji/60 transition-colors hover:text-cheong"
          >
            {name}
            <span aria-hidden> ↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
