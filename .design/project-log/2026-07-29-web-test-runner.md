# 2026-07-29 — one shared web test runner

**Branch:** `feat/web-test-runner`, merged; `main` = `aa08f1a`. Landed with
`373ff49` and `c360097` beneath it -- the runner cannot be separated from
`expandRunnerScript` without a knowingly-red intermediate on main.
**Files:** `web/scripts/run-node-tests.mjs` (new), `web/package.json`,
`scripts/ci-suite-manifest.mjs`.

## What was wrong

`npm test` on main was `tsc -p tsconfig.test.json && node --test
.tmp-test/utils/task-ready.test.js`. It **compiled every test file and executed
one**. That was a hotfix to stop main bleeding under node 22, not a design, and
two tracks were blocked behind it: `em-hardening`'s union branch adds four web
test files, `test-xss-r8` seven.

`test-xss-r8` measured the cost on union base `d7154a4`: six web test files
present, one executed, and **deleting `DOMPurify.sanitize` left the suite green
at 1 of 1 passing**. A suite that certifies a removed sanitiser is worse than no
suite, because an absent guard everyone believes in is the worst of the three
states.

## The node matrix is the constraint

There is no spelling of `node --test` that works on both versions this project
runs. Measured 2026-07-29 at the `7a2ad51` tree, node 20.20.2 (every agent
container) against node 22.23.1 (`ci.yml` `NODE_VERSION`, and the runner):

| positional | node 20.20.2 | node 22.23.1 |
|---|---|---|
| `.tmp-test` / `./.tmp-test` / `tmp-test` | exit 0, 1 pass | exit 1 MODULE_NOT_FOUND |
| `'.tmp-test/**/*.test.js'` | exit 1 ENOENT | exit 0, 1 pass |
| none | runs the compiled `.js` | runs the `.ts` SOURCE and fails it |
| explicit `file.js` | exit 0, 1 pass | exit 0, 1 pass |

**The last row is the only agreement.** So discovery cannot be delegated to
node's CLI: it happens in JavaScript, where it means the same thing on every
version, and node is handed explicit paths and nothing else. Row 1 is what CI
run 30458935255 cost. Note rows 1 and 2 also refute the two most natural
guesses — it is not the leading dot, and a glob is not portable either.

`web/scripts/run-node-tests.mjs` is adopted from em-task-state **by content**
rather than rewritten, per instruction. One substantive change, and it is the
single place their version was not adopted:

```js
// theirs, still present at a036807 / blob bceae783
if (sources.length === 0) { console.log('…nothing to compile.'); process.exit(0); }
```

**Zero discovered files exited 0.** That is the vacuous pass in its purest form
— an empty suite reporting success — so here it exits 1. Anyone adopting their
copy wholesale reintroduces it.

## The reconciliation design

`present` — the population — is a git scan and is never derived from a runner.
That independence is the whole yardstick: a runner that under-reports must fail
the gate, not redefine it.

Against that, a runner is established two ways, never one:

