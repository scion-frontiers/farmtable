# dev-xss-r4 — fix round 4, url-scheme-validation-r2

Branch `url-scheme-validation-r2`, current head
`6805daa32aa67992bb26a4e66bd9d102bbf6fa53`.

Do not take a filesystem path from this brief. Confirm your tree with
`git rev-parse --show-toplevel` and `git rev-parse HEAD`; HEAD must be `6805daa`.
If it is not, stop and say so. **The branch name is not an identifier; the SHA
is.**

Read `_xss-r3-baseline-block.md` in this directory first, in full. Its §1–§6
apply to you unchanged — same tree, same gates, same evidence discipline, same
fence. Its §7 describes the round you are fixing. Two deltas:

- **§2's gate table I re-measured myself, this session, in your tree, with zero
  other legs running.** Every row reproduced exactly, including
  `PASS: 4 test file(s), 315 assertions.` That 315 is load-bearing for X4.
- **§0's open pass**: do one, but you are a fix leg, so keep it short. The
  question for you is narrower: *before you start fixing, is there anything in
  this diff that all three review legs missed?* Write it first, then fix.

Three independent legs reviewed `0bc9b72..6805daa`. **Read all three in full
before you touch anything.** All three say REQUEST CHANGES.

- `/scion-volumes/scratchpad/projects/farmtable/reports/review-xss-r3.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-xss-r3.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-xss-r3.md`

---

## What this round is, and it is not round 3

Round 3 was "the measurements are right and the sentences above them are wrong."
Round 4 is worse and simpler. The test leg framed it, and I am quoting it in
full because it is the most accurate sentence anyone has written about this
branch:

> The diff ships three new meta-oracles (a URL-binding scanner, an adapter-key
> source scanner, and a test-runner consumption gate) which are now the only
> thing standing behind large parts of the property, and **two of the three have
> measured fail-opens of exactly the class this round was convened to
> eliminate.**

Carry the auditor's fenced note alongside that, because it sets your urgency
correctly:

> **None of the three is a live vulnerability. All three are the instruments
> this diff exists to install, failing open.**

So: nothing here is on fire. Everything here is a control that does not control.
You are not patching exploits, you are making the instruments able to fail.

---

## Deliverable 0 — reproduce the decisive experiment BEFORE you fix anything

The test leg wrote a **new component**, added it to the allow-list with
`viaSafeHref: true`, and had it assign the guarded value and then overwrite it:

```ts
export function renderProbeLink(url: string) {
  let href = safeHref(url);
  href = url;
  return html`<a href=${href} target="_blank" rel="noopener" class="probe-link">probe</a>`;
}
```

Measured result:

```
$ npm test
url-binding-scan: ok
PASS: 4 test file(s), 320 assertions.
EXIT 0
```

**A live unguarded `href`, suite green.** Reproduce this yourself, with your own
control (the same file with the second line removed must be green for a
different reason, and the same file with the *first* line removed must be RED).
Report the measurement before you write the fix.

If it refutes, stop and say so — a refutation is the more valuable result and
five of the eight items below are built on top of it.

---

## The blocking set

Eight items. X2 and X3 are the two that matter most; X1 is the one that decides
whether any of it means anything.

### X1 — nothing runs `npm test`. Break the build at `make test`.

*audit F1, HIGH. **I verified this myself rather than accepting it**, and I am
telling you that so you weight it correctly: this one is not a claim.*

- `Makefile:9-10` — `test:` is `go test ./...` and nothing else.
- `Makefile:16-17` — `web:` is `cd web && npm ci && npm run build`.
- Both `Dockerfile` and `Dockerfile.server` run `npm ci` and `npm run build`.
  Nothing else.
- Repo-wide `git grep "npm test"` returns **only prose, in three project-log
  markdown files.**

So `d92ae5e` — the whole consumption-gate commit — is a genuine improvement to a
link in a chain that is **already severed upstream.** Every instrument this
branch installs is currently unreachable by any automated path.

