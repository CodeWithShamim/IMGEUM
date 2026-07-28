import {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {Layout} from '../components/layout/Layout';
import {TileWipe} from '../components/motion/TileWipe';
import {Watermark} from '../components/ui/Watermark';
import {Badge} from '../components/ui/Badge';
import {Button} from '../components/ui/Button';
import {SolvencyMeter} from '../components/ui/SolvencyMeter';
import {AddressChip} from '../components/ui/AddressChip';
import {useImgeum} from '../hooks/useImgeum';
import {useEmployerDirectory, sortByReliability, type DirectoryEntry} from '../hooks/useEmployers';

const PAGE_SIZE = 24;

/**
 * The public employer directory — the half of the pay-reliability story that was missing.
 *
 * Deliberately readable with no wallet connected: a worker deciding whether to take a job is
 * exactly the person least likely to arrive holding one, and the score is worthless as a
 * signal if checking it requires being a participant first.
 */
export default function Employers() {
  const {t} = useTranslation();
  const {isDeployed} = useImgeum();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const {entries, total, pageCount, isLoading} = useEmployerDirectory(page, PAGE_SIZE);

  // Filtering is over the loaded page only, and says so: the registry is paged on-chain, so a
  // search box that silently searched 24 of 4,000 companies would be a lie.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = sortByReliability(entries);
    if (!q) return sorted;
    return sorted.filter((e) =>
      [e.profile.displayName, e.profile.upId, e.upIdName ?? '', e.address]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [entries, query]);

  return (
    <Layout rail={t('common:nav.directory')}>
      <TileWipe>
        <div className="relative mx-auto max-w-6xl px-4 py-8">
          <Watermark text="신뢰" className="-right-4 top-16 opacity-[0.05]" />

          <header className="mb-6">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-nok">{t('employers:subtitle')}</p>
            <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{t('employers:title')}</h1>
            <p className="mt-3 max-w-2xl text-sm text-hanji/70">{t('employers:body')}</p>
          </header>

          {!isDeployed ? (
            <Empty msg={t('common:empty.notDeployed')} tone="vermil" />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('employers:searchPlaceholder')}
                  className="min-w-[14rem] flex-1 rounded border-2 border-ink bg-ink-2 px-3 py-2 text-sm text-hanji placeholder:text-hanji/30 focus:border-cheong focus:outline-none"
                />
                <span className="font-mono text-xs text-hanji/50">
                  {t('employers:count', {shown: shown.length, total})}
                </span>
              </div>

              {isLoading && entries.length === 0 ? (
                <Empty msg={t('common:status.loading')} />
              ) : shown.length === 0 ? (
                <Empty msg={total === 0 ? t('employers:emptyRegistry') : t('employers:emptySearch')} />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {shown.map((e) => (
                    <EmployerCard key={e.address} entry={e} />
                  ))}
                </ul>
              )}

              {pageCount > 1 && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    {t('employers:pager.prev')}
                  </Button>
                  <span className="font-mono text-xs text-hanji/60">
                    {t('employers:pager.page', {page: page + 1, of: pageCount})}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={page + 1 >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    {t('employers:pager.next')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </TileWipe>
    </Layout>
  );
}

function EmployerCard({entry}: {entry: DirectoryEntry}) {
  const {t} = useTranslation();
  const {profile, score, rated, verifiedNow, upIdName, address} = entry;

  return (
    <li className="rounded border-2 border-ink bg-ink-2 p-4 shadow-hard-ink">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/employers/${address}`}
            className="font-display text-lg font-bold text-hanji hover:text-dan-gold"
          >
            {profile.displayName || t('employers:unnamed')}
          </Link>
          <div className="mt-0.5 font-mono text-xs text-jade-mist">{upIdName || profile.upId}</div>
        </div>
        <Badge tone={verifiedNow ? 'nok' : 'muted'}>
          {verifiedNow ? t('common:status.verified') : t('common:status.unverified')}
        </Badge>
      </div>

      <div className="mt-3">
        <SolvencyMeter score={score} rated={rated} size="sm" />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Figure label={t('common:labels.vault')} value={profile.vaultsOpened} tone="text-jade-mist" />
        <Figure label={t('common:status.onTime')} value={profile.onTimeCount} tone="text-nok" />
        <Figure label={t('common:status.breached')} value={profile.arrearsCount} tone="text-vermil" />
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2">
        <AddressChip address={address} upId={upIdName || undefined} link={false} />
        <Link to={`/employers/${address}`} className="text-xs font-semibold text-cheong hover:text-dan-gold">
          {t('employers:view')}
        </Link>
      </div>
    </li>
  );
}

function Figure({label, value, tone}: {label: string; value: number; tone: string}) {
  return (
    <div className="rounded border border-hanji/10 bg-ink px-2 py-1.5">
      <dt className="text-[0.6rem] uppercase tracking-wide text-hanji/40">{label}</dt>
      <dd className={`font-display text-lg font-bold tnum ${tone}`}>{value}</dd>
    </div>
  );
}

function Empty({msg, tone}: {msg: string; tone?: 'vermil'}) {
  return (
    <div
      className={`rounded border-2 border-dashed p-10 text-center ${
        tone === 'vermil' ? 'border-vermil/30 text-vermil/80' : 'border-hanji/20 text-hanji/60'
      }`}
    >
      {msg}
    </div>
  );
}
