import {useTranslation} from 'react-i18next';
import {useNetwork} from '../../hooks/useNetwork';
import {ACTIVE_CHAIN} from '../../config/giwa';

/**
 * Persistent wrong-network bar.
 *
 * The automatic switch on connect covers the ordinary path; this is what's left when the user
 * declines it, or moves the wallet to another network after connecting. It stays on screen
 * until the wallet is back on GIWA — writes are blocked in that state, so a dismissible
 * notice would just turn into a confusing failure later.
 */
export function NetworkBanner() {
  const {t} = useTranslation();
  const {isWrongNetwork, walletChainId, isSwitching, ensureNetwork} = useNetwork();

  if (!isWrongNetwork) return null;

  return (
    <div role="alert" className="border-b-2 border-ink bg-vermil/15 no-print">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        <span className="font-semibold text-vermil">{t('common:network.wrongNetworkTitle')}</span>
        <span className="text-hanji/70">
          {t('common:network.wrongNetworkDetail', {
            chain: ACTIVE_CHAIN.name,
            chainId: ACTIVE_CHAIN.id,
            current: walletChainId ?? '—',
          })}
        </span>
        <button
          onClick={() => void ensureNetwork()}
          disabled={isSwitching}
          className="ml-auto rounded border-2 border-vermil px-3 py-1 text-xs font-bold uppercase tracking-wide text-vermil transition-colors hover:bg-vermil hover:text-ink disabled:opacity-50"
        >
          {isSwitching ? t('common:network.switching') : t('common:nav.wrongNetwork')}
        </button>
      </div>
    </div>
  );
}
