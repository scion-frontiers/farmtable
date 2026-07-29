// Chromium execution + network-egress probe — audit-195-r10.
// Serves the REAL renderMarkdown output to a real Chromium and observes
// (a) which URLs are fetched with NO user interaction, and
// (b) whether anything executes script.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { renderMarkdown } = await import('../.tmp-test/util/markdown.js');

const PORT = 8899;
const HITS = [];          // every request Chromium made
const EXEC = [];          // execution beacons from page JS

// --- the corpus of AUTO-FETCH candidates, each pointed at a unique beacon path
// Each entry: [id, markdown source using {{U}} for the beacon URL]
const AUTOFETCH = [
  ['img-src',        '<img src="{{U}}">'],
  ['md-image',       '![a]({{U}})'],
  ['img-srcset',     '<img srcset="{{U}} 1x">'],
  ['video-poster',   '<video poster="{{U}}"></video>'],
  ['video-src',      '<video src="{{U}}" autoplay preload="auto"></video>'],
  ['audio-src',      '<audio src="{{U}}" autoplay preload="auto"></audio>'],
  ['source-src',     '<video autoplay preload="auto"><source src="{{U}}"></video>'],
  ['source-srcset',  '<picture><source srcset="{{U}}"><img src="{{U}}-fallback"></picture>'],
  ['track-src',      '<video><track src="{{U}}" default kind=captions></video>'],
  ['table-bg',       '<table background="{{U}}"><tr><td>x</td></tr></table>'],
  ['svg-image-href', '<svg><image href="{{U}}" width=10 height=10></image></svg>'],
  ['svg-image-xlink','<svg><image xlink:href="{{U}}" width=10 height=10></image></svg>'],
  ['svg-feimage',    '<svg width=10 height=10><filter id="f"><feImage xlink:href="{{U}}"></feImage></filter><rect width=10 height=10 filter="url(#f)"/></svg>'],
  ['blockquote-cite','<blockquote cite="{{U}}">q</blockquote>'],
  // POSITIVE CONTROL: a sink that certainly fetches, proving the observer works.
  ['POSCTL-plain-img', '<img src="{{U}}">'],
];

// --- execution candidates (require a click, or fire on load)
const EXECCASES = [
  ['exec-js-href-notarget',  '<a id="T" href="javascript:window.__hit(\'js-href-notarget\')">x</a>', true],
  ['exec-js-href-self',      '<a id="T" href="javascript:window.__hit(\'js-href-self\')" target="_self">x</a>', true],
  ['exec-js-href-blank',     '<a id="T" href="javascript:window.__hit(\'js-href-blank\')" target="_blank">x</a>', true],
  ['exec-onerror',           '<img src="x" onerror="window.__hit(\'onerror\')">', false],
  ['exec-script',            '<script>window.__hit("script")</script>', false],
  ['exec-svg-onload',        '<svg onload="window.__hit(\'svg-onload\')"></svg>', false],
  // POSITIVE CONTROLS: UNSANITISED markup proving the harness CAN observe
  // execution. Note innerHTML never runs <script>, and unsafeHTML/innerHTML is
  // exactly how the real sink injects, so the load-bearing control is onerror.
  ['POSCTL-raw-onerror',     null, false],
  ['POSCTL-raw-jshref',      null, true],
];

function build() {
  const blocks = [];
  for (const [id, tpl] of AUTOFETCH) {
    const url = `http://127.0.0.1:${PORT}/beacon/${id}`;
    const src = tpl.replaceAll('{{U}}', url);
    blocks.push(`<section data-id="${id}">${renderMarkdown(src)}</section>`);
  }
  return blocks.join('\n');
}

function buildExec() {
  const blocks = [];
  for (const [id, tpl, needsClick] of EXECCASES) {
    let html;
    if (id === 'POSCTL-raw-onerror') {
      html = `<img src="/nonexistent-xyz" onerror="window.__hit('POSCTL-raw-onerror')">`;
    } else if (id === 'POSCTL-raw-jshref') {
      html = `<a id="T" href="javascript:window.__hit('POSCTL-raw-jshref')">x</a>`;
    } else {
      html = renderMarkdown(tpl);
    }
    blocks.push(`<section data-id="${id}" data-click="${needsClick ? 1 : 0}">${html}</section>`);
  }
  return blocks.join('\n');
}

const AUTOFETCH_HTML = build();
const EXEC_HTML = buildExec();

