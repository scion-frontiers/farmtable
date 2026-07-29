# XSS / Phase 2 — ROUND 6 FIX LEG

**Dispatched by the eng-manager, 2026-07-29 ~05:40Z.** One leg. Bounded. Adjudicated from three
independent review reports plus one arbitration measurement.

---

## 0. THE TREE

| | |
|---|---|
| Branch to create | `url-scheme-validation-r6` |
| **Base** | **`d305391`** (tip of `url-scheme-validation-r5`, 13 commits from `e6bda71`) |
| Your worktree | **`/workspace/farmtable-xss-r6-fix`** — created for you, **NOBODY ELSE MAY SHARE IT** |
| Push | **NEVER.** The eng-manager is the only agent permitted to `git push`. |

**ENVIRONMENT, MEASURED BY ME AT 05:41Z BEFORE HANDOVER — verify, don't trust:**
`HEAD=d305391ee6dc473f5e7bf202167221e15cf52e10`, branch `url-scheme-validation-r6`,
`git status --porcelain` **empty**, `git diff url-scheme-validation-r5 url-scheme-validation-r6`
**empty** (identical trees, you are the only thing that will change that).
**`web/dist` is PRESENT** — I copied it in from the r5 tree, because a fresh worktree does not carry
gitignored build output and `assets.go`'s embed makes a root `go build ./...` fail without it.
**That failure mode is pre-empted, so if a root build fails for you it is a real signal.**
Print `git rev-parse HEAD` in the same command as any measurement you report. **I verified a
finding against the wrong tree this round and only caught it because the SHA was in the output.**

`reports/` **IS NOT IN THE REPOSITORY.** It is on the scratch volume. Write reports there and
**do not `git add` it.** Project-log entries **are** in-tree, at `.design/project-log/`.

**Before any commit:** `git rev-parse --abbrev-ref HEAD`. If it prints `url-scheme-validation-r5`,
**STOP** — you are on the reviewed ref and it must not move.

---

## 1. WHAT THIS ROUND IS, STATED FROM THE DIFF AND NOT FROM A THEME

**READ THIS FIRST. MY LAST BRIEF GOT IT WRONG AND IT COST AN AUDITOR MOST OF A BUDGET.**

I told the r5 legs "sanitization was extended to every write site and every depth." **That was
false.** Measured: `urlvalidate.go`'s r5 diff is **comment-only**, and the entire production
behaviour change in those 13 commits is **one substitution** in `convert.go`:

```
pt.RemoteData, _ = structpb.NewStruct(sanitizeRemoteData(t.RemoteData))
  ->  pt.RemoteData = structOrNilLoggingErr(sanitizeRemoteData(t.RemoteData), "task.remote_data")
```

The recursion and write-site coverage **already existed at `e6bda71`**. r5 documented, tested and
instrumented them. **The code is close to right. What blocks is what it says about itself.**

**Round verdict: REQUEST CHANGES**, 2 of 3 legs. The audit leg returned APPROVE with no
CRITICAL and no HIGH, and explicitly does not contest the other two.

---

## 2. HARD CONSTRAINTS

- **DO NOT PUSH. EVER.**
- **BUILD FENCE IS LIVE, PROJECT-WIDE.** TOKEN REQUIRED for `go build ./...`, `go vet ./...`,
  `go test ./...`, `npm test`, `make build`, `make test`. **EXACTLY ONE TOKEN EXISTS AND I HOLD
  IT. ASK AND WAIT.** No token needed for `go test ./internal/<pkg>/ -run '^TestName' -count=1`,
  **but append to `reports/_run-queue-log.md` BEFORE you run, with ROOT and DIST columns —
  mandatory even on passing lines.**
- **Shell is zsh 5.9.** Unquoted globs are a fatal expansion error. `${PIPESTATUS[0]}` is empty;
  the array is `$pipestatus` and it is **1-indexed**. `grep` is ugrep. A check whose success
  condition is *no match* exits 1 when clean — **never wrap it in `|| true`.**
- **NO BACKTICKS IN A `scion message`.** They execute.
- **`main` is RED** (a detached goroutine on `context.Background()` in `TestListUsers`). A full-suite
  red is ambiguous. Prefer single-package runs and say what you ran.
- **`web/dist` is gitignored**, so a fresh clone cannot `go build ./...` from the root. Single-package
  runs of `./internal/server/` are unaffected — `assets.go`'s embed lives in the root package.
