// CI guard for internationalization (build spec §6.5):
//   1. EN and KO must have identical key sets in every namespace.
//   2. No hardcoded literal text in JSX — every user-visible string goes through t().
// Exits non-zero on any violation so it can gate CI.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');
const localesDir = join(web, 'src', 'locales');
const srcDir = join(web, 'src');

let errors = 0;
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  errors++;
};

/* ---------------------------- 1. key parity ------------------------------ */
function flatten(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flatten(v, key));
    else out.push(key);
  }
  return out;
}

const namespaces = readdirSync(join(localesDir, 'en')).filter((f) => f.endsWith('.json'));
for (const ns of namespaces) {
  const en = JSON.parse(readFileSync(join(localesDir, 'en', ns), 'utf8'));
  const koPath = join(localesDir, 'ko', ns);
  let ko;
  try {
    ko = JSON.parse(readFileSync(koPath, 'utf8'));
  } catch {
    fail(`missing KO namespace: ${ns}`);
    continue;
  }
  const enKeys = new Set(flatten(en));
  const koKeys = new Set(flatten(ko));
  for (const k of enKeys) if (!koKeys.has(k)) fail(`${ns}: KO missing key "${k}"`);
  for (const k of koKeys) if (!enKeys.has(k)) fail(`${ns}: EN missing key "${k}"`);
}

/* --------------------- 2. no hardcoded JSX text -------------------------- */
// Heuristic: flag JSX text nodes >{'>'}Aa..<{'<'} that contain two or more letters and are
// not clearly a t()/expression. Files can opt out per line with `// i18n-ignore`.
const JSX_TEXT = />\s*([A-Za-z][A-Za-z' .,!?:—-]{2,})\s*</g;
// Allow common non-UI tokens that legitimately appear as JSX text.
const ALLOW = /^(ETH|KRW|IMGEUM|up\.id|GIWA|GASOK|Dojang|EAS|ABI|KO|EN|FAQ)$/;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === 'locales') continue;
      walk(p);
    } else if (p.endsWith('.tsx')) checkFile(p);
  }
}

function checkFile(path) {
  const src = readFileSync(path, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('i18n-ignore')) return;
    let m;
    JSX_TEXT.lastIndex = 0;
    while ((m = JSX_TEXT.exec(line))) {
      const text = m[1].trim();
      if (ALLOW.test(text)) continue;
      // Skip obvious code fragments rather than real UI copy: arrow/logical operators, or a
      // dotted lowercase identifier like `c.x`, `v.id` that a `>`…`<` comparison can produce.
      if (/=>|&&|\|\|/.test(m[0])) continue;
      if (/^[a-z][\w]*\.[a-z]/.test(text) && !text.includes(' ')) continue;
      // Real UI copy is either multiple words or clearly prose; single dotted tokens aren't.
      fail(`${relative(web, path)}:${i + 1}  hardcoded JSX text: "${text}"`);
    }
  });
}

walk(srcDir);

if (errors) {
  console.error(`\ni18n check failed with ${errors} issue(s).`);
  process.exit(1);
}
console.log('✓ i18n check passed: EN/KO key parity and no hardcoded JSX text.');
