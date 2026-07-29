/**
 * `/api/meta?path=…` — crawler-facing HTML carrying per-route Open Graph tags.
 *
 * IMGEUM ships as a client-rendered SPA, so every route serves the same `index.html`. Link
 * unfurlers do not run JavaScript, which meant a shared employer profile and a shared evidence
 * record previewed identically — or, before this, not at all, since `index.html` carried no `og:`
 * tags whatsoever. Both are links meant to be *sent to someone*: a worker is shown an employer's
 * record before signing, and an evidence record is forwarded to a labour office or a union.
 *
 * `vercel.json` routes only known social crawlers here by user-agent, so humans keep getting the
 * app and the SPA is untouched. Crawlers that slip past the UA list simply get the static
 * defaults in `index.html`, which is a weaker card rather than a broken one.
 *
 * NOTE — no `og:image`. A per-route preview image has to be a raster (PNG/JPEG); Twitter, Slack
 * and KakaoTalk all ignore SVG in `og:image`, so pointing at `/api/badge` would produce cards
 * with a broken image slot rather than the text-only cards these tags produce today. Rendering
 * one properly needs `@vercel/og` plus a bundled Korean face for employer names — a dependency
 * and a font decision, deliberately left out of this change.
 */
import {
  asAddress,
  readEmployer,
  readRecord,
  readToken,
  resolveRecordId,
  type EmployerSnapshot,
  type RecordSnapshot,
} from './_chain';
import {formatUnits} from 'viem';

export const config = {runtime: 'edge'};

const COPY = {
  ko: {
    siteName: 'IMGEUM · 임금 프로토콜',
    defaultTitle: 'IMGEUM · 임금 프로토콜',
    defaultDesc:
      '지급여력을 급여일 전에 확인하고, 체불을 단 한 번의 트랜잭션으로 증명합니다. GIWA 체인 기반 임금 에스크로와 체불 증빙 프로토콜.',
    directoryTitle: '사업주 디렉터리 · IMGEUM',
    directoryDesc:
      '등록된 모든 사업주와, 실제 예치 이력으로 컨트랙트가 계산한 임금 신뢰도 점수. 지갑 없이 확인할 수 있습니다.',
    docsTitle: '문서 · IMGEUM',
    docsDesc: 'IMGEUM 프로토콜의 컨트랙트 구조, 신뢰도 점수 산식, 증빙 검증 방법.',
    employerDesc: (s: EmployerSnapshot, score: string) =>
      `임금 신뢰도 ${score} · 개설 볼트 ${s.vaultsOpened}건 · 기한 내 지급 ${s.onTimeCount}건 · 체불 ${s.arrearsCount}건. ${
        s.verifiedNow ? 'Dojang 검증된 사업주입니다.' : 'Dojang 검증이 현재 확인되지 않습니다.'
      } 지갑 없이 누구나 확인할 수 있습니다.`,
    unrated: '미평가',
    notRegistered: (a: string) => `${a} 주소는 IMGEUM에 사업주로 등록되어 있지 않습니다.`,
    notRegisteredTitle: '미등록 주소 · IMGEUM',
    recordTitle: (id: string) => `임금체불 증빙 제 ${id} 호 · IMGEUM`,
    recordDesc: (r: RecordSnapshot, amount: string) =>
      `${r.employerName || '사업주'} · 볼트 #${r.vaultId.toString()}${amount ? ` · 미지급액 ${amount}` : ''}. GIWA 블록체인에 기록된 변경 불가능한 증빙으로, 고용노동부 또는 법원 제출용입니다. 누구나 직접 재검증할 수 있습니다.`,
    recordMissingTitle: '증빙 기록을 찾을 수 없습니다 · IMGEUM',
    recordMissingDesc: '해당 ID의 임금체불 증빙 기록이 존재하지 않습니다.',
    openApp: '앱에서 열기',
  },
  en: {
    siteName: 'IMGEUM · Wage Protocol',
    defaultTitle: 'IMGEUM · Wage Protocol',
    defaultDesc:
      'Proof-of-solvency payroll and wage-arrears evidence on the GIWA chain. See employer solvency before payday, and prove non-payment in one transaction.',
    directoryTitle: 'Employer directory · IMGEUM',
    directoryDesc:
      'Every registered employer with the pay-reliability score the contracts compute from their actual funding history. No wallet needed to read it.',
    docsTitle: 'Docs · IMGEUM',
    docsDesc: 'How the IMGEUM contracts work: the reliability score formula, and how to verify an evidence record.',
    employerDesc: (s: EmployerSnapshot, score: string) =>
      `Pay reliability ${score} · ${s.vaultsOpened} vaults opened · ${s.onTimeCount} paid on time · ${s.arrearsCount} in arrears. ${
        s.verifiedNow ? 'Dojang-verified employer.' : 'Dojang verification not currently confirmed.'
      } Readable by anyone, no wallet required.`,
    unrated: 'unrated',
    notRegistered: (a: string) => `${a} has not registered as an employer on IMGEUM.`,
    notRegisteredTitle: 'Unregistered address · IMGEUM',
    recordTitle: (id: string) => `Wage Arrears Evidence Record No. ${id} · IMGEUM`,
    recordDesc: (r: RecordSnapshot, amount: string) =>
      `${r.employerName || 'Employer'} · vault #${r.vaultId.toString()}${amount ? ` · ${amount} unpaid` : ''}. An immutable on-chain record for submission to the Ministry of Employment and Labor or a court. Anyone can re-verify it independently.`,
    recordMissingTitle: 'Evidence record not found · IMGEUM',
    recordMissingDesc: 'No wage-arrears evidence record exists for this ID.',
    openApp: 'Open in the app',
  },
} as const;

