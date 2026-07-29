// Priority 3: does ANY package in the FULL TRANSITIVE tree patch DOM prototypes?
// The manager checked direct deps only. A transitive prototype patcher would be
// a route to V25's effect that does NOT require commit access to this repo.
//
// SELF-CHECK (bar 3): the scanner must first prove it can FIND a known patcher.
// We synthesise a decoy package containing the exact V25 construct. If the
// scanner fails to flag the decoy, it is not fit to report a negative and aborts.
import { readdirSync, statSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/workspace/web/node_modules';

// Patterns for mutating the DOM prototypes the sanitizer relies on.
const PATTERNS = [
  /\b(Element|Node|HTMLElement|SVGElement|Document|DocumentFragment|Attr|NamedNodeMap)\s*\.\s*prototype\s*\.\s*\w+\s*=/g,
  /Object\.defineProperty\s*\(\s*(Element|Node|HTMLElement|SVGElement|Document|DocumentFragment|Attr)\s*\.\s*prototype/g,
  /Object\.defineProperties\s*\(\s*(Element|Node|HTMLElement|SVGElement|Document|DocumentFragment|Attr)\s*\.\s*prototype/g,
  // the specific V25 primitives
  /prototype\s*\.\s*(removeAttribute|removeChild|setAttribute|getAttribute|appendChild|insertBefore|cloneNode|createElement|createElementNS|importNode|adoptNode)\s*=/g,
];

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* walk(p);
    else if (/\.(js|mjs|cjs)$/.test(e)) yield p;
  }
}

function scan(dir) {
  const hits = [];
  for (const file of walk(dir)) {
    let src;
    try { src = readFileSync(file, 'utf8'); } catch { continue; }
    for (const re of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src)) !== null) {
        const line = src.slice(0, m.index).split('\n').length;
        hits.push({ file, line, match: m[0].replace(/\s+/g, ' ').slice(0, 90) });
        if (hits.length > 4000) return hits;
      }
    }
  }
  return hits;
}

// ---- SELF-CHECK: plant a decoy containing the literal V25 construct --------
const DECOY = '/tmp/audit195/decoy_modules/evil-pkg';
rmSync('/tmp/audit195/decoy_modules', { recursive: true, force: true });
mkdirSync(DECOY, { recursive: true });
writeFileSync(join(DECOY, 'index.js'), `
// exactly the V25 construct
const _ra = Element.prototype.removeAttribute;
Element.prototype.removeAttribute = function (n) { if (n && n.toLowerCase().startsWith('on')) return; return _ra.call(this, n); };
Node.prototype.removeChild = function (c) { return c; };
`);
const decoyHits = scan('/tmp/audit195/decoy_modules');
console.log('=== SCANNER SELF-CHECK (must FIND the planted V25 decoy) ===');
for (const h of decoyHits) console.log(`  HIT ${h.file}:${h.line}  ${h.match}`);
if (decoyHits.length < 2) {
  console.log('  ABORT: scanner failed to find the planted decoy. A negative result would be worthless.');
  process.exit(2);
}
console.log(`  scanner found ${decoyHits.length} hits in the decoy -> scanner is live.\n`);
rmSync('/tmp/audit195/decoy_modules', { recursive: true, force: true });

// ---- real scan ------------------------------------------------------------
const hits = scan(ROOT);
console.log(`=== FULL TRANSITIVE SCAN of ${ROOT} ===`);
const pkgOf = (f) => {
  const rel = f.slice(ROOT.length + 1);
  const parts = rel.split('/');
  return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};
const byPkg = new Map();
for (const h of hits) {
  const p = pkgOf(h.file);
  if (!byPkg.has(p)) byPkg.set(p, []);
  byPkg.get(p).push(h);
}
console.log(`total pattern hits: ${hits.length} across ${byPkg.size} packages\n`);
for (const [p, hs] of [...byPkg.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${p}  (${hs.length} hits)`);
  for (const h of hs.slice(0, 6)) {
    console.log(`      ${h.file.slice(ROOT.length + 1)}:${h.line}  ${h.match}`);
  }
  if (hs.length > 6) console.log(`      ... ${hs.length - 6} more`);
}

// ---- classify: which of these actually ship to the BROWSER? ---------------
const pkgJson = JSON.parse(readFileSync('/workspace/web/package.json', 'utf8'));
const runtimeRoots = Object.keys(pkgJson.dependencies || {});
const devRoots = Object.keys(pkgJson.devDependencies || {});
console.log(`\nruntime (shipped) direct deps: ${runtimeRoots.join(', ')}`);
console.log(`dev-only direct deps        : ${devRoots.join(', ')}`);
console.log(`\npackages with hits: ${[...byPkg.keys()].join(', ') || '(none)'}`);
