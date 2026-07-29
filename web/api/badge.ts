/**
 * `/api/badge?address=0x…` — the pay-reliability score as an embeddable SVG.
 *
 * The README has always claimed the score is something "employers can show in job postings",
 * and nothing in the app made that possible: the score lived only inside a React route that a
 * job board will not render. This is the shields.io shape — an `<img>` an employer pastes into a
 * posting, a careers page or a README — which is the one embed format that works everywhere
 * without scripts.
 *
 * SVG, not a raster: it stays sharp, weighs a few hundred bytes, and needs no image toolchain in
 * the build. The cost is that text cannot be measured server-side, so widths are estimated below.
 *
 * The score is read live per request and cached at the edge for five minutes. A stale badge is a
 * dishonest badge — this one lags a settlement by minutes, not by a deploy.
 */
import {readEmployer, asAddress, scoreHex, PALETTE, type EmployerSnapshot} from './_chain';

export const config = {runtime: 'edge'};

const FONT_SANS = "Pretendard,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
const FONT_MONO = "'JetBrains Mono',ui-monospace,SFMono-Regular,monospace";

const COPY = {
  ko: {
    label: '임금 신뢰도',
    unrated: '미평가',
    unregistered: '미등록 사업주',
    unavailable: '조회 불가',
    badAddress: '주소 오류',
    verified: '검증됨',
    unverified: '미검증',
    onTime: '기한 내 지급',
    arrears: '체불',
    vaults: '개설 볼트',
  },
  en: {
    label: 'PAY RELIABILITY',
    unrated: 'UNRATED',
    unregistered: 'NOT REGISTERED',
    unavailable: 'UNAVAILABLE',
    badAddress: 'BAD ADDRESS',
    verified: 'VERIFIED',
    unverified: 'UNVERIFIED',
    onTime: 'ON TIME',
    arrears: 'ARREARS',
    vaults: 'VAULTS',
  },
} as const;

type Lang = keyof typeof COPY;

/**
 * XML-escape anything that came off the chain.
 *
 * `displayName` and `upId` are employer-supplied strings written by `register`/`updateProfile`.
 * Unescaped they would break the document at best, and at worst carry markup into every page
 * that embeds the badge. Nothing employer-controlled reaches the output without passing here.
 */
function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&apos;',
  );
}

