// What did the PRE-round-6 renderMarkdown do with each non-string? If it
// rendered rather than threw, the guard is a behaviour change that blanks live
// content, not purely an availability fix.
import { JSDOM } from '/workspace/web/node_modules/jsdom/lib/api.js';
const dom = new JSDOM(''); globalThis.window = dom.window; globalThis.document = dom.window.document;
import { Marked } from '/workspace/web/node_modules/marked/lib/marked.esm.js';
import DOMPurify from '/workspace/web/node_modules/dompurify/dist/purify.es.mjs';
const parser = new Marked({ renderer: { checkbox: ({checked}) => checked ? '<span></span>' : '<span></span>' } });
const old = (md) => DOMPurify.sanitize(parser.parse(md), {
  FORBID_TAGS: ['form','input','button','select','textarea','option','dialog','style'],
  FORBID_ATTR: ['style','class','formaction','action','download'],
});
const P = '**bold** <img src=x onerror=alert(1)>';
for (const [n, v] of [
  ['undefined', undefined], ['null', null], ['number 42', 42], ['boolean', true],
  ['boxed String', new String(P)], ['obj toString', { toString: () => P }],
  ['Symbol.toPrimitive', { [Symbol.toPrimitive]: () => P }], ['array', [P]],
]) {
  let r, e = null;
  try { r = old(v); } catch (err) { e = `${err.constructor?.name}: ${err.message}`; }
  console.log(`${(e ? 'THREW ' : 'RENDER').padEnd(7)} ${n.padEnd(20)} -> ${e ?? JSON.stringify(r)}`);
}
console.log('PROBE-COMPLETE prechange');
