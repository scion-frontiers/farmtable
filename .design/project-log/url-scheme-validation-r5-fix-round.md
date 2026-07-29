# URL Scheme Validation — R5 Fix Round

Date: 2026-07-29
Branch: `url-scheme-validation-r5`
Base: `e6bda71`
Commits: `5b7dae4`, `1eaf990`
Verdict: the write-site scanner is re-aimed and its claims are now scoped to what
it actually walks. **No product vulnerability was found or fixed in this round.**
Everything below is about the instrument.

Follow-up to `url-scheme-validation-r4-fix-round.md`.

## What this round was

R4 was "the instruments this diff exists to install are failing open." R5 is the
next turn of the same screw:

> The scanner that certifies every `RemoteData` write was blind to a write
> **shape**, and while we were fixing that we nearly certified its blindness to a
> write **location** and to a write **form** — by making the guard stronger, and
> therefore more trusted, without touching what it claimed.

## The sentence this round exists to record

**THE MARGIN ABSORBED THE LOSS EXACTLY. A FLOOR OF 5 WOULD HAVE FAILED LOUDLY.
WE WERE NOT SAVED FROM ANYTHING; WE WERE MISSED BY A UNIT.**

The shipped guard was `sanitized < 4`. The tree held 6 sanitized sites. The
blinding edit removed exactly 2 from the scanner's view. `6 − 2 = 4`, and
`4 < 4` is false, so the suite would have gone green while both gRPC wire-path
sites — the only `RemoteData` writes that reach a browser — sanitized nothing.

And the slack was not slack. The failure text read *"expected at least 4
(convert.go x2, export_import.go x2)"* while `export_import.go` had **four**
sites. The author believed 4 was the total. **It was never a floor at all: it was
an exact count of a miscounted population wearing the word "floor,"** and the
margin that concealed the regression is an artefact of the miscount. Three lines
above it sat a comment instructing the maintainer to raise the number when a site
is added — in a file where that had not been done. A self-certifying comment: not
merely wrong, but *the reason a reader skips the number underneath it.*

## What changed

### 1. The scanner anchors on the right-hand side (`5b7dae4`)

The old pattern admitted `RemoteData` followed by at most a literal `, _`. Naming
the error instead of discarding it — the obvious logging improvement — made two
sites **vanish** from the scan rather than fail it.

Widening the enumeration to `(?:,\s*\w+)?` was proposed and rejected. It admits an
identifier but not a selector, an index, or a blank. **Enlarging the admissible
set is not changing the question.** The scanner's question was never "what does
the left-hand side look like"; it is "does this assignment route `RemoteData`
through the sanitizer."

`remoteDataAssignment` now splits at the first top-level `=`, `:=` or `:`,
requires `\bRemoteData\b` to its left, and tests the **right** side. No LHS shape
is enumerated, so no LHS shape can hide a site.

Three false-positive classes had to be closed to make that work, all measured
rather than anticipated:

- Struct tags. The canonical `[^=:]*` form filed by a review leg and relayed as
  canonical **ships RED on a clean tree** — a tag's `json:"..."` reads as a
  top-level colon (`export_import.go:39`, `:76`). Closed with `maskGoLiterals`,
  which blanks literal interiors preserving length and offsets. That masking is
  sound for the reason widening was not: **Go has exactly three literal
  delimiters, so it is a closed population — argued, not enumerated hopefully.**
- `const maxRemoteDataDepth = 32` matched on substring. Closed with `\b`.
- `==` and compound operators had to be skipped in the separator scan.

**The rewrite immediately exposed two real write sites in `server.go` that no
shape enumeration would ever have admitted** — both map-index targets, one
writing a URL-bearing key straight from the wire. Not a vulnerability: entry
validation returns before it. Now adjudicated as text-keyed exemptions instead of
silently unseen.

### 2. Membership by name, split by security direction (`5b7dae4`)

The registry binds a **set of function names** per file, not a count. A per-file
count fails to compensating substitution one grain below the file — measured
GREEN while `taskToProto`'s write was deleted and an unrelated sanitized write
took its place in the same file.

