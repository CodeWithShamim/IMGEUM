import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {motion} from 'framer-motion';
import {Layout} from '../components/layout/Layout';
import {TileWipe} from '../components/motion/TileWipe';
import {Button} from '../components/ui/Button';
import {Watermark} from '../components/ui/Watermark';
import {BlockPulse} from '../components/motion/Loader';
import {EASE} from '../components/motion/ease';
import {useLang} from '../hooks/useLang';

export default function Landing() {
  const {t} = useTranslation();
  const {lang} = useLang();

  return (
    <Layout rail={t('common:brand')}>
      <TileWipe>
        {/* HERO — asymmetric, art-directed per locale. */}
        <section className="relative overflow-hidden border-b-2 border-ink">
          <Watermark text={t('landing:hero.watermark')} className="-right-8 -top-10 opacity-[0.08]" />
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:py-24 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-dan-gold">{t('landing:hero.kicker')}</p>
              {/* KO and EN are distinct compositions (spec §6.5): the KO wordmark stacks tight
                  in Pretendard Black, the EN in uppercase Bricolage — same keys, art-directed
                  layout per locale, never a machine-swapped string. */}
              <h1
                className={`mt-4 font-display text-mega font-extrabold leading-[0.85] ${
                  lang === 'en' ? 'uppercase' : 'tracking-tight'
                }`}
              >
                <span className="block">{t('landing:hero.line1')}</span>
                <span className="block text-dan-gold">{t('landing:hero.line2')}</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-hanji/75">{t('landing:hero.sub')}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/worker">
                  <Button variant="gold">{t('landing:hero.ctaWorker')}</Button>
                </Link>
                <Link to="/employer">
                  <Button variant="ghost">{t('landing:hero.ctaEmployer')}</Button>
                </Link>
              </div>
            </div>

            {/* Live-accrual teaser card. */}
            <motion.div
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.5, ease: EASE}}
              className="rounded border-2 border-ink bg-ink-2 p-6 shadow-hard-gold"
            >
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-hanji/50">
                  {t('landing:hero.liveCounter')}
                </span>
                <BlockPulse label="1s" />
              </div>
              <div className="mt-3 h-2 w-full rounded dancheong-band opacity-40" />
              <LiveTeaser />
            </motion.div>
          </div>
        </section>

        {/* STATS band. */}
        <section className="dancheong-band">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-ink/10 sm:grid-cols-4">
            <StatCell label={t('landing:stats.arrearsLabel')} value={t('landing:stats.arrearsValue')} />
            <StatCell label={t('landing:stats.workersLabel')} value={t('landing:stats.workersValue')} />
            <StatCell label={t('landing:stats.blockLabel')} value={t('landing:stats.blockValue')} />
            <StatCell label={t('landing:stats.attestLabel')} value={t('landing:stats.attestValue')} />
          </div>
        </section>

        {/* PROBLEM. */}
        <Beam watermark={t('landing:problem.watermark')} align="left">
          <SectionHead title={t('landing:problem.title')} body={t('landing:problem.body')} />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Point n="01" title={t('landing:problem.point1Title')} body={t('landing:problem.point1Body')} tone="vermil" />
            <Point n="02" title={t('landing:problem.point2Title')} body={t('landing:problem.point2Body')} tone="gold" />
            <Point n="03" title={t('landing:problem.point3Title')} body={t('landing:problem.point3Body')} tone="cheong" />
          </div>
        </Beam>

        {/* HOW. */}
        <Beam watermark={t('landing:how.watermark')} align="right">
          <SectionHead title={t('landing:how.title')} />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Step
                key={i}
                n={`0${i}`}
                title={t(`landing:how.step${i}Title`)}
                body={t(`landing:how.step${i}Body`)}
              />
            ))}
          </div>
        </Beam>

        {/* WHY GIWA. */}
        <Beam watermark={t('landing:why.watermark')} align="left">
          <SectionHead title={t('landing:why.title')} />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Why title={t('landing:why.flashTitle')} body={t('landing:why.flashBody')} tone="gold" />
            <Why title={t('landing:why.dojangTitle')} body={t('landing:why.dojangBody')} tone="nok" />
            <Why title={t('landing:why.upidTitle')} body={t('landing:why.upidBody')} tone="cheong" />
          </div>
        </Beam>

        {/* CTA. */}
        <section className="border-t-2 border-ink">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center">
            <h2 className="font-display text-giant font-extrabold">{t('landing:cta.title')}</h2>
            <p className="mt-4 text-hanji/70">{t('landing:cta.body')}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/worker">
                <Button variant="gold">{t('landing:cta.worker')}</Button>
              </Link>
              <Link to="/employer">
                <Button variant="cheong">{t('landing:cta.employer')}</Button>
              </Link>
              <Link to="/docs">
                <Button variant="ghost">{t('landing:cta.docs')}</Button>
              </Link>
            </div>
          </div>
        </section>
      </TileWipe>
    </Layout>
  );
}

