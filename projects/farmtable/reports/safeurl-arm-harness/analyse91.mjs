import { readFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync('rows/union91.json','utf8'));
const res  = JSON.parse(readFileSync('results91.json','utf8'));
const R = new Map(res.map(r=>[r.id,r]));
const eq = (a,b) => a===b;

// A row is scored against a subject ONLY under a configuration its author asserted it in.
function score(subject, pick){
  const scored=[], pass=[], fail=[];
  for (const r of rows){
    const exp = pick(r); if (!exp) continue;
    scored.push(r.id);
    const got = R.get(r.id).got[subject];
    let ok = got.verdict === exp.verdict;
    if (ok && exp.value !== undefined && exp.value !== null) ok = eq(got.value, exp.value);
    if (ok && exp.verdict === 'R') ok = (got.value === null || got.value === undefined);
    (ok?pass:fail).push(r.id);
  }
  return {n:scored.length, pass, fail};
}
const mainExp   = r => r.main ? {verdict:r.main, value:r.mainValue} : null;
const blockExp  = r => r.branchArms.includes('BLOCKING') ? {verdict:r.branch, value:r.branchValue} : null;
const carveExp  = r => r.branchArms.includes('CARVEOUT') ? {verdict:r.branch, value:r.branchValue} : null;

console.log('=== ARM A, config-correct scoring (91-row table) ===');
for (const [subj, pickName, pick] of [
  ['MAIN.pristine','MAIN rows',mainExp],
  ['MAIN.pristine','BRANCH BLOCKING rows',blockExp],
  ['MAIN.pristine','BRANCH CARVEOUT rows',carveExp],
  ['BRANCH.blocking','MAIN rows',mainExp],
  ['BRANCH.blocking','BRANCH BLOCKING rows',blockExp],
  ['BRANCH.carveout','BRANCH CARVEOUT rows',carveExp],
  ['BRANCH.carveout','MAIN rows',mainExp],
]){
  const s = score(subj,pick);
  console.log(`${subj.padEnd(16)} vs ${pickName.padEnd(22)}: ${s.pass.length}/${s.n} pass, ${s.fail.length}/${s.n} fail` + (s.fail.length?`  fail ids: ${s.fail.join(', ')}`:''));
}
