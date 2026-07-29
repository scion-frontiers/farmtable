# FIX ROUND r7 — dev-xss-r6 continues on `url-scheme-validation-r6`

## VERDICT: ROUND SIX DOES NOT MERGE. Three legs, three blocking sets, and they converge.

`audit-xss-r6` APPROVE WITH CONDITIONS / `review-xss-r6` REQUEST CHANGES / `test-xss-r6` DO NOT
MERGE AS-IS. Read all three reports in `reports/` before you start. **The production change is
correct** — review looked hard and found no correctness defect in it, and said so. Most of what
follows is comments, a prune list, and a rate limiter.

**Base:** `c108acbcfa2357862576092469828709bb6c4090`, your tree, clean. Commit on the same branch.

---

## THE ONE THAT MATTERS MOST, AND IT IS ABOUT YOUR GUARD, NOT YOUR CODE

**TWO LEGS INDEPENDENTLY DROVE B11 GREEN WITH A LITERAL CONSUMER.** Not a computed access — the
exact ordinary spelling your project log says goes RED naming file, line and text. Two unrelated
mechanisms, neither leg knowing the other was trying:

- **Go-side plant → OUT OF POPULATION.** The guard is web-scoped. There are live uncovered Go
  reads *today* at `convert.go:411/470/473`.
- **Web-side plants in `web/src/build/`, `web/src/util/dist/`, `web/src/components/coverage/` →
  ALL PRUNED.** `skipDirs[d.Name()]` inside `WalkDir` prunes **by basename at arbitrary depth**,
  not by top-level path. And `web/tsconfig.json` has `"include": ["src"]`, so those files are
  compiled, bundled and **shipped source**. The guard calls source "build output" on the strength
  of one path segment.

**This falsifies the bound you shipped** — *"CATCHES THE ACCIDENTAL ADDITION."* The pruning case
**is** the accidental one. A developer putting a helper in `src/build/` and writing the field the
obvious way is not evading anything.

**AND THE REASON NEITHER OF US SAW IT, which is the lesson worth more than the fix:** all four of
your planted mutations sat in files the census **already reached**. Your matrix has an axis for
spelling and an axis for declared entries; **it has no axis for "file the walk never opens."**
**A MUTATION MATRIX MEASURES THE DETECTOR AND ASSUMES THE CENSUS.** The population was the
untested axis in an instrument built to test populations. That is not a criticism you could
reasonably have anticipated — it is the round's best result and it belongs in the log.

---

## BLOCKING — do these

**B1. `convert.go:697-706` — the replacement comment reproduces the error class this round exists
to eliminate.** Found by the audit and the review independently, by different routes. It names
three collection RemoteData writers (Create, Update, **Import**) and then discharges only **two**:
*"no in-tree caller populates CreateCollectionParams.RemoteData OR UpdateCollectionParams.RemoteData."*
**ImportCollection is dropped from the argument, and ImportCollection is the live one** — it
populates RemoteData from an attacker-uploaded JSON document at `export_import.go:332`, reaching
the store at `:412`.

Worse, and fix this properly rather than by adding a clause: the real reason the line does not
fire on the import path is that JSON-decoded values are **structpb-representable** — a **TYPE**
argument. Which is the argument this same comment disowns four lines earlier as FALSIFIED. **The
gap is filled by the reason the comment rejects.** Say the true thing: the caller argument covers
two writers, the type argument covers the third, and both are load-bearing.

**B2. The rewrite DELETED the pre-diff clause covering `syntheticCollection()`** (`passthrough.go:644`).
That struct literal bypasses both param structs and **is the collection object returned for every
GitHub passthrough collection** — the exact object whose `remoteData.writable` the dashboard gate
reads. Your heading says "THE INVALIDATING EVENT, NAMED" and now omits the single most likely
arming edit there is. Restore it, in the new comment's vocabulary.

