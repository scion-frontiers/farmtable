> # !! SUPERSEDED IN PART — READ THIS BLOCK BEFORE ANYTHING BELOW IT !!
> **Amended 2026-07-29 01:47Z by the EM. The original text is preserved unedited below
> (SUPERSEDE, NEVER ERASE); it is NOT the current instruction.**
>
> **§1 and deliverable 2 as written specify REPRESENTABILITY NORMALISATION AT THE SANITIZER'S
> EXIT. THAT IS CANCELLED AND MUST NOT BE BUILT.** `review-xss-r4` measured that exit-normalisation
> ARMS finding O1: today `structpb.NewStruct` ERRORS on the unrepresentable value and `:358`
> discards the field, so `parent.html_url = javascript:...` never reaches a client. **THE
> UNREPRESENTABILITY IS DOING SECURITY WORK BY ACCIDENT AND THE REMEDY REMOVES IT — FAIL-CLOSED
> BECOMES FAIL-OPEN, AND THE CHANGE THAT DOES IT IS THE SECURITY FIX.** `audit-xss-r4`
> independently filed that no normaliser should ship this round in EITHER form.
>
> **RULING: LOGGING ONLY.** Entry-normalisation (not exit) is the design of record for a later
> round, gated on OPEN-1, OPEN-3, and on `urlBearingRemoteDataKey` being replaced by a predicate
> that inspects VALUES rather than key NAMES.
>
> **AND THE LOGGING HAS A MANDATORY SHAPE — FORM E. SEE MY DISPATCH MESSAGE.** Writing the logging
> the obvious way (`, err =` / `, convErr =` / `:=`) makes both `convert.go` write sites INVISIBLE
> to the write-site scanner's regex, drops its census 6→4 against a `< 4` floor, and **THE SUITE
> GOES GREEN WITH THE TWO WIRE-PATH WRITE SITES UNSCANNED.** Measured by `test-xss-r4`.
>
> **ALSO FALSIFIED: §2.1's claim that the beads carrier is LIVE, and §2.2's claim that the two
> carriers "STAND OR FALL TOGETHER."** `dev-xss-r5` measured that beads has no passthrough store
> at all and its `buildRemoteData` map's only exit is into store params. The github carrier is
> live and direct (coordinator's persistence walk); the beads one is not. They are independent.

# BRIEF — dev-xss-r4-fix

**Round:** xss-r4 fix leg (round 5 of the XSS workstream)
**Base SHA:** `e6bda716` — pinned. Every file:line in this brief resolves there and NOWHERE ELSE.
**Branch:** `url-scheme-validation-r5` cut from `e6bda71`.
**Worktree:** `/workspace/farmtable-dev-xss-r5` — ASSIGNED, not chosen. Do not work in `/workspace/farmtable`.
**Build token:** you are the next holder. It is free as of 01:28:24Z. Ask before your first compile.

---

## 0. THE ONE THING THAT WILL COST YOU THE MOST IF YOU SKIP IT

**READ ALL THREE REPORTS YOURSELF, IN FULL, BEFORE YOU WRITE A LINE.**

- `reports/review-xss-r4.md` (~2140 lines) — 6 Required
- `reports/audit-xss-r4.md`  (~2251 lines) — REQUEST CHANGES, ZERO LIVE XSS
- `reports/test-xss-r4.md`   (Part H is the fix-shape section) — 5 Required, 6 Suggested

All three say **REQUEST CHANGES**. I am deliberately NOT summarising their findings below. This
round produced a named failure class called **SUPPRESSIVE ASSURANCE** — *an upstream artefact
accurate enough to be trusted and specific enough to make the downstream search feel redundant* —
and a manager's paraphrase of three reports is the purest form of it. My synthesis below is
restricted to things **no single leg could see**, because they required reading across legs.

Where this brief and a report disagree, **THE REPORT WINS AND YOU TELL ME.** My briefs have carried
errors in twenty-one consecutive rounds; the running ledger is tasks #76, #105, #110, #121, #130,
#142, #150, #155, #164. That is not modesty, it is a measured base rate. **Reading this brief
credulously is the single highest-probability way for this round to fail.**

---

## 1. THE REMEDY HAS CHANGED SINCE THE LEGS REVIEWED IT

The three legs reviewed **"drop the offending key at two call sites."** That is NOT what you are
building. Coordinator ruling, verbatim:

> THE REMEDY HAS CHANGED, SO THE REVIEW OF THE OLD REMEDY NO LONGER APPLIES. […] It alters the
> sanitizer's POSTCONDITION, which every caller's assumptions rest on. Do not let a remedy grow
> past its review silently; that is how a fix becomes the next round's finding.

**WHAT YOU ARE BUILDING: [[CANCELLED — SEE HEADER]] representability normalisation at the sanitizer's EXIT, plus logging the
discarded `structpb` error at `convert.go:358` and `convert.go:534`.**

Delta opinions from the three legs are inbound to me. **If a delta opinion lands mid-flight I will
relay it by message — and per this round's own rule, AN AMENDMENT TO A LIVE DELIVERABLE MUST BE
PUSHED, NOT LEFT ON DISK. A file edit is not a notification.** I will not silently edit this brief
under you. If you see this file change, that is a bug and you should tell me.

---

## 2. WHY IT IS A TYPE AND NOT A PATCH — CREDIT WHERE IT IS DUE

`review-xss-r4` filed this as O1/O2 an hour before anyone acted on it: **"the fix is a TYPE not a
patch."** I read it as a stylistic preference. It was right, it was first, and it was in writing.

The mechanism, measured at `e6bda71`:

`sanitizeRemoteValue` in `internal/server/urlvalidate.go` is **type-preserving** — it faithfully
returns whatever Go type it was handed. `structpb.NewStruct` accepts `map[string]any`, `[]any`,
`string`, `float64`, `bool`, `nil`, the integer types. It **rejects `[]string` and
`[]map[string]any`.** So the sanitizer hands `structpb` a value it cannot represent, **on the
sanitizer's own SUCCESS path**, and the discarded error at `:358` then **nils the ENTIRE field.**

### 2.1 THE CARRIERS — TWO, NOT ONE. THE SECOND IS MINE AND IT IS LIVE. (task #207)

I verified both at `e6bda71` with `git show`, with a control confirming the extractor can return
nothing:

| carrier | site | adapter |
|---|---|---|
| `[]string` (labels) | audit's C-1 | github |
| `[]map[string]any` | `internal/platform/github/graphql_queries.go`, `rd["sub_issues"] = subs` | github |
| `[]map[string]any` | `internal/platform/beads/beads.go`, `rd["dependencies"] = deps` | **beads** |

**FOR GITHUB THE SECOND CARRIER IS REDUNDANT** — C-1's unconditional `[]string` labels already nils
every passthrough task. **FOR beads IT IS NOT. beads IS A SECOND ADAPTER AND C-1 NEVER CONSIDERED
IT.** There the slice-of-maps is the *only* carrier.

**AND INSIDE THE beads LITERAL: `"metadata": dep.Metadata`** — the field the coordinator named as
**NEVER-WALKED**, of unknown Go type, sitting inside the carrier. **Your normalisation must COVER
it, not enumerate around it.** If you find yourself writing a list of key names, stop and re-read
this paragraph.

### 2.2 THE SINGLE PREDICATE — READ THIS BEFORE YOU BELIEVE ANY OF SECTION 2

Both carriers reach `structpb` **only if the adapter map arrives without a JSON round-trip** (a
round-trip normalises `[]string` → `[]any` and `[]map[string]any` → `[]any` and kills both). I
measured that `passthrough.go` builds an **in-memory `ent.Task` struct literal** —
`RemoteData: issueBuildRemoteData(...)`, not persisted.

> **THE TWO CARRIERS SHARE EXACTLY ONE REACHABILITY PREDICATE, AND IT IS THE SAME ONE C-1 RESTS ON.
> THEY STAND OR FALL TOGETHER — SO THIS PREDICATE IS A SINGLE POINT OF FALSIFICATION FOR THE ROUND'S
> HEADLINE FINDING.**

**I MEASURED THE STRUCT LITERAL. I DID NOT WALK EVERY PATH FROM IT TO `taskToProto`.** That walk is
the highest-value unmeasured item in the round. **It is DELIVERABLE 1 below and it comes FIRST,
because if it comes back "persisted", C-1 dies, carrier 2 dies, and you should not have written the
fix at all.**

Note the ordering rule this obeys, which the coordinator imposed on me twice tonight and which cost
me nothing both times: **THE REMEDY IS INVARIANT TO THE ANSWER; THE RATING IS NOT.** Normalisation
is correct whether or not anything reaches the carriers today. So the *fix* does not wait on the
measurement — **the SEVERITY does. DO NOT PUBLISH A TASK-PATH SEVERITY.**

### 2.3 THE REASONING I GOT WRONG, SO YOU DO NOT INHERIT IT

I told the coordinator the collection path was safe because the sanitizer is **type-preserving**.
`audit-xss-r4` corrected me and it is right:

> **THE PROTECTING PROPERTY IS REACHABILITY, NOT PRESERVATION. JSON decoding produces `[]any` and
> `map[string]any` and NEITHER `[]string` NOR `[]map[string]any`, so a JSON-decoded input cannot
> reach either de-novo arm.**

Why that is load-bearing and not pedantic: my framing **would survive unchanged if someone added
`case string: return []string{tv}, true`**, and the closure would break silently. Reachability is a
local, per-arm check. Preservation is a global property nobody re-derives. **Your fix should make
the property local and checkable at the exit, which is precisely why it is normalisation.**

---

## 3. THE FIX-SHAPE CORRECTIONS FROM `test-xss-r4` PART H — READ PART H DIRECTLY

Its own summary, which I am relaying because it changes how the work is *decomposed*, not just what
it contains:

**H-1 — REQUIRED 1 AND REQUIRED 2 ARE ONE FIX. DO NOT BUILD THEM AS TWO.**
Both enumerate the same set: which files legitimately write `RemoteData`, and where. Building them
separately yields **TWO REGISTRIES THAT CAN DRIFT APART — two sources of truth for one set of write
sites, which is EXACTLY THE DEFECT CLASS THIS ROUND EXISTS TO ELIMINATE.** One declared registry
keyed by file, carrying per-file expected sites and any exemption, consumed by both assertions.
**IT MUST FAIL CLOSED ON AN UNKNOWN FILE, not merely on a count mismatch** — otherwise it reproduces
the magnitude-floor defect at a new address. That property also closes R7.

**H-2 — ITS OWN REQUIRED 2 SPECIFIES THE WRONG KEY. DO NOT BUILD IT AS WRITTEN.**
It said "key the exemption on FILE + LINE + TEXT." **DROP THE LINE NUMBER.** Three demonstrations
tonight that a line number is a pointer into mutable state and not an identity: its own D-10 (project
log citations drifted +4), my `convert.go:534` near-miss (resolved to unrelated code in a divergent
tree), and its own R10 — **the exemption compares `strings.TrimSpace(line)` and the line number never
enters the comparison at all.** A line-keyed exemption breaks fail-closed, which is safe, but breaks
often and for no reason, and **AN EXEMPTION THAT GOES RED ON UNRELATED EDITS TRAINS DEVELOPERS TO
UPDATE EXEMPTIONS WITHOUT READING THEM.**
- **BEST:** an in-source `nolint`-style annotation at the site. Moves with the line, zero drift, and
  a colliding new file must *deliberately* add it — a visible, reviewable act in the diff.
- **MINIMUM:** file + text.

**H-3 — REQUIRED 4 IS A SHAPE DEFECT AND ONE FIXTURE ROW DOES NOT FIX IT.**
Arm 2 is documented **UNIVERSAL** over the whole file. One destructuring row makes it survive *that*
form; the claim stays false for `Object.assign`, spread, computed property, `||=`, comma operator.
**The precedent is in this very diff: X6 replaced regex with an AST walk for adapter remote_data
keys.** Two acceptable shapes: (a) make arm 2 actually universal via AST, or (b) **retire the word**
— redocument as an ENUMERATED set of assignment forms and pin the enumeration.
**NOT ACCEPTABLE: one fixture row under an unchanged universality claim. THE CLAIM IS WHAT TELLS THE
NEXT READER THEY NEED NOT CHECK.**

**H-4 — Required 5:** content, unless you take the "perform the reconciliation" branch. **If you take
the cheap branch, the comment MUST SAY THE RECONCILIATION HAS NOT BEEN PERFORMED.** Softening it into
something that merely stops being false reproduces the defect in a quieter register: **a guard whose
stated reason is wrong is a guard the next person removes for the wrong reason, and "wrong" includes
"vague."**

**H-5 — SEQUENCING, one constraint only:** the registry (Required 1+2 as a single change) **MUST LAND
BEFORE ANYTHING ELSE TOUCHES THE WRITE-SITE ORACLE.** Required 3, 4, 5 are mutually independent.

---

## 4. THE VOCABULARY PROBLEM — `audit-xss-r4` C-7′

Three names in this tree lie, **and all three err in the same direction: THEY OVERSTATE THE SAFETY OF
THE MECHANISM.**
- `sanitizeRemoteData` — names a repair, performs a deletion
- `urlBearingRemoteDataKey` — names a property of content, tests only the key NAME
- `...NeverSerialises` — names a control, describes a bug

The third is the sharpest thing found tonight. That test's failure message reads *"structpb.NewStruct
now accepts []string. The passthrough path can therefore ship remote_data."*
**IT EXISTS TO FIRE WHEN THE BUG IS FIXED. A guard named `NeverSerialises` whose RED state means THE
DATA FLOWS AGAIN.**

**YOUR FIX WILL TURN THAT TEST RED. THAT IS THE TEST WORKING AS WRITTEN AND THE NAME BEING WRONG.**
Do not "fix" it by weakening your change. Rename it to state the property it actually guards, and
say so in the commit message. **THE NAME IS THE SPECIFICATION** — standing rule, ninth instance
tonight.

Credit where it is load-bearing: **that same test carries a genuine positive control** ("the identical
map with a structpb-representable slice builds fine, so the failure is about the value type and not
about NewStruct being broken"). C-1 rests on that controlled in-tree measurement. **Preserve the
control when you rename the test.**

---

## 5. DELIVERABLES — IN THIS ORDER

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

---

## 6. NON-NEGOTIABLES

- **DO NOT PUSH.** Commit locally. Pushing is the manager's, exclusively. No exceptions.
- **DO NOT TOUCH `/workspace/farmtable`.** Your worktree is `/workspace/farmtable-dev-xss-r5`.
  **NOTHING in `/workspace/farmtable-em-verify195` is to be touched** (standing coordinator ruling).
- **Phase 1 is merged, deployed, and LIVE IN PRODUCTION. Do not touch it, do not redeploy it.**
- **ONE BUILD TOKEN EXISTS PROJECT-WIDE AND I HOLD IT.** Ask before every compile or suite run.
  An unannounced full-suite run is a resource incident. Measured budget for a targeted Go run in a
  detached worktree: **~10s, NOT ~90s** — the Go build cache is content-keyed, so a detached worktree
  of an already-built tree inherits the cache (measured by `test-194-r11` at 01:28Z; my earlier
  cold-cache figure was wrong and is withdrawn).

### 6.1 APPARATUS — EVERY ONE OF THESE COST A LEG REAL WORK TONIGHT

- **QUOTE EVERY GLOB.** `--include='*.go'`. This is **zsh, not bash**: an unquoted `*.go` that matches
  nothing is a **FATAL EXPANSION ERROR THAT TERMINATES THE ENTIRE COMMAND LINE.**
  **`;` DOES NOT PROTECT YOU — that mitigation was measured and refuted tonight** (`;` separates
  commands; this error is raised before commands exist). Run `unsetopt nomatch` once at session
  start as a safety net — but it retires *aborts*, **not wrong answers**. Quoting is the real fix.
- **ABSOLUTE PATHS, ALWAYS.** The harness resets cwd to `/workspace` between Bash calls.
  **A RELATIVE PATH IN A SHELL WHOSE cwd SILENTLY RESETS IS A WRITE TO A FILE YOU DID NOT NAME.**
- **A SENTINEL YOU ACTUALLY READ** at the end of every batch. *A control you do not look at is
  decoration.*
- **`cmd | tail` REPORTS `$?` FROM `tail`.** Never chain `&&` behind a pipe. `set -o pipefail`.
- **BACKTICKS IN `scion message` EXECUTE.** Write the body to a file with a quoted heredoc
  (`<<'EOF'`) and send `"$(cat file)"`.
- **RESTORE CERTIFICATION IS FIVE CHANNELS, NOT THREE:** `git diff`; `git status --porcelain -uall`;
  `git clean -nxd`; `find -type d -empty` (an abandoned `mkdir` is invisible to the first three);
  **`git worktree list`** (`git worktree add` writes `.git/worktrees/<name>/`, which defeats all four
  others). And **all five are REPO-SCOPED — none can see writes to the shared volume.**
- **A CENSUS OF WRITE VERBS MISSES EVERY COMMAND THAT WRITES AS A SIDE EFFECT.** Census over
  *commands with effects*, not verbs that look like writing.

### 6.2 EVIDENCE STANDARD

- **EVERY `file:line` CARRIES ITS SHA.** A pointer is sound iff its target is content-addressed.
  I resolved a leg's citation in a divergent tree tonight and was one sentence from filing a
  fabrication charge. **THE WRONG TREE RETURNED WELL-FORMED CONTENT, so nothing signalled.**
- **EVERY NULL RESULT OWES A POSITIVE CONTROL** — *a null result from an instrument is
  indistinguishable from a misaimed instrument.* And it runs **both ways**: misaimed instruments
  produce false positives as readily as false negatives (24 fabricated detector results tonight
  across five legs).
- **A POSITIVE CONTROL MUST BE ABLE TO FAIL INDEPENDENTLY OF THE INSTRUMENT IT CONTROLS.** A control
  written in the instrument's own idiom shares its failure mode and **is worse than no control,
  because it converts an unexamined null into an apparently-examined one.**
- **THE ESCAPE, and it is the cleanest result of the night** (`test-194-r11`):
  **A MIXED NAMED RESULT IS SELF-CONTROLLING FOR AIM; A UNIFORM RESULT NEVER IS.** A filter matching
  nothing yields zero of both; a filter matching the wrong things yields the wrong *names*. Controls
  passing while attack rows fail **in the same invocation** cannot be an aiming artefact. It escapes
  the idiom trap because **A CONTROL THAT IS A PROPERTY OF THE OUTPUT CANNOT SHARE THE INSTRUMENT'S
  IDIOM.** Prefer this shape over a second invocation.
- **BEFORE RUNNING A DIFFERENTIAL, PROVE THE INSTRUMENT IS THE SAME OBJECT ON BOTH ARMS, BY CONTENT
  HASH, NOT BY INSPECTION.**
- **DISTINGUISH MEASURED FROM DERIVED IN EVERY SENTENCE YOU WRITE.** Tonight's headline failure is
  **THE SELF-CERTIFYING DIFF** — the artefact under review carrying the evidence for its own
  correctness — because **A BELIEF WRITTEN DOWN IS INDISTINGUISHABLE FROM A MEASUREMENT WRITTEN
  DOWN.** Your commit messages and comments are exactly where this happens.

### 6.3 THE THREE FAILURE CLASSES THIS ROUND NAMED — ALL THREE ARE THE SAME DISEASE

1. **THE SELF-CERTIFYING DIFF** — the artefact carries its own evidence.
2. **THE NO-ACTION LABEL** — a defect filed under a category that implies no action and rediscovered
   later at full severity. Four instances tonight. Its other form: **a finding received in the wrong
   register** (§2 — I read "the fix is a TYPE not a patch" as a style note for an hour).
3. **THE LOAD-BEARING COINCIDENCE** — a **correct** conclusion resting on a **false** premise. Three
   tonight, one of them mine (§2.3). **More dangerous than a wrong conclusion, because a wrong
   conclusion eventually contradicts something and a right one never does.**

> **THE RECORD'S LABELS, RATINGS AND STATED REASONS HAVE COME UNCOUPLED FROM THE FACTS, AND
> EVERYTHING STILL READS AS FINE.**

---

## 7. TERMINATION

**You MUST complete deliverable 1 before writing code; complete deliverables 2–5; write the project
log entry; commit your work; report to me with MEASURED and DERIVED separated — and then mark the
task complete.**

Report to `farmtable-em-task-state-model-v2` via `scion message`. If you are blocked, say so and say
on what; do not proceed past an ambiguity. **If you believe this brief is wrong, that is a finding,
and it is the finding I most want.**
