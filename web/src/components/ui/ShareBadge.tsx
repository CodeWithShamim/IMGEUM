import {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useLang} from '../../hooks/useLang';
import type {Address} from '../../lib/vault';

type Style = 'flat' | 'card';

/**
 * The embed panel on an employer's public profile: the live badge, and the snippets to paste it
 * into a job posting, a careers page or a README.
 *
 * This is the half of the reliability score that was missing. The contracts computed a public
 * number and the app rendered it on a route no job board will ever load — so the score could not
 * travel to where hiring actually happens. `/api/badge` renders it as an SVG; this panel is how
 * an employer discovers that and copies it.
 *
 * Shown for every registered employer, not only good ones. A badge that appeared once a score
 * crossed a threshold would be marketing; one that always renders is a reputation.
 */
export function ShareBadge({address, profileUrl}: {address: Address; profileUrl: string}) {
  const {t} = useTranslation();
  const {lang} = useLang();
  const [style, setStyle] = useState<Style>('flat');
  // A dev server has no serverless functions, so the preview 404s locally. Failing quietly to
  // the snippets is better than a broken-image icon on the profile of a real employer.
  const [previewFailed, setPreviewFailed] = useState(false);

  const badgeUrl = useMemo(() => {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}/api/badge?address=${address}&lang=${lang}&style=${style}`;
  }, [address, lang, style]);

  const alt = t('employers:share.alt');
  const snippets: {id: string; label: string; value: string}[] = [
    {
      id: 'markdown',
      label: t('employers:share.formatMarkdown'),
      value: `[![${alt}](${badgeUrl})](${profileUrl})`,
    },
    {
      id: 'html',
      label: t('employers:share.formatHtml'),
      value: `<a href="${profileUrl}"><img src="${badgeUrl}" alt="${alt}" /></a>`,
    },
    {id: 'url', label: t('employers:share.formatUrl'), value: profileUrl},
  ];

  return (
    <section className="mt-8 rounded border-2 border-ink bg-ink-2 p-5 shadow-hard-ink">
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-dan-gold">
        {t('employers:share.heading')}
      </h2>
      <p className="mt-1 text-xs text-hanji/50">{t('employers:share.body')}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(['flat', 'card'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStyle(s)}
            aria-pressed={style === s}
            className={`rounded border-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
              style === s
                ? 'border-dan-gold bg-dan-gold text-ink'
                : 'border-ink-3 text-hanji/60 hover:border-dan-gold/50 hover:text-hanji'
            }`}
          >
            {t(`employers:share.style.${s}`)}
          </button>
        ))}
      </div>

      {!previewFailed && (
        <div className="mt-4 flex justify-center rounded border border-dashed border-hanji/15 bg-ink p-4">
          {/* Rendered through the real endpoint rather than mocked in React: what an employer
              sees here is byte-for-byte what a job board will serve. */}
          <img src={badgeUrl} alt={alt} onError={() => setPreviewFailed(true)} />
        </div>
      )}

      <div className="mt-4 space-y-2">
        {snippets.map((s) => (
          <SnippetRow key={s.id} label={s.label} value={s.value} />
        ))}
      </div>
    </section>
  );
}

function SnippetRow({label, value}: {label: string; value: string}) {
  const {t} = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-hanji/40">
        {label}
      </span>
      <code className="min-w-0 flex-1 truncate rounded border border-ink-3 bg-ink px-2 py-1.5 font-mono text-[0.7rem] text-jade-mist" title={value}>
        {value}
      </code>
      <button
        onClick={copy}
        className="shrink-0 rounded border-2 border-ink-3 px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-hanji/60 hover:border-dan-gold hover:text-dan-gold"
      >
        {copied ? t('common:actions.copied') : t('common:actions.copy')}
      </button>
    </div>
  );
}
