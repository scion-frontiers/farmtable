import { readFileSync, writeFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync('rows/union.json','utf8'));
const res  = JSON.parse(readFileSync('results.json','utf8'));
const byId = Object.fromEntries(rows.map(r=>[r.id,r]));
const esc = s => s===null?'`null`':(s==='__UNDEFINED__'?'`undefined`':'`'+JSON.stringify(s).slice(1,-1).replace(/\|/g,'\\|')+'`');
let out = '| # | Input | Config | MAIN asserts | BRANCH asserts | MAIN.pristine | BRANCH.blocking | BRANCH.carveout |\n|---|---|---|---|---|---|---|---|\n';
for (const rr of res){
  const r = byId[rr.id];
  const cfg = rr.c2 ? '**BOTH**' : 'any';
  const g = n => { const x=rr.got[n]; return x.verdict==='A' ? 'A' : (x.verdict==='R'?'R':'THREW'); };
  out += `| ${r.id} | ${esc(r.input)} | ${cfg} | ${r.main??'—'} | ${r.branch??'—'} | ${g('MAIN.pristine')} | ${g('BRANCH.blocking')} | ${g('BRANCH.carveout')} |\n`;
}
writeFileSync('armtable.md', out);
console.log('rows in table:', res.length);
// disagreement summary between the two BRANCH configs
const flip = res.filter(r=>r.got['BRANCH.blocking'].verdict!==r.got['BRANCH.carveout'].verdict).map(r=>r.id);
console.log('rows whose verdict CHANGES between BRANCH configs:', flip.length, '->', flip.join(', '));
