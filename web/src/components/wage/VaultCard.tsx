import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {useSecondsClock} from '../../hooks/useClock';
import {useLang} from '../../hooks/useLang';
import {
  earnedAt,
  fundingPace,
  shortfallAt,
  vaultState,
  withdrawableAt,
  isNative,
  type Vault,
} from '../../lib/vault';
import {formatKRW, formatToken, formatDateShort} from '../../lib/format';
import {Badge} from '../ui/Badge';
import {AddressChip} from '../ui/AddressChip';

const STATE_TONE = {streaming: 'nok', settled: 'muted', breached: 'vermil', pending: 'cheong'} as const;

/**
 * A vault at a glance — used in both worker and employer lists. Shows the funding-vs-accrual
 * bar (the "is my employer keeping up?" signal) and a live earned figure.
 */
export function VaultCard({
  vault,
  role,
  children,
}: {
  vault: Vault;
  role: 'worker' | 'employer';
  children?: React.ReactNode;
}) {
  const {t} = useTranslation();
  const {lang} = useLang();
  const now = useSecondsClock();

  const earned = earnedAt(vault, now);
  const withdrawable = withdrawableAt(vault, now);
  const shortfall = shortfallAt(vault, now);
  const state = vaultState(vault, now);
  const pace = fundingPace(vault, now);
  const native = isNative(vault.token);
  const fmt = (v: bigint) => (native ? formatKRW(v, lang) : `${formatToken(v)} ${t('common:units.krw')}`);

  const fundedPct = vault.wageAmount > 0n ? Number((vault.funded * 100n) / vault.wageAmount) : 0;
  const earnedPct = vault.wageAmount > 0n ? Number((earned * 100n) / vault.wageAmount) : 0;

  const paceKey =
    pace === 'breached'
      ? 'worker:fundedPace.breached'
      : pace === 'ahead'
        ? 'worker:fundedPace.ahead'
        : pace === 'onpace'
          ? 'worker:fundedPace.onpace'
          : 'worker:fundedPace.behind';
  const paceTone = pace === 'breached' ? 'text-vermil' : pace === 'behind' ? 'text-dan-gold' : 'text-nok';

  return (
    <article className="rounded border-2 border-ink bg-ink-2 p-4 shadow-hard-ink">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-hanji">{t('common:labels.vaultId', {id: vault.id.toString()})}</span>
          <Badge tone={STATE_TONE[state]}>{t(`common:status.${state === 'settled' ? 'closed' : state === 'breached' ? 'breached' : state === 'pending' ? 'pending' : 'streaming'}`)}</Badge>
        </div>
        <span className="text-xs text-hanji/50">
          {role === 'worker' ? t('common:labels.employer') : t('common:labels.worker')}:{' '}
          <AddressChip address={role === 'worker' ? vault.employer : vault.worker} link={false} />
        </span>
      </header>

      {/* Funding vs accrual bar — accrual line rides over the funded fill. */}
      <div className="relative mt-4 h-3 w-full overflow-hidden rounded bg-hanji/10">
        <div className="absolute inset-y-0 left-0 bg-cheong/60" style={{width: `${Math.min(100, fundedPct)}%`}} />
        <div
          className="absolute inset-y-0 w-0.5 bg-dan-gold"
          style={{left: `${Math.min(100, earnedPct)}%`}}
          title={t('common:labels.earned')}
        />
      </div>
      <p className={`mt-2 text-xs font-semibold ${paceTone}`}>
        {t(paceKey, {amount: fmt(shortfall)})}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-hanji/50">{t('common:labels.earned')}</dt>
          <dd className="font-mono tnum text-dan-gold">{fmt(earned)}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-hanji/50">{t('common:labels.funded')}</dt>
          <dd className="font-mono tnum text-jade-mist">{fmt(vault.funded)}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-hanji/50">
            {role === 'worker' ? t('common:labels.withdrawable') : t('common:labels.wage')}
          </dt>
          <dd className="font-mono tnum text-nok">{role === 'worker' ? fmt(withdrawable) : fmt(vault.wageAmount)}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wide text-hanji/50">{t('common:labels.deadline')}</dt>
          <dd className="font-mono tnum text-hanji/80">{formatDateShort(vault.payoutDeadline, lang)}</dd>
        </div>
      </dl>

      {(state === 'breached' || vault.arrearsAttested) && (
        <Link
          to={`/worker`}
          className="mt-3 block rounded border border-vermil/50 bg-vermil/10 px-3 py-2 text-xs font-semibold text-vermil"
        >
          {t('worker:arrears.banner')} — {fmt(shortfall)}
        </Link>
      )}

      {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
    </article>
  );
}