The names are split into **OUTBOUND** and **INBOUND**, and this is the sharpest
measurement of the round:

| | |
|---|---|
| sanitized sites | 6 |
| shipped floor | 4 |
| slack | 2 |
| OUTBOUND | 4 |
| INBOUND | 2 |

**The floor equalled the outbound count exactly, and the slack was entirely the
inbound set.** Inbound coverage could go to **zero** — not degraded, zero — and
`4 < 4` is still false. Those two sites are also precisely the ones reachable
from caller-supplied bytes on the `ImportCollection` RPC. Three independent
characterisations — the floor's slack, the wire-reachable set, and the inbound
direction — name the same two lines.

Two different security properties were sharing one counter. They no longer are.

### 3. The guard no longer lies about its own reach (`5b7dae4`, `1eaf990`)

`TestEveryRemoteDataWriteSiteSanitizes` → `TestScannedServerPackageRemoteDataWriteSitesSanitize`.

Two limits, both now stated in the map declaration, in every failure message, and
in the name:

- **Location.** The walk is one `os.ReadDir` of `internal/server`. "Every" was
  false.
- **Form.** `\bRemoteData\b` **does not match `SetRemoteData`** — there is no word
  boundary between "Set" and "RemoteData". Verified:
  `printf 'x.SetRemoteData(m)' | grep -cE '\bRemoteData'` → `0`. Ent's mutation
  builders carry the identifier as a *suffix of a different identifier*, so three
  independent censuses this round all excluded `internal/store/entstore.go`
  **by the shape of the anchor** rather than by anyone's decision. Six live there.

And the argument that ends the counting rather than winning it: `RemoteData` is
`map[string]any`, a **reference type**. `create.SetRemoteData(p.RemoteData)` hands
the store the map itself, so any later mutation through any alias is a write to
persisted state **in which the token "RemoteData" does not appear at all.** A
census keyed on the identifier cannot in principle enumerate those. **The
population is open**, so no name could have been universal, and the test now says
what it *walks*.

This is the same defect one level up. The scanner was blind to a write shape; it
is also blind to a write location and a write form. **Fixing the predicate while
leaving the name unqualified would have shipped a more precise instrument making a
wider false claim** — and a stronger guard is trusted further, which converts a
limitation that is merely *present* into one that is actively *certified*.

### 4. A bare function name is not an identity — and neither is `file:function` (`1eaf990`, `<key-fix>`)

Package `server` declares `taskToProto` twice: the free function in `convert.go`
holding the wire-path write, and a method on `*FarmTableService` in `server.go`
that wraps it. The wrapper is the **enrichment seam** — it takes `ctx` and the
store and already mutates the proto after conversion — so it is by convention
exactly where store-dependent field population lands. Keys now render as
`(*FarmTableService).taskToProto`.

File-keying already separated that pair. The receiver capture closes what
file-keying cannot, and that case is not hypothetical — two real instances,
verified in this tree at `e6bda71` rather than taken on report:

| declaration | collides as |
|---|---|
| `internal/cli/connect.go:251` `(*embeddedCloser).Close` / `:334` `(*passThroughCloser).Close` | `connect.go:Close` |
| `api/farmtable/v1/farmtable.pb.go:2034` `(*Task).GetRemoteData` / `:2212` `(*Collection).GetRemoteData` | `farmtable.pb.go:GetRemoteData` |

The second one is **this field's own accessor**. Both are now rows in
`TestRemoteDataFuncIdentSeparatesMethodsFromFunctions`, and the negative control
— strip the receiver from the key — reports **4** collisions.

**But it ships labelled as an INSTANCE FIX, in the source, because that is what
it is.** Look at the sequence this round actually ran: the regex was widened to
admit a form; the census was widened to admit a form; the key was widened to
admit a qualifier; the qualifier was widened again. **Each fix resolved the
instance that had just been demonstrated and left the class intact** — and
several were proposed by people who had, that same hour, ruled that adding a
form *moves* a blind spot rather than closing it. Four parties, five instances.

