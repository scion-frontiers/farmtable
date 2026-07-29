import { readFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync('rows/union.json','utf8'));
const res  = JSON.parse(readFileSync('results.json','utf8'));
const byId = Object.fromEntries(rows.map(r=>[r.id,r]));
const show=(ids,mods,title)=>{
  console.log('\n=== '+title+' ===');
  for(const id of ids){
    const r=byId[id], rr=res.find(x=>x.id===id);
    console.log(`#${id} ${JSON.stringify(r.input)}  [${r.cls}]  C2dep=${rr.c2}`);
    console.log(`    asserted: MAIN=${r.main??'-'}${r.mainValue?` (=${JSON.stringify(r.mainValue)})`:''}  BRANCH=${r.branch??'-'}${r.branchValue?` (=${JSON.stringify(r.branchValue)})`:''}`);
    for(const m of mods) console.log(`    ${m.padEnd(17)} -> ${rr.got[m].verdict} ${JSON.stringify(rr.got[m].value)}`);
  }
};
show([44,47],['MAIN.pristine','BRANCH.blocking'],'MAIN rows BRANCH fails, C2-INDEPENDENT');
show([78,79,80],['BRANCH.blocking','BRANCH.disarmed'],'BRANCH normalising accepts vs the disarm');
show([64,66,69,70,50],['BRANCH.blocking','BRANCH.carveout'],'C1 MERITS: loopback under BLOCKING vs CARVEOUT');
show([62,61],['MAIN.pristine','BRANCH.blocking','BRANCH.carveout'],'backslash/userinfo rows');
