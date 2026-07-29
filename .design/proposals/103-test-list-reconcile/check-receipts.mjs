#!/usr/bin/env node
/**
 * Exercises scripts/test-receipts.mjs -- the assertion-receipt protocol logic --
 * with synthetic stdout. Lands at web/scripts/check-receipts.mjs.
 *
 * This imports THE ARTEFACT, not a copy of its logic. It compiles nothing, runs
 * no test suite and needs no build token: every case below is a string and a
 * function call.
 *
 * The rule it exists to protect is the one that is easy to get subtly wrong and
 * impossible to notice when wrong: ** A SUITE THAT REPORTED NOTHING AND A SUITE
 * WHOSE REPORT WAS NOT UNDERSTOOD ARE BOTH ERRORS, AND NEITHER IS A ZERO. ** If
 * that ever degrades to `count = 0`, the aggregate total quietly drops and the
 * suite still exits 0, which is #103 wearing a different hat.
 *
 * Exit 0 = all cases behaved. Exit 1 = at least one did not.
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadManifest, readAssertionTotal } from './test-receipts.mjs';

let failures = 0;
let ran = 0;

function check(name, cond, detail = '') {
  ran += 1;
  if (cond) {
    console.log(`  ok    ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? `\n          ${detail}` : ''}`);
  }
}

/** Build a manifest on disk and load it through the real loader. */
function withManifest(obj) {
  const dir = mkdtempSync(join(tmpdir(), 'd103-receipts-'));
  writeFileSync(join(dir, 'test-receipts.manifest.json'), JSON.stringify(obj), 'utf8');
  const res = loadManifest(dir);
  rmSync(dir, { recursive: true, force: true });
  return res;
}

// The real declaration, copied from test-receipts.manifest.json.
const MARKDOWN_DECL = {
  protocol: 'private-total',
  pattern: '^markdown sanitizer: [0-9]+ checks passed \\(([0-9]+) assertions\\)$',
  captureGroup: 1,
};
const REAL = withManifest({
  suites: { 'util/markdown': MARKDOWN_DECL },
  aggregateAssertionPin: null,
});

console.log('\n-- manifest loading --');
check('a valid manifest loads', !REAL.error, REAL.error);
check('a null aggregate pin survives as null', REAL.manifest?.aggregatePin === null);
check(
  'a missing manifest is an error, not an empty default',
  Boolean(loadManifest(join(tmpdir(), 'd103-definitely-absent')).error),
);
check(
  'an unknown protocol is refused',
  Boolean(withManifest({ suites: { x: { protocol: 'tap14' } } }).error),
);
check(
  'private-total without a pattern is refused',
  Boolean(withManifest({ suites: { x: { protocol: 'private-total', captureGroup: 1 } } }).error),
);
check(
  'an uncompilable pattern is refused',
  Boolean(
    withManifest({ suites: { x: { protocol: 'private-total', pattern: '([', captureGroup: 1 } } })
      .error,
  ),
);
check(
  'a non-integer aggregate pin is refused',
  Boolean(withManifest({ suites: {}, aggregateAssertionPin: 'lots' }).error),
);

const M = REAL.manifest;

console.log('\n-- default protocol (receipt), for any undeclared suite --');
check(
  'a valid receipt yields its count',
  readAssertionTotal('util/safe-url', 'ok\n#assertions 42\n', M).count === 42,
);
const silent = readAssertionTotal('utils/task-ready', 'no output at all\n', M);
check('a silent suite is an error', Boolean(silent.error));
check(
  'and the error says it is NOT a zero',
  /NOT READ AS ZERO/.test(silent.error ?? ''),
  silent.error,
);
check(
  'a silent suite yields NO count field at all',
  silent.count === undefined,
  'a count of 0 here would be summed into the aggregate and vanish',
);
check(
  'a zero receipt is an error',
  Boolean(readAssertionTotal('util/safe-url', '#assertions 0\n', M).error),
);
check(
  'an unparseable receipt is an error',
  Boolean(readAssertionTotal('util/safe-url', '#assertions banana\n', M).error),
);
check(
  'the highest receipt wins when several are printed',
  readAssertionTotal('util/safe-url', '#assertions 3\n#assertions 9\n', M).count === 9,
);

console.log('\n-- private-total protocol, as declared for util/markdown --');
const REAL_LINE = 'markdown sanitizer: 82 checks passed (131 assertions)';
check(
  "the REAL markdown.test.ts output line parses to 131",
  readAssertionTotal('util/markdown', `${REAL_LINE}\n`, M).count === 131,
  JSON.stringify(readAssertionTotal('util/markdown', `${REAL_LINE}\n`, M)),
);
check(
  'surrounding output does not disturb the match',
  readAssertionTotal('util/markdown', `noise\n${REAL_LINE}\nmore noise\n`, M).count === 131,
);
const reworded = readAssertionTotal('util/markdown', 'markdown sanitizer: all good\n', M);
check('a reworded report line is an error', Boolean(reworded.error));
check(
  'and that error is NOT read as zero either',
  /NOT READ AS ZERO/.test(reworded.error ?? ''),
  reworded.error,
);
check(
  'a declared private-total suite that ALSO emits a receipt is an error',
  Boolean(readAssertionTotal('util/markdown', `${REAL_LINE}\n#assertions 5\n`, M).error),
);
check(
  'two matching report lines are an error',
  Boolean(readAssertionTotal('util/markdown', `${REAL_LINE}\n${REAL_LINE}\n`, M).error),
);
check(
  'a private total of zero is an error',
  Boolean(
    readAssertionTotal('util/markdown', 'markdown sanitizer: 0 checks passed (0 assertions)\n', M)
      .error,
  ),
);

console.log(
  `\n${failures === 0 ? 'PASS' : 'FAIL'}: ${ran - failures}/${ran} receipt-protocol cases behaved.`,
);
process.exit(failures === 0 ? 0 : 1);
