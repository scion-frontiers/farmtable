// Does SANITIZE_DOM:false actually WEAKEN this sanitizer? Round-5 bar: a green
// mutation is only a finding if it demonstrably weakens the thing.
// SANITIZE_DOM is DOMPurify's DOM-clobbering defence: it strips id/name
// attributes whose value collides with a property an attacker could shadow.
import { JSDOM } from '/workspace/web/node_modules/jsdom/lib/api.js';
const dom = new JSDOM(''); globalThis.window = dom.window; globalThis.document = dom.window.document;
// Dynamic import: DOMPurify binds globalThis.window at module-eval time and
// static imports are hoisted above the DOM setup above. Without this it
// degrades to a stub with no .sanitize -- which fails CLOSED (TypeError), but
// would have made this probe unable to run at all.
const { Marked } = await import('/workspace/web/node_modules/marked/lib/marked.esm.js');
const DOMPurify = (await import('/workspace/web/node_modules/dompurify/dist/purify.es.mjs')).default;
const parser = new Marked({ renderer: { checkbox: () => '<span></span>' } });
const FORBID_TAGS = ['form','input','button','select','textarea','option','dialog','style'];
const FORBID_ATTR = ['style','class','formaction','action','download','slot'];
const on  = (md) => DOMPurify.sanitize(parser.parse(md), { FORBID_TAGS, FORBID_ATTR });
const off = (md) => DOMPurify.sanitize(parser.parse(md), { FORBID_TAGS, FORBID_ATTR, SANITIZE_DOM: false });

const vectors = [
  ['clobber getElementById', '<a id="getElementById">x</a>'],
  ['clobber attributes',     '<a id="attributes">x</a>'],
  ['clobber name=body',      '<a name="body">x</a>'],
  ['clobber id=body',        '<a id="body">x</a>'],
  ['clobber currentScript',  '<a id="currentScript">x</a>'],
  ['clobber name=nodeName',  '<a name="nodeName">x</a>'],
  ['clobber id=children',    '<a id="children">x</a>'],
  ['clobber id=location',    '<a id="location" href="//evil.example">x</a>'],
  ['clobber two-step',       '<a id="x"></a><a id="x" name="y"></a>'],
  ['plain id (control)',     '<a id="section-1">x</a>'],
];
let differs = 0;
for (const [n, md] of vectors) {
  const a = on(md), b = off(md);
  const d = a !== b;
  if (d) differs++;
  console.log(`${(d ? 'DIFFERS' : 'same   ')} ${n.padEnd(24)}\n    SANITIZE_DOM on : ${JSON.stringify(a)}\n    SANITIZE_DOM off: ${JSON.stringify(b)}`);
}
console.log(`\nPROBE-COMPLETE clobber differs=${differs}/${vectors.length}`);
process.exit(differs > 0 ? 3 : 0);
