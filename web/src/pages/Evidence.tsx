import {useEffect, useMemo, useState} from 'react';
import {useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {motion} from 'framer-motion';
import {useReadContract} from 'wagmi';
import type {Abi} from 'viem';
import {useImgeum} from '../hooks/useImgeum';
import {useLang} from '../hooks/useLang';
import {LangToggle} from '../components/ui/LangToggle';
import {Button} from '../components/ui/Button';
import {Loader} from '../components/motion/Loader';
import {EASE} from '../components/motion/ease';
import {usePrefersReducedMotion} from '../hooks/usePrefersReducedMotion';
import {formatKRW, formatToken, formatDate, shortAddress} from '../lib/format';
import {explorerAddress, DOJANG, GIWA_LINKS} from '../config/giwa';
import {isNative, type Address} from '../lib/vault';

interface ArrearsRecord {
  vaultId: bigint;
  employer: Address;
  worker: Address;
  token: Address;
  wageAmount: bigint;
  fundedAtAttestation: bigint;
  shortfall: bigint;
  periodStart: bigint;
  periodEnd: bigint;
  payoutDeadline: bigint;
  attestedAt: bigint;
  attestedAtBlock: bigint;
  employerDojangUid: `0x${string}`;
  employerUpId: string;
  employerName: string;
  attester: Address;
}

/**
 * Public, wallet-less, printable evidence page — the labor-office view (spec §4).
 * Inverts to hanji paper mode; KO is the legal-register default here regardless of app locale
 * (spec §6.5), with EN available for foreign workers. Print stylesheet renders both.
 */
export default function Evidence() {
  const {id} = useParams<{id: string}>();
  const {t} = useTranslation();
  const {lang, setLang} = useLang();
  const {attestor, isDeployed} = useImgeum();
  const reduced = usePrefersReducedMotion();
  const [stamped, setStamped] = useState(false);

  // Evidence page defaults to Korean (legal register) on first mount.
  useEffect(() => {
    if (lang !== 'ko') setLang('ko');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Support both /evidence/:recordId and /evidence/vault-:vaultId.
  const isVaultRef = id?.startsWith('vault-');
  const vaultId = isVaultRef ? BigInt(id!.replace('vault-', '')) : undefined;

  const recordOfVault = useReadContract({
    address: attestor?.address as Address | undefined,
    abi: attestor?.abi as Abi | undefined,
    functionName: 'recordOfVault',
    args: vaultId !== undefined ? [vaultId] : undefined,
    query: {enabled: isDeployed && isVaultRef && vaultId !== undefined},
  });

  const recordId = useMemo(() => {
    if (isVaultRef) return (recordOfVault.data as bigint | undefined) ?? undefined;
    try {
      return id ? BigInt(id) : undefined;
    } catch {
      return undefined;
    }
  }, [id, isVaultRef, recordOfVault.data]);

  const verify = useReadContract({
    address: attestor?.address as Address | undefined,
    abi: attestor?.abi as Abi | undefined,
    functionName: 'verifyRecord',
    args: recordId !== undefined && recordId !== 0n ? [recordId] : undefined,
    query: {enabled: isDeployed && recordId !== undefined && recordId !== 0n},
  });

  useEffect(() => {
    if (verify.data) {
      const id2 = setTimeout(() => setStamped(true), reduced ? 0 : 250);
      return () => clearTimeout(id2);
    }
  }, [verify.data, reduced]);

  if (!isDeployed) return <PaperShell><p>{t('common:empty.notDeployed')}</p></PaperShell>;
  if (verify.isLoading || recordOfVault.isLoading) return <Loader label={t('common:status.loading')} />;

  const data = verify.data as
    | readonly [ArrearsRecord, boolean, `0x${string}`, bigint]
    | undefined;

  if (!data || recordId === 0n || recordId === undefined) {
    return (
      <PaperShell>
        <div className="text-center">
          <p className="font-display text-2xl font-bold text-vermil">✕</p>
          <p className="mt-2 text-ink/70">{t('evidence:notFound')}</p>
        </div>
      </PaperShell>
    );
  }

  const [rec, verifiedNow, , outstanding] = data;
  const native = isNative(rec.token);
  const fmt = (v: bigint) => (native ? formatKRW(v, lang) : `${formatToken(v)} KRW`);

  return (
    <PaperShell>
      {/* Document header with the vermilion dojang seal stamp. */}
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-cheong">{t('evidence:issuedBy')}</p>
            <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">{t('evidence:docTitle')}</h1>
            <p className="mt-1 text-sm text-ink/60">{t('evidence:docSubtitle')}</p>
            <p className="mt-1 font-mono text-sm text-ink/80">{t('evidence:recordNo', {id: recordId.toString()})}</p>
          </div>
          <div className="flex flex-col items-end gap-2 no-print">
            <LangToggle />
          </div>
        </div>

        {/* Dojang seal — slams in with a screen-shake (spec §6). */}
        <motion.div
          initial={reduced ? {opacity: 1} : {opacity: 0, scale: 2.4, rotate: -18}}
          animate={stamped ? {opacity: 1, scale: 1, rotate: -12} : undefined}
          transition={{duration: 0.35, ease: EASE}}
          className="pointer-events-none absolute right-2 top-2 hidden sm:block"
        >
          <DojangSeal breached={outstanding > 0n} />
        </motion.div>
      </div>

      {/* Summary banner. */}
      <div className={`mt-6 rounded border-2 p-4 ${outstanding > 0n ? 'border-vermil bg-vermil/10' : 'border-nok bg-nok/10'}`}>
        <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink/60">
          {t('evidence:fields.shortfall')}
        </div>
        <div className="mt-1 font-mono text-3xl font-bold tnum text-vermil sm:text-4xl">{fmt(rec.shortfall)}</div>
        <div className="mt-1 text-sm text-ink/70">
          {rec.employerName} · {t('evidence:fields.vault')} #{rec.vaultId.toString()}
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Section title={t('evidence:sections.parties')}>
          <Row label={t('evidence:fields.employer')} value={rec.employerName} />
          {rec.employerUpId && <Row label={t('evidence:fields.employerUpId')} value={rec.employerUpId} mono />}
          <Row label={t('evidence:fields.employerAddress')} value={shortAddress(rec.employer, 6)} mono link={explorerAddress(rec.employer)} />
          <Row label={t('evidence:fields.workerAddress')} value={shortAddress(rec.worker, 6)} mono link={explorerAddress(rec.worker)} />
        </Section>

        <Section title={t('evidence:sections.amounts')}>
          <Row label={t('evidence:fields.wageAmount')} value={fmt(rec.wageAmount)} mono />
          <Row label={t('evidence:fields.funded')} value={fmt(rec.fundedAtAttestation)} mono />
          <Row label={t('evidence:fields.shortfall')} value={fmt(rec.shortfall)} mono tone="vermil" />
          <Row label={t('evidence:verification.outstanding')} value={fmt(outstanding)} mono />
        </Section>

        <Section title={t('evidence:sections.timeline')}>
          <Row label={t('evidence:fields.periodStart')} value={formatDate(rec.periodStart, lang)} />
          <Row label={t('evidence:fields.periodEnd')} value={formatDate(rec.periodEnd, lang)} />
          <Row label={t('evidence:fields.deadline')} value={formatDate(rec.payoutDeadline, lang)} tone="vermil" />
          <Row label={t('evidence:fields.attestedAt')} value={formatDate(rec.attestedAt, lang)} />
          <Row label={t('evidence:fields.attestedBlock')} value={`#${rec.attestedAtBlock.toString()}`} mono />
        </Section>

        <Section title={t('evidence:sections.verification')}>
          <Row
            label={t('evidence:verification.atRecord')}
            value={t('evidence:verification.yes')}
            tone="nok"
          />
          <Row
            label={t('evidence:verification.now')}
            value={verifiedNow ? t('evidence:verification.yes') : t('evidence:verification.no')}
            tone={verifiedNow ? 'nok' : 'vermil'}
          />
          <Row label={t('evidence:fields.dojangUid')} value={shortAddress(rec.employerDojangUid, 8)} mono />
        </Section>
      </div>

      {/* Trustless verification panel. */}
      <div className="mt-6 rounded border-2 border-ink bg-ink/5 p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
          {t('evidence:sections.verification')}
        </h3>
        <p className="mt-2 text-sm text-ink/70">{t('evidence:verification.explainer')}</p>
        <div className="mt-3 flex flex-wrap gap-2 no-print">
          <a href={explorerAddress(DOJANG.eas)} target="_blank" rel="noreferrer">
            <Button variant="ghost" className="!text-ink !border-ink/40">{t('evidence:verification.easLink')}</Button>
          </a>
          <a href={explorerAddress(rec.employer)} target="_blank" rel="noreferrer">
            <Button variant="ghost" className="!text-ink !border-ink/40">{t('evidence:verification.vaultLink')}</Button>
          </a>
        </div>
      </div>

      {/* Legal statement — 합니다체 register. */}
      <div className="mt-6 border-t-2 border-ink pt-4 text-sm text-ink/80">
        <p>{t('evidence:legal.statement')}</p>
        <p className="mt-2 font-semibold">{t('evidence:legal.forOfficial')}</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 no-print">
        <p className="text-xs text-ink/50">{t('evidence:legal.printHint')}</p>
        <div className="flex gap-2">
          <ShareButton />
          <Button variant="cheong" onClick={() => window.print()}>
            {t('evidence:printCta')}
          </Button>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-ink/20 pt-3 text-[0.65rem] text-ink/40 no-print">
        <span>IMGEUM · 임금 프로토콜</span>
        <a href={GIWA_LINKS.explorer} target="_blank" rel="noreferrer" className="hover:text-cheong">
          GIWA Sepolia Explorer ↗
        </a>
      </div>
    </PaperShell>
  );
}

function ShareButton() {
  const {t} = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      className="!text-ink !border-ink/40"
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? t('common:actions.copied') : t('evidence:shareCta')}
    </Button>
  );
}

function PaperShell({children}: {children: React.ReactNode}) {
  return (
    <div className="min-h-screen bg-ink px-4 py-8">
      <div className="print-paper mx-auto max-w-3xl rounded border-2 border-ink bg-hanji p-6 text-ink shadow-hard-ink-lg sm:p-10">
        {children}
      </div>
    </div>
  );
}

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <section>
      <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-[0.2em] text-ink/60">{title}</h2>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
  tone,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'nok' | 'vermil';
  link?: string;
}) {
  const color = tone === 'nok' ? 'text-nok' : tone === 'vermil' ? 'text-vermil' : 'text-ink';
  const val = <span className={`${mono ? 'font-mono' : ''} text-sm font-semibold ${color}`}>{value}</span>;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-ink/55">{label}</dt>
      <dd>
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" className="hover:underline">
            {val} <span className="no-print text-ink/40">↗</span>
          </a>
        ) : (
          val
        )}
      </dd>
    </div>
  );
}

/** The 도장/dojang seal metaphor — a vermilion stamp. Poetic, since Dojang verifies the employer. */
function DojangSeal({breached}: {breached: boolean}) {
  const {t} = useTranslation();
  const color = breached ? '#FF3D2E' : '#00C48C';
  return (
    <div
      className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 text-center"
      style={{borderColor: color, color}}
    >
      <span className="font-display text-2xl font-black leading-none">체불</span>
      <span className="mt-1 text-[0.5rem] font-bold uppercase tracking-wider">{t('common:status.breached')}</span>
    </div>
  );
}