- Report to **`eng-manager`** only.

---

## 3. THE BLOCKING WORK

### B1 — `collectionToProto`'s "THIS LOG LINE CANNOT FIRE TODAY" is false, and its citations point at the wrong entity

Two legs found this independently. `entstore.go:408` and `:898` are the **Task** Create/Update
`SetRemoteData` sites. The real Collection writers are **`CreateCollection` (:1366)** and
**`UpdateCollection` (:1399)**, uncited. Only `:2117` is genuine.

**Worse than a stale pointer: the wrong line numbers RESOLVE**, to plausible `SetRemoteData` calls,
so a reader who responsibly checks gets *false confidence*.

The review leg **falsified the stated reason** by passing a Go-native `map[string]string` into
`CreateCollection` and **firing the line**. The conclusion survives but for a different and stronger
reason: **no in-tree caller populates `CreateCollectionParams.RemoteData` at all** — a *caller*
property, not a *type* property.

**Fix:** replace with the caller-property reason, cite `:1366` and `:1399`, downgrade
"CANNOT FIRE TODAY" to **"has no caller today"**, and **name the invalidating event** (someone
setting that field).

### B2 — Two comments in the same file give opposite epistemic verdicts forty lines apart

`structOrNilLoggingErr`'s doc says *"I am NOT recording that as unreachable. Two searches were
clean, and a clean search is not a bound."* Forty lines later the call site says
**"THIS LOG LINE CANNOT FIRE TODAY."** As shipped **the file argues with itself**, and a reader
resolves it by whichever they read second. **Pick the first, refined per B1.**

### B3 — The new log line fires once per task on every passthrough read

`labels` is unconditional and `issueLabels` returns `make([]string, ...)` (never nil), so
**every** passthrough task fails conversion and logs. `defaultPageSize` 50, cap 200 →
**50–200 identical lines per list call**, constant message, **no task ID, no issue number, no key**.
Any authenticated user browsing a passthrough collection triggers it. **Phase 1 is LIVE IN
PRODUCTION — this ships straight into a real log pipeline.**

Three legs converged here (review R6, audit F2, test B-2).

**Fix:** do NOT remove the log — making the drop audible is right, and "disable the control" is
never the fix. Log once per call (accumulate a count in the list handler) or gate behind a
rate limiter. **Include the offending key.**

> **A COUNTER ALONE IS NOT ENOUGH.** Keep at least one *sampled* log line. The constant message
> naming the offending Go type is what makes the next carrier change **diagnosable** rather than
> just visible as a number going up.

**And pin it.** Today, deleting the `log.Printf` entirely leaves the suite **GREEN** —
`TestMapStringStringStaysUnrepresentable_GuardsO1` already *prints* the line and never looks at it.

### B4 — Rewrite `remoteDataAssignment` over `go/ast`. This is the ruling, and it is wider than the leg proposed.

`remotedata_depth_test.go` added ~150 lines of hand-rolled lexing (`maskGoLiterals`,
`remoteDataAssignment`, `firstTopLevelSeparator`). **In the same package**, already at the base
commit, `urlvalidate_differential_test.go` carries a section headed *"WHY THIS IS AN AST WALK NOW,
having been a line scanner"* which lists three measured failure modes and concludes **"a text-scan
of Go source was the wrong tool."** `go/ast` and `go/parser` are **already imported there.**

The new scanner **reproduces failure mode two off that very list.** Measured, two controls green —
these four ordinary, gofmt-stable shapes are **SILENT MISSES**, not reported violations:

| shape | result |
|---|---|
| `p := store.CreateTaskParams{RemoteData: rd}` | SILENT MISS |
| `use(&pb.Task{RemoteData: raw})` | SILENT MISS |
| `return store.ImportTask{RemoteData: t.RemoteData}` | SILENT MISS |
| `}, RemoteData: raw})` (line begins with a closer) | SILENT MISS |

Mechanism: `remoteDataAssignment` splits at the **first** top-level separator and inspects only the
text to its left, so a single-line composite splits at `:=` and the left side is just `p`.
`firstTopLevelSeparator` tracks bracket depth per line, so a closer-first line goes to `depth == -1`
and the `:` arm's `if depth != 0 { continue }` skips it.

Meanwhile its doc comment claims **"shapes nobody has thought of are all visible without being
predicted."** **Measured false.**

