// Measures the actual allow-list surface the production config leaves open, and
// tests mXSS re-parse stability. BY EXECUTION.
import { JSDOM } from '/workspace/web/node_modules/jsdom/lib/api.js';
const dom = new JSDOM('');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { renderMarkdown } = await import('/workspace/web/.tmp-test/util/markdown.js');
const DOMPurify = (await import('/workspace/web/node_modules/dompurify/dist/purify.es.mjs')).default;

const FORBID_TAGS = ['form','input','button','select','textarea','option','dialog','style'];
const FORBID_ATTR = ['style','class','formaction','action','download'];

// ---- 1. which TAGS survive the production config? -------------------------
const HTML_TAGS = `a abbr acronym address area article aside audio b bdi bdo big blink blockquote body br
button canvas caption center checkbox cite code col colgroup content data datalist dd decorator del details
dfn dialog dir div dl dt element em fieldset figcaption figure font footer form h1 h2 h3 h4 h5 h6 head header
hgroup hr html i img input ins kbd label legend li main map mark marquee menu menuitem meter nav nobr ol
optgroup option output p picture pre progress q rp rt ruby s samp section select shadow small source spacer
span strike strong style sub summary sup table tbody td template textarea tfoot th thead time tr track tt u
ul var video wbr iframe object embed base meta link script noscript slot portal frame frameset applet param`.split(/\s+/).filter(Boolean);

const SVG_TAGS = `svg a altglyph altglyphdef altglyphitem animatecolor animatemotion animatetransform animate
circle clippath defs desc ellipse filter font g glyph glyphref hkern image line lineargradient marker mask
metadata mpath path pattern polygon polyline radialgradient rect set stop style switch symbol text textpath
title tref tspan use view vkern foreignobject script feblend fecolormatrix fegaussianblur feimage femerge`.split(/\s+/).filter(Boolean);

const MATH_TAGS = `math maction maligngroup malignmark menclose merror mfenced mfrac mglyph mi mlabeledtr
mlongdiv mmultiscripts mn mo mover mpadded mphantom mroot mrow ms mscarries mscarry msgroup mstack msline
mspace msqrt msrow mstyle msub msup msubsup mtable mtd mtext mtr munder munderover annotation annotation-xml
semantics`.split(/\s+/).filter(Boolean);

function tagSurvives(tag, wrapper) {
  const input = wrapper ? wrapper(tag) : `<${tag}></${tag}>`;
  const out = DOMPurify.sanitize(input, { FORBID_TAGS, FORBID_ATTR });
  const d = dom.window.document.createElement('div');
  d.innerHTML = out;
  return d.querySelector(tag.toLowerCase()) !== null;
}

const htmlAllowed = HTML_TAGS.filter((t) => tagSurvives(t));
const svgAllowed = SVG_TAGS.filter((t) => tagSurvives(t, (x) => `<svg><${x}></${x}></svg>`));
const mathAllowed = MATH_TAGS.filter((t) => tagSurvives(t, (x) => `<math><${x}></${x}></math>`));

console.log('=== TAGS PERMITTED THROUGH THE PRODUCTION CONFIG ===');
console.log(`HTML  (${htmlAllowed.length}): ${htmlAllowed.join(' ')}`);
console.log(`SVG   (${svgAllowed.length}): ${svgAllowed.join(' ')}`);
console.log(`MathML(${mathAllowed.length}): ${mathAllowed.join(' ')}`);
console.log(`TOTAL PERMITTED: ${htmlAllowed.length + svgAllowed.length + mathAllowed.length}`);

// ---- 2. what does marked actually EMIT? -----------------------------------
// Everything marked emits from pure-markdown syntax (no raw HTML passthrough).
const MD_CORPUS = `# h1
## h2
para *em* **strong** ~~del~~ \`code\`

> quote

- a
- [x] done
- [ ] todo

1. one

---

[link](https://ok.example) ![img](https://ok.example/i.png)

| a | b |
|---|---|
| 1 | 2 |

\`\`\`js
code block
\`\`\`
`;
const mdOut = renderMarkdown(MD_CORPUS);
const d2 = dom.window.document.createElement('div');
d2.innerHTML = mdOut;
const emitted = new Set();
d2.querySelectorAll('*').forEach((e) => emitted.add(e.tagName.toLowerCase()));
const emittedArr = [...emitted].sort();
console.log(`\n=== TAGS MARKED ACTUALLY EMITS FROM MARKDOWN SYNTAX (${emittedArr.length}) ===`);
console.log(emittedArr.join(' '));

