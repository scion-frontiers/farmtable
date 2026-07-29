// Conformance re-run against the e64138c base.
//
// The only thing that changed from the 91-row run is CONFIGURATION LABELLING:
// blob 9391a2a adds three userinfo inputs that a9e49ff already asserted, so
// rows 72/74/75 move from BLOCKING-only to BOTH branch arms. The denominator
// does not move. This run exists to prove the promoted rows actually pass under
// the carve-out build rather than to assume they do.
import { readFileSync, writeFileSync } from 'node:fs';

const rows = JSON.parse(readFileSync('rows/union91-e64138c.json', 'utf8'));

const mods = {
  'MAIN.pristine'   : (await import('./impl/main.pristine.mjs')).safeHref,
  'BRANCH.blocking' : (await import('./impl/branch.pristine.mjs')).safeExternalUrl,
  'BRANCH.carveout' : (await import('./impl/branch.flagon.mjs')).safeExternalUrl,
};

const arg = (r) => (r.input === null ? null : r.input === '__UNDEFINED__' ? undefined : r.input);

function verdictOf(fn, a) {
  try {
    const out = fn(a);
    return { verdict: out === undefined || out === null ? 'R' : 'A', value: out, threw: null };
  } catch (e) {
    return { verdict: 'THREW', value: undefined, threw: String(e && e.message) };
  }
}

// Which rows does each subject OWN, i.e. which rows is it the control for.
const owners = {
  'MAIN.pristine'   : (r) => Boolean(r.mainSrc),
  'BRANCH.blocking' : (r) => r.branchArms.includes('BLOCKING'),
  'BRANCH.carveout' : (r) => r.branchArms.includes('CARVEOUT'),
};

const expected = {
  'MAIN.pristine'   : (r) => ({ verdict: r.main,   value: r.mainValue }),
  'BRANCH.blocking' : (r) => ({ verdict: r.branch, value: r.branchValue }),
  'BRANCH.carveout' : (r) => ({ verdict: r.branch, value: r.branchValue }),
};

const report = {};
for (const [name, fn] of Object.entries(mods)) {
  const own = rows.filter(owners[name]);
  const fails = [];
  for (const r of own) {
    const got = verdictOf(fn, arg(r));
    const exp = expected[name](r);
    // Loopback rows legitimately flip verdict between the two BRANCH configs;
    // under CARVEOUT the recorded BLOCKING verdict does not apply. Those rows
    // are scored against the carve-out expectation carried on the row itself.
    const expVerdict = name === 'BRANCH.carveout' && r.carveoutVerdict ? r.carveoutVerdict : exp.verdict;
    if (got.verdict !== expVerdict) fails.push({ id: r.id, input: r.input, exp: expVerdict, got: got.verdict, cls: r.cls });
  }
  report[name] = { denominator: own.length, passed: own.length - fails.length, fails };
}

// The specific question this re-run was commissioned to answer.
const promoted = [72, 74, 75];
report.promotedRows = promoted.map((id) => {
  const r = rows.find((x) => x.id === id);
  const out = {};
  for (const [name, fn] of Object.entries(mods)) out[name] = verdictOf(fn, arg(r)).verdict;
  return { id, input: r.input, cls: r.cls, arms: r.branchArms, src: r.branchSrc, verdicts: out };
});

writeFileSync('results-e64138c.json', JSON.stringify(report, null, 1));

for (const name of Object.keys(mods)) {
  const s = report[name];
  console.log(`${name.padEnd(17)} ${s.passed}/${s.denominator} pass` + (s.fails.length ? `  FAILS=[${s.fails.map((f) => f.id).join(', ')}]` : '  (control clean)'));
}
console.log('\nPROMOTED ROWS (the three inputs 9391a2a adds to the carve-out arm):');
for (const p of report.promotedRows) {
  console.log(`  row#${p.id} ${JSON.stringify(p.input)}`);
  console.log(`    cls=${p.cls}  arms=[${p.arms.join(',')}]  src=[${p.src.join(',')}]`);
  console.log(`    MAIN=${p.verdicts['MAIN.pristine']}  BRANCH.blocking=${p.verdicts['BRANCH.blocking']}  BRANCH.carveout=${p.verdicts['BRANCH.carveout']}`);
}
