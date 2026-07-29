// audit-195-r6 probe. Written for this round; does not reuse r5 code.
//
// Usage: node probe.mjs <path-to-module-exporting-renderMarkdown> [corpus.json]
//
// Two independent detectors per vector, so a failure of one does not silently
// turn the whole run green:
//
//   EXEC   the sanitized string is injected into a fresh JSDOM configured with
//          runScripts:'dangerously'; a canary on the window is set by the
//          payload. This observes actual script execution, not markup shape.
//   ARTIF  the sanitized string is parsed and inspected for the dangerous
//          artifact the vector is trying to land (a tag, an on* attribute, a
//          scheme, a forbidden attribute). Independent of execution.
//
// A vector is ALLOWED if either detector fires. Exit code is the number of
// ALLOWED vectors, capped at 250, so the caller reads the child's status and
// never a pipe.
import { JSDOM } from '/workspace/web/node_modules/jsdom/lib/api.js';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
const corpusPath = process.argv[3];
if (!modulePath) {
  console.error('usage: node probe.mjs <module> [corpus.json]');
  process.exit(255);
}

// DOMPurify binds globalThis.window at module-eval time; a DOM must exist first.
const bootDom = new JSDOM('');
globalThis.window = bootDom.window;
globalThis.document = bootDom.window.document;

const mod = await import(pathToFileURL(modulePath).href);
const renderMarkdown = mod.renderMarkdown;
if (typeof renderMarkdown !== 'function') {
  console.error(`FATAL: ${modulePath} exports no renderMarkdown function`);
  process.exit(255);
}

const EVENT_ATTR = /^on[a-z]+$/i;
const SCHEME = /^\s*(?:javascript|vbscript|data)\s*:/i;

// ---------------------------------------------------------------------------
// ARTIF detector. Parses the sanitized output in an inert document and walks it.
// ---------------------------------------------------------------------------
const inertDom = new JSDOM('');
function artifacts(html) {
  const found = [];
  const host = inertDom.window.document.createElement('div');
  host.innerHTML = html;
  const walk = (el) => {
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (
      ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select',
       'textarea', 'option', 'dialog', 'style', 'base', 'meta', 'link', 'noscript',
       'template', 'svg', 'math'].includes(tag)
    ) {
      found.push(`tag:${tag}`);
    }
    for (const a of Array.from(el.attributes ?? [])) {
      const n = a.name.toLowerCase();
      if (EVENT_ATTR.test(n)) found.push(`event:${n}`);
      if (['style', 'class', 'formaction', 'action', 'download', 'slot', 'srcdoc',
           'is', 'xlink:href', 'http-equiv'].includes(n)) {
        found.push(`attr:${n}`);
      }
      if (SCHEME.test(a.value)) found.push(`scheme:${a.value.slice(0, 24).trim()}`);
      if (/^\s*\/\//.test(a.value) && ['href', 'src', 'action'].includes(n)) {
        found.push(`protocol-relative:${n}`);
      }
    }
    for (const c of Array.from(el.children)) walk(c);
    // BLIND SPOT FIXED MID-RUN: <template> children live in .content, a
    // DocumentFragment that el.children does NOT expose. Without this the probe
    // reported DENIED for anything DOMPurify left inside a template — the exact
    // shape of a false negative this round is supposed to catch.
    if (el.content && el.content.children) {
      for (const c of Array.from(el.content.children)) walk(c);
    }
  };
  for (const c of Array.from(host.children)) walk(c);
  // Raw-text detection: a <script> body that survived as text is still evidence.
  if (/<\s*script/i.test(html)) found.push('rawtext:<script');
  if (/\son[a-z]+\s*=/i.test(html)) found.push('rawtext:on-handler');
  return [...new Set(found)];
}