const permitted = new Set([...htmlAllowed, ...svgAllowed, ...mathAllowed]);
const excess = [...permitted].filter((t) => !emitted.has(t)).sort();
console.log(`\n=== EXCESS SURFACE: permitted but never emitted by markdown (${excess.length}) ===`);
console.log(excess.join(' '));

// ---- 3. mXSS: is renderMarkdown output re-parse stable? -------------------
// unsafeHTML assigns the sanitized STRING via innerHTML, so the browser parses
// it a second time. If serialize->reparse is not a fixed point, that delta is
// the mXSS primitive. Test: sanitize(x) must equal sanitize(sanitize(x)) AND
// the string must survive a parse/serialize round trip unchanged.
const MXSS = [
  '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>">',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>',
  '<svg><p><style><img src=1 onerror=alert(1)></style></p></svg>',
  '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;/mglyph&gt;&lt;img src=1 onerror=alert(1)&gt;">',
  '<table><caption><svg><foreignobject><math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<xmp><p title="</xmp><img src=x onerror=alert(1)>">',
  '<listing><p title="</listing><img src=x onerror=alert(1)>">',
  '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
  '<template><style><a title="</style><img src=x onerror=alert(1)>">',
];

console.log('\n=== mXSS RE-PARSE STABILITY (idempotence + round-trip) ===');
let mxssBad = 0, mxssChecked = 0;
for (const p of MXSS) {
  const once = renderMarkdown(p);
  const twice = renderMarkdown(once);
  // round trip through the browser parser, as unsafeHTML/innerHTML will do
  const rt = dom.window.document.createElement('div');
  rt.innerHTML = once;
  const reserialized = rt.innerHTML;
  const rtDiv = dom.window.document.createElement('div');
  rtDiv.innerHTML = reserialized;
  const handlers = [...rtDiv.querySelectorAll('*')].some((el) =>
    [...el.attributes].some((a) => a.name.toLowerCase().startsWith('on')));
  const stable = reserialized === once;
  mxssChecked++;
  const bad = handlers;
  if (bad) mxssBad++;
  console.log(`  ${bad ? 'HANDLER-AFTER-REPARSE!!' : 'inert'}  roundtripStable=${stable}  idempotent=${twice === once}`);
  console.log(`     in  : ${JSON.stringify(p)}`);
  console.log(`     out : ${JSON.stringify(once)}`);
  if (!stable) console.log(`     rt  : ${JSON.stringify(reserialized)}`);
}
// self-check: prove the handler detector fires post-reparse on a known-bad string
const probe = dom.window.document.createElement('div');
probe.innerHTML = '<img src=x onerror=alert(1)>';
const probeFires = [...probe.querySelectorAll('*')].some((el) =>
  [...el.attributes].some((a) => a.name.toLowerCase().startsWith('on')));
console.log(`\n  SELF-CHECK post-reparse handler detector fires on control: ${probeFires ? 'FIRE' : 'DEAD'}`);
if (!probeFires) { console.log('  ABORT: detector dead, negatives untrustworthy.'); process.exit(2); }
console.log(`  mXSS vectors checked: ${mxssChecked}, yielding a live handler after reparse: ${mxssBad}`);

// ---- 4. checkbox renderer: can input influence what it emits? -------------
console.log('\n=== CHECKBOX RENDERER ===');
const cbInputs = [
  '- [x] done',
  '- [ ] todo',
  '- [x] <img src=x onerror=alert(1)>',
  '- [X] UPPER',
  '- [x] "><script>alert(1)</script>',
  '- [x] ' + '‮' + 'rtl-override',
];
for (const c of cbInputs) {
  console.log(`  in : ${JSON.stringify(c)}`);
  console.log(`  out: ${JSON.stringify(renderMarkdown(c))}`);
}
