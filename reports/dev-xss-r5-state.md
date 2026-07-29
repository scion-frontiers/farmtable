# dev-xss-r5 — STATE FILE. Written 2026-07-29T04:2xZ, at the EM's instruction.

Written BEFORE replying to the EM's 04:14Z message, because that message's whole subject is
what a compaction takes. This file is the thing that does not forget what it was defending.

~~**HEAD `d5e35a4869475cd79c3a46e791909a610d1ea8f2`** ... Eight commits.~~
**SUPERSEDED 05:0xZ — see §7. Preserved, not erased.** That header described a tree three commits
behind the one now under review, and §§1–6 below were written against it. Read §7 onward for
current state.

## CURRENT STATE [MEASURED 2026-07-29T05:0xZ]

**HEAD `d305391`**, branch `url-scheme-validation-r5`, base
`e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1`. Working tree clean. **THIRTEEN commits.**
NOTHING PUSHED, and nothing will be: three review legs are measuring `d305391` right now and the
tree must not move under them.

Commands and observed values, not verdicts:

| Command | Observed |
|---|---|
| `git rev-parse --short HEAD` | `d305391` |
| `git rev-list --count e6bda71..HEAD` | `13` |
| `git status --porcelain` | 0 lines |
| `git log --oneline origin/main..HEAD \| wc -l` | `39` (i.e. unpushed; origin untouched) |

**THE COUNT WAS WRONG IN THE DIRECTIVE AND IS CORRECTED HERE.** The dispatching brief asserted ten
commits. It is 13, and was 12 before #228. The EM has taken the correction and printed the command
next to the number in the tree table the review legs read. Recorded here because a number that
round-trips through a directive comes back with authority it never earned.

---

## 1. THE CORRECTION: D1–D7 ARE NOT SEVEN QUESTIONS I ASKED

The EM's 04:14Z message says it owes me "an adjudication of D1-D7", describes them as "seven
questions I can no longer read", and asks me to "restate D1 through D7 verbatim, as you
originally put them."

**I did not originate them.** D1–D7 are the EM's own brief's seven DELIVERABLES:
`briefs/dev-xss-r4-fix.md` §5 (header line 217), items at **lines 219–232**. The EM quoted
them to me verbatim at 02:47:21Z. The file is on disk, unmodified since 01:47, md5
`df3f29c27239ad2a3c3a02318030b968`.

**So nothing was lost.** The content never depended on either of our memories. What the EM
owes me is not answers to seven questions — it is **adjudication of my seven closure claims**
against those deliverables, filed at 02:55Z.

## 2. THE DELIVERABLES, VERBATIM FROM THE BRIEF (briefs/dev-xss-r4-fix.md:219-232)

1. **THE PERSISTENCE WALK (§2.2). FIRST, BEFORE ANY CODE.** Walk every path from the `ent.Task`
   struct literal in `passthrough.go` to `taskToProto`. Does any of them persist and re-read (JSON
   round-trip)? Also: **does beads have a passthrough path at all?** Source only, no build.
   **If the answer is "persisted", STOP AND MESSAGE ME.** C-1 and carrier 2 both die and the round
   changes shape. Write the answer down either way, with the commands that produced it.
2. **[[CANCELLED — SEE HEADER. BUILD THE LOGGING ALONE, FORM E.]] ~~Representability normalisation at the sanitizer's exit~~** + error logging at `convert.go:358`
   and `:534`. Must cover `dep.Metadata` structurally (§2.1).
3. **The single write-site registry** (H-1), fail-closed on unknown files, in-source annotation key
   (H-2). Lands before anything else touching the write-site oracle.
4. Required 3, 4 (AST or retire the word — H-3), 5 (H-4).
5. **Rename `...NeverSerialises`, preserving its positive control** (§4).
6. **A PROJECT LOG ENTRY** at `.design/project-log/`. Not optional. State what you measured, what you
   derived, and which is which.
7. **COMMIT.** Clear messages, one logical change each.

## 3. MY CLOSURE CLAIMS, VERBATIM AS FILED 02:55Z — THE THING AWAITING ADJUDICATION

