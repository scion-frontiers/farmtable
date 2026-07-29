import { readFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync('rows/union91.json','utf8'));
const res  = JSON.parse(readFileSync('results91.json','utf8'));
const R = new Map(res.map(r=>[r.id,r]));
function kills(subject, pick){
  const kill=[], vac=[];
  for (const r of rows){
    const exp = pick(r); if (!exp) continue;
    const got = R.get(r.id).got[subject];
    let ok = got.verdict === exp.verdict;
    if (ok && exp.value !== undefined && exp.value !== null) ok = (got.value === exp.value);
    if (ok && exp.verdict === 'R') ok = (got.value === null || got.value === undefined);
    (ok?vac:kill).push(r.id);   // still passes against the mutant => VACUOUS
  }
  return {n:kill.length+vac.length, kill, vac};
}
const mainExp  = r => r.main ? {verdict:r.main, value:r.mainValue} : null;
const blockExp = r => r.branchArms.includes('BLOCKING') ? {verdict:r.branch, value:r.branchValue} : null;
const carveExp = r => r.branchArms.includes('CARVEOUT') ? {verdict:r.branch, value:r.branchValue} : null;

console.log('=== ARM B, kill power, 91-row table, denominator in every sentence ===');
for (const [label, subj, pick] of [
  ['MAIN.disarmed   vs MAIN rows            ','MAIN.disarmed',   mainExp],
  ['BRANCH.disarmed vs BRANCH BLOCKING rows ','BRANCH.disarmed', blockExp],
  ['BRANCH.disarmed vs BRANCH CARVEOUT rows ','BRANCH.disarmed', carveExp],
]){
  const k = kills(subj,pick);
  console.log(`${label}: ${k.kill.length}/${k.n} KILL, ${k.vac.length}/${k.n} VACUOUS`);
  console.log(`     vacuous ids: ${k.vac.join(', ') || '(none)'}`);
}
// Which of the 10 NEW rows do work?
const NEW = rows.filter(r=>r.id>=82).map(r=>r.id);
const kc = kills('BRANCH.disarmed', carveExp);
const newKill = NEW.filter(id=>kc.kill.includes(id));
const newVac  = NEW.filter(id=>kc.vac.includes(id));
console.log(`\n=== the 10 rows the table was missing: ${newKill.length}/10 KILL the disarm, ${newVac.length}/10 vacuous ===`);
console.log('   KILL   :', newKill.join(', '));
console.log('   VACUOUS:', newVac.join(', '));
