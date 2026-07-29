# Why a superset `executed` set made `missing` unable to be nonzero

Branch: `fix/manifest-superset`. Subject: the executed/attribution arm of
`scripts/ci-suite-manifest.mjs`.

## The measurement that started this

On a tree carrying the union `web/package.json` — `scripts.test` is
`node scripts/run-node-tests.mjs && npm run test:components`, with
`test:components` = `vitest run` — and with **no `web/vitest.config.ts`**:

```
npm test                            -> EXIT 1, twelve files fail
                                       "No test suite found in file"
node scripts/ci-suite-manifest.mjs  -> EXIT 0
  OK: every tracked JS/TS test file is executed by `npm test`.
  enumerated=6 executed=12 missing=0
```

The gate whose entire job is to catch a suite that does not run certified a
suite green while `npm test` exited 1. Two independent faults, below.

## Fault 1: the two sets are drawn from different universes

This is the load-bearing sentence, and it is the one a future reader will
delete if it is not written down:

```
enumerated  <-  GIT         (tracked, or untracked and not gitignored)
attributed  <-  FILESYSTEM  (each runner resolves discovery against the disk)
```

`present` is built from `git ls-files`. `executed` is built from what runners
say they found — `vitest list` globs the working directory, and the working
directory contains things git cannot see.

The six surplus paths were `web/.tmp-test/*.test.js`: the node runner's
compiled intermediates, gitignored at `.gitignore:46`. They exist on disk.
They are not tracked. **They can therefore appear on the attributed side and
can never, under any circumstance, appear on the enumerated side.** That
asymmetry is structural, not incidental.

Now put that next to how `missing` was computed:

```js
const missing = present.filter((p) => !executed.has(p));   // enumerated MINUS attributed
```

One direction. Adding a member to `executed` that is not in `present` cannot
raise `missing` — the filter only ever asks whether each *enumerated* path was
credited. Every out-of-population credit either matches nothing (no effect) or
matches an enumerated path (drives `missing` down).

So `missing` had **no path to a nonzero value** from the defect that was
actually present. It is not that `missing == 0` happened to miss a runner
sweeping up build artefacts on this particular night. `missing == 0` was
*incapable* of detecting it. A metric that cannot go up is not a metric, and
`enumerated=6 executed=12` should have been read as "these are not two
measurements of one population" rather than as a comfortable margin.

It gets worse in the specific case, because the surplus was not noise — it was
the **visible signature of the actual bug**. With no `vitest.config.ts`, vitest
fell back to its built-in default `include` and swept up (a) the node runner's
`src/**/*.test.ts` sources, which it cannot execute as-is, and (b) the
`.tmp-test/` build artefacts. Twelve files, zero runnable. The manifest had the
evidence of the breakage in its hand, printed it on screen as `executed=12`,
and reported OK.

### The fix

Every runner's discovery set now goes through one function:

```js
function credit(source, files) {
  const outside = outOfPopulation(files);
  if (outside.length) surplus.push({ source, paths: outside });
  for (const f of files) if (present.includes(f)) executed.add(f);
}
```

Any surplus is fatal. It is **not** silently intersected away, because the
surplus is the diagnostic. It is reported per-runner and by name — a count
alone tells whoever has to fix this nothing about which runner or which
directory. The failure text names the likely cause (a runner with no config
file) and the correct action (add `web/vitest.config.ts` with a scoped
`include`), and explicitly rules out the two green-by-blinding moves: widening
the population, or deleting the arm.

The surplus verdict runs **before** the missing verdict, because a surplus does
not merely add a second problem — it invalidates the `missing` number printed
above it.

### The new arm's own failure mode, defused

`surplus == 0` has its pass condition at zero, and zero is also what a broken
implementation returns: a typo, a wrong path root, a set built from the wrong
variable, an empty input. A guard whose failure mode is indistinguishable from
its expected output is not a guard, and it will read as a clean bill of health
forever.

So the arm ships with an **in-process positive control** that fires on every
run. The same `outOfPopulation` function used for the real answer is fired at a
seeded path constructed to be absent, in the same invocation, and both results
are printed together:

```
surplus=0 of 6 attributed path(s). ...
Positive control, fired this run:
outOfPopulation(['web/__ci-suite-manifest-positive-control__/seeded.test.ts'])
returned 1, so the zero above is a measurement and not a default.
```

If the control returns anything but 1, the script exits non-zero and refuses to
print a pass. Demonstrated red by creating that path so it entered `present`.

## Fault 2: the claim was about a command the script never runs

The old success line:

> `OK: every tracked JS/TS test file is executed by `npm test`.`

The script does not run `npm test`. It parses `scripts.test` statically and
asks each runner to **enumerate** — for vitest it shells `vitest list`, and
`list` lists without executing. That is precisely why it could list twelve
files and not notice that all twelve were incapable of running.

**A static parse of a script is not an observation of the script.** The remedy
was not to make the script run `npm test`, which would be circular and slow. It
was to make the claim match the evidence: the success text now says only that
each tracked test file is **attributable** to a runner named in `scripts.test`,
and says in the same breath that attribution is not execution and not passing.

## Third fault, reported and NOT fixed

**Double attribution is invisible.** `credit()` adds to a Set; nothing checks
whether two runners claim the *same* file. In the exact red condition above,
`src/**/*.test.ts` was claimed by both the node runner and by unconfigured
vitest — six files attributed twice, executed under two different environments,
and the gate said nothing. A file attributed twice is indistinguishable here
from a file attributed once, so "which runner owns this test" is not a question
the manifest can currently answer. Left for the arm's owner.

## What to hold onto

If you are tempted to simplify the surplus arm away as redundant with
`missing == 0`, re-read the first section. They measure opposite directions of
a difference between sets drawn from **different universes**, and only one of
those directions can ever see a gitignored file.