```
  D1 persistence walk        -- prior round, not re-done by me; say if you want it re-derived.
  D2 logging only, Form E    -- shipped; convert.go:534 carries NO unreachable-by-construction claim.
  D3 single registry         -- shipped, fail-closed on unknown file AND unknown function.
  D4 Required 3              -- ** DONE THIS COMMIT, four mutants red. **
     Required 4              -- done: two renames + three-limit banner.
     Required 5 (H-4)        -- ** DONE THIS COMMIT, reconciliation PERFORMED, not commented away. **
  D5 NeverSerialises rename  -- done, control asserted and shown above, provenance repaired.
  D6 project log             -- .design/project-log/url-scheme-validation-r5-fix-round.md, 11 sections.
  D7 commit                  -- seven commits, one logical change each, NOTHING PUSHED.
```
(Now eight commits, not seven — `d5e35a4` followed.)

## 4. WHERE I ACTED ON A PROVISIONAL READING (the EM asked for these specifically)

- **D1 — THE LIVE ONE.** I did NOT perform the persistence walk. I treated it as satisfied by the
  prior round and built D2–D7 on top of that. D1 is the deliverable whose answer could have
  killed C-1 and carrier 2 and "changed the shape of the round" — so every later deliverable
  rests on an assumption I did not measure. Flagged at 02:55Z; never ruled on.
- **D2 — superseded instruction.** The 01:40Z ruling said `:534` "cannot fire, comment it". I
  shipped a comment that carries NO unreachable-by-construction claim, i.e. I declined to write
  the sentence I was told to write, and said so. Form E collapsed both sites into one helper
  (`structOrNilLoggingErr`, convert.go:307/:310), so the brief's ":358 and :534" are now :420
  and :617.
- **D4/Required 5 — I took the expensive branch.** H-4 permitted a cheap branch (a comment
  saying the reconciliation had NOT been performed). I performed the reconciliation instead and
  found "the two agree" false in a second way: the test is stricter than the sanitizer.

## 5. VERIFICATION STATE (accepted by the EM 03:39Z)

Class (b) named selective run, logged to `reports/_run-queue-log.md` before and after.
8 tests named → 8 top-level `--- PASS:`, 0 FAIL, 84 subtests. Requested-count == observed-count
is the evidence; the exit code is not. Four flat tables are `[UNCHECKED]` per-row and that is
now owned BY THE EM, deferred to r6 (convert to `t.Run`).
`git diff --name-only e6bda71..HEAD -- web/` → **0**. safe-url / url-binding-scan are not mine.
Collection-arm log pin: **ABSENT**, declined by the EM 03:39Z, not to be written.

## 6. NOT MINE, NOT OWED BY ME

`reports/dev-xss-r4.md` — reassigned to `xss-r4-reconstruct`, from the tree only, forbidden to
read the three review reports.

---

# 7. THE THREE POST-ADJUDICATION LEDGER ITEMS (#226, #227, #228)

Everything in §§1–6 predates these. They are the last three commits on the branch and they are
what `d305391` adds over `d5e35a4`.

## 7.1 #226 — `a624b72` — BOTH structpb CARRIERS PINNED

**Why.** `TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` asserted ONE carrier. The
passthrough-GraphQL `remote_data` map has TWO independent values that `structpb.NewStruct`
rejects. **A ONE-CARRIER PIN ON A TWO-CARRIER PROPERTY IS A GREEN LIGHT FOR THE WRONG CHANGE** —
worse than no pin, because no pin issues no clearance. Fix carrier 1 alone and the test goes
green while the property still holds for a reason the test no longer knows about.

| Key | Built at | Go type | Carrier? |
|---|---|---|---|
| `labels` | `issueLabels()`, unconditional | `[]string` | **CARRIER, UNCONDITIONAL** |
| `sub_issues` | only when the issue has children | `[]map[string]any` | **CARRIER, CONDITIONAL** |
| `parent` | only when the issue has a parent | `map[string]any` | not a carrier |
| `sub_issues_summary` | only when children exist | `map[string]any` | not a carrier |

**WHAT GOES RED IF EITHER STOPS BEING ENFORCED** [MEASURED — each was mutation-proved]:
- `labels` converted to `[]any` (or to any representable form) → the carrier-1 assertion fails,
  because it requires `structpb.NewStruct` to RETURN AN ERROR on `{"labels": []string{}}`. Note
  the empty slice: `issueLabels` uses `make([]string, len(...))` and is never nil, so the carrier
  is present even on an issue with no labels. That unconditionality is recorded IN THE TEST, not
  only here.