The absence of CI is fenced and tracked (#22) and is **not** what I am asking
you to fix. What is in scope and blocking: **`make test` must run this branch's
own guard.** Split the target so the web suite runs, add `npm test` to both
Dockerfiles so the release path cannot ship a tree whose guard is red, and say
so in `CLAUDE.md` where the build commands are documented.

If adding `npm test` to the container build is the wrong call for a reason you
can measure — image size, `node_modules` availability at that stage, build time
— **say so and do the Makefile half only.** Do not silently drop it.

### X2 — the scanner asks the wrong question. `.some()` must become "no line is unguarded."

*review RQ-2 and test O-3, found independently by two legs on different routes,
both HIGH. This is deliverable 0's defect.*

`web/src/util/url-binding-scan.test.ts:792-794`:

```ts
const block = enclosingBlock(lines, finding.lineNo).map((l) => blankNonCode(l));
assert(
  block.some((l) => assignsFromSafeHref(l, id!)),
```

The predicate is **existential over the block**. It asks whether *some* line
guards the identifier. The property it must enforce is universal: **no line in
the block may assign that identifier from anything other than `safeHref`.**
Round 3 fixed the single-line spelling of this (`safeHref(url) || url`) and left
the multi-statement spelling wide open.

The fixture corpus cannot see this either, and that is the second half of the
defect. `:619-633` — the `notGuarded` table — has **ten entries and every one is
a single line.** A fixture set that cannot express a two-statement function
cannot falsify a scanner that is only wrong across two statements. That is
taxonomy form (2) sitting directly underneath form (1).

So: invert the check to a universal, **and** add multi-statement rows to both
the `guarded` and `notGuarded` tables — reassignment after guard, conditional
reassignment, reassignment inside a nested block, and a `let` that is guarded on
one branch and bare on the other. The fixtures are as blocking as the predicate.

### X3 — the shallow walk, as ONE item at FOUR call sites

*review RQ-1 + test O-1/O-2 + audit F4/F5. Three legs, four sites, one defect.*

`sanitizeRemoteData` recurses one level. Nested URL carriers survive it. The
test leg and the review leg independently drove a nested `sub_issues[0].url`
**to the wire** on the import path.

The four call sites:

- `sanitizeRemoteData`
- `validateImportedTaskURLs`
- `collectionToProto`
- `taskExport`

**The deliverable is not "patch four sites." The deliverable is that the
enumeration becomes TRUE.** `urlvalidate.go:100-109` currently documents an
invariant it cannot hold — it says the adapter-written key set "IS finite" and
enforceable, and `remoteDataLiteralKeysIn` (see X6) does not actually compute
that set. Fix the mechanism so that arbitrary nesting is handled by
construction, then make the comment describe what the code does.

Note for scoping: a sync-comment against an unbounded set is not satisfiable.
That exact lesson was item B1 of the round-3 brief, and the round-3 fix replaced
a list with a predicate but left the *depth* unbounded. Do not repeat the shape
one level up.

### X4 — pin the absolute suite total

*test leg, HIGH. One assertion kills three separately demonstrated forgeries.*

The suite total is unpinned, and the test leg demonstrated three independent
ways to forge it green:

| mutant | mechanism | reported total |
|---|---|---|
| MT1-2 | `count + 1000` | 4315 |
| MT1-6 | freeze the counter above 20 | 59 |
| MT3-1 | forged `#assertions 47` via `writeSync`, harness never imported | 362 |
| MT1-5 | `must()` gutted — **count-neutral** | 315 |
| MT1-1 | `assertEqual` uses `!=` | 315 |

`assert(total === 315)` kills the first three outright.

It does **not** kill MT1-5 or MT1-1, and I want you to state that plainly rather
than let the pin imply more than it buys. Those two are count-neutral
corruptions of the harness itself. This is the third consecutive round in which
the count-neutral bar has climbed a level — it reached the fixture corpus and
then the assertion harness, and **the regress does not terminate.** Pinning an
absolute total at the outermost level is where you stop, not because it is
complete but because it is the last level that exists. Say that in the comment.

### X5 — anti-vacuity must bind DIRECTORIES REACHED, not file count

*audit F7 + test MT3-2, HIGH.*

`url-binding-scan.test.ts:713-716` sets `MIN_FILES = 40` against a measured 52
files. The test leg skipped `store/`, `gen/` and `kanban/` — **11 of 52 files** —
and needed **no padding at all**: the walk still returns 41, the floor is 40, all
three named witnesses at `:725-729` are still reached, and the assertion count is
unchanged at 315. Green. MT3-2b then planted a **real unguarded `href=${raw}`**
in `store/` and the suite stayed green. That is exploitable, not theoretical.

Twelve files of slack under the floor is the whole defect. The witness list is
the right idea and is three files deep; it needs to bind the **directory set**.
Enumerate the directories under `web/src` and require the walk to reach every
one of them, or require the file count *per directory*. A floor on a total is
blind to a redistribution.

### X6 — `remoteDataLiteralKeysIn` mis-parses exactly what ent generates

*test O-7.*

Three defects, one of which is not hypothetical:

1. It misattributes nested keys under `map[string]interface{}{`. **That is the
   literal shape ent generates** — see `internal/store/ent/task.go:60`:
   `RemoteData map[string]interface{}`. So the scanner is wrong about the type
   it will most often meet.
2. One-line literals are not handled.
3. `internal/server/server.go:660-669` is not scanned at all — and it is a real
   `RemoteData` writer, populating `remote_id` and `remote_url` from request
   fields.

Fix by whichever route you judge best. **If text-scanning Go source is the wrong
tool here, use `go/ast` and say so** — an unanalysable-by-text shape is a signal
to change tools, not to add another regex. Add negative fixtures either way: the
scanner needs inputs it must *reject*, and it currently has none of the shapes
above.

Then correct `urlvalidate.go:104-107`, which presents a **lower bound as a set**.

### X7 — two scanner correctness defects

*review RQ-3 and RQ-5.*

- `blankNonCode` must hard-fail on unbalanced braces rather than proceeding with
  a mis-identified region. A pre-pass that silently mis-parses makes every
  assertion downstream of it meaningless, and it does so quietly.
- `noteDeclaresBaseDependence` is inverted.

### X8 — the second structpb rejection cause, and the severity framing

- `issueBuildRemoteData` writes `[]string`, `structpb.NewStruct` rejects it,
  `convert.go` discards the error with `_`. Round 3 pinned the resulting `nil`.
  There is a **second** rejection cause on the same path (`sub_issues`). Handle
  both, or handle the class.
- The round-3 narrative says `remote_data` never reaches a client. **Test O-9
  refutes the framing it was used for**: `Task.remoteData` is read by *nothing*
  in `web/src`. That makes the r2 HIGH latent rather than live — which is the
  auditor's call and it stands — but it also means the client-side scrub is not
  the compensating control anyone thought it was. Correct any comment that
  states or implies otherwise.

---

## Cheap, same round, not worth their own round

- **`docs/url-policy.md` does not exist** and the only in-tree statement of URL
  policy lives in a test fixture's `_README` (#160). Move it to `docs/`. Do not
  expand its scope — after the `#195` merge there will be three policies and
  reconciling them is tracked as a merge seam (#115) and is **not yours**. Write
  what is true of *this* branch and date it.
- The comment at `ft-inspector-desc.ts:232` says *"renderMarkdown sanitizes with
  DOMPurify before this HTML is injected."* That is true and insufficient — see
  the escalation below. Do not fix the sink. Do make the comment stop implying
  the policy is closed.

## Not blocking — tracked, do not fix

- **The two widest-policy sinks in the tree**, `ft-inspector-desc.ts:233` and
  `ft-inspector-comments.ts:221`, both `unsafeHTML(renderMarkdown(...))`, both
  with **no test at all**, and DOMPurify's default config permits
  `//evil.com/login` — so a task description renders a live off-origin anchor
  today. Measured by the test leg as O-10. **Escalated and routed to the `#195`
  markdown track (#163).** It is real, it is live, and it is not this branch.
- CSP absence (#85), the `web/dist` clean-checkout defect (#100), the four
  `go vet` copylocks, the `#194` and `#195` branches, the merge seam (#115).

---

## Method

Everything in the baseline block's §3 applies. Three things specific to you:

- **The flake is characterised now, and it is worse than the number you have
  been given.** 200 sequential runs: 9 failures, **4.50%**, Wilson CI
  [2.39%, 8.33%], and it is **five different test names**, not one — all at
  5.00–5.01s, which is what makes them recognisable. Every mutation row you
  record must be re-run on RED before you call it killed. A single-run 27-row
  matrix is ~71% likely to contain a spurious RED, and **a spurious RED reads as
  "mutant killed", so the bias is toward flattering the suite.** Match the
  failing test **name** — and note the names share the `TestWatchTasks_` prefix,
  so matching the literal string `TestWatchTasks` finds nothing.
- **Record green controls at equal weight.** "I checked X and X holds" is a
  result.
- Commit in logical increments. If scope balloons past what one branch should
  carry, stop and say so rather than pushing through.

## Deliverables

1. §0 open pass, short, written first.
2. Deliverable 0's reproduction of the `renderProbeLink` experiment, with both
   controls, **reported before any fix for X2.**
3. X1–X8 fixed and committed locally in logical increments. For X1, if you drop
   the Dockerfile half, the measured reason.
4. A mutation table for every new or strengthened pin, **each row re-run on
   RED**, and each including its count-neutral corruption — count held fixed,
   identity corrupted, result. A pin that only reacts to a count does not land.
5. For X5, the specific evidence that the directory-skip mutant is now RED.
6. A numbered list of everywhere this brief is wrong. **Required.** Legs have
   found 5–11 errors per brief for twenty-four consecutive rounds. Two known
   candidates to check first: I have re-resolved every citation above against
   the tree myself this session, so the *paths* should hold — which means if one
   is wrong it is wrong in a way I could not see, and I want to know. And my
   claim that `assert(total === 315)` kills exactly three of five mutants is my
   arithmetic on someone else's table, not my measurement.
7. A project log entry at `.design/project-log/`.
8. **A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-xss-r4.md`**,
   carrying items 1–6. This is not optional and it is not the same artefact as
   the project log: the next round's three review legs are pointed at this file
   and read it as your account of what you did. Work that is not in it did not
   happen.
9. `git status --porcelain` shown empty at the end, with any dirty cells listed.

Do not push. Commit locally only.

You MUST write the project log entry and commit your work, and then mark the
task complete.
