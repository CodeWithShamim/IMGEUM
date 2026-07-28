import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {explorerAddress} from '../../config/giwa';
import {shortAddress} from '../../lib/format';
import {useUpId} from '../../hooks/useUpId';
import type {Address} from '../../lib/vault';

interface Props {
  address: Address;
  /** Pre-resolved name (a snapshot, a batch lookup). Skips this chip's own resolution. */
  upId?: string;
  /**
   * Look the name up on-chain when none was passed. On by default: an address a person is
   * meant to recognise should read as a name wherever it appears. Turn it off for addresses
   * that are not people — deployed contracts have no up.id name and never will.
   */
  resolve?: boolean;
  verified?: boolean;
  mono?: boolean;
  link?: boolean;
}

/**
 * Renders an address as its up.id name when available, otherwise a shortened hex, always with
 * copy + explorer affordances. Workers send `name.up.id`, never a raw address (spec §1).
 *
 * The hex is never thrown away: it stays in the title attribute, and copy still yields the
 * address, because that is what a person pastes into a wallet or an explorer. The name is a
 * label on top of the address, not a replacement for it.
 */
export function AddressChip({address, upId, resolve = true, verified, mono = true, link = true}: Props) {
  const {t} = useTranslation();
  const [copied, setCopied] = useState(false);
  const lookup = useUpId(resolve && !upId ? address : undefined);
  const name = upId || lookup.name;
  const label = name && name.length > 0 ? name : shortAddress(address);

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
