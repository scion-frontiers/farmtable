# 2026-07-29 — ci-suite-manifest: closing three vacuous-pass paths

**Branch:** `fix/ci-manifest-guards` off `main` (`faf1c8c`) · **Scope:**
`scripts/ci-suite-manifest.mjs` only.

The membership check is the one gate step that decides pass/fail by classifying
text rather than by exit status. Three of its expressions were loose enough to
manufacture a green. All three are now closed, and each was proved to fire.

## What was wrong

**1. Runner classification, `/\bvitest\b/` over the whole command string.**
`npx jest --config vitest.config.ts` was read as a vitest run because the word
appears in a config filename. It then fell to the no-path-filter arm, which does
`present.forEach(p => executed.add(p))` — marking every test file in the tree
executed on the strength of a flag value. Now classified by the command's
leading token, after skipping env assignments, launcher flags and launchers.

**2. Vitest path filters, `p.includes(a)`.** An unanchored substring. Filter
`read` claimed to execute `.../task-ready.test.ts`. Over-crediting shrinks
`missing`, and `missing` is the pass condition, so a loose match here creates
the pass it exists to guard. Now anchored to path-segment boundaries.

**3. No floor on the population.** With `present` empty — a moved directory, an
edited `TEST_FILE_RE`, a pathspec typo — both guards were empty and the script
printed `OK` and exited 0. That is exactly what its own header forbids: *"A
check that cannot see is not a check that passes."* `MIN_TEST_FILES` is now a
committed integer, checked **before** the membership comparison, and every
verdict prints `enumerated / executed / missing`.

**4. Quote-unaware splitting.** Script bodies were split on `/&&|\|\||;/`
regardless of quoting. Splitting is now quote-aware; an unterminated quote is
reported as unanalysable rather than guessed at.

## Canary evidence

Every guard was fired before being trusted. Each canary was also run against the
**pre-fix script** (`git show faf1c8c:scripts/ci-suite-manifest.mjs`), so the red
is attributable to the change and not to some other property of the canary.
Canaries were never committed; restoration was verified by content hash and by
`git status --porcelain -uall --ignored`.

| # | Fix | Canary (`web/package.json` `scripts.test`) | OLD | NEW |
|---|-----|--------------------------------------------|-----|-----|
| A | 1 | `npx vitest-runner-x` | **0 GREEN** | **1 RED** |
| B | 2 | `npx vitest run read` | **0 GREEN** | **1 RED** |
| C | 3 | `npx vitest run` + emptied population | **0 GREEN** | **1 RED** |
| D | 4 | `npx vitest run "utils && nonexistent"` | 1 red | 1 red |
| E | tsconfig gate | include narrowed to `src/**/*.spec.ts` | n/a | **1 RED** |
| F | suite reds | `throw` appended to the one test file | n/a | **1 RED** |
| G | discovery | a second `.test.ts` file added | n/a | **0 green, 2 tests ran** |
| H | stale output | `rm -rf .tmp-test` removed from `test` | n/a | **1 RED** |
| B2 | control | `npx vitest run utils` (legitimate segment) | 0 | **0 green** |
| D2 | control | `npx vitest run "src/utils"` (quoted, legitimate) | 1 red | **0 green** |

A, B and C are the three that matter: **the old script passed all three.** Each
is a green over a suite that is not running. After the canary was removed, the
tree returned to `enumerated=1 executed=1 missing=0 (floor 1)`, exit 0.

Canary C needed care. Emptying the population is not enough on its own — with
the real `test` script the old code reports the missing artefact as unanalysable
and goes red for an unrelated reason. The vacuous pass only appears when the
population is empty **and** the runner is a discovery runner, because then
`executed` is legitimately empty too and nothing is left to complain. The
population was emptied via a temporary `GIT_INDEX_FILE` plus moving the file
outside the repo, so the real index was never modified.

## Two things worth keeping

**The canary for fix 4 found a second defect.** Running it rather than assuming
it showed that the *body* split was quote-aware but the *argument* split was
still `/\s+/`, producing a path filter literally named `"utils`. Fixed in the
second commit. A legitimate quoted filter, `vitest run "src/utils"`, went from
unanalysable to resolving correctly — control D2 above.

