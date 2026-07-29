// Two config mutations left the 61-check suite GREEN. A guard gap only exists if
// the mutation ACTUALLY WEAKENS the sanitizer. If the mutation is a security
// no-op, green is the correct answer and reporting it would be a false finding.
// Bar 2: measure regardless of which answer I'd prefer.
import { JSDOM } from '/workspace/web/node_modules/jsdom/lib/api.js';
const dom = new JSDOM('');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const DOMPurify = (await import('/workspace/web/node_modules/dompurify/dist/purify.es.mjs')).default;
const { Marked } = await import('/workspace/web/node_modules/marked/lib/marked.esm.js');

const FORBID_TAGS = ['form','input','button','select','textarea','option','dialog','style'];
const FORBID_ATTR = ['style','class','formaction','action','download'];
const parser = new Marked({ renderer: { checkbox: ({checked}) => checked ? '<span>x</span>' : '<span>o</span>' } });

const cfgs = {
  'PRODUCTION (baseline)':            { FORBID_TAGS, FORBID_ATTR },
  'ADD_ATTR:[style]':                 { FORBID_TAGS, FORBID_ATTR, ADD_ATTR: ['style'] },
  'ALLOW_UNKNOWN_PROTOCOLS:true':     { FORBID_TAGS, FORBID_ATTR, ALLOW_UNKNOWN_PROTOCOLS: true },
};

const probes = [
  ['style attribute', '<p style="position:fixed;inset:0;background:red">x</p>'],
  ['javascript: href', '<a href="javascript:alert(1)">x</a>'],
  ['md javascript: link', '[x](javascript:alert(1))'],
  ['unknown proto href', '<a href="evilproto:payload">x</a>'],
  ['data:text/html href', '<a href="data:text/html,<script>alert(1)</script>">x</a>'],
  ['vbscript: href', '<a href="vbscript:msgbox(1)">x</a>'],
];

console.log('Comparing sanitizer OUTPUT across the mutated configs.');
console.log('A mutation is a GUARD GAP only if its output differs from baseline in a');
console.log('security-relevant way. Identical output => the mutation is a no-op and');
console.log('the suite staying green is CORRECT.\n');

const baseline = {};
for (const [cname, cfg] of Object.entries(cfgs)) {
  console.log(`--- ${cname} ---`);
  for (const [pname, input] of probes) {
    const out = DOMPurify.sanitize(parser.parse(input), cfg);
    if (cname.startsWith('PRODUCTION')) baseline[pname] = out;
    const differs = out !== baseline[pname];
    console.log(`  ${differs ? 'DIFFERS!' : 'same    '}  ${pname.padEnd(22)} ${JSON.stringify(out)}`);
  }
  console.log();
}

// explicit verdicts
console.log('=== VERDICT PER MUTATION ===');
for (const [cname, cfg] of Object.entries(cfgs)) {
  if (cname.startsWith('PRODUCTION')) continue;
  const diffs = probes.filter(([pname, input]) =>
    DOMPurify.sanitize(parser.parse(input), cfg) !== baseline[pname]);
  if (diffs.length === 0) {
    console.log(`  ${cname}: SECURITY NO-OP (output identical on all ${probes.length} probes).`);
    console.log(`     -> suite staying green is CORRECT. NOT a guard gap.`);
  } else {
    console.log(`  ${cname}: WEAKENS the sanitizer on ${diffs.length} probe(s): ${diffs.map(d=>d[0]).join(', ')}`);
    console.log(`     -> suite staying green IS a guard gap.`);
  }
}
