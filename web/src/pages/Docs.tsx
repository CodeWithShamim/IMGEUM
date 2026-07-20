import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Layout} from '../components/layout/Layout';
import {TileWipe} from '../components/motion/TileWipe';
import {Badge} from '../components/ui/Badge';
import {AddressChip} from '../components/ui/AddressChip';
import {useImgeum} from '../hooks/useImgeum';
import {GIWA_LINKS, explorerAddress} from '../config/giwa';
import type {Address} from '../lib/vault';

const SECTIONS = [
  'overview',
  'streaming',
  'employer',
  'worker',
  'evidence',
  'contracts',
  'giwa',
  'faq',
  'security',
] as const;

/**
 * In-app documentation, hanji paper mode, fully authored in EN and KO (language toggle in the
 * nav switches the whole content, not just chrome). Left nav + content; contract addresses and
 * ABIs are read from the deployment artifact, never hand-copied.
 */
export default function Docs() {
  const {t} = useTranslation();
  const [active, setActive] = useState<(typeof SECTIONS)[number]>('overview');

  return (
    <Layout rail={t('common:nav.docs')}>
      <TileWipe>
        <div className="min-h-screen bg-ink px-4 py-8">
          <div className="mx-auto max-w-6xl">
            <header className="mb-6">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-cheong">{t('docs:subtitle')}</p>
              <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{t('docs:title')}</h1>
            </header>

            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              {/* Left nav. */}
              <nav className="lg:sticky lg:top-24 lg:self-start">
                <ul className="space-y-1">
                  {SECTIONS.map((s) => (
                    <li key={s}>
                      <button
                        onClick={() => {
                          setActive(s);
                          document.getElementById(`doc-${s}`)?.scrollIntoView({behavior: 'smooth', block: 'start'});
                        }}
                        className={`w-full rounded px-3 py-1.5 text-left text-sm ${
                          active === s ? 'bg-dan-gold text-ink font-semibold' : 'text-hanji/60 hover:text-hanji'
                        }`}
                      >
                        {t(`docs:nav.${s}`)}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Content on hanji paper. */}
              <article className="rounded border-2 border-ink bg-hanji p-6 text-ink sm:p-8">
                <Prose id="overview" heading={t('docs:overview.heading')}>
                  <p>{t('docs:overview.p1')}</p>
                  <p>{t('docs:overview.p2')}</p>
                </Prose>

                <Prose id="streaming" heading={t('docs:streaming.heading')}>
                  <p>{t('docs:streaming.p1')}</p>
                  <p>{t('docs:streaming.p2')}</p>
                  <VaultLifecycle caption={t('docs:streaming.diagramCaption')} />
                </Prose>

                <Prose id="employer" heading={t('docs:employer.heading')}>
                  <Steps items={[t('docs:employer.s1'), t('docs:employer.s2'), t('docs:employer.s3'), t('docs:employer.s4')]} />
                </Prose>

                <Prose id="worker" heading={t('docs:worker.heading')}>
                  <Steps items={[t('docs:worker.s1'), t('docs:worker.s2'), t('docs:worker.s3'), t('docs:worker.s4')]} />
                </Prose>

                <Prose id="evidence" heading={t('docs:evidence.heading')}>
                  <p>{t('docs:evidence.p1')}</p>
                  <p>{t('docs:evidence.p2')}</p>
                  <div className="my-4 rounded border-2 border-ink/20 bg-ink/5 p-4 text-sm">
                    <p className="font-semibold">{t('docs:evidence.sampleHeading')}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/70">
                      <li>{t('docs:evidence.sampleEmployer')}</li>
                      <li>{t('docs:evidence.sampleShortfall')}</li>
                      <li>{t('docs:evidence.sampleUid')}</li>
                    </ul>
                  </div>
                </Prose>

                <Prose id="contracts" heading={t('docs:contracts.heading')}>
                  <p>{t('docs:contracts.p1')}</p>
                  <VerifyPanel />
                  <p className="mt-3 text-sm text-ink/60">{t('docs:contracts.abiHint')}</p>
                </Prose>

                <Prose id="giwa" heading={t('docs:giwa.heading')}>
                  <DocLink href={GIWA_LINKS.verifiedAddressDocs}>{t('docs:giwa.dojang')}</DocLink>
                  <DocLink href={GIWA_LINKS.upIdDocs}>{t('docs:giwa.upid')}</DocLink>
                  <DocLink href={GIWA_LINKS.flashblocksDocs}>{t('docs:giwa.flashblocks')}</DocLink>
                  <DocLink href={GIWA_LINKS.feesDocs}>{t('docs:giwa.fees')}</DocLink>
                </Prose>

                <Prose id="faq" heading={t('docs:faq.heading')}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="mb-3">
                      <p className="font-semibold text-ink">{t(`docs:faq.q${i}`)}</p>
                      <p className="text-ink/70">{t(`docs:faq.a${i}`)}</p>
                    </div>
                  ))}
                </Prose>

                <Prose id="security" heading={t('docs:security.heading')}>
                  <ul className="list-disc space-y-2 pl-5 text-ink/75">
                    <li>{t('docs:security.l1')}</li>
                    <li>{t('docs:security.l2')}</li>
                    <li>{t('docs:security.l3')}</li>
                    <li>{t('docs:security.l4')}</li>
                    <li>{t('docs:security.l5')}</li>
                  </ul>
                </Prose>
              </article>
            </div>
          </div>
        </div>
      </TileWipe>
    </Layout>
  );
}

