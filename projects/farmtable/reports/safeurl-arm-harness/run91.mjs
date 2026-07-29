import { readFileSync, writeFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync('rows/union91.json','utf8'));
const mods = {
  'MAIN.pristine'      : (await import('./impl/main.pristine.mjs')).safeHref,
  'MAIN.disarmed'      : (await import('./impl/main.disarmed.mjs')).safeHref,
  'BRANCH.blocking'    : (await import('./impl/branch.pristine.mjs')).safeExternalUrl,
  'BRANCH.carveout'    : (await import('./impl/branch.flagon.mjs')).safeExternalUrl,
  'BRANCH.disarmed'    : (await import('./impl/branch.disarmed.mjs')).safeExternalUrl,
};
const arg = (r) => r.input === null ? null : (r.input === '__UNDEFINED__' ? undefined : r.input);
// C2-dependence, COMPUTED not guessed: a row's verdict turns on the plaintext-http
// ruling iff it parses, resolves to http:, and carries no userinfo (userinfo is
// already ruled reject by C3, so those are decided regardless of C2).
function c2dep(r){
  const a = arg(r);
  if (typeof a !== 'string') return false;
  let u; try { u = new URL(a); } catch { return false; }
  if (u.username || u.password) return false;
  return u.protocol === 'http:';
}
const results = [];
for (const r of rows) {
  const a = arg(r);
  const row = { id:r.id, cls:r.cls, c2:c2dep(r), main:r.main, branch:r.branch, got:{} };
  for (const [name,fn] of Object.entries(mods)) {
    let verdict, value, threw=null;
    try { const out = fn(a); value = out; verdict = (out === undefined || out === null) ? 'R' : 'A'; }
    catch(e){ threw = String(e && e.message); verdict='THREW'; }
    row.got[name] = { verdict, value, threw };
  }
  results.push(row);
}
writeFileSync('results91.json', JSON.stringify(results,null,1));
const nc2 = results.filter(r=>r.c2).length;
console.log('rows:', results.length, ' C2-dependent:', nc2, ' C2-independent:', results.length-nc2);
console.log('C2-dependent ids:', results.filter(r=>r.c2).map(r=>r.id).join(', '));