So `LIMIT 3` in the registry banner is a bound argued rather than patched:

> **EVERY KEY SHORT OF A COMPILER-RESOLVED IDENTITY IS A HEURISTIC WITH AN
> UNKNOWN MARGIN. THE ONLY SOUND BOUND IS AST- OR TYPE-RESOLVED, AND THIS
> REGISTRY IS NOT THAT.**

Unknown is not zero and is not measured. A receiver rendered as text is still
text: a type alias, a generic instantiation, a dot-import, or the same type name
in two packages each yield one key for two declarations. It costs one comment
and it is the only part of this that survives the next form.

### 5. Names that claimed more than they pinned (`5b7dae4`)

`TestGitHubPassthroughRemoteDataNeverSerialises` →
`TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident`.

"Never" was a universal the body does not establish — it asserts that `structpb`
rejects `[]string`; drop `labels` from the builder and the old name sits there
green. "Serialises" named a symptom where the mechanism is an **accident** someone
may reasonably remove. Positive control preserved.

Vocabulary: **passthrough-GraphQL**, not "the GitHub adapter." **sync-REST** is a
different code path with a different builder and this test says nothing about it.

Also repaired: the doc comment for `TestTaskToProtoScrubsRemoteDataURLCarriers`
had been stranded by a test inserted between it and its function. Two contiguous
`//` blocks merge, so it had silently become the opening paragraph of a
*different* test's documentation while its own function had none. Godoc reported
nothing; nothing could.

### 6. The shared log, and what is *not* claimed about it (`5b7dae4`)

`structOrNilLoggingErr` is **one** log statement called from both converters, so
it cannot ship for one and be withheld from the other. It is reachable on the task
path — two tests pin the live triggers — so it carries **no** "unreachable by
construction" claim, which would be false.

The collection half looks hard to reach and is **not** recorded as unreachable.
Two clean searches are not a bound, and *"this constructor does not set X" is not
"no path reaches a write of X."*

### 7. A test deliberately not written, barred by name in the registry

**Do not assert that the beads converter emits no `RemoteData`.** It is true and it
is not why the system is safe. Both import arms converge on `doc` before any
sanitizer, and `sanitizeRemoteData` takes a bare map and cannot tell the arms
apart, so coverage is **arm-invariant**. The emptiness test would stay green
against a third arm calling the store directly, a sanitizer hoisted above the
join, or an arm building an `ImportTask` itself — all three of which break the
actual property. **A test that pins a property the safety argument does not rest
on is not defence in depth; it is a future reader's evidence that the wrong thing
is load-bearing.**

### 8. One claim retracted before it shipped, kept on the record

A reason for the `server.go:661` exemption was drafted and is **withdrawn**: that
the AST scanner in `urlvalidate_differential_test.go` also had no representation
for `:663` and `:669`, so the exemption and the blind spot concealed each other.
**False.** `buildsRemoteData` admits both through its `*ast.IndexExpr` arm via
`isRemoteDataTarget`, and `remoteDataLiteralKeysIn`'s `*ast.AssignStmt` arm
extracts their keys. Verified by reading the primary text, not the report.

