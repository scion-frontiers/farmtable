// Non-string guard probe. `typeof md !== 'string'` returns ''. What reaches it,
// and does anything coerce back into a live payload downstream?
import { JSDOM } from '/workspace/web/node_modules/jsdom/lib/api.js';
const dom = new JSDOM('');
globalThis.window = dom.window; globalThis.document = dom.window.document;
const { renderMarkdown } = await import('/workspace/web/.tmp-test/util/markdown.js');

const PAYLOAD = '<img src=x onerror=alert(1)>';
const cases = [
  ['undefined',                undefined],
  ['null',                     null],
  ['number 42',                42],
  ['boolean true',             true],
  ['bigint',                   10n],
  ['symbol',                   Symbol('x')],
  ['plain object',             {}],
  ['array of md',              [PAYLOAD]],
  ['boxed String(payload)',    new String(PAYLOAD)],
  ['obj toString->payload',    { toString: () => PAYLOAD }],
  ['obj valueOf->payload',     { valueOf: () => PAYLOAD }],
  ['Symbol.toPrimitive',       { [Symbol.toPrimitive]: () => PAYLOAD }],
  ['template-tag strings obj', Object.assign([PAYLOAD], { raw: [PAYLOAD] })],
  ['String.prototype proxy',   new Proxy(new String(PAYLOAD), {})],
  ['null-proto obj toString',  Object.assign(Object.create(null), {})],
  ['Date',                     new Date()],
  ['empty string (control)',   ''],
  ['real string (control)',    PAYLOAD],
  ['real string benign',       '**bold**'],
];
let bad = 0;
for (const [name, input] of cases) {
  let out, err = null;
  try { out = renderMarkdown(input); } catch (e) { err = `${e.constructor?.name}: ${e.message}`; }
  const live = typeof out === 'string' && /onerror|<img|alert/i.test(out);
  if (live && name !== 'real string (control)') bad++;
  console.log(
    `${(err ? 'THREW  ' : live ? 'LIVE!! ' : 'EMPTY  ').padEnd(8)}${name.padEnd(26)}` +
    `-> ${err ?? JSON.stringify(out)}`,
  );
}
// Positive control: the guard must NOT be swallowing a real string.
const ctl = renderMarkdown(PAYLOAD);
console.log(`\ncontrol: real string still sanitized-and-rendered -> ${JSON.stringify(ctl)}`);
console.log(`PROBE-COMPLETE nonstring bad=${bad}`);
process.exit(bad > 0 ? 3 : 0);
