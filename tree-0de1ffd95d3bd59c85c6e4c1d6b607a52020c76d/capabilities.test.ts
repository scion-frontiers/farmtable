/**
 * THE CAPABILITY GATE HAS TWO READERS AND THIS IS WHAT MAKES THEM AGREE.
 *
 * `getCapabilities` and `isCollectionWritable` (both in capabilities.ts) encode
 * one rule: a collection is writable IFF it is platform GITHUB *and* carries an
 * explicit `writable: true`. Until r8 the second reader tested only the second
 * conjunct. Its two callers, `FtApp.isReadOnly` and `FtApp.isExternalWritable`,
 * each exclude FARMTABLE before calling, so its effective predicate was "not
 * FARMTABLE and writable" -- strictly weaker than the rule, across an enum with
 * six non-FARMTABLE members. Commit `af9ea8c` added the missing conjunct.
 *
 * WHAT THIS FILE IS FOR, STATED SO IT CAN BE JUDGED:
 *
 *   ARM 1 (§1) pins af9ea8c itself. Delete the three-line platform guard and
 *   this arm goes RED, naming the platform that escaped. That is not a
 *   prediction: it was executed as three interleaved reverted/fixed pairs in a
 *   throwaway clone, and every individual run is recorded in the r9 report. A
 *   test that has never been observed RED is not evidence of anything.
 *
 *   ARM 2 (§2) pins the AGREEMENT of the two readers over the whole platform
 *   enum crossed with a set of writable-flag shapes. r8 re-aligned the two
 *   predicates BY HAND; without this arm they can diverge again by hand
 *   tomorrow with nothing going red. That is audit F3.
 *
 *   ARM 3 (§3) pins that `ft-app.ts` still ROUTES THROUGH the shared predicate
 *   rather than carrying a private copy of it. Arms 1 and 2 test the function;
 *   only this one testifies that the component still calls it.
 *
 * WHY IT TESTS `isCollectionWritable` AND NOT `getCapabilities`, WHICH IS THE
 * TEMPTING VEHICLE AND THE WRONG ONE. `getCapabilities` already contained both
 * conjuncts before r8, so it was never the defective surface; a test of it is
 * GREEN on the defect in both directions, always. When the subject of a test is
 * hard to reach, the vehicle drifts to whatever is exported nearby and the
 * substitution is invisible precisely because the diagnosis is right. The
 * subject was a private method on a Lit element; r9 exported it rather than
 * testing its neighbour.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Platform, type Collection } from './gen/types.js';
import { GITHUB_CAPABILITIES, getCapabilities, isCollectionWritable } from './capabilities.js';
import { assert, assertEqual } from './util/assertions.js';

/** A collection with every required field, so only the two under test vary. */
const BASE: Omit<Collection, 'platform' | 'remoteData'> = {
  id: 'collection-1',
  name: 'Collection',
  statusMappings: [],
  customFieldDefinitions: [],
  createdAt: '2026-07-29T00:00:00.000Z',
};

function collection(platform: Platform, rd: Record<string, unknown> | undefined): Collection {
  return { ...BASE, platform, remoteData: rd };
}

/**
 * The writable-flag shapes, with their labels.
 *
 * The last two are the NEAR-MISS arms and they are the reason this is a table
 * and not four hand-written cases: both implementations use `=== true`, so both
 * must reject the string `'true'` and the number `1`. A test that only feeds
 * booleans cannot tell `=== true` from a truthiness check.
 */
const RD_VARIANTS: ReadonlyArray<readonly [string, Record<string, unknown> | undefined]> = [
  ['absent', undefined],
  ['empty object', {}],
  ['writable: true', { writable: true }],
  ['writable: false', { writable: false }],
  ["writable: 'true' (string near-miss)", { writable: 'true' }],
  ['writable: 1 (number near-miss)', { writable: 1 }],
];

/**
 * Expected `isCollectionWritable` per platform, in RD_VARIANTS order.
 *
 * WRITTEN OUT AS DATA, NOT DERIVED FROM A FORMULA. A formula here would be a
 * second copy of the implementation, and a second copy of a wrong
 * implementation agrees with the first. This table is the specification: only
 * GITHUB has a true in it, and only in the `writable: true` column.
 *
 * The `Record<Platform, ...>` type makes a new enum member a COMPILE error
 * here, and §2 makes it a runtime error too, so a platform cannot be added
 * without someone deciding what it means.
 */
const EXPECTED: Record<Platform, readonly boolean[]> = {
  [Platform.UNSPECIFIED]: [false, false, false, false, false, false],
  [Platform.FARMTABLE]: [false, false, false, false, false, false],
  [Platform.GITHUB]: [false, false, true, false, false, false],
  [Platform.LINEAR]: [false, false, false, false, false, false],
  [Platform.JIRA]: [false, false, false, false, false, false],
  [Platform.ASANA]: [false, false, false, false, false, false],
  [Platform.BEADS]: [false, false, false, false, false, false],
};

/**
 * The platform population, enumerated from the enum rather than listed.
 *
 * `Object.values` on a numeric TypeScript enum returns the reverse mapping too
 * -- names AND numbers, fourteen entries for seven members -- so the filter is
 * load-bearing and not defensive noise.
 */
const PLATFORMS: readonly Platform[] = Object.values(Platform).filter(
  (v): v is Platform => typeof v === 'number',
);

const PLATFORM_NAME: Record<Platform, string> = {
  [Platform.UNSPECIFIED]: 'UNSPECIFIED',
  [Platform.FARMTABLE]: 'FARMTABLE',
  [Platform.GITHUB]: 'GITHUB',
  [Platform.LINEAR]: 'LINEAR',
  [Platform.JIRA]: 'JIRA',
  [Platform.ASANA]: 'ASANA',
  [Platform.BEADS]: 'BEADS',
};