**My own verification probe had the bug I was fixing.** While checking canary C
I ran `git ls-files web | grep -cE '\.(test|spec)\.'` and got 1 against an
emptied index. The grep is unanchored and matches `tsconfig.test.json`. The
script's own `TEST_FILE_RE` is `$`-anchored and correctly reported 0. The
instrument checking the fix for unanchored matching was itself unanchored, and
the only reason it did not mislead is that the script printed its own count
next to it.

## The web suite ran one file, and now runs the tree

Assigned after the manifest work, as its payoff. `npm test` was
`tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js`, and
`tsconfig.test.json`'s `include` named **the same single file**. Both halves of
the wiring were explicit, so a second test file would have been neither compiled
nor run and `npm test` would still have exited 0.

**Measured at `faf1c8c`: `enumerated=1 executed=1 missing=0`.** The tree really
does contain exactly one JS/TS test file — checked three ways: the script's
`TEST_FILE_RE` (1), a deliberately wider net over `__tests__/`, `tests/`,
`*_test.*`, `*-spec.*` under `web/` (1, the same file), and the whole repo
outside `web/` (0). So there was no hidden population to expose and **no
previously-unrun test file failed — there were none to run.** The defect was
real but structural: it is about the next test file, not this one.

Now `include` is `src/**/*.{test,spec}.{ts,tsx}` and `test` is
`tsc -p tsconfig.test.json && node --test .tmp-test`.

`MIN_TEST_FILES` stays **1** because 1 is the measured real number, not a
placeholder.

**The manifest is taught the new shape and taught to distrust it.** `node --test`
over a compiled directory discovers only what the compile step emitted, so
crediting every present file to it would be the same vacuous pass in a new
place — the runner cannot report a file it was never given. The manifest now
reads the tsconfig's `include`/`files` globs and credits a source file only if
that config matches it. Canary E fires this.

**And that produced a third instance of this branch's own bug.** Stripping JSONC
comments with `/\/\*[\s\S]*?\*\//g` is not string-aware, and the glob
`"src/**/*.test.ts"` contains both `/*` and `*/` — so the stripper rewrote it to
`"src*.test.ts"` and the include list stopped matching the files it names. The
manifest went red on a correct config. Comment stripping is now string-aware.
Found by running it, not by reading it — which is now three for three: every
non-obvious defect on this branch came from firing a guard, never from
re-reading the code that contained it.

## A compiler does not delete

The last defect on this branch was found by the final verification run, after
everything else was committed and green. `npm test` reported **2 tests on a tree
containing 1 test file.**

Canary G had added a second test file, and removing the source did not remove
its compiled output. `tsc` emits into `.tmp-test` and never cleans it, so the
compiled form of a deleted test kept being discovered and kept reporting pass.

What makes this worth writing down is not the stale artefact. It is that **the
two instruments disagreed and the reassuring one was wrong.** The manifest reads
sources and said 1. The suite runs the output directory and ran 2. A test whose
source no longer exists was contributing a pass to the count that gates merges,
and the check built to detect exactly this kind of drift could not see it,
because it was looking at the wrong side of the compile step.

`npm test` now begins `rm -rf .tmp-test`, and the manifest tracks which
directories a pipeline removes and reports a `node --test <dir>` over an
uncleaned `<dir>` as unanalysable — so adding the runner without the clean step
is red, not green. Canary H fires this.

Both of the last two defects were found by running something, and neither would
have survived a careful reading, because neither was visible in the code. One
needed a glob to contain `/*`, the other needed a file to have been deleted.

## Not fixed here, owned elsewhere

- `.github/workflows/ci.yml:169` — the failure-summary grep requires a space
  where Go emits a tab; matched 0 of 31 real failure lines, and `|| echo "none"`
  means the step cannot red. Owned by `farmtable-ci-workflow`.
- `.github/workflows/ci.yml:104`/`:120` — `web/dist` asserted by existence, not
  content, so a stub satisfies both assertions and the Go embed.
- `Makefile:65-67` — `make lint` runs `go vet ./...`, which aborts in any tree
  without a built frontend, and is not invoked by CI.
- `MIN_TEST_FILES` is 1 because that is what this tree has. The branch
  `task-state-web-ui-v2` carries 15 more. **Raise the floor in the same commit
  that lands them**, or the floor protects nothing it does not already protect.