- `sub_issues` converted to `[]any` → the carrier-2 assertion fails. It is asserted on a map
  containing **only** `sub_issues`, with no `labels` key, so it fails for its own reason and
  survives any future fix to `labels`. A one-map assertion carrying both keys would have gone red
  for carrier 1 and told you nothing about carrier 2.
- The two NON-carriers are asserted to SUCCEED. They are not decoration: they localise a future
  failure to `[]T` rather than to nesting. If `parent` starts failing, the cause is not the
  carrier property.
- The original positive control is **preserved verbatim**: `{"labels": []any{"bug"}}` must
  serialise. Without it, "NewStruct returns an error" is satisfiable by an instrument that errors
  on everything.

**Named non-carriers are load-bearing.** AN ENUMERATION'S INTERIOR OMISSIONS ANNOUNCE THEMSELVES
AND ITS TRAILING OMISSIONS CANNOT. The four keys are named so the next reader can see where the
list stops rather than inferring that it is complete.

## 7.2 #227 — `2fd3a61` — THE REASON WAS FALSE AND THE BEHAVIOUR WAS NOT

**STATE THIS IN EXACTLY THOSE TERMS, BECAUSE THE FAILURE MODE IS A READER GOING TO LOOK FOR A
BEHAVIOURAL REGRESSION THAT IS NOT THERE.** #227 changed a COMMENT — the reason string attached
to the `metadata` exemption. **THE CODE DID NOT CHANGE. THE EXEMPTION'S BEHAVIOUR DID NOT CHANGE.
`metadata` was exempt before this commit and is exempt after it, on identical terms.** There is no
behavioural delta to hunt for. `git show 2fd3a61 --stat` is one file.

**What was false.** The old reason read (in part): *"Not walked by sanitizeRemoteData:
`structpb.NewStruct` cannot represent `json.RawMessage` either, so it never reaches the wire at
all."* Both clauses are **true on the beads write and false after the ent round-trip**
[MEASURED on source]. beads writes `rd["metadata"] = json.RawMessage(...)`, and in that form the
claim holds. But **beads PERSISTS through the ent store**, and `field.TypeJSON` decodes on read.
After the round-trip the value is plain `map[string]any` / `[]any` — which IS walked and IS
representable. The exemption is therefore correct **because of the key's NAME** (not URL-bearing),
**not** because the value cannot reach the wire. On the persisted path it can, and the depth walk
classifies its nested keys.

**This is the adjacent-justification class**, and it is ranked above the homonym trap for a
reason: the reason was sound on the path the author had in mind and silent about the path they
didn't. **CORRECTNESS IS PRECISELY WHAT STOPS A CAREFUL READER LOOKING FURTHER.**

**REASONED-NOT-MEASURED, STILL CARRIED.** The claim that the stdlib JSON decode yields
`map[string]any` / `[]any` for this field is **[DERIVED]**, from `encoding/json`'s documented
behaviour for `any` targets. I did not execute a decode of a real beads `metadata` blob through
the ent store. That marking is written into the comment block in the test file itself and must
not be quietly upgraded to [MEASURED] by a later editor who "checks" it by re-reading the same
reasoning. It is discharged only by running the round-trip.

**The behaviour was NOT changed on this ruling**, per the standing instruction: if the behaviour
had also been wrong, the order was to STOP AND MESSAGE. It was not wrong.

## 7.3 #228 — `d305391` — PATH 12 PINNED

**Deliverable:** a pin that goes RED if `RemoteData` begins propagating onto the ephemeral-store
path via `taskToCreateParams`. Landed as `TestEphemeralGraphRouteDropsRemoteData` in
`internal/server/graph_routing_test.go`. **TEST-ONLY. No production file is touched**;
`taskToCreateParams` is unexported but in `package server`, so an in-package test reaches it and
the STOP-if-production-must-change condition did not fire.

**Why it matters.** Path 12 — the ephemeral graph store — is the ONE path from a
passthrough-GraphQL task to `taskToProto` containing a real serialisation round-trip.
`loadEphemeralStore` copies each task through `taskToCreateParams` into an in-memory SQLite store
and the inner handler reads it back. If `RemoteData` travelled it, `labels` would return as
`[]any`, `structpb.NewStruct` would stop failing, and passthrough `remote_data` would begin
reaching the wire — exactly what #226 asserts cannot happen.