/** Trim to a display length, counting a CJK glyph as the two columns it actually occupies. */
function clamp(s: string, maxCols: number): string {
  let cols = 0;
  let out = '';
  for (const ch of s) {
    cols += /[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 2 : 1;
    if (cols > maxCols) return `${out}…`;
    out += ch;
  }
  return out;
}

/**
 * Approximate rendered width in px.
 *
 * An SVG served to an `<img>` is laid out by the viewer's renderer with the viewer's fonts, so
 * there is no measuring it here — every badge service estimates. Erring wide is the safe
 * direction: extra padding looks intentional, a clipped glyph does not.
 */
function estWidth(text: string, size: number): number {
  let em = 0;
  for (const ch of text) {
    if (/[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch)) em += 1.0;
    else if (/[0-9]/.test(ch)) em += 0.62;
    else if (/[A-Z]/.test(ch)) em += 0.68;
    else if (/[ .,:/'’·]/.test(ch)) em += 0.32;
    else em += 0.56;
  }
  return Math.ceil(em * size);
}

/**
 * Same, for the monospaced value.
 *
 * A separate function because the proportional estimate is badly wrong here: it scores a space
 * or a slash at 0.32em, but in a monospaced face every latin glyph occupies one identical
 * advance. "842 / 1000" came out ~20% narrow, which is exactly the amount that clips a digit.
 */
function estMonoWidth(text: string, size: number): number {
  let em = 0;
  for (const ch of text) em += /[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 1.0 : 0.62;
  return Math.ceil(em * size);
}

// Geometry of the left segment, in one place. These were previously two independent constants —
// the segment width assumed the wordmark ended at 62px while the label was placed at 74px, so a
// Korean label ran 2px under the right segment. Everything now derives from these three.
const MARK_W = 20; // roof glyph
const WORD_W = 52; // "IMGEUM" at 11px/800 with 0.5 letter-spacing
const GAP = 6;

/** The two-segment pill: left says what this measures, right says the number. */
function flatBadge(left: string, right: string, rightHex: string, rightOnDark: boolean): string {
  const h = 28;
  const pad = 10;
  const labelX = pad + MARK_W + WORD_W + GAP;
  const leftW = labelX + estWidth(left, 11) + pad;
  const rightW = estMonoWidth(right, 12) + pad * 2;
  const w = leftW + rightW;
  const rightText = rightOnDark ? PALETTE.hanji : PALETTE.ink;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(left)}: ${esc(right)}">
  <title>${esc(left)}: ${esc(right)}</title>
  <defs>
    <!-- The right segment is a plain rect with square corners. Without this clip its top-right
         and bottom-right corners paint outside the pill's rounded outline. -->
    <clipPath id="pill"><rect width="${w}" height="${h}" rx="6"/></clipPath>
  </defs>
  <g clip-path="url(#pill)">
    <rect width="${w}" height="${h}" fill="${PALETTE.ink}"/>
    <rect x="${leftW}" y="0" width="${rightW}" height="${h}" fill="${rightHex}"/>
  </g>
  <path d="M${pad} 12 L${pad + 7} 7.5 L${pad + 14} 12" fill="none" stroke="${PALETTE.gold}" stroke-width="2"/>
  <rect x="${pad + 3}" y="14" width="8" height="2" fill="${PALETTE.gold}"/>
  <rect x="${pad + 3}" y="17.5" width="8" height="2" fill="#D99700"/>
  <text x="${pad + MARK_W}" y="18.5" font-family="${FONT_SANS}" font-size="11" font-weight="800" fill="${PALETTE.hanji}" letter-spacing="0.5">IMGEUM</text>
  <text x="${labelX}" y="18.5" font-family="${FONT_SANS}" font-size="11" font-weight="600" fill="${PALETTE.hanji}" opacity="0.65">${esc(left)}</text>
  <text x="${leftW + pad}" y="19" font-family="${FONT_MONO}" font-size="12" font-weight="700" fill="${rightText}">${esc(right)}</text>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="6" fill="none" stroke="${PALETTE.ink3}"/>
</svg>`;
}

/** The larger card: score, meter and the funding record behind it. */
function cardBadge(snap: EmployerSnapshot, name: string, c: (typeof COPY)[Lang]): string {
  const w = 420;
  const h = 168;
  const hex = scoreHex(snap.score);
  const segments = 10;
  const pct = Math.max(0, Math.min(100, (snap.score / 1000) * 100));

  const meter = Array.from({length: segments}, (_, i) => {
    const filled = snap.rated && pct >= (i + 1) * (100 / segments) - 5;
    const sw = (w - 40 - (segments - 1) * 3) / segments;
    const x = 20 + i * (sw + 3);
    return `<rect x="${x.toFixed(1)}" y="104" width="${sw.toFixed(1)}" height="10" rx="2" fill="${filled ? hex : '#F7F2E7'}" opacity="${filled ? 1 : 0.14}"/>`;
  }).join('\n  ');

  // Deliberately NOT the score colour. Colour carries fixed meaning here — vermilion is breach —
  // so painting a "Dojang verified" chip with the score band made a verified employer whose score
  // was merely unrated read as though something were wrong with their verification. Verification
  // and reliability are two different claims and get two different colours.
  const chipHex = PALETTE.cheong;
  const chipW = estWidth(snap.verifiedNow ? c.verified : c.unverified, 9) + 16;
  const stat = (x: number, label: string, value: number, color: string) =>
    `<text x="${x}" y="140" font-family="${FONT_MONO}" font-size="15" font-weight="700" fill="${color}">${value}</text>
  <text x="${x}" y="153" font-family="${FONT_SANS}" font-size="8" font-weight="600" fill="${PALETTE.hanji}" opacity="0.45">${esc(label)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(name)} — ${esc(c.label)} ${snap.rated ? snap.score : c.unrated}">
  <title>${esc(name)} — ${esc(c.label)}: ${snap.rated ? `${snap.score} / 1000` : esc(c.unrated)}</title>
  <rect width="${w}" height="${h}" rx="6" fill="${PALETTE.ink}" stroke="${PALETTE.ink3}" stroke-width="2"/>
  <path d="M20 26 L31 19 L42 26" fill="none" stroke="${PALETTE.gold}" stroke-width="2.5"/>
  <rect x="24" y="28" width="14" height="3" fill="${PALETTE.gold}"/>
  <rect x="24" y="33" width="14" height="3" fill="#D99700"/>
  <text x="50" y="32" font-family="${FONT_SANS}" font-size="13" font-weight="800" fill="${PALETTE.hanji}" letter-spacing="0.6">IMGEUM</text>
  <rect x="${w - 20 - chipW}" y="20" width="${chipW}" height="16" rx="3" fill="${snap.verifiedNow ? chipHex : PALETTE.hanji}" opacity="${snap.verifiedNow ? 1 : 0.16}"/>
  <text x="${w - 20 - chipW / 2}" y="31.5" text-anchor="middle" font-family="${FONT_SANS}" font-size="9" font-weight="700" fill="${snap.verifiedNow ? PALETTE.ink : PALETTE.hanji}">${esc(snap.verifiedNow ? c.verified : c.unverified)}</text>
  <text x="20" y="60" font-family="${FONT_SANS}" font-size="17" font-weight="800" fill="${PALETTE.hanji}">${esc(clamp(name, 30))}</text>
  <text x="20" y="94" font-family="${FONT_SANS}" font-size="9" font-weight="700" fill="${PALETTE.hanji}" opacity="0.5" letter-spacing="1.4">${esc(c.label)}</text>
  ${
    snap.rated
      ? `<text x="${w - 20}" y="94" text-anchor="end" font-family="${FONT_MONO}" font-size="26" font-weight="700" fill="${hex}">${snap.score}<tspan font-size="11" fill="${PALETTE.hanji}" opacity="0.4"> / 1000</tspan></text>`
      : `<text x="${w - 20}" y="92" text-anchor="end" font-family="${FONT_SANS}" font-size="13" font-weight="700" fill="${PALETTE.hanji}" opacity="0.5">${esc(c.unrated)}</text>`
  }
  ${meter}
  ${stat(20, c.vaults, snap.vaultsOpened, PALETTE.hanji)}
  ${stat(140, c.onTime, snap.onTimeCount, PALETTE.cheong)}
  ${stat(260, c.arrears, snap.arrearsCount, PALETTE.vermil)}
</svg>`;
}

function svg(body: string, seconds: number): Response {
  return new Response(body, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      // Long enough that a popular posting does not hammer the RPC, short enough that a
      // settlement or a fresh arrears record shows up the same afternoon.
      'cache-control': `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=3600`,
      // The point of this endpoint is to be embedded on other people's pages.
      'access-control-allow-origin': '*',
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const lang: Lang = url.searchParams.get('lang') === 'en' ? 'en' : 'ko';
  const c = COPY[lang];
  const style = url.searchParams.get('style') === 'card' ? 'card' : 'flat';

  const address = asAddress(url.searchParams.get('address'));
  if (!address) {
    return svg(flatBadge(c.label, c.badAddress, PALETTE.vermil, false), 0);
  }

  const snap = await readEmployer(address);

  // Chain unreachable. Not cached: the next request should try again rather than serve an
  // outage for five minutes.
  if (!snap) return svg(flatBadge(c.label, c.unavailable, PALETTE.ink3, true), 0);

  if (!snap.registered) {
    return svg(flatBadge(c.label, c.unregistered, PALETTE.ink3, true), 300);
  }

  const name = snap.displayName || snap.upId || `${address.slice(0, 6)}…${address.slice(-4)}`;
  if (style === 'card') return svg(cardBadge(snap, name, c), 300);

  const value = snap.rated ? `${snap.score} / 1000` : c.unrated;
  return svg(flatBadge(c.label, value, snap.rated ? scoreHex(snap.score) : PALETTE.ink3, !snap.rated), 300);
}