/** Resolve web/src. Compiled into .tmp-test/, so import.meta.url is build output. */
function sourceRoot(): string {
  let dir = fileURLToPath(new URL('.', import.meta.url));
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('could not locate web/package.json from ' + import.meta.url);
    dir = parent;
  }
  return join(dir, 'src');
}

// ── §1. THE af9ea8c GUARD ────────────────────────────────────────────────────
//
// The three lines af9ea8c added are `if (coll.platform !== Platform.GITHUB)
// return false`. This arm is written separately from the table below, ahead of
// it, so that the FIRST thing a reader of a red run sees is the platform that
// got through. Every case here is also covered by §2; the duplication buys
// legibility in the failure message and costs six assertions.
function pinTheAf9ea8cGuard(): void {
  for (const platform of PLATFORMS) {
    if (platform === Platform.GITHUB) continue;
    assertEqual(
      isCollectionWritable(collection(platform, { writable: true })),
      false,
      `af9ea8c GUARD BREACHED: platform ${PLATFORM_NAME[platform]} with an explicit ` +
        'writable flag is treated as WRITABLE. The gate requires GITHUB *and* writable, ' +
        'together. If you just removed the platform check from isCollectionWritable, this ' +
        'is the line that says so',
    );
  }

  // The control arm. Without it, an implementation that returns false always
  // satisfies every assertion above, and this file would be green on a gate
  // that grants nothing.
  assertEqual(
    isCollectionWritable(collection(Platform.GITHUB, { writable: true })),
    true,
    'CONTROL ARM: GITHUB with writable: true must still be writable. If this fails, the ' +
      'assertions above are being satisfied by a predicate that refuses everything',
  );
}

// ── §2. THE TWO READERS AGREE, ACROSS THE WHOLE ENUM ─────────────────────────
//
// audit F3: r8 re-aligned getCapabilities and isCollectionWritable by hand and
// installed no guard against them diverging again. This is the guard. The
// invariant is: a collection is writable IFF getCapabilities grants the GitHub
// write set. Object identity, not deep equality -- the module returns frozen
// singletons and identity is the stronger claim.
function pinTheTable(): void {
  let sawTrue = false;
  let sawFalse = false;

  for (const platform of PLATFORMS) {
    const row = EXPECTED[platform];
    assert(
      row !== undefined && row.length === RD_VARIANTS.length,
      `PLATFORM ${PLATFORM_NAME[platform]} HAS NO EXPECTATION ROW of the right width. A ` +
        'platform was added to the enum and nobody decided whether it is writable. Add a ' +
        'row to EXPECTED rather than deleting this check',
    );

    for (let i = 0; i < RD_VARIANTS.length; i += 1) {
      const [label, rd] = RD_VARIANTS[i];
      const coll = collection(platform, rd);
      const want = row[i];

      assertEqual(
        isCollectionWritable(coll),
        want,
        `isCollectionWritable(${PLATFORM_NAME[platform]}, ${label})`,
      );

      const grantsGithubWrites = getCapabilities(coll) === GITHUB_CAPABILITIES;
      assertEqual(
        isCollectionWritable(coll),
        grantsGithubWrites,
        `THE TWO READERS OF THE CAPABILITY GATE DISAGREE for (${PLATFORM_NAME[platform]}, ` +
          `${label}): isCollectionWritable says ${String(isCollectionWritable(coll))} and ` +
          `getCapabilities ${grantsGithubWrites ? 'grants' : 'withholds'} GITHUB_CAPABILITIES. ` +
          'One rule, two implementations; r8 fixed a divergence here by hand and this is ' +
          'what makes the next one red',
      );

      if (want) sawTrue = true;
      else sawFalse = true;
    }
  }

  // Anti-vacuity with its denominator. A table that never observes both
  // outcomes is satisfied by a constant.
  assert(
    sawTrue,
    `the ${PLATFORMS.length} x ${RD_VARIANTS.length} table expects no writable case at all; ` +
      'it cannot distinguish the gate from a closed door',
  );
  assert(
    sawFalse,
    `the ${PLATFORMS.length} x ${RD_VARIANTS.length} table expects no read-only case at all; ` +
      'it cannot distinguish the gate from an open door',
  );
}

// ── §3. ft-app.ts STILL ROUTES THROUGH THE SHARED PREDICATE ──────────────────
//
// §1 and §2 test the function. They say nothing about whether the component
// still calls it: reinstating a private copy inside FtApp leaves both arms
// green while the dashboard runs different code. That is the same class of
// defect as the one af9ea8c repaired -- one rule, written twice -- so it gets
// its own arm rather than a comment asking people not to.
function pinTheCallSite(): void {
  const path = join(sourceRoot(), 'components', 'ft-app.ts');
  const text = readFileSync(path, 'utf8');

  assert(
    text.length > 0,
    'read 0 bytes of components/ft-app.ts; the assertions below would pass on an empty ' +
      'string and this arm would be a decoration',
  );
  assert(
    /import\s*\{[^}]*\bisCollectionWritable\b[^}]*\}\s*from\s*'\.\.\/capabilities\.js'/.test(text),
    'components/ft-app.ts does not import isCollectionWritable from ../capabilities.js. ' +
      'Either the import moved or the component stopped using the shared predicate',
  );
  assert(
    !/\b(private|public|protected|function)\s+isCollectionWritable\b/.test(text),
    'components/ft-app.ts DECLARES ITS OWN isCollectionWritable. There must be exactly one ' +
      'implementation of this rule; a second copy is precisely the divergence af9ea8c fixed',
  );
}

function run(): void {
  pinTheAf9ea8cGuard();
  pinTheTable();
  pinTheCallSite();
  console.log('capabilities: ok');
}

run();
