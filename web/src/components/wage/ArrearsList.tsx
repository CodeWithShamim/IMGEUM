import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useLang} from '../../hooks/useLang';
import {useAmountFormat} from '../../hooks/useToken';
import {formatDateShort} from '../../lib/format';
import {AddressChip} from '../ui/AddressChip';
import type {ArrearsRecordView} from '../../hooks/useArrears';

/**
 * Arrears records as a list, newest first — the same component behind an employer's own
 * console and their public profile, because it is the same public record either way. Every row
 * opens the evidence page, which is the artifact that actually goes to a labour office.
 */
export function ArrearsList({records, show}: {records: ArrearsRecordView[]; show: 'worker' | 'employer'}) {
  return (
    <ul className="space-y-2">
      {records.map((r) => (
        <ArrearsRow key={r.recordId.toString()} record={r} show={show} />
      ))}
    </ul>
  );
}

function ArrearsRow({record, show}: {record: ArrearsRecordView; show: 'worker' | 'employer'}) {
  const {t} = useTranslation();
  const {lang} = useLang();
  const fmt = useAmountFormat(record.token);
  const counterparty = show === 'worker' ? record.worker : record.employer;

  return (
    <li className="rounded border-2 border-vermil/40 bg-vermil/5 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-hanji/60">
          {t('evidence:recordNo', {id: record.recordId.toString()})}
        </span>
        <span className="font-mono text-xs text-hanji/50">{formatDateShort(record.attestedAt, lang)}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="text-xs text-hanji/60">
          {show === 'worker' ? t('common:labels.worker') : t('common:labels.employer')}:{' '}
          <AddressChip address={counterparty} link={false} />
        </span>
        <span className="font-mono text-sm font-bold tnum text-vermil">{fmt(record.shortfall)}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-hanji/50">
          {t('common:labels.vaultId', {id: record.vaultId.toString()})}
        </span>
        <Link
          to={`/evidence/${record.recordId.toString()}`}
          className="rounded border border-vermil/50 px-2 py-1 text-xs font-semibold text-vermil hover:bg-vermil/10"
        >
          {t('worker:arrears.viewEvidence')}
        </Link>
      </div>
    </li>
  );
}