**Today it does not travel, and the only thing stopping it is AN ABSENT LINE.**
`taskToCreateParams` copies fourteen fields and never assigns `RemoteData`, although
`store.CreateTaskParams` HAS the field — so the omission is a choice, not an unavailability.
**A MISSING FIELD IN A FOURTEEN-FIELD COPY READS TO EVERY FUTURE MAINTAINER AS AN OVERSIGHT TO BE
TIDIED UP.** Adding one line looks like a bug fix and would silently invalidate the premise with
nothing else in the tree going red. **SAFE BY OMISSION IS THE PREMISE-LEVEL FORM OF SAFE BY LUCK.**

**It pins the VALUE, not the spelling.** No grep for the absent assignment — that would be a guard
on today's spelling. The test drives a real `*ent.Task` carrying `RemoteData` (a URL-bearing key
plus the `[]string` `labels`) through the actual ephemeral store: mirror collection →
`taskToCreateParams` → `CreateTask` → `GetTask` → assert what ARRIVES is nil.

**Two controls, both load-bearing:**
- **Control 1 (`Title` is copied).** Without it, a nil `RemoteData` is equally consistent with
  `taskToCreateParams` having become a no-op or never having seen its input.
- **Control 2 (the store WOULD carry it).** The same params **with** `RemoteData` assigned are
  stored and read back **non-nil**. **AN ASSERTION THAT A VALUE COMES BACK NIL IS WORTH NOTHING
  UNLESS SOMETHING COULD HAVE COME BACK NON-NIL.** This proves the protection lives in
  `taskToCreateParams` and not in some downstream inability to persist the field — without it the
  pin would stay green after the copy started propagating, if the store happened to drop it.

**Mutation proof — three mutants, all RED** [MEASURED]:

| Mutant | Result |
|---|---|
| prod `taskToCreateParams` gains `RemoteData: t.RemoteData` | `--- FAIL:` on the property assertion, message printing the arrived map |
| fixture's `RemoteData` literal deleted | `--- FAIL:` on the vacuity guard |
| control 2's `withRemote.RemoteData = src.RemoteData` deleted | `--- FAIL:` on control 2 |

**Restore proof** [MEASURED]: `md5sum -c` OK on both files against pre-mutation checksums;
`git diff --stat -- internal/server/graph_routing.go` empty; `git status --porcelain` clean after
commit. The production file is byte-identical to what it was before the mutation.

**Regression** [MEASURED]: the same 8-way alternation used at 03:27Z and after #227 →
**8 PASS / 0 FAIL / 84 subtests**, per-parent census 15 / 6 / 63. Unchanged.

---

# 8. #234 — A LIMITATION ON MY OWN INSTRUMENT

**THE WRITE-SITE SCANNER DOES NOT READ `_test.go` FILES.**

`remotedata_depth_test.go` skips every directory entry whose name ends `_test.go`
(the `strings.HasSuffix(name, "_test.go")` clause in its read loop). [MEASURED — cited by content,
not by line, because A LINE NUMBER IS A POINTER INTO MUTABLE STATE.]

**Consequence, stated as a limitation and not as a finding:** every green that scanner produced
about anything in a `_test.go` file means **NOT SCANNED**, not **CLEARED**. The fail-closed
registry (H-1) is fail-closed over the set of files it reads, and that set excludes test sources.
Anyone treating a green here as coverage of test-file write sites is reading a clearance that was
never issued.

**How it was found, because the method matters more than the fact.** My #228 pin contains a
literal `withRemote.RemoteData = src.RemoteData` and a `RemoteData:` composite-literal key inside
`package server`. I ran the regression **expecting the registry to REJECT my own test as an
unregistered write site**, and logged that expectation to `_run-queue-log.md` before running. It
did not reject it. **THE GREEN WAS THE SURPRISE, AND CHASING IT IS THE ONLY WAY THIS CLASS GETS
FOUND** — a green nobody expected to be green is indistinguishable from a green everybody
expected, unless someone wrote the expectation down first.

**I am NOT proposing to widen the scanner.** ADDING A FORM MOVES A BLIND SPOT, IT DOES NOT CLOSE
ONE, and widening to test sources is the same move as widening to `internal/store` — already
ruled out. Filed as #234 and owned by the EM, who has disclosed it to all three review legs so
none inherits the false clearance.

---

# 9. PATH 12 — AN **OPEN** ITEM AGAINST MY OWN D1 WALK. NOT SOFTENED.

**MY D1 PERSISTENCE WALK MISSED PATH 12.** #228 pins it; that does not close this.