- **Preferred — ask it.** `--list` makes the runner state its own files. The
  claim is *not* self-certifying and never stands alone: it is reconciled
  against `tsc -p <cfg> --showConfig` (TypeScript's own expansion) **and**
  against `present`. Residue in any direction is fatal.
- **Fallback — read it.** For a runner offering no list, the source walk is
  parsed and cross-checked against tsc. Weaker, and printed as such.

`--list` is only ever passed to a runner whose source advertises the flag.
Passing it to one that does not would not list anything — it would **run the
whole suite**, during a check whose entire job is to not need the suite.

This replaced the previous design, which parsed the runner's discovery logic
with a regex. A four-suffix walk is not a shape a regex should chase, and a
wrong answer there is worse than a refusal.

### The coupling

`TEST_SUFFIXES` in the runner and `include` in `tsconfig.test.json` are **one
object written in two files**. A file in one but not the other compiles and
never runs, or runs and never compiles — silently, both ways. They are now
compared on every build and a divergence fails. Both sides carry all four
patterns (`.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`); the runner also
derives its emitted suffixes from that one list rather than restating them.

**There are THREE sites, not two**, and the third is the one that gets missed:

| site | decides | here |
|---|---|---|
| 1 | what is **compiled** | `include` in `tsconfig.test.json` |
| 2 | what is **counted** | `TEST_SUFFIXES` |
| 3 | what is **run** | the walk over compiled output |

Site 3 is the execution loop's own walk. Widen 1 and 2 but not 3 and a
`.spec.tsx` is compiled, discovered, then **fails the runner's count check and
exits non-zero before executing** — red whether the widening worked or not.
That is a positive control confirming itself, and em-task-state's leg came
within one commit of shipping exactly that.

Here site 3 is **derived** rather than restated:

```js
const EMITTED_SUFFIXES = [
  ...new Set(TEST_SUFFIXES.map((suffix) => suffix.replace(/\.tsx?$/, '.js'))),
];
```

so widening site 2 widens site 3 automatically and they cannot drift. That
leaves two things to keep in step (1 and 2), which the manifest enforces,
instead of three kept in step by remembering. em-task-state reached the same
three-site conclusion independently at `a036807`, with a third hand-maintained
pattern (`OUTPUT_RE`) and a docblock instructing the reader to widen all three
together — same coverage, one more place to forget.

**Measured, not asserted** (their counterfactual, run here on
`canary/runner-spec-executes`, clean tree, node 20.20.2):

| site 3 | result |
|---|---|
| derived (as shipped) | exit 0, `# tests 2 # pass 2`, **marker present** |
| narrowed to `['.test.js']`, sites 1+2 left at four | exit 1, *Expected 2 compiled test script(s), found 1*, **marker absent** |

### The gap this leaves, stated rather than smoothed

Under that same counterfactual **the manifest stays GREEN** at
`enumerated=2 executed=2 missing=0` while `npm test` goes red. `--list` reports
**discovery**, which happens before compilation, so a narrow site 3 is invisible
to the gate. It is caught only by the runner's own count assertion.

It fails closed — CI still reds at *Web tests* — but the manifest's `executed`
is a claim about what will be **discovered**, not about what will **run**, and
under a narrow site 3 it over-credits. Main is safe because site 3 is derived;
nothing in the gate enforces that it stays derived.

**A limit found while building the positive control, not fixed here.** The
`.tsx` patterns are wired for *discovery*, but `web/tsconfig.json` sets no `jsx`
option, so a `.tsx` file containing **actual JSX** does not compile:

```
error TS17004: Cannot use JSX unless the '--jsx' flag is provided.
```

Measured directly. So `.tsx` test files work today only without JSX syntax, and
the `canary/runner-spec-executes` control is deliberately JSX-free — the
extension is what is under test there, not JSX. The first person to write a real
JSX test hits a compiler configuration question, which is a `tsconfig` decision
and out of scope for this branch. Recorded so it is found by reading rather than
by surprise.

### The double-count invariant

`TEST_FILE_RE` matches `.js`/`.mjs`/`.cjs`, so compiled test output is a test
file *by name*. It stays out of `present` today only because `web/.tmp-test/` is
gitignored at `.gitignore:46` — an accident of another file, not a decision.
Point `outDir` anywhere git can see and `present` roughly doubles, counting each
test once as source and once as artefact. **That direction still looks safe,
because the floor is more satisfied than before**, which is exactly why it is
now asserted rather than assumed. The outDir is taken from tsc, not a hardcoded
name, so a rename cannot step around it.

### The floor message

The remedy line used to end `lower MIN_TEST_FILES in the same commit` — telling
a contributor who has just lost a suite by accident how to silence the alarm.
It now opens with *find them*, gives the two commands to do so, and frames
lowering as a separate deliberate act belonging to the commit that deletes a
suite. Raising is named as what a new suite requires. The three integers stay.
The predicate for one unit of `MIN_TEST_FILES` is now stated in the file.

## Evidence

**Primary is the mutation arm**, not the canaries: it does not break the gate or
the harness, it breaks the **subject** and asks whether anything notices. The
OLD-wiring arm is the positive control — without it a red only shows the suite
*can* fail, not that this runner is why.

### A control must have different outcomes under its two hypotheses

This is the property that makes the whole table below mean anything, so it is
written here rather than left to be re-derived.

**A positive control that is red under both hypotheses is not a control.** If
both branches of the question produce the same colour, the observation carries
no information and ticking it off is worse than not running it, because it
manufactures confidence. State both outcomes *before* running, and if they are
the same colour, the experiment is wrong — not the subject.

The mutation control, in one line:

> **OLD wiring + sanitiser deleted = GREEN**, because the test file compiles and
> never runs; **NEW wiring + sanitiser deleted = RED**. Two different colours,
> so the red is attributable to the runner rather than merely to the suite being
> capable of failing.

The `.spec.tsx` control, in one line:

> **Widening works = GREEN `2/2/0` with the file's own stdout marker in the log;
> widening does not work = RED at membership, or green counts with no marker.**
> The spec is written to **pass** on purpose: a *failing* spec would trip the
> runner's source-vs-compiled count check and exit non-zero **before executing
> anything**, going red under both hypotheses and proving nothing. That trap was
> found by reading on another track, not by any check here.

Note the second failure mode in each: *green counts with no marker*. Counting
alone cannot separate compiling from executing, which is the exact confusion
that made the union branch dangerous, so every execution claim in the table is
backed by a marker in stdout rather than by a number.

All rows below: this branch's content, node version named, tree **deliberately
dirty** (a canary is a planted defect). Per the measure-the-commit rule these
are **iteration, not evidence**; the committed canary branches are the evidence.

| # | Planted | node | OLD wiring | NEW wiring |
|---|---|---|---|---|
| **MUT** | sanitiser intact | 20 | exit 0, `# tests 1`, marker **absent** | exit 0, `# tests 3 # pass 3`, marker present |
| **MUT** | **sanitiser deleted** | 20 | **exit 0, GREEN — mutation SURVIVES** | **exit 1, `# pass 2 # fail 1`** |
| **MUT** | sanitiser deleted | 22 | — | **exit 1, `# pass 2 # fail 1`** |
| i | 2nd test file | 20 & 22 | — | GREEN `2/2/0`; both markers in the log |
| ii | `.test.mts` nothing runs | — | RED `2/1/1` | **RED `2/1/1`** |
| iii | empty population (scratch index) | — | RED, remedy reads *lower the floor* | **RED, remedy reads *find them*** |
| iii | zero files, runner directly | 20 & 22 | — | **exit 1** both, and `--list` exit 1 |
| iv+ | `.spec.tsx` both sides agree | 20 | — | GREEN `2/2/0`, marker present |
| iv | `.spec.tsx`, runner drops the suffix | 20 | — | **RED** *compiled-but-not-listed*, marker absent |
| v | `outDir` → `.test-build` | — | — | **RED**, `enumerated=2` for one real test |

Row **MUT/deleted** is the finding: under main's wiring the sanitiser can be
deleted and the suite stays green; under the runner it goes red. That is
`test-xss-r8`'s N=6 result reproduced at N=2 and closed.

Rows i and iv+ check the marker in stdout, not just the count — **compile
versus execute is the whole distinction**, and a count cannot separate them.

Row iv also fired at a second layer: the runner's own
`compiled.length !== sources.length` assertion refused independently of the
manifest.

Row **iii** is worth noting for a reason it was not designed for: with the file
deleted on disk but still in the index, `present` still counted it, giving
`enumerated=1 executed=0 missing=1` — red, and correctly so. Only a scratch
`GIT_INDEX_FILE` produced a true empty population. Unstaged deletion is not a CI
condition, but it fails closed, which is the right direction.

Every canary was restored from a pre-canary copy and each restoration verified
with `cmp`; `git status --porcelain -uall` returned to the three intended
entries after each.

## Runner-confirmed versus dev-only

Everything in the table above was measured in a dev container, which cannot
prove a gate on the runner — the entire lesson of the node-22 outage. Per the
measure-the-commit rule each canary is therefore **committed** to a throwaway
branch, so CI measures a commit rather than anyone's tree. EM-CI pushed them.

| branch | predicted | runner result | run |
|---|---|---|---|
| `feat/web-test-runner` → **merged, `main` = `aa08f1a`** | GREEN `1/1/0` | **SUCCESS**, `enumerated=1 executed=1 missing=0` | 30462451008 |
| `canary/runner-mutation-intact` | GREEN, marker in log | **SUCCESS** | 30462438729 |
| `canary/runner-mutation-deleted` | RED at "Web tests" | **FAILURE at "Web tests (invoked directly)"** | 30462441196 |
| `canary/runner-orphan` | RED at membership | **FAILURE at "Which JS suites will actually run"** | 30462444127 |
| `canary/runner-zero-files` | RED at membership, on the floor | **FAILURE at the same step** | 30462446322 |
| `canary/runner-spec-divergence` | RED, compiled-but-not-listed | **FAILURE**, log names `compiled-but-not-listed [web/src/utils/canary-widget.spec.tsx]`, `enumerated=2 executed=0 missing=2` | 30462447826 |
| `canary/runner-spec-executes` | GREEN `2/2/0` **and the marker** | *awaiting push* | — |

**Six for six, each red on its intended step and for its named reason** — a
generic red would have proved much less. `canary/runner-mutation-deleted`
failing at *Web tests* rather than at membership is the load-bearing one: the
mutation is killed by the suite actually executing, on the runner, under node
22.

**Canary v (`outDir`) cannot be confirmed on the runner** and is dev-only by
construction: membership runs at `ci.yml:85`, `npm test` at `:245`, so no
compiled output exists when the assertion is evaluated. Stated rather than
quietly dropped.

`main` stays at `enumerated=1 executed=1 missing=0`, floor 1, and `npm test` is
exit 0 `# tests 1 # pass 1` under **both** node 20.20.2 and node 22.23.1.

## Not measured here

`em-hardening`'s `xss-url-scheme-union` @ `789314a` is still not present in local
canonical — no matching branch, and `789314a` is not a valid object — so nothing
is claimed about it. `test-xss-r8`'s `d7154a4` figures are quoted from their
report, not re-measured by me.