The claim was true of a **pre-`4e58242`** tree, and `4e58242` ("recover adapter
remote_data keys by AST, not by regex") is an ancestor of `HEAD` —
`git merge-base --is-ancestor` confirms it. So a `file:line` read at the current
SHA was joined to a measurement taken at an older one. **The branch is not an
identifier; the SHA is, and every `file:line` carries its SHA.**

The exemption stays; the reason is replaced by the part that is true and is
general — *an exact-text exemption can express "this write is empty"; it cannot
express "and nothing populates it afterwards."* The retraction is recorded in
the source next to the entry rather than deleted, because the joining error is
worth more to the next reader than the sentence was.

## Verification

`make test` green, both halves — Go suite plus 380 web assertions, matching
`EXPECTED_ASSERTIONS`. No `TestWatchTasks_*` flake observed.

Seven mutations run **against the compiled test, not a model of it**. Each fails
in the predicted layer and no other:

| mutation | result |
|---|---|
| clean tree | green |
| the original blinding edit, still sanitized | **green, and the site stays visible** |
| the same shape, desanitized | red: unsanitized + OUTBOUND + `san==sites` |
| wire-path site deleted | red: OUTBOUND membership only |
| **both inbound writes deleted** | **red: INBOUND membership only — `san==sites` passes and the old floor of 4 passes** |
| unsanitized site added to a declared function | red: `san==sites` only |
| undeclared file, correctly sanitized | red: fail-closed |
| within-file compensating substitution | red in both directions |
| write moved into the same-named wrapper method | red in both directions |

Neither layer subsumes the other, measured rather than argued.

## Attribution

**Six corrections, not one of them caught by its own author:**

1. test-xss-r4 measured the blinding and had filed the right remedy hours earlier.
2. The EM relayed a compressed, wrong version of it.
3. The coordinator refuted the floor bump.
4. review-xss-r4 declined to accept the relay and found the stale floor.
5. review-xss-r4 then falsified its **own** count-free remedy on the vanishing row.
6. The coordinator refuted the widening with the same test that had selected it.

Two more landed after the token was granted, making eight: a parallel leg measured
the scanner's **population** rather than its predicate and found the scope claim;
the test-engineering leg found the `SetRemoteData` anchor gap that all three prior
censuses shared.

Two more after that, making ten, and both are corrections *of a correction*:

7. An auditor challenged the mutual-concealment claim; the EM re-read the primary
   text and retracted its own blocking dispatch (§8 above).
8. The test leg caught the `file:function` key being one scope too shallow, with
   two hand-verified instances (§4 above).

The pattern across all ten is the one worth carrying forward: **not one was
caught by its own author**, and the two most recent were caught only because the
recipient re-derived the claim instead of implementing it.

Found in this leg and worth keeping: the per-file count blind spot; the canonical
`[^=:]*` form shipping red on a clean tree, which **nobody had ever executed** —
a remedy specified in a message and never run is not a remedy, it is a proposal
with a reputation; and a draft exemption comment citing a test that did not exist,
caught by grepping before it shipped.

## What I could not verify

- **The six `SetRemoteData` sites in `internal/store/entstore.go`.** Out of scope
  by instruction; tracked separately. The walk was **not** widened, `SetRemoteData`
  was **not** added as a seventh admissible form — adding a form is the move that
  produced every blind spot in this file's history — and no finding is filed. The
  sound bound is compiler-resolved: an AST walk, or a type that makes raw
  assignment unrepresentable.
- **Whether writes in `internal/platform/*` need sanitizing.** Not adjudicated
  here. A plausible benign reading exists (adapters write raw, `convert.go`
  sanitizes outbound) and it belongs to the audit and review legs. Silence in this
  round is not a clearance.
- **`internal/server/scopes.go` is gofmt-dirty at the base commit.** Pre-existing,
  untouched, flagged so it is not attributed to this branch.

## Two notes for the next round

- **`urlvalidate_differential_test.go:541` scans `internal/platform/beads/beads.go`.**
  The adapter-key census therefore generalises over a population that *contains*
  the package we spent the evening arguing was dead. My report does not **say**
  beads is reachable; that census **depends** on beads being in the population.
  Those are different propositions.
- **`${PIPESTATUS[0]}` is empty in this environment.** The shell is zsh 5.9; the
  array is `$pipestatus` and it is **1-indexed**. It is not an error, merely
  absent, and it renders as `EXIT=` inside a line whose shape announces that an
  exit code was reported — an unarmed guard that looks armed. Related: quote your
  globs, since zsh aborts a command on a non-matching glob.

  And the part that generalises past this shell: confirming such a guard on a
  passing command proves nothing. **A guard that has only ever printed `0` has
  not been observed firing — it has been observed agreeing, and a guard wired to
  a constant zero is indistinguishable from a correct one on every passing
  case.** The control is a command made to fail on purpose:
  `sh -c 'exit 7' | tail -1` with `${pipestatus[1]}` prints **7**. Measured here,
  in this tree, this round.