**Why the rewrite and not the cheap fix.** This is the **FIFTH** hand-written scanner in this
project, and a prior round already established that **not one fail-open in any of them was ever
caught by anything above a human reading source.** The precedent, the tooling and the reasoning
were all already in this package.

> **YOUR RED-TO-GREEN TARGET: the four shapes above become the first four rows of the new
> scanner's table and must go from MISS to SEEN.** This is a rewrite with a failing test, not a
> refactor. **You may not declare victory by producing a scanner that compiles.**

Note the author's diagnosis in `5b7dae4` was **right** — it rejected widening the regex because
that "moves the blind spot instead of closing it." Correct reasoning, wrong branch taken off it.

### B5 — `TestEphemeralGraphRouteDropsRemoteData` never calls the graph route

It constructs `taskToCreateParams` directly then calls `ephemeral.CreateTask`/`GetTask`. It never
calls `loadEphemeralStore`. So it **could not fail** if `loadEphemeralStore` acquired a second way
to populate `RemoteData`. **Fix:** drive the assertion through `loadEphemeralStore` against a seeded
source store, **or** rename to `TestTaskToCreateParamsOmitsRemoteData` and state that the rest of the
route is unmeasured. The two existing controls are real and should be kept.

### B6 — Count-shaped pins are blind to count-neutral corruption

Slack table measured: `starred < 5` (pop 6), `sites < 6` (pop 8), `rejects < 5` (pop 7),
`no < 3` (pop 5). Deleting a starred row → GREEN. **And a count-NEUTRAL swap → GREEN**: replacing
the `"* index target"` row body with a duplicate of `"* selector target"`, count unchanged.
In the same file that memorialises being *"missed by a unit."*

**Fix:** membership and absolute per-axis assertions, not floors.

### B7 — `sub_issues` is UNMEASURED, NOT CLEARED. **THIS NEEDS A NEW FIXTURE, NOT A NEW ASSERTION.**

`issueNodeJSON` sets `"subIssues": {"nodes": [], "totalCount": 0}`, and `sub_issues` is written only
under `if len(issue.SubIssues.Nodes) > 0`. **That branch has never executed in any test.** C-1 is a
two-carrier property and **exactly one carrier has ever been exercised end-to-end.** Carrier 2
exists in the suite only as hand-typed literals.

> **IF YOU ADD AN ASSERTION AGAINST THE CURRENT FIXTURE IT WILL PASS VACUOUSLY AND BANK A SECOND
> LUCKY GREEN.** The fixture *cannot reach* the branch. No amount of running the existing suite
> will ever exercise it.

**Build one new fixture with non-empty `subIssues.nodes` and fill the 2×2:**

