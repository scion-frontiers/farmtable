// Settles the RELAYED claim: does target="_blank" suppress javascript: URL
// execution in real Chromium? Tested on RAW (unsanitised) anchors, because
// renderMarkdown strips href entirely and so cannot reach the question at all.
// 3 target variants x 2 popup-blocker settings, each with a positive control.
import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = 8901;
const HITS = [];

const CASES = [
  ['notarget', ''],
  ['self',     ' target="_self"'],
  ['blank',    ' target="_blank"'],
  ['blanknoop',' target="_blank" rel="noopener"'],
];

const server = http.createServer((req, res) => {
  HITS.push(req.url);
  if (req.url.startsWith('/p')) {
    const anchors = CASES.map(([id, attr]) =>
      `<section><a id="a-${id}" href="javascript:window.__hit('${id}')"${attr}>x</a></section>`
    ).join('\n');
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><html><body><div id="host"></div>
<script>
  window.__hit = (n) => { fetch('/hit/' + n); };
  const sr = document.getElementById('host').attachShadow({mode:'open'});
  sr.innerHTML = ${JSON.stringify(anchors).replaceAll('</', '<\\/')};
  // POSITIVE CONTROL that the click path itself works at all.
  fetch('/ctl/page-script-ran');
  setTimeout(() => {
    ${CASES.map(([id]) => `try { sr.getElementById ? 0 : 0; sr.querySelector('#a-${id}').click(); } catch(e) { fetch('/clickerr/${id}'); }`).join('\n    ')}
    setTimeout(() => navigator.sendBeacon('/done'), 1200);
  }, 300);
<\/script></body></html>`);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('ok');
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

async function arm(label, extraArgs) {
  const before = HITS.length;
  const args = [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--virtual-time-budget=6000',
    `--user-data-dir=/tmp/chrome-t-${Math.random().toString(36).slice(2)}`,
    ...extraArgs,
    '--dump-dom', `http://127.0.0.1:${PORT}/p`,
  ];
  const p = spawn('/usr/bin/chromium', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise(r => { p.on('exit', r); setTimeout(() => { p.kill(); r(); }, 12000); });
  await new Promise(r => setTimeout(r, 400));
  const seen = HITS.slice(before);
  const hits = seen.filter(u => u.startsWith('/hit/')).map(u => u.replace('/hit/', ''));
  console.log(`--- ARM: ${label}`);
  console.log(`    page script ran (POSITIVE CONTROL): ${seen.includes('/ctl/page-script-ran')}`);
  console.log(`    page completed                    : ${seen.includes('/done')}`);
  for (const [id] of CASES) {
    console.log(`    ${hits.includes(id) ? 'EXECUTED    ' : 'NOT_EXECUTED'}  javascript: href target=${id}`);
  }
  const ce = seen.filter(u => u.startsWith('/clickerr/'));
  if (ce.length) console.log('    click errors:', ce);
  console.log('');
}

console.log('=== RELAYED CLAIM UNDER TEST ===');
console.log('  "javascript: with no target or _self -> EXECUTED;');
console.log('   same payload with target=_blank -> NOT_EXECUTED"');
console.log('');
await arm('popup blocker DEFAULT (on)', []);
await arm('popup blocker DISABLED', ['--disable-popup-blocking']);

server.close();
process.exit(0);
