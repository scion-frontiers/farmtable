import { readFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync('rows/union.json','utf8'));
const res  = JSON.parse(readFileSync('results.json','utf8'));
const byId = Object.fromEntries(rows.map(r=>[r.id,r]));

// Does module `m` satisfy the assertion side `side` makes about row r?
function ok(r, side, got){
  const want = side==='main' ? r.main : r.branch;
  if (!want) return null;                       // side does not assert this row
  if (got.verdict === 'THREW') return false;
  if (want === 'R') return got.verdict === 'R';
  const wantVal = side==='main' ? r.mainValue : r.branchValue;
  if (got.verdict !== 'A') return false;
  if (wantVal == null) return true;             // verdict-only assertion
  return got.value === wantVal;                 // exact-value assertion
}
function report(modName, side){
  const fails=[], passes=[];
  for (const rr of res){
    const r = byId[rr.id];
    const v = ok(r, side, rr.got[modName]);
    if (v === null) continue;
    (v ? passes : fails).push(rr.id);
  }
  return {fails, passes};
}
const mods = ['MAIN.pristine','MAIN.disarmed','BRANCH.blocking','BRANCH.carveout','BRANCH.disarmed'];
console.log('════════ ARM A — CONFORMANCE ════════');
for (const m of mods.filter(x=>!x.includes('disarmed'))){
  for (const side of ['main','branch']){
    const {fails,passes} = report(m,side);
    const c2f = fails.filter(id=>res.find(r=>r.id===id).c2);
    const indf= fails.filter(id=>!res.find(r=>r.id===id).c2);
    console.log(`${m.padEnd(17)} vs ${side.toUpperCase().padEnd(6)} rows: ${passes.length} pass / ${fails.length} fail`);
    if (fails.length) {
      console.log(`    fail C2-INDEPENDENT (${indf.length}): ${indf.join(', ') || '-'}`);
      console.log(`    fail C2-dependent   (${c2f.length}): ${c2f.join(', ') || '-'}`);
    }
  }
}
console.log('\n════════ ARM B — KILL POWER ════════');
for (const [dis, side, label] of [['MAIN.disarmed','main','MAIN'],['BRANCH.disarmed','branch','BRANCH']]){
  const {fails,passes} = report(dis,side);
  console.log(`${label} union rows vs ${dis}: ${fails.length} KILL (red) / ${passes.length} VACUOUS (still pass)`);
  console.log(`    vacuous ids: ${passes.join(', ')}`);
}