type Lang = keyof typeof COPY;

/** HTML-escape. Employer names and up.ids are employer-written strings; none reach the document raw. */
function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&#39;',
  );
}

/** Preview text is quoted in full by some clients and truncated hard by others; keep it short. */
function trim(s: string, max = 200): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

interface Card {
  title: string;
  description: string;
  /** Absolute canonical URL of the real route, never the /api/meta one. */
  canonical: string;
  status: number;
}

async function employerCard(origin: string, raw: string, c: (typeof COPY)[Lang], lang: Lang): Promise<Card> {
  const canonical = `${origin}/employers/${raw}`;
  const address = asAddress(raw);
  if (!address) {
    return {title: c.notRegisteredTitle, description: c.notRegistered(raw), canonical, status: 404};
  }

  const snap = await readEmployer(address);
  // Chain unreachable, or the address never registered. Both get the generic card rather than a
  // confidently wrong one — a preview that invents a score is worse than a preview that doesn't.
  if (!snap || !snap.registered) {
    return {
      title: c.notRegisteredTitle,
      description: c.notRegistered(shortAddress(address)),
      canonical,
      status: snap ? 404 : 200,
    };
  }

  const name = snap.displayName || snap.upId || shortAddress(address);
  const score = snap.rated ? `${snap.score} / 1000` : c.unrated;
  return {
    title: `${name} — ${lang === 'ko' ? '임금 신뢰도' : 'pay reliability'} ${score} · IMGEUM`,
    description: c.employerDesc(snap, score),
    canonical,
    status: 200,
  };
}

async function evidenceCard(origin: string, raw: string, c: (typeof COPY)[Lang]): Promise<Card> {
  const canonical = `${origin}/evidence/${raw}`;
  const recordId = await resolveRecordId(raw);
  if (recordId === undefined) {
    return {title: c.recordMissingTitle, description: c.recordMissingDesc, canonical, status: 404};
  }

  const rec = await readRecord(recordId);
  if (!rec) {
    return {title: c.recordMissingTitle, description: c.recordMissingDesc, canonical, status: 404};
  }

  // The shortfall is quoted only when its token's decimals are known. See `readToken`.
  const meta = await readToken(rec.token);
  const amount = meta ? `${formatUnits(rec.shortfall, meta.decimals)} ${meta.symbol}` : '';
  return {
    title: c.recordTitle(recordId.toString()),
    description: c.recordDesc(rec, amount),
    canonical,
    status: 200,
  };
}

function page(card: Card, c: (typeof COPY)[Lang], lang: Lang): Response {
  const title = esc(trim(card.title, 90));
  const description = esc(trim(card.description));
  const canonical = esc(card.canonical);

  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#0E0B16">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(c.siteName)}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${lang === 'ko' ? 'ko_KR' : 'en_US'}">
<meta property="og:locale:alternate" content="${lang === 'ko' ? 'en_US' : 'ko_KR'}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
</head>
<body>
<h1>${title}</h1>
<p>${description}</p>
<p><a href="${canonical}">${esc(c.openApp)}</a></p>
<script>location.replace(${JSON.stringify(card.canonical)})</script>
</body>
</html>`;

  return new Response(html, {
    status: card.status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Unfurlers cache aggressively on their own side; this keeps a shared link from re-reading
      // the chain for every recipient in a group chat.
      'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = url.origin;

  // `?lang` wins; otherwise follow the crawler's Accept-Language. Korean is the default because
  // the app is Korean-first and the evidence document is issued in the legal register.
  const requested = url.searchParams.get('lang');
  const accepts = req.headers.get('accept-language') ?? '';
  const lang: Lang = requested === 'en' || (!requested && /^en\b/i.test(accepts)) ? 'en' : 'ko';
  const c = COPY[lang];

  const path = url.searchParams.get('path') ?? '/';
  const segments = path.split('?')[0].split('/').filter(Boolean);

  try {
    if (segments[0] === 'employers' && segments[1]) {
      return page(await employerCard(origin, segments[1], c, lang), c, lang);
    }
    if (segments[0] === 'evidence' && segments[1]) {
      return page(await evidenceCard(origin, segments[1], c), c, lang);
    }
    if (segments[0] === 'employers') {
      return page(
        {title: c.directoryTitle, description: c.directoryDesc, canonical: `${origin}/employers`, status: 200},
        c,
        lang,
      );
    }
    if (segments[0] === 'docs') {
      return page({title: c.docsTitle, description: c.docsDesc, canonical: `${origin}/docs`, status: 200}, c, lang);
    }
  } catch {
    // Fall through to the generic card. A crawler gets one shot at a link; a 500 here would turn
    // a shared evidence record into a bare URL in the recipient's chat.
  }

  return page(
    {title: c.defaultTitle, description: c.defaultDesc, canonical: `${origin}${path}`, status: 200},
    c,
    lang,
  );
}