// A literal `</script>` inside a JSON string embedded in an inline <script>
// terminates that script element. JSON.stringify does NOT escape `/`. This bit
// me on the first run: it silently killed the whole page script and BOTH the
// payloads and the positive control came back NOT_EXECUTED, which reads exactly
// like a clean result.
const j = (s) => JSON.stringify(s).replaceAll('</', '<\\/');

const server = http.createServer((req, res) => {
  HITS.push(req.url);
  if (req.url === '/autofetch') {
    res.writeHead(200, { 'content-type': 'text/html' });
    // Rendered inside a shadow root, mirroring how the Lit components inject it.
    res.end(`<!doctype html><html><body><div id="host"></div>
<script>
  const sr = document.getElementById('host').attachShadow({mode:'open'});
  sr.innerHTML = ${j(AUTOFETCH_HTML)};
  setTimeout(() => { navigator.sendBeacon('/done-autofetch'); }, 2500);
</script></body></html>`);
    return;
  }
  if (req.url === '/exec') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><html><body><div id="host"></div>
<script>
  window.__hits = [];
  window.__hit = (n) => { window.__hits.push(n); fetch('/exechit/' + n); };
  const sr = document.getElementById('host').attachShadow({mode:'open'});
  sr.innerHTML = ${j(EXEC_HTML)};
  // click every case that needs one
  setTimeout(() => {
    for (const s of sr.querySelectorAll('section[data-click="1"]')) {
      const a = s.querySelector('#T') || s.querySelector('a');
      if (a) { try { a.click(); } catch(e) { fetch('/clickerr/' + s.dataset.id); } }
      else { fetch('/noanchor/' + s.dataset.id); }
    }
    // report what the DOM actually contains, so we know WHY nothing ran
    setTimeout(() => {
      const dump = [...sr.querySelectorAll('section')].map(s => s.dataset.id + '=' + s.innerHTML).join('|||');
      fetch('/dom?d=' + encodeURIComponent(dump));
      setTimeout(() => navigator.sendBeacon('/done-exec'), 300);
    }, 800);
  }, 400);
</script></body></html>`);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('ok');
});

await new Promise(r => server.listen(PORT, '127.0.0.1', r));

async function run(path, waitMs) {
  const before = HITS.length;
  const args = [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--virtual-time-budget=6000',
    `--user-data-dir=/tmp/chrome-prof-${Math.random().toString(36).slice(2)}`,
    '--dump-dom', `http://127.0.0.1:${PORT}${path}`,
  ];
  const p = spawn('/usr/bin/chromium', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', d => out += d);
  await new Promise(r => { p.on('exit', r); setTimeout(() => { p.kill(); r(); }, waitMs); });
  await new Promise(r => setTimeout(r, 500));
  return HITS.slice(before);
}

console.log('=== ARM 1: AUTO-FETCH (no user interaction) ===');
const a1 = await run('/autofetch', 12000);
const fetched = a1.filter(u => u.startsWith('/beacon/')).map(u => u.replace('/beacon/', ''));
const uniq = [...new Set(fetched)];
console.log('candidates offered :', AUTOFETCH.length);
console.log('BEACONS FETCHED    :', uniq.length);
for (const [id] of AUTOFETCH) {
  console.log(`  ${uniq.includes(id) ? 'FETCHED    ' : 'not fetched'}  ${id}`);
}
console.log('page completed     :', a1.includes('/done-autofetch'));

console.log('');
console.log('=== ARM 2: EXECUTION ===');
const a2 = await run('/exec', 12000);
const hits = a2.filter(u => u.startsWith('/exechit/')).map(u => u.replace('/exechit/', ''));
console.log('EXEC HITS:', [...new Set(hits)]);
for (const [id] of EXECCASES) {
  console.log(`  ${hits.includes(id.replace('exec-','')) || hits.includes(id) ? 'EXECUTED    ' : 'NOT_EXECUTED'}  ${id}`);
}
console.log('clickerr :', a2.filter(u => u.startsWith('/clickerr/')));
console.log('noanchor :', a2.filter(u => u.startsWith('/noanchor/')));
console.log('page completed :', a2.includes('/done-exec'));
const domHit = a2.find(u => u.startsWith('/dom?'));
if (domHit) {
  const d = decodeURIComponent(new URL('http://x' + domHit).searchParams.get('d'));
  console.log('--- DOM AS RENDERED ---');
  for (const seg of d.split('|||')) console.log('   ', seg);
}

server.close();
process.exit(0);