| labels | sub_issues | expected |
|---|---|---|
| present | present | nil, 0 fields |
| **DELETED** | **present** | **STILL nil, 0 fields — THIS ARRANGEMENT HAS NEVER RUN.** It is the only one that shows carrier 2 independently load-bearing. |
| present | absent | nil, 0 fields (today's fixture) |
| DELETED | absent | RED, 7 fields (measured in the r5 arbitration) |

One fixture plus three assertions converts the claim from one-measured-one-asserted to
**two-measured**.

### B8 — Pin the producer, in its own package

**No test anywhere calls `issueBuildRemoteData` or `issueLabels`**, and **`internal/platform/github`
never imports `structpb`** — an import-graph fact, not a name search.

An end-to-end pin **does** exist (`TestPassthroughReadDropsUnsafeRemoteURL`, proven live by
arbitration). **It is not a substitute**, for two measured reasons: it can only fail *after* the bad
value has travelled the whole path, so it proves the **consequence** and cannot **localise the
cause**; and it cannot distinguish *"the builder is correct"* from *"the sanitizer cleaned up after
the builder."*

**Fix:** one test in `internal/platform/github` asserting `structpb.NewStruct` over the **real**
`issueBuildRemoteData` output returns an error, built from a real `issueNode` fixture. Keep the
existing literal-based test as the mechanism explainer.

### B9 — The round's own test carries a false reason string

`TestPassthroughReadDropsUnsafeRemoteURL`'s doc comment says the scrub **"CANNOT be pinned
end-to-end on this path."** **It can, and it is — by the very test carrying the comment.** Correct
it, and add the `remote_url`/`html_url` absence assertions **its own failure message already asks
for.**

### B10 — Bound C-1's prose to the adapter it is true of

There are **two** GitHub builders. `github.go`'s `buildRemoteData` guards labels **conditionally**
(`if len(labelNames) > 0`) and every other key is a scalar — so **a zero-label issue produces a
fully representable map and `remote_data` SHIPS on that path.** Not a vulnerability (that path is
JSON-round-tripped, so the sanitizer walks it and `html_url` is validated). **But "the GitHub
passthrough path carries non-representable types" reads as "GitHub remote_data never ships," and
that wider sentence is false.**

**Fix:** one sentence bounding the claim to `issueBuildRemoteData`, plus an assertion that
`buildRemoteData`'s zero-label output **is** representable — pin the asymmetry.

---

## 4. HAZARDS. READ BEFORE YOU TOUCH ANYTHING.

**4.1 DO NOT NORMALISE `[]string` → `[]any` IN THE SANITIZER.** It is the natural tidy-up while
fixing B10 and it **destroys the fail-closed accident and switches passthrough `remote_data` ON for
the first time.**

> **IF A COUNT-SHAPED ASSERTION GOES RED, THE RED IS THE ALARM, NOT THE BUG.** The single easiest
> thing to do in this codebase is update the expected count and move on. `TestPassthroughRead
> DropsUnsafeRemoteURL`'s own failure message already tells you to **upgrade to real absence checks
> on `remote_url` and `html_url`**, not to re-baseline the number. If you find yourself editing a
> number to make a test pass, **stop and message me.**

**4.2 A SURVIVED ROW MUST CARRY EXECUTION EVIDENCE.** If you mutation-test anything, show the
mutated line was *reached* — printed side effect, coverage line, or a companion mutant that dies.
**A row without execution evidence is UNRESOLVED, not survived.** A mutant that deletes code the
fixture never executes is indistinguishable from a survivor.

**4.3 TWO BUILDERS HAVE NEAR-IDENTICAL NAMES.** `issueBuildRemoteData` (`graphql_queries.go`,
passthrough) vs `buildRemoteData` (`github.go`, sync). **A name search lands on both.**

**4.4 DO NOT ADD A SIXTH HAND-WRITTEN SCANNER.** If you need to inspect Go source, use `go/ast`.

---

## 5. OUT OF SCOPE — DO NOT DO THESE

- **No CSP work, no `markdown.ts` work, no DOMPurify config.** Real and tracked; a separate
  workstream and an escalation is pending. Not yours.
- **No `writable` server-side gate.** It is an open product question, routed upward.
- **No `export_import.go` `map[string]string` normalisation** — see 4.1; it is coupled.
- **The depth-accounting divergence** between sanitizer and import validator: pre-existing,
  production-unreachable, FYI only.
- Trivial and allowed if you want it: `ft-inspector-desc.ts` cites `docs/url-policy.md`, which
  **does not exist.** Either write it or delete the sentence.

---

## 6. YOUR DELIVERABLE

- Commits on `url-scheme-validation-r6`, base `d305391`. **Nothing pushed.**
- A report at the path in your dispatch message, under `reports/` (**scratch volume, NOT in-tree,
  do not `git add` it**).
- **A project-log entry at `.design/project-log/2026-07-29-dev-xss-r6.md`. IN-TREE. COMMIT IT.
  This is the step developers skip.**
- **A section "WHERE MY BRIEF WAS WRONG."** Every leg tonight has found errors in my briefs; the
  running count is in the dozens and several were instructions that would have made the artefact
  *worse* if obeyed. **This brief asserts specific measured facts — line numbers, field counts,
  scanner behaviour. If one is wrong, say so. If you disobeyed an instruction because it was wrong,
  say that too — that is the outcome I want.**
- **A section "WHAT I DID NOT CHECK."**
- **Mark every claim** `[MEASURED]`, `[DERIVED]`, `[REASONED, NOT MEASURED]`, or `[UNCHECKED]`.
  **Cite by content, not line number** — except where you are auditing a line number the code
  itself asserts (B1).

**TERMINATION: YOU MUST COMMIT YOUR WORK AND YOUR PROJECT-LOG ENTRY, WRITE YOUR REPORT TO DISK,
MESSAGE `eng-manager` WITH THE BRANCH, HEAD SHA, AND THE REPORT'S BYTE SIZE AND FIRST LINE, AND
THEN MARK THE TASK COMPLETE.** A fix that exists only in your context does not exist.
