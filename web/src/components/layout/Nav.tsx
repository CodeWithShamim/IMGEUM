import {NavLink} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAccount, useConnect, useDisconnect, useChainId, useSwitchChain} from 'wagmi';
import {LangToggle} from '../ui/LangToggle';
import {Button} from '../ui/Button';
import {shortAddress} from '../../lib/format';
import {giwaSepolia} from '../../config/giwa';
import {BlockPulse} from '../motion/Loader';

const linkClass = ({isActive}: {isActive: boolean}) =>
  `px-3 py-1.5 text-sm font-semibold uppercase tracking-wide rounded transition-colors ${
    isActive ? 'text-ink bg-dan-gold' : 'text-hanji/70 hover:text-hanji'
  }`;

export function Nav() {
  const {t} = useTranslation();
  const {address, isConnected} = useAccount();
  const {connect, connectors, isPending} = useConnect();
  const {disconnect} = useDisconnect();
  const chainId = useChainId();
  const {switchChain} = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== giwaSepolia.id;

  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-ink/95 backdrop-blur lg:pl-10">
      <nav className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2" aria-label="IMGEUM">
          <RoofMark />
          <span className="font-display text-xl font-extrabold tracking-tight">
            {t('common:brand')}
            <span className="ml-1 hidden align-super text-[0.6rem] font-semibold uppercase tracking-widest text-dan-gold sm:inline">
              {t('common:brandSub')}
            </span>
          </span>
        </NavLink>

        <div className="mx-2 hidden items-center gap-1 md:flex">
          <NavLink to="/worker" className={linkClass}>
            {t('common:nav.worker')}
          </NavLink>
          <NavLink to="/employer" className={linkClass}>
            {t('common:nav.employer')}
          </NavLink>
          <NavLink to="/docs" className={linkClass}>
            {t('common:nav.docs')}
          </NavLink>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:block">
            <BlockPulse />
          </span>
          <LangToggle />
          {wrongNetwork ? (
            <Button variant="vermil" onClick={() => switchChain({chainId: giwaSepolia.id})}>
              {t('common:nav.wrongNetwork')}
            </Button>
          ) : isConnected ? (
            <button
              onClick={() => disconnect()}
              className="rounded border-2 border-ink bg-ink-2 px-3 py-2 font-mono text-xs text-hanji hover:border-vermil"
              title={t('common:nav.disconnect')}
            >
              {shortAddress(address)}
            </button>
          ) : (
            <Button
              variant="gold"
              loading={isPending}
              onClick={() => connect({connector: connectors[0]})}
            >
              {t('common:nav.connect')}
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}

function RoofMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="6" fill="#0E0B16" stroke="#211B38" />
      <path d="M4 12 L16 5 L28 12" fill="none" stroke="#FFB300" strokeWidth="2.5" />
      <rect x="8" y="13" width="16" height="3" fill="#2245FF" />
      <rect x="8" y="18" width="16" height="3" fill="#00C48C" />
      <rect x="8" y="23" width="16" height="3" fill="#FF3D2E" />
    </svg>
  );
}
