import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Link, useParams} from 'react-router-dom';
import {isAddress} from 'viem';
import {Layout} from '../components/layout/Layout';
import {TileWipe} from '../components/motion/TileWipe';
import {Badge} from '../components/ui/Badge';
import {Button} from '../components/ui/Button';
import {Stat} from '../components/ui/Stat';
import {SolvencyMeter} from '../components/ui/SolvencyMeter';
import {AddressChip} from '../components/ui/AddressChip';
import {ArrearsList} from '../components/wage/ArrearsList';
import {useEmployer} from '../hooks/useEmployer';
import {useUpId} from '../hooks/useUpId';
import {useLang} from '../hooks/useLang';
import {useEmployerArrearsIds, useArrearsRecords} from '../hooks/useArrears';
import {formatDateShort} from '../lib/format';
import {explorerAddress} from '../config/giwa';
import type {Address} from '../lib/vault';

/**
 * One employer, in public: identity, pay-reliability score, and every arrears record filed
 * against them.
 *
 * This is the page a worker is meant to be shown a link to before signing anything, and the
 * page an employer can put in a job posting when their record is good. Both readings are
 * intentional — a reliability score nobody can look up is not a reputation.
 */
export default function EmployerProfile() {
  const {t} = useTranslation();
  const {lang} = useLang();
  const {address} = useParams<{address: string}>();
  const valid = !!address && isAddress(address);
  const target = valid ? (address as Address) : undefined;

  const emp = useEmployer(target);
  const {name} = useUpId(target);
  const {data: recordIds} = useEmployerArrearsIds(target);
  const idList = useMemo(() => (recordIds as bigint[] | undefined) ?? [], [recordIds]);
  const {records} = useArrearsRecords(idList);

  const p = emp.profile;

  return (
    <Layout rail={t('common:nav.directory')}>
      <TileWipe>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <Link to="/employers" className="text-xs font-semibold uppercase tracking-widest text-cheong hover:text-dan-gold">
            ← {t('employers:profile.back')}
          </Link>

          {!valid ? (
            <Notice msg={t('employers:profile.notFound')} tone="vermil" />
          ) : emp.isLoading ? (
            <Notice msg={t('common:status.loading')} />
          ) : !emp.isRegistered ? (
            <div className="mt-6">
              <Notice msg={t('employers:profile.notRegistered')} tone="vermil" />
              <div className="mt-4 flex justify-center">
                <AddressChip address={target as Address} upId={name || undefined} />
              </div>
            </div>
          ) : (
            <>
              <header className="mt-4 rounded border-2 border-ink bg-ink-2 p-5 shadow-hard-ink">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="font-display text-3xl font-extrabold">{p?.displayName}</h1>
                    <div className="mt-1 font-mono text-sm text-jade-mist">{name || p?.upId}</div>
                    <div className="mt-2">
                      <AddressChip address={target as Address} upId={name || undefined} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge tone={emp.verifiedNow ? 'nok' : 'muted'}>
                      {emp.verifiedNow ? t('common:status.verified') : t('common:status.unverified')}
                    </Badge>
                    {p?.registeredAt ? (
                      <span className="font-mono text-[0.65rem] text-hanji/50">
                        {t('employers:profile.registered', {date: formatDateShort(p.registeredAt, lang)})}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5">
                  <SolvencyMeter score={emp.score} rated={emp.rated} />
                  <p className="mt-2 text-xs text-hanji/50">
                    {emp.rated ? t('employers:profile.scoreBody') : t('employer:score.unratedBody', {n: 3})}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <Stat label={t('common:labels.vault')} value={p?.vaultsOpened ?? 0} tone="cheong" />
                  <Stat label={t('common:status.onTime')} value={p?.onTimeCount ?? 0} tone="nok" />
                  <Stat label={t('common:status.breached')} value={p?.arrearsCount ?? 0} tone="vermil" />
                </div>

                {/* The identity claim is only worth what its source is: link straight to it. */}
                <div className="mt-5 flex flex-wrap gap-2">
                  <a href={explorerAddress(target as Address)} target="_blank" rel="noreferrer">
                    <Button variant="ghost">{t('employers:profile.openExplorer')}</Button>
                  </a>
                </div>
              </header>

              <section className="mt-8">
                <h2 className="mb-1 font-display text-sm font-bold uppercase tracking-[0.2em] text-vermil">
                  {t('employers:profile.arrearsHeading')}
                </h2>
                <p className="mb-3 text-xs text-hanji/50">{t('employers:profile.arrearsBody')}</p>
                {records.length === 0 ? (
                  <div className="rounded border-2 border-dashed border-nok/30 p-8 text-center text-sm text-nok/80">
                    {t('employers:profile.arrearsNone')}
                  </div>
                ) : (
                  <ArrearsList records={records} show="worker" />
                )}
              </section>
            </>
          )}
        </div>
      </TileWipe>
    </Layout>
  );
}

function Notice({msg, tone}: {msg: string; tone?: 'vermil'}) {
  return (
    <div
      className={`mt-6 rounded border-2 border-dashed p-10 text-center ${
        tone === 'vermil' ? 'border-vermil/30 text-vermil/80' : 'border-hanji/20 text-hanji/60'
      }`}
    >
      {msg}
    </div>
  );
}
