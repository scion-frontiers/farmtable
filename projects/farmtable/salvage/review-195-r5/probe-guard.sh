#!/bin/bash
# Run from web/. Rebuilds an importable copy of the compiled guard and drives
# its internal predicates directly.
set -eu
P=node_modules/.probe
mkdir -p $P
npx tsc -p tsconfig.test.json
cp .tmp-test/util/markdown.test.js $P/guard.mjs
cp .tmp-test/util/markdown.js      $P/markdown.js
printf '\nexport { sinkBindingViolations, stripImportStatements, stripInertText, directiveIndirectionOffenders };\n' >> $P/guard.mjs
cat > $P/matrix.mjs <<'EOF'
import { JSDOM } from 'jsdom';
const dom=new JSDOM(''); globalThis.window=dom.window; globalThis.document=dom.window.document;
const g = await import('./guard.mjs');
const scanned = new Set(['src/util/markdown.ts']);
const REL='src/components/inspector/x.ts';
const SINK = "const t = unsafeHTML(renderMarkdown(this.body));";
const cases = {
  'C0 all semicolons + alias   (want CAUGHT)': ["import { unsafeHTML } from 'lit/directives/unsafe-html.js';","const rawHtml = unsafeHTML;","import { renderMarkdown } from '../../util/markdown.js';",SINK],
  'C1 no semicolons + alias    (want CAUGHT)': ["import { unsafeHTML } from 'lit/directives/unsafe-html.js'","const rawHtml = unsafeHTML","import { renderMarkdown } from '../../util/markdown.js';",SINK],
  'C2 import no semi, alias semi (want CAUGHT)': ["import { unsafeHTML } from 'lit/directives/unsafe-html.js'","const rawHtml = unsafeHTML;","import { renderMarkdown } from '../../util/markdown.js';",SINK],
  'C4 all semicolons, no alias (want CLEAN)':  ["import { unsafeHTML } from 'lit/directives/unsafe-html.js';","import { renderMarkdown } from '../../util/markdown.js';",SINK],
  'C5 no semicolons, no alias  (want CLEAN)':  ["import { unsafeHTML } from 'lit/directives/unsafe-html.js'","import { renderMarkdown } from '../../util/markdown.js'",SINK],
};
for (const [k,lines] of Object.entries(cases)) {
  const src = lines.join('\n');
  const a = g.sinkBindingViolations(REL, src, scanned);
  const b = g.directiveIndirectionOffenders(REL, g.stripInertText(src,{strings:false}));
  console.log(k.padEnd(46), '(a)', a.length?'CAUGHT':'MISSED', ' (b)', b.length?'CAUGHT':'MISSED');
}
// Proposed fix for stripImportStatements, evaluated on the same matrix.
const wipe = (m) => m.replace(/[^\n]/g, ' ');
const FIXED = (code) => code
  .replace(/\bimport\b[^;'"]*?\bfrom\b\s*(['"])[^'"]*\1\s*;?/g, wipe)
  .replace(/\bimport\s*(['"])[^'"]*\1\s*;?/g, wipe);
const visible = (view, src) => /\bunsafeHTML\b(?!\s*\()/.test(view(g.stripInertText(src,{strings:true})));
console.log('\n-- proposed stripImportStatements fix --');
for (const [k,lines] of Object.entries(cases))
  console.log(k.padEnd(46), 'fixed view sees alias:', visible(FIXED, lines.join('\n')));
EOF
node $P/matrix.mjs
rm -rf $P