**B3. `internal/webguard/doc.go` asserts there is no CI configuration in this repository at all.**
True at `c108acb`. **FALSE on the merge target.** Real `main` is
`cc927355e5a23c45bfd983cd331eb540b0a61ad5` and its `.github/workflows/ci.yml` runs
`go test ./... -v` directly on push to **any** branch. **This is good news for you** — the guard
acquires a real invoker on merge, and your "NEITHER PLACEMENT DOMINATES" trade-off largely
dissolves. **Rewrite the rationale against `cc92735`; do not delete it.** Keep the one part that
stays true: **neither Dockerfile runs `go test`** (`Dockerfile:9`, `Dockerfile.server:9` run
`npm test` only), so no *image build* enforces the guard.

**B4. `skipDirs` prunes by basename at arbitrary depth.** Anchor it to explicit **top-level**
entries under `web/` (`node_modules`, `dist`, `build`, `coverage`, `.vite`). Also add `.tmp-test`,
which `npm test` creates and never cleans up — latent today, but it arms on the most likely next
commit, and at that moment `make test` becomes non-idempotent: green on a clean tree, red on the
second consecutive run. Consider asserting the count of directories actually descended into, so a
future prune is itself a visible event.

**B5. The drop-log sampler is global, not per-field, so the collection canary can never fire.**
`remoteDataLogMu`, `remoteDataLogLast`, `remoteDataLogSuppressed` are three package-level
singletons; `field` is a formatting parameter and never keys the limiter. Compose two claims you
make yourself: the task path fails conversion for **every** passthrough task (`labels`
unconditional, `issueLabels` never nil), and the collection line is the sole signal for a silent
write-authorization revocation. So while anyone browses a passthrough collection the window never
closes and **the collection line never prints** — measured, on a pinned clock, the word
"collection" absent from the buffer entirely. Key the sampler by `field`, or at minimum carry
per-field counts into the suppressed report so the canary survives as data.

**Coverage note, and it is the whole list:** `"collection.remote_data"` occurs in exactly one place
in the repository — `convert.go:736`, the production call site. **No test anywhere passes that
field value.** All five sampler assertions use `"task.remote_data"`. Add the one that does not
exist.

---

## THE CANARY REQUIREMENT — THIS IS NOT OPTIONAL AND IT IS THE POINT OF THE ROUND

> **A GUARD MUST BE PROVEN BY A CANARY THAT MAKES IT FIRE. AN UNFIRED GUARD IS AN UNTESTED GUARD.**

For **B4** specifically: after your fix, **re-plant all three consumers**
(`web/src/build/telemetry.ts`, `web/src/util/dist/deep.ts`, `web/src/components/coverage/deep2.ts`,
each a plain `const rd = coll.remoteData;`) and **show `RED / UNDECLARED` naming file, line and
text.** Then revert and re-confirm green. A fix to a guard that is not observed firing is a
comment. Same standard for **B5**: show the collection line printing when it should, and show your
new test failing if you revert the keying.

**Do not report a green you did not observe.** `go test` prints `ok` and exits 0 when its `-run`
filter matches zero tests, so count `=== RUN` lines against a number you state in advance, confirm
the output ends on a package verdict line, and never `head`. Never terminate a command with an
echo of its own status.

---

## NOT YOUR PROBLEM, AND I AM TELLING YOU SO YOU DO NOT TRY TO FIX IT

Two legs independently extracted real main's `scripts/ci-suite-manifest.mjs` and ran it read-only
against your tree: **exit 1, fail-closed, and CI runs it BEFORE the suites on push to any branch.**
Your branch goes red at the first gate.

**It is not yours.** `web/package.json` and `web/scripts/run-tests.mjs` are **untouched** by
`d305391..c108acb` — inherited from dev-xss-r2/r4. The checker has no case for a bespoke discovery
runner, so it maps `scripts/run-tests.mjs` to nothing and reports four test files as executed by
nothing when `run-tests.mjs` glob-discovers all four. **The fix is a change to a file on `main`**
and I am routing it separately. Do not touch it. Do not work around it.

---

## NON-BLOCKING — do them if they are cheap, say so if they are not

- `log.Printf` uses `%s` on attacker-authored map keys. Use `%q`.
- The `unrepresentableKeys` "this should not happen" branch **is** reachable: `structpb.NewStruct`
  rejects an invalid-UTF-8 **key** while every value passes `NewValue`. Fires deterministically.
  Fix the message so it names the real cause; a test would be welcome.
- The guard catches proto-shape changes but not payload-shape changes; the producer test has zero
  collection coverage. Note in the log if you do not act.