**What I claimed.** My D1 walk reported NOT PERSISTED with "UNDETERMINED edges: none." **That was
overstated.** The prior walk, `persistence-walk-194-r11.md`, had already found the ephemeral graph
store round-trip and documented it. I did not.

**Root cause, in one sentence: I BOUNDED THE SWEEP BY FILE WHEN THE CRITERION WAS WRITTEN OVER
PATH NODES.** I swept `passthrough.go`, `multistore.go` and five sampled server sites. Path 12
runs through `graph_routing.go`, which was not in my file set — so the predicate was never
evaluated there. The criterion was sound; the search space was not.

**THE POSITIVE CONTROL COULD NOT HAVE CAUGHT THIS, AND THAT IS THE GENERAL POINT.** My walk
carried a pre-registered positive control and it was green. Had `taskToCreateParams` copied
`RemoteData`, my walk would still have returned NOT PERSISTED, would still have been wrong, and
the control would still have been green. **A POSITIVE CONTROL ON THE DETECTOR DOES NOT VALIDATE
THE SEARCH SPACE.** It proves the instrument fires when pointed at the thing; it cannot prove you
pointed it everywhere. (Filed by the EM as rule 10.12-b, retracting their own earlier rule.)

**WHAT THE PERSISTENCE PREMISE ON THIS BRANCH ACTUALLY RESTS ON.** NOT PERSISTED is load-bearing
on **`persistence-walk-194-r11.md`**, the r11 walk — **AND NOT ON MY ENUMERATION.** My walk
independently reached the same verdict and agrees with r11's §4, including on both carriers, but
**agreement between a complete walk and an incomplete one is not corroboration of the incomplete
one.** The next person to read this file must not conclude that my enumeration certifies the
premise. It does not.

**Related, and also open: rule 10.16, knowing vs enforcing.** The second structpb carrier was
OBSERVED at r11 and never PINNED until #226. A reviewer asking "did anyone know about this?"
**succeeds** — and stops. That is why it survived. The same shape applies here: Path 12 was known
at r11 and unenforced until #228.

**Suppressive assurance, stated plainly:** a reviewer who checks the persistence question will
find a report that answers it correctly and will stop. My D1 report is one of the artefacts that
can produce that stop. **ENUMERATE THE PATHS FROM SCRATCH. DO NOT START FROM MY LIST.** The EM has
already instructed all three review legs to do exactly that, and that instruction is correct.

---

# 10. PROVENANCE CORRECTION, CARRIED FORWARD

"TWO CLEAN SEARCHES ARE NOT A BOUND" is **the EM's own formulation**, not mine —
`em-tooling/_STANDING-RULES-2026-07-29.md` lines 304–305 and `_broadcast-15.txt:41`. I held B15; I
am an application of the rule, not an independent witness to it. **A POINTER FROM AN INTERESTED
PARTY IS SAFE, BECAUSE IT RESOLVES OR IT DOES NOT. A QUOTATION FROM AN INTERESTED PARTY IS NOT,
BECAUSE NOTHING ABOUT IT FAILS.** Recorded here so the misattribution does not re-enter through
this file.

---

# 11. WHAT IS NOT IN THIS FILE

- The four flat `[UNCHECKED]` tables: owned BY THE EM, deferred to r6 (`t.Run` conversion).
- The collection-arm log pin: **ABSENT**, declined by the EM 03:39Z, not to be written.
- The `:606` `t.Logf` finding: filed separately as [LOW] against the differential test. **NOT
  MINE, NOT TO BE TOUCHED.**
- The seven unseen adapter sites, the six `internal/store` `SetRemoteData` sites: out of scope by
  standing ruling, deliberately not sanitized, deliberately not filed.
- `reports/dev-xss-r4.md`: reassigned to `xss-r4-reconstruct`.

**BUILD TOKEN: NEVER REQUESTED, NEVER HELD, NEVER SPENT** across the whole round. Every run was
class (b), named-selective, logged to `_run-queue-log.md` with `ROOT`/`DIST`/`DIST-PROVENANCE`
**before** execution. `DIST=PRESENT-PLACEHOLDER` throughout — so no green in this round is a
build; the Go runs are type-checks plus execution of named tests, and the web half
(`safe-url.test.ts`, `url-binding-scan.test.ts`) **WAS NEVER RUN BY ME**.
`git diff --name-only e6bda71..HEAD -- web/` → **0**.
