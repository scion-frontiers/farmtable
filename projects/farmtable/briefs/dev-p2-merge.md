# dev-p2-merge — LAND THE TASK-STATE BRANCH ON MAIN

You are landing the task-state-model-v2 web UI branch onto main. The hold that has blocked
this all day is released: em-ci's floor fix is on main.

## 0. THE PERMANENT RULES. These override anything else in this brief.

1. **NEVER STAGE WITH A DIRECTORY OR GLOB PATHSPEC. NAME EVERY FILE.** No `git add -A`,
   `git add .`, `git add -u`, `git commit -a`, `git stash -u`. Anywhere. Not once.
2. **NEVER print, log, commit or echo a credential.** No bare `git remote` listing, no
   `git remote -v`, no printing of any remote URL. Use remote NAMES only. Canonical's
   origin URL carries a live PAT.
3. **DO NOT DELETE `/workspace/farmtable/web/dist`.** Do not build a frontend anywhere.
   Note `npm run build` is `tsc --noEmit && vite build`, and **vite EMPTIES web/dist** —
   so `npm run build` is forbidden. `npx tsc --noEmit` alone is fine.
4. **CLONE FROM THE LOCAL PATH**, not the network remote.
5. **DO NOT PUSH.** I am the only agent permitted to `git push`. Commit; I push.
6. **AUTH ARCHITECTURE IS OUT OF SCOPE.** The test: does your change alter WHO IS
   AUTHENTICATED, WHAT THEY MAY DO, or HOW THAT IS DECIDED? If yes, STOP and report.

## 1. THE COMMITS. Measure the commit, not the tree.

- **BASE: `2982ffd8f3f6e231d8855b9cae7c448c2bd3144f`** — this is `origin/main`. It is NOT
  `439b309`; main moved 15 commits today. Every figure in any older document was measured
  against `439b309` or `aa08f1a`. **RE-DERIVE, DO NOT CARRY FORWARD.**
- **BRANCH: `e64138c058ad707d2b08b3a213cfa63c17c8e953`** — the rebased task-state tip.
  Durable on the network remote as `refs/salvage/dev-p2-rebase/p2-land`.
- Merge base is `aa08f1ae8ca972f463215f76113c121c4578ce70`.
- Both resolve in `/workspace/farmtable`. Clone from there. They do NOT both resolve
  anywhere else — do not go looking in `/workspace/dev-p2-*`.

## 2. THE CONFLICT SET IS SEVEN. I measured it at YOUR base, not an older one.

```
git merge-tree --write-tree 2982ffd e64138c   -> rc=1, merged tree 42a71d84294421fca73121c6e68be5c9d19fb5ba
awk '$3 ~ /^[123]$/ {print $4}' <output> | sort -u
```
```
web/package-lock.json
web/package.json
web/src/components/inspector/ft-inspector-code.ts
web/src/components/inspector/ft-inspector-meta.ts
web/src/util/safe-url.test.ts        <- CARVE-OUT, DO NOT RESOLVE
web/src/util/safe-url.ts             <- CARVE-OUT, DO NOT RESOLVE
web/src/utils/task-ready.test.ts
```

**READ THE STAGE-NUMBERED ENTRIES, NEVER THE PROSE.** `git merge-tree` prints
`Auto-merging <path>` for files it merged **SUCCESSFULLY**. That output line count is 8,
the true conflict count is 7, and I published the wrong number this morning by harvesting
prose. If you re-measure, use the awk predicate above.

**YOU RESOLVE FIVE.** The two `safe-url` files belong to `farmtable-em-hardening` and are
adjudicated separately. Leave them at **main's version** in your merge, and say so
explicitly in the commit body — this is a deliberate deferral, not a resolution.

### The carve-out has a property that changes how it must eventually be handled

Both safe-url files carry **stages 2 and 3 only — NO STAGE 1.** They are add/add: there is
no merge-base version, both sides wrote them from nothing. Every other conflicted path has
all three stages. Do not attempt a three-way resolution on them; there is no ancestor to
diff against, and the usual resolution silently degrades into a pick-a-side. Not yours to
fix — just do not touch them, and do not let them get silently clobbered.

## 3. NAMED MERGE TASK, NOT A DISCOVERY — the cross-language fixture

`testdata/url-scheme-cases.json` is a FIXTURE. It is **not** a member of the 30-file web
test population, so no web gate will notice it. **It is the CLIENT half of a
cross-language differential pin whose SERVER half is
`TestValidateURLFieldMatchesSharedFixtures` in
`internal/server/urlvalidate_differential_test.go`.**

If the safe-url adjudication lands the branch side and this fixture is not rehomed, the Go
test goes on asserting against a fixture that nothing on the client checks — **present,
executing, and no longer measuring anything, and it STAYS GREEN.** em-ci's membership gate
is structurally blind to it.

**Your job here is narrow:** do not move, rename or modify that fixture, and **report its
exact path and current blob hash at your merge commit** so the adjudication has it. Do not
attempt the rehoming — it depends on a decision that has not been made.

## 4. GIVE `web/src/components/ft-app.ts` AN EYE. This is assigned work, not a note.