## HELD, NOT ASSIGNED

Whether B11's population widens to the **Go** side is a scoping decision above you and I am taking
it upstream. Do not attempt it. If your B4 fix makes widening easier or harder, say which in the log.

---

## RULES

- **REQUEST THE BUILD TOKEN FROM ME BEFORE ANY `go test ./...`, `go build ./...`, `make test` or
  `npm test`.** One token exists project-wide and I hold it. Targeted single-package runs
  (`go test ./internal/<pkg>/ -run '^TestName$' -count=1`) need no token but must be logged to
  `reports/_run-queue-log.md` **before** running, ROOT and DIST columns included, **on passing
  lines too.**
- **Commit locally. DO NOT PUSH.** Pushing is mine alone.
- **Write a project log entry** covering what you changed, the canary evidence for B4 and B5, and
  your own view of the matrix/census lesson above.
- Shell is **zsh 5.9**. Unquoted globs matching nothing are FATAL. `$pipestatus` is 1-indexed;
  `${PIPESTATUS[0]}` is empty. `cmd > file 2>&1`, never `cmd 2>&1 > file`.
- No backticks in messages to me — heredoc to a file, send with a command substitution on `cat`.

## TERMINATION

**You MUST commit the fixes, write the project log entry, message me a summary including the
canary evidence, and then mark the task complete.** If you disagree with any item above, say so
with the measurement — three legs found errors in my briefs tonight and the ones that found the
most were the most useful.

---

# AMENDMENT 1 — 2026-07-29 07:40Z, appended by eng-manager AFTER dispatch.

**THE BRIEF ABOVE IS NOT REWRITTEN. It stands as dispatched and this stands under it.** I wrote
it from the three legs' summary messages. I have now read all three reports in full and I owe you
two things: one item I left out, and one result that is in **no** report because it needs two of
them held at once.

## A1 — B2 IS NOT A COMMENT NIT. IT IS THE ONLY REACHABLE INPUT TO AN AUTHORIZATION GATE.

I measured this myself at `c108acb`, read-only, in `/workspace/farmtable-review-xss-r6`. Both
halves are quoted from source, not inferred:

`web/src/capabilities.ts`, `getCapabilities()` — **exactly one branch reads `remote_data`:**

    if (collection.platform === Platform.FARMTABLE) { return ALL_ENABLED; }   // never reads it
    if (collection.platform === Platform.GITHUB) {
        const rd = collection.remoteData;
        if (rd && ... && rd.writable === true) { return GITHUB_CAPABILITIES; }
    }
    return ALL_DISABLED;

`internal/platform/github/passthrough.go:644`, `syntheticCollection()` — sets
`Platform: collection.PlatformGithub` and **no `RemoteData` field at all**, so it is nil.

Put those together and the conclusion is not a style point:

  **`syntheticCollection()` IS THE ONLY PRODUCER OF A GITHUB-PLATFORM COLLECTION OBJECT, SO IT IS
  THE ONLY OBJECT IN THE PRODUCT THAT CAN EVER REACH THE `writable` READ. ITS `RemoteData` IS NIL,
  AND THAT NIL IS THE SOLE REASON `GITHUB_CAPABILITIES` IS UNREACHABLE TODAY.**

The clause your rewrite deleted was the only in-tree sentence documenting the thing that holds a
nine-operation authorization gate shut. Restore it as a statement about the **gate**, not about
the log line.

**AND THE PART THAT MAKES IT URGENT RATHER THAN TIDY.** The security leg measured, at your SHA,
that `writable` appears in Go in exactly two places — `convert.go:716` and `:718` — **both
comments, both added by this round.** There is **no functional Go code that reads it. There is no
server-side notion of a read-only collection.** So on the day somebody ships GitHub editing by
adding `RemoteData: map[string]any{"writable": true}` to that literal, this product acquires an
authorization control **that exists only in the browser** — and the comment whose job is to name
that exact moment is the one this round removed. That edit is not on your "THE INVALIDATING EVENT,
NAMED" list. It is the most likely edit anyone will ever make to that function.

State it in the comment in those terms: the invalidating edit arms a **client-side-only** gate.

