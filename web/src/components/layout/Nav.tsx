import {useEffect, useMemo, useRef, useState} from 'react';
import {NavLink} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAccount, useConnect, useDisconnect} from 'wagmi';
import type {Connector} from 'wagmi';
import {LangToggle} from '../ui/LangToggle';
import {Button} from '../ui/Button';
import {shortAddress} from '../../lib/format';
import {GIWA_LINKS} from '../../config/giwa';
import {useNetwork} from '../../hooks/useNetwork';
import {useToasts} from '../../hooks/useToasts';
import {useUpId} from '../../hooks/useUpId';
import {errorKey} from '../../hooks/useTx';
import {BlockPulse} from '../motion/Loader';
import type {Address} from '../../lib/vault';

const linkClass = ({isActive}: {isActive: boolean}) =>
  `px-3 py-1.5 text-sm font-semibold uppercase tracking-wide rounded transition-colors ${
    isActive ? 'text-ink bg-dan-gold' : 'text-hanji/70 hover:text-hanji'
  }`;

export function Nav() {
  const {t} = useTranslation();
  const {address, isConnected} = useAccount();
  const {disconnect} = useDisconnect();
  const {isWrongNetwork, isSwitching, ensureNetwork} = useNetwork();
  // The wallet's own up.id name, when it holds an active one. Seeing your own name here is
  // what makes the identity layer feel like it belongs to you rather than to the app.
  const {name} = useUpId(address as Address | undefined);

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
          {/* `end` so an employer's public profile doesn't light up the console tab. */}
          <NavLink to="/employers" className={linkClass} end>
            {t('common:nav.directory')}
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
          {isWrongNetwork ? (
            <Button variant="vermil" loading={isSwitching} onClick={() => void ensureNetwork()}>
              {t('common:nav.wrongNetwork')}
            </Button>
          ) : isConnected ? (
            <button
              onClick={() => disconnect()}
              className="rounded border-2 border-ink bg-ink-2 px-3 py-2 font-mono text-xs text-hanji hover:border-vermil"
              title={`${address ?? ''} — ${t('common:nav.disconnect')}`}
            >
              {name || shortAddress(address)}
            </button>
          ) : (
            <ConnectControl />
          )}
        </div>
      </nav>
    </header>
  );
}

/**
 * Connect entry point.
 *
 * The GIWA switch is deliberately NOT folded into `connect({chainId})`: the injected connector
 * rethrows a declined switch out of `connect`, so wagmi would tear the whole connection down
 * and leave the user with nothing. Connecting plainly and letting `useNetwork`'s auto-switch
 * follow costs the same two wallet prompts, and a decline leaves the wallet connected with the
 * wrong-network banner explaining itself.
 *
 * EIP-6963 means several wallets may announce themselves, so with more than one we ask rather
 * than silently picking whichever loaded first.
 */
function ConnectControl() {
  const {t} = useTranslation();
  const {connectAsync, connectors, isPending} = useConnect();
  const {push} = useToasts();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // A wallet that announces over EIP-6963 also sits behind the generic `injected()` connector,
  // which would otherwise show up beside it as a second, unnamed "Injected" entry. When
  // anything has announced itself properly, that generic fallback is redundant.
  const options = useMemo(() => {
    const announced = connectors.filter((c) => c.id !== 'injected');
    const list = announced.length > 0 ? announced : connectors;
    const seen = new Set<string>();
    return list.filter((c) => {
      const key = c.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [connectors]);

  // Only the generic fallback, and nothing behind it: this browser has no wallet at all.
  const noWallet =
    options.length === 0 || (options.every((c) => c.id === 'injected') && !hasInjectedProvider());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = async (connector: Connector) => {
    setOpen(false);
    try {
      await connectAsync({connector});
    } catch (err) {
      push({kind: 'error', message: t(errorKey(err))});
    }
  };

  if (noWallet) {
    return (
      <a href={GIWA_LINKS.connectDocs} target="_blank" rel="noreferrer">
        <Button variant="ghost">{t('common:nav.noWallet')}</Button>
      </a>
    );
  }

  if (options.length === 1) {
    return (
      <Button variant="gold" loading={isPending} onClick={() => void run(options[0])}>
        {t('common:nav.connect')}
      </Button>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <Button variant="gold" loading={isPending} onClick={() => setOpen((v) => !v)}>
        {t('common:nav.connect')}
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 min-w-[12rem] rounded border-2 border-ink bg-ink-2 p-1 shadow-hard-ink"
        >
          {options.map((c) => (
            <button
              key={c.uid}
              role="menuitem"
              onClick={() => void run(c)}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-hanji hover:bg-ink"
            >
              {c.icon && <img src={c.icon} alt="" className="h-4 w-4" aria-hidden />}
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Whether a browser wallet is actually present, as opposed to merely declared by wagmi. */
function hasInjectedProvider() {
  return typeof window !== 'undefined' && !!(window as {ethereum?: unknown}).ethereum;
}

function RoofMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="6" fill="#0E0B16" stroke="#211B38" />
      <path d="M4 12 L16 5 L28 12" fill="none" stroke="#FFB300" strokeWidth="2.5" />
      <rect x="8" y="13" width="16" height="3" fill="#FFB300" />
      <rect x="8" y="18" width="16" height="3" fill="#D99700" />
      <rect x="8" y="23" width="16" height="3" fill="#A87400" />
    </svg>
  );
}