function Prose({id, heading, children}: {id: string; heading: string; children: React.ReactNode}) {
  return (
    <section id={`doc-${id}`} className="mb-10 scroll-mt-24">
      <div className="mb-3 h-1 w-12 dancheong-band" />
      <h2 className="font-display text-2xl font-bold text-ink">{heading}</h2>
      <div className="mt-3 space-y-3 text-[0.95rem] leading-relaxed text-ink/80">{children}</div>
    </section>
  );
}

function Steps({items}: {items: string[]}) {
  return (
    <ol className="space-y-2">
      {items.map((s, i) => (
        <li key={i} className="rounded border border-ink/15 bg-ink/5 p-3 text-sm text-ink/80">
          {s}
        </li>
      ))}
    </ol>
  );
}

function DocLink({href, children}: {href: string; children: React.ReactNode}) {
  return (
    <p className="mb-2">
      <a href={href} target="_blank" rel="noreferrer" className="text-cheong underline hover:text-vermil">
        {children} ↗
      </a>
    </p>
  );
}

/** Animated diagram of the vault lifecycle. */
function VaultLifecycle({caption}: {caption: string}) {
  const {t} = useTranslation();
  const nodes = [
    {k: 'openVault', c: 'bg-cheong'},
    {k: 'fund', c: 'bg-dan-gold'},
    {k: 'streaming', c: 'bg-nok'},
    {k: 'withdraw', c: 'bg-dan-gold'},
    {k: 'closed', c: 'bg-hanji/40'},
  ];
  return (
    <figure className="my-4">
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto rounded border-2 border-ink/20 bg-ink/5 p-4">
        {nodes.map((n, i) => (
          <div key={n.k} className="flex items-center gap-2">
            <span className={`rounded ${n.c} px-3 py-1.5 text-xs font-bold text-ink`}>
              {t(`common:actions.${n.k}`, {defaultValue: t(`common:status.${n.k}`, {defaultValue: n.k})})}
            </span>
            {i < nodes.length - 1 && <span className="text-ink/40">→</span>}
          </div>
        ))}
        <span className="text-ink/40">⤷</span>
        <span className="rounded bg-vermil px-3 py-1.5 text-xs font-bold text-hanji">{t('common:status.breached')}</span>
      </div>
      <figcaption className="mt-2 text-xs text-ink/50">{caption}</figcaption>
    </figure>
  );
}

/** "Verify it yourself" — deep-links every deployed contract to the explorer. */
function VerifyPanel() {
  const {t} = useTranslation();
  const {deployment, isDeployed} = useImgeum();
  if (!isDeployed || !deployment) {
    return <p className="mt-3 rounded border border-vermil/40 bg-vermil/10 p-3 text-sm text-vermil">{t('docs:contracts.notDeployed')}</p>;
  }
  const rows: [string, Address][] = [
    ['EmployerRegistry', deployment.employerRegistry],
    ['WageVault', deployment.wageVault],
    ['ArrearsAttestor', deployment.arrearsAttestor],
    ['DojangVerifier', deployment.dojangVerifier],
  ];
  return (
    <div className="mt-3 rounded border-2 border-ink/20 bg-ink/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink">{t('docs:contracts.verifyPanel')}</h3>
        {deployment.dojangMock && <Badge tone="gold">{t('common:status.mock')}</Badge>}
      </div>
      <ul className="space-y-1.5">
        {rows.map(([name, addr]) => (
          <li key={name} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-mono text-ink/70">{name}</span>
            <a href={explorerAddress(addr)} target="_blank" rel="noreferrer" className="font-mono text-cheong hover:text-vermil">
              <AddressChip address={addr} link />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
