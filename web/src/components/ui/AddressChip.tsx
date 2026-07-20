import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {explorerAddress} from '../../config/giwa';
import {shortAddress} from '../../lib/format';
import type {Address} from '../../lib/vault';

interface Props {
  address: Address;
  /** Optional resolved up.id name; shown in place of the hex when present. */
  upId?: string;
  verified?: boolean;
  mono?: boolean;
  link?: boolean;
}

/**
 * Renders an address as its up.id name when available, otherwise a shortened hex, always with
 * copy + explorer affordances. Workers send `name.up.id`, never a raw address (spec §1).
 */
export function AddressChip({address, upId, verified, mono = true, link = true}: Props) {
  const {t} = useTranslation();
  const [copied, setCopied] = useState(false);
  const label = upId && upId.length > 0 ? upId : shortAddress(address);

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${mono ? 'font-mono' : 'font-sans'} text-sm ${verified ? 'text-nok' : 'text-hanji/90'}`}
        title={address}
      >
        {verified && <span aria-hidden>◆ </span>}
        {label}
      </span>
      <button
        onClick={copy}
        className="rounded px-1 text-xs text-hanji/50 hover:text-dan-gold"
        aria-label={t('common:actions.copy')}
      >
        {copied ? t('common:actions.copied') : '⧉'}
      </button>
      {link && (
        <a
          href={explorerAddress(address)}
          target="_blank"
          rel="noreferrer"
          className="rounded px-1 text-xs text-hanji/50 hover:text-cheong"
          aria-label={t('common:actions.viewOnExplorer')}
        >
          ↗
        </a>
      )}
    </span>
  );
}