It auto-merges cleanly, which is exactly why nobody is looking at it. **AUTO-MERGED IS NOT
THE SAME AS CORRECT.** Main has commits touching the dashboard root since the merge base.
Read the merged result. Confirm the two sides' changes are actually compatible in meaning,
not merely in line position. If they are not, that is a blocker — report it, do not paper
over it. If they are, say so in one sentence naming what each side changed.

## 5. THE FLOOR. Re-derive it; do not carry my number or em-ci's.

`scripts/ci-suite-manifest.mjs` (repo ROOT) enforces `MIN_TEST_FILES`. **Main is now at 6**
(em-ci raised it from 1, derived set-wise at 439b309). em-ci's own instruction: *"Re-derive
at your merge commit; do not carry my 6 forward as if it described your tree."*

The population predicate is the gate's own regex at `:28`, applied at `:75-78`:
`/\.(test|spec)\.(ts|tsx|mts|cts|js|mjs|cjs)$/`. It excludes `web/test/setup.ts` and the
three helpers `web/test/helpers/{dom,feedback,fixtures}.ts` — four non-test `.ts` files, not
one.

**Derive the population from the MERGED TREE with `git ls-tree -r --name-only` plus that
regex. Do not read it out of any prose, including this brief.** My figure at the previous
base was 30; if you get 30, good, but get it yourself.

Then **raise `MIN_TEST_FILES` to the number you derived**, in the merge commit, per em-ci's
rule that a floor is set TO the population.

## 6. HOW TO REPORT ANY RESULT — this is binding and it is the house rule.

**EVERY REPORTED RESULT, ABSENCE OR PRESENCE, MUST NAME SOMETHING THE SAME INVOCATION WAS
EXPECTED TO CATCH, AND REPORT WHETHER IT CAUGHT IT.**

- For an **absence**: name a known-present member the instrument DID return. A zero with no
  known-present alongside it is void and I will ask again.
- For a **green**: name what the run flagged. **IF A GREEN CAUGHT NOTHING AT ALL, IT IS NOT
  A GREEN, IT IS AN UNLIT INSTRUMENT.**
- For anything **counted**: assert the EXPECTED INTEGER before you run it. Never assert
  "results were returned".
- **PUBLISH THE PATH SET, NEVER THE INTEGER.** A count over a list cannot validate the
  membership of the list.
- **NEVER send stderr to `/dev/null` on a measurement.**
- **ALWAYS brace `${rev}:${path}`** in git object arguments. This is zsh; unbraced
  `$sha:path` is parsed as a history substitution modifier and returns a PLAUSIBLE WRONG
  ANSWER rather than an error.
- `grep -c` returns LINE counts, not occurrence counts. They are different integers.

## 7. ACCEPTANCE CRITERIA

- (a) A merge commit on top of `2982ffd` bringing in `e64138c`, five conflicts resolved,
      the two safe-url files left at main's version.
- (b) `npx tsc --noEmit` in `web/` passes. (NOT `npm run build` — see rule 3.)
- (c) The web test suite runs and passes; report enumerated / executed / missing as three
      integers, with the expected value stated BEFORE the run.
- (d) `MIN_TEST_FILES` raised to the population you derived at the merge commit.
- (e) `go build ./...` and `go vet ./...` clean. Note the clean-checkout defect: these can
      fail on a fresh clone because of `web/dist`. If you hit that, report it as
      environment, do not "fix" it.
- (f) Working tree porcelain-clean apart from what you deliberately staged by name.

## 8. THE MERGE COMMIT BODY — specific content required

- **The full population PATH SET you derived (all of them, one per line), with the merge
  commit's own base SHA `2982ffd` named in the SAME SENTENCE as the count.** Not the
  integer alone. This is the whole point.
- The five paths you resolved, each with one sentence on how.
- The two safe-url paths, named, marked DEFERRED TO em-hardening, with the add/add
  no-stage-1 fact stated.
- `testdata/url-scheme-cases.json` named with its blob hash and the sentence that its
  server-side twin is `TestValidateURLFieldMatchesSharedFixtures`.
- The old floor and the new floor.

## 9. DELIVERABLES — you are not done until all four exist

1. The merge commit, committed (NOT pushed) on a branch named `p2-merge-2982ffd`.
2. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-p2-merge-report.md`.
3. **A project log entry** at `.design/project-log/2026-07-29-p2-merge.md`, committed.
   Do not skip this. It is a checklist item alongside "commit your work", not an optional
   extra.
4. A one-message report to me (`agent:farmtable-em-task-state-model-v2`) in the format
   STATUS / BLOCKER / NEXT ACTION, under 20 lines. **No backticks in the message body —
   backticks in a scion message EXECUTE.**

## 10. IF YOU GET BLOCKED

Report to me and stop. Do not improvise around a blocker, do not widen your own scope, and
do not resolve the safe-url files "just to get it building". If two of my instructions
cannot both be satisfied, say so and stop rather than silently picking one — a previous leg
did exactly that and it was the right call.

**YOU MUST PRODUCE ALL FOUR DELIVERABLES IN SECTION 9 AND THEN MARK THE TASK COMPLETE.**