// ---------------------------------------------------------------------------
// EXEC detector. Fresh JSDOM per vector, scripts enabled, canary on window.
// ---------------------------------------------------------------------------
async function executes(html) {
  const dom = new JSDOM(
    '<!doctype html><html><head></head><body><div id="sink"></div></body></html>',
    { runScripts: 'dangerously', resources: undefined, pretendToBeVisual: true },
  );
  const w = dom.window;
  w.__CANARY__ = [];
  w.alert = (v) => { w.__CANARY__.push(`alert:${v}`); };
  w.__fire = (v) => { w.__CANARY__.push(`fire:${v}`); };
  try {
    w.document.getElementById('sink').innerHTML = html;
    // Re-inject any <script> the parser left inert: innerHTML never executes
    // scripts, so without this step EXEC could not observe an inline script even
    // when one is present. This makes the detector strictly more sensitive.
    for (const s of Array.from(w.document.querySelectorAll('script'))) {
      const clone = w.document.createElement('script');
      for (const a of Array.from(s.attributes)) clone.setAttribute(a.name, a.value);
      clone.textContent = s.textContent;
      s.parentNode.replaceChild(clone, s);
    }
    // Drive handlers that jsdom will not fire on its own (no resource loading).
    for (const el of Array.from(w.document.querySelectorAll('#sink *'))) {
      for (const a of Array.from(el.attributes)) {
        if (!EVENT_ATTR.test(a.name)) continue;
        try {
          // eslint-disable-next-line no-new-func
          new w.Function(a.value).call(el);
        } catch { /* a handler that throws still proves the attribute landed */ }
      }
      for (const a of ['href', 'src', 'action', 'formaction']) {
        const v = el.getAttribute?.(a);
        if (v && /^\s*javascript:/i.test(v)) {
          try { new w.Function(v.replace(/^\s*javascript:/i, '')).call(el); } catch { /* ignore */ }
        }
      }
    }
    await new Promise((r) => setTimeout(r, 0));
    return w.__CANARY__.slice();
  } finally {
    w.close();
  }
}

// ---------------------------------------------------------------------------
const DEFAULT_CORPUS = JSON.parse(
  readFileSync(new URL('./corpus.json', import.meta.url), 'utf8'),
);
const corpus = corpusPath
  ? JSON.parse(readFileSync(corpusPath, 'utf8'))
  : DEFAULT_CORPUS;

let allowed = 0;
const rows = [];
for (const v of corpus) {
  let out;
  let threw = null;
  try {
    out = renderMarkdown(v.md);
  } catch (e) {
    threw = `${e.constructor?.name ?? 'Error'}: ${e.message}`;
    out = '';
  }
  const arts = threw ? [] : artifacts(out);
  const exec = threw ? [] : await executes(out);
  const isAllowed = arts.length > 0 || exec.length > 0;
  if (isAllowed) allowed += 1;
  rows.push({
    id: v.id,
    verdict: threw ? 'THREW' : isAllowed ? 'ALLOWED' : 'DENIED',
    threw,
    artifacts: arts,
    exec,
    out: (out ?? '').slice(0, 200),
  });
}

for (const r of rows) {
  const tail = r.threw
    ? `  !! ${r.threw}`
    : r.verdict === 'ALLOWED'
      ? `  ARTIF=[${r.artifacts.join(',')}] EXEC=[${r.exec.join(',')}]\n      out=${JSON.stringify(r.out)}`
      : '';
  console.log(`${r.verdict.padEnd(8)} ${r.id}${tail}`);
}
// A sentinel the caller MUST see. Node exits 1 on an uncaught module-resolution
// error, which is indistinguishable from "1 vector allowed" if the exit code is
// the only signal — the harness would report a near-clean run because it never
// ran. The caller greps for this line; absence means the run did not complete.
console.log(
  `\nPROBE-COMPLETE module=${modulePath} vectors=${corpus.length} allowed=${allowed} ` +
    `denied=${rows.filter((r) => r.verdict === 'DENIED').length} ` +
    `threw=${rows.filter((r) => r.verdict === 'THREW').length}`,
);
// 0 = nothing allowed, 3 = at least one allowed, 255 = fatal. Never a count.
process.exit(allowed > 0 ? 3 : 0);