## A2 — ITEM I OMITTED: annotate the two conjuncts. This was an explicit condition of approval.

The security leg's condition 5, which I dropped: import copies an uploaded document's collection
map into storage with **no key validation** (`export_import.go:332` -> `entstore.go:2116-2117`), so
an authenticated `ScopeCollectionAdmin` caller can plant **any** key including `writable: true`. It
is inert **only** by a two-file conjunction nobody wrote down:

- **Conjunct A** — `export_import.go:305` rejects any non-`farmtable` document and `:331` hardcodes
  `Platform: collection.PlatformFarmtable`. An imported collection is always farmtable-platform.
- **Conjunct B** — `capabilities.ts` returns `ALL_ENABLED` for FARMTABLE **before** the
  `remote_data` read, so the planted key is never consulted.

**MINIMUM ASK, AND IT IS CHEAP: annotate each conjunct with a comment naming the other one.**
Neither is currently marked as a security control, and either one can be moved by somebody with no
reason to think they are touching security. Do not build the key allowlist — that is a separate
fix round and is not yours.

**NOTE THE SHARED HINGE, because it is why A1 and A2 belong in the same commit:** conjunct B and
A1 are **the same early return, seen from opposite sides.** It is the reason a planted key is inert
*and* the reason the GitHub path depends on `writable` at all. The security leg named the edit
"consult `writable` before the platform check" as an invalidating change; that single edit would
arm the planted key **and** change the GitHub path simultaneously. Neither report says this,
because neither leg held both halves.

**Bound on A1/A2, stated so you can falsify it:** I did not run an import end-to-end and I did not
execute the capability gate. Both halves are read-and-quoted from source at `c108acb`. If you find
a second producer of a GITHUB-platform collection object, **A1 is wrong and I want to know inside
ten minutes.**

## A3 — SMALLER ITEMS FROM THE FULL REPORTS, none blocking

- **The guard doc overstates its own population.** It claims coverage of "any file, of any type"
  under `web/`, but `skipDirs` excludes `dist`, and the repo root carries `//go:embed all:web/dist`
  — so the guard cannot see the bytes actually compiled into the server binary. Say so in the
  limits block alongside the four limits already listed honestly. (This is separate from B4: B4 is
  the basename bug, this is the doc claim.)
- **"occurrence census" is a line census.** `censusRemoteDataMentions` breaks after the first
  identifier match per line; the declared grpc-client line contains three occurrences and counts
  as one. Allowlist semantics are correct and impact is nil — but this file's whole correctness
  argument is "we over-approximate and our errors run in the noisy direction", so name the unit
  exactly. Say "line census".
- **`withRemoteDataLogClock` (`remotedata_log_test.go:62`) registers no cleanup.** It overwrites
  the package global `remoteDataLogNow`; the restore lives in `captureRemoteDataLog`'s `t.Cleanup`.
  Correct today — all three call sites call capture first, and order-independence was verified
  under `-shuffle` seeds 1, 2 and 3, all green. But a future test calling only the clock helper
  leaks a frozen clock into every subsequent test in `internal/server`. Register the restore in
  the helper itself. **You are editing this file for B5 anyway.**
- **Import asymmetry, INFO only:** `validateImportedTaskURLs` **errors** on a bad URL in task
  `remote_data` (`:722`) while `sanitizeRemoteData` **silently drops** it in collection
  `remote_data` (`:332`). Both fail closed, so not exploitable. At minimum append a warning to
  `ImportCollectionResponse.Warnings` when the collection sanitizer drops something. Note it in
  the log if you do not act.

## A4 — WHAT THIS AMENDMENT SAYS ABOUT MY PROCESS, since I ask you to report mine

I dispatched a fix brief built from three summary messages before reading the three reports. Four
of five blocking items survived unchanged, which is the only reason I am amending rather than
reissuing — but **A1 is the strongest single result of the round and I did not have it, because it
does not exist in any one report.** It required the security leg's zero-Go-readers measurement and
the review leg's deleted-clause finding held together. **A SUMMARY IS LOSSY IN EXACTLY THE PLACE
WHERE TWO REPORTS WOULD HAVE TOUCHED.** Nothing in a per-leg summary can be about two legs.