/* ------------------------------- pieces ---------------------------------- */

function LiveTeaser() {
  const {lang} = useLang();
  // Purely decorative teaser: a KRW figure ticking up from a fixed base.
  const base = 1_284_500;
  return (
    <div className="mt-4">
      <TeaserCounter base={base} />
      <div className="mt-1 font-mono text-xs text-nok">+ {lang === 'ko' ? '1,041원' : '₩1,041'} /sec</div>
    </div>
  );
}

function TeaserCounter({base}: {base: number}) {
  const {lang} = useLang();
  const [v, setV] = useState(base);
  useEffect(() => {
    const id = setInterval(() => setV((x) => x + 1041), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = new Intl.NumberFormat(lang === 'ko' ? 'ko-KR' : 'en-US', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  });
  return <div className="font-mono text-4xl font-bold tnum text-dan-gold">{fmt.format(v)}</div>;
}

function StatCell({label, value}: {label: string; value: string}) {
  return (
    <div className="bg-ink p-6">
      <div className="font-display text-2xl font-extrabold text-hanji tnum">{value}</div>
      <div className="mt-1 text-xs text-hanji/50">{label}</div>
    </div>
  );
}

function Beam({children, watermark, align}: {children: React.ReactNode; watermark: string; align: 'left' | 'right'}) {
  return (
    <section className="relative overflow-hidden border-b-2 border-ink">
      <Watermark text={watermark} className={`${align === 'left' ? '-left-8' : '-right-8'} top-8 opacity-[0.05]`} />
      <div className="mx-auto max-w-7xl px-4 py-16">{children}</div>
    </section>
  );
}

function SectionHead({title, body}: {title: string; body?: string}) {
  return (
    <div className="max-w-2xl">
      <div className="mb-3 h-1 w-16 dancheong-band" />
      <h2 className="font-display text-giant font-extrabold leading-none">{title}</h2>
      {body && <p className="mt-4 text-hanji/70">{body}</p>}
    </div>
  );
}

function Point({n, title, body, tone}: {n: string; title: string; body: string; tone: 'vermil' | 'gold' | 'cheong'}) {
  const border = tone === 'vermil' ? 'border-vermil' : tone === 'gold' ? 'border-dan-gold' : 'border-cheong';
  return (
    <div className={`rounded border-2 border-ink border-l-4 ${border} bg-ink-2 p-5`}>
      <div className="font-mono text-xs text-hanji/40">{n}</div>
      <h3 className="mt-2 font-display text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm text-hanji/65">{body}</p>
    </div>
  );
}

function Step({n, title, body}: {n: string; title: string; body: string}) {
  return (
    <div className="rounded border-2 border-ink bg-ink-2 p-5 shadow-hard-ink">
      <div className="font-display text-3xl font-black text-dan-gold">{n}</div>
      <h3 className="mt-2 font-display font-bold">{title}</h3>
      <p className="mt-2 text-sm text-hanji/65">{body}</p>
    </div>
  );
}

function Why({title, body, tone}: {title: string; body: string; tone: 'gold' | 'nok' | 'cheong'}) {
  const c = tone === 'gold' ? 'text-dan-gold' : tone === 'nok' ? 'text-nok' : 'text-jade-mist';
  return (
    <div className="rounded border-2 border-ink bg-ink-2 p-5">
      <h3 className={`font-display text-lg font-bold ${c}`}>{title}</h3>
      <p className="mt-2 text-sm text-hanji/65">{body}</p>
    </div>
  );
}
