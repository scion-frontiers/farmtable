# safe-url ADD/ADD adjudication — Phase 1 halted on a security-policy contradiction

Date: 2026-07-29
Scope: `web/src/util/safe-url.ts`, `web/src/util/safe-url.test.ts`
Full union table: `/scion-volumes/scratchpad/projects/farmtable/reports/safeurl-union-table.md`

## What this was

An ADD/ADD collision: two tracks independently wrote URL scheme validation.
Neither is the canonical version.

| Side | Commit | impl blob | test blob |
|---|---|---|---|
| MAIN | 439b309 | 659ef58 | c3e1b5c |
| BRANCH | 633f8f2 | d85bb5b | a9e49ff |

Adjudicated from a leg tree cloned from the local path
(`file:///workspace/farmtable`), never the network remote; every read was
`git show` against a named blob SHA rather than a working tree.

## Ordering

Tests were enumerated in full **before either implementation was opened**, on the
coordinator's ruling that each side's tests are the written record of what that
side knew about the attack surface. Blobs 659ef58 and d85bb5b remain unread. The
ruling paid for itself: the contradiction below is visible only in the tests, and
picking an implementation first would have silently retired one side's policy.

## The three integers

> **LABEL REPAIR, struck in place, not deleted.** The three bullets below called
> 49 and 45 **rows**. Wrong noun: they are **distinct-input** counts. The numbers
> and all downstream arithmetic were correct — a verified quantity joined to the
> wrong unit, the defect that cannot go red.

- ~~MAIN rows: **49** (35 inline in c3e1b5c + 14 contributed only by fixture blob
  4a54328, `testdata/url-scheme-cases.json`)~~
- ~~BRANCH rows: **45** (all inline in a9e49ff; BRANCH has no fixture)~~
- ~~UNION rows: **82** (49 + 45 − 12 identical (input, verdict) pairs)~~

Restated, unit named every time:

- MAIN: **49 distinct inputs**, **78 rows** as assertion occurrences — Tier A
  inline in c3e1b5c is 36 rows over 35 distinct inputs, Tier B fixture 4a54328 is
  42 rows over 42 distinct inputs, overlapping on 28 inputs.
- BRANCH: **45 distinct inputs**, **45 rows** — no input asserted twice,
  machine-verified.
- UNION: **81 distinct inputs**, **82 rows** as distinct (input, verdict) pairs
  (49 + 45 − 12 identical pairs).

**78 and 82 are on different bases and must not be compared**: 78 counts
assertion occurrences, 82 counts distinct (input, verdict) pairs. A reader who
sets them side by side would conclude BRANCH added four rows. It added **32
distinct inputs**.

`http://[::1]/x` is asserted by both sides with opposite verdicts, so it is two
pairs over one distinct input and is deliberately not deduplicated —
deduplicating it would make the table self-consistent and destroy the finding.

The union does **not** equal the MAIN count. BRANCH contributes 32 distinct
inputs (33 rows on the pair basis). The "branch contributed nothing" alarm does
not fire.

Row-number lists backing each integer are published in the report; a bare count
cannot distinguish a leak from growth.

## Finding: a MAIN-only third artefact

MAIN's test does not hold all its rows inline. It asserts against
`testdata/url-scheme-cases.json` (blob 4a54328), which **does not exist at
633f8f2**. That file is the client half of a server/client differential pin whose
other half is `TestValidateURLFieldMatchesSharedFixtures` in
`internal/server/urlvalidate_differential_test.go`. Dropping MAIN's test blob
leaves the Go half asserting against a fixture nothing on the client checks — and
it stays green while doing so.

## STOP: the two tables contradict

Halted per the stop condition. Not resolved in either direction; escalated as a
standalone question.

1. **`http://[::1]/x` — byte-identical input, opposite verdicts.** MAIN accepts
   (fixture blob 4a54328, case `"ipv6 host"`, `client: accept`, enforced at
   c3e1b5c:285). BRANCH rejects (a9e49ff:76). Unarguable.
2. **The `http:` scheme itself.** MAIN accepts `http://example.com/x`
   (c3e1b5c:126, asserted returned unchanged). BRANCH rejects
   `http://example.com/issues/1` (a9e49ff:39) and rejects loopback http in
   production too (a9e49ff:65), pinning the intent at a9e49ff:59–63 with
   `LOCAL_HTTP_LINKS_ENABLED === false`.
3. **Embedded credentials (userinfo).** MAIN accepts
   `https://user:pass@example.com/x` (c3e1b5c:130). BRANCH rejects the whole
   class (a9e49ff:49–52), reasoning that the call sites render static link text
   so the status bar is the user's only cue.
4. **Return contract (divergence, not admit/reject).** MAIN requires byte-identity
   (`safeHref(input) === input`, c3e1b5c:132–137). BRANCH requires normalisation
   — lowercased scheme, trimmed, trailing slash added (a9e49ff:84–98). These
   cannot both hold.

The underlying question is not a merge conflict: **is this helper a scheme
allow-list (MAIN) or a destination-trust gate (BRANCH), and is `http:` admissible
at all?** Two teams disagreeing about security policy, discovered by accident.

## Note on the disclosure

The requester disclosed that MAIN is their own track's work. Contradictions 1–3
all run against MAIN (it admits what BRANCH refuses). That is what the artefacts
say; it is recorded as measured, and it is not a quality judgement — BRANCH's
threat model is broader, MAIN's scope is narrower and its server counterpart
agrees with it. The ruling is the coordinator's.

## Corrections made in place

1. **IPv6 double-count.** A presentation row (line 82 of the report)
   double-counted BRANCH's IPv6 rejection, making the BRANCH column total 46
   against a stated 45. Caught by machine-checking the published columns rather
   than by re-reading. Struck through in place, not deleted; the integers were
   unaffected. Carried in commit **c623332**, SHA fill-in in **1713ce8**.

2. **Unit label.** 49 and 45 were labelled "rows" when they are distinct-input
   counts. Struck and restated above.

3. **A phantom SHA, corrected against the coordinator.** The coordinator's
   acknowledgement credited correction 1 to commit **9f81b8f**. No such object
   exists — `git cat-file -t 9f81b8f` returns `fatal: Not a valid object name`,
   exit 128. It was a forward-reference I drafted before the commit existed and
   then withdrew, and it leaked into the record from the draft. The real SHAs are
   c623332 and 1713ce8. Recorded because a correction credited to a nonexistent
   object is unverifiable, and this project has already lost time to exactly this
   class of defect.

**Process note.** I reached for an unmade SHA three times while writing this up.
Each was caught and removed before commit, but the rate is the finding: forward-
referencing a commit that does not yet exist produces a right-format, wrong-value
identifier that no check catches. Cite only SHAs already returned by
`git rev-parse`.

## Phase 2 — status superseded below

~~Not started, and cannot start. Running both implementations against a union table
whose contested rows assert mutually exclusive verdicts would measure the
disagreement, not resolve it. Once the policy question is ruled on, the losing
side's contested rows are retired explicitly and the remaining uncontested rows
become the merged table.~~

Struck, not deleted: rulings arrived (C3 reject, C2 allow-by-default) and Phase 2
ran. Results below.

## Phase 2 — Arm A and Arm B, executed

Full config-labelled table: the report. Harness and arm definitions mirrored to
`/scion-volumes/scratchpad/projects/farmtable/reports/safeurl-arm-harness/` —
those are non-ref artefacts and no bundle would carry them.

Both pristine subjects were re-hashed to 659ef58 / d85bb5b before any run.

**Arm A (conformance).** Each side passes its own rows completely — 49/49 and
45/45, the control that proves the table was transcribed correctly. MAIN fails 23
of BRANCH's 45; BRANCH fails 10 of MAIN's 49. **Each fails rows the other passes:
the answer is a merge, not a winner.** After the C3 ruling retires MAIN's
userinfo row, the only C2-independent conflict left is the **return contract**
(row 44, `HtTpS://example.com` — identity vs normalisation).

**Arm B (kill power).** Mutants are real: `numstat 1 63` for MAIN — independently
reproducing dev-xss-r9's figure — and `1 25` for BRANCH. Neither is 0. The
flag-on build is `1 2` and is labelled a **config selection, not a mutant**.

- MAIN disarmed: 31 kill / **18 vacuous**
- BRANCH disarmed: 41 kill / **4 vacuous**

**The finding: MAIN's identity return contract cannot kill a passthrough, by
construction.** MAIN asserts `safeHref(input) === input`; a passthrough returns
`input`; so all 16 of MAIN's accept rows are vacuous — 0 kills from 16. BRANCH's
normalising contract kills on 3 of its 5 accepts (78, 79, 80), staying vacuous
only where the input is already normalised (77, 81). This is an oracle-strength
argument and is independent of the C2 policy question.

**18-vs-21 resolved by execution: 18 — and my derivation was wrong.** I had
predicted 18 by subtracting BRANCH's 3 normalising accepts from 21 accepts across
both sides. The measured 18 is `null` + `undefined` + MAIN's 16 accepts: same
number, unrelated cause. Recorded because a right number from wrong reasoning is
not evidence, and this is the third instance today of a right-format value with a
wrong basis (after the unit label and the phantom SHA).

## C1 decided on its merits — not carried forward as settled

The coordinator reversed its own C1 hold once the C2 default flipped, because the
precondition I had recorded (d85bb5b:65 kills http before host reasoning) no
longer holds. Measured under the permissive branch:

- `http://0x7f000001/x`, `http://0177.0.0.1/x` and fullwidth `http://127．0．0．1/x`
  all normalise to hostname `127.0.0.1` and are **admitted** — exactly what
  BRANCH's own test comment and its d85bb5b:16–22 docblock warned would happen.
- `http://[::1]/x` is still **refused**, because `LOCAL_HOSTNAMES` holds only
  `localhost` and `127.0.0.1`. The hex-encoded IPv4 loopback gets in; the IPv6
  literal does not.

Under allow-by-default http, C1 stops being about IPv6 and becomes: *is loopback
a category to control separately from plaintext http?* If yes, `LOCAL_HOSTNAMES`
is the wrong shape — it omits `[::1]` and is consulted only inside the http
branch. Recommendation recorded; **nothing implemented**.

## Row 62 is mislabelled, and the config split is what found it

BRANCH names row 62 "backslash userinfo trick is rejected". Measured,
`new URL('http://evil.example\\@localhost/')` yields hostname `evil.example`
with `username` and `password` both empty. **There is no userinfo in it.** It is
rejected purely because `http:` is blocked, so under the ruled allow-by-default
the rejection evaporates while the name still claims a userinfo mechanism. Row 61
(`http://localhost@evil.example/`) genuinely does carry userinfo and is correctly
C2-independent. The two look like a matched pair and are not one. Flagged, not
fixed.

## Neither side implements the ruled default

C2 was ruled plaintext http **allowed to any host** by default, switch blocking.
MAIN has no switch. BRANCH's switch is loopback-scoped and polarity-inverted, and
the ruling requires it renamed — `LOCAL_HTTP_LINKS_ENABLED` would govern *all*
http, not local http, and would ship meaning the opposite of its name. Reject UX
remains open; neither reject behaviour has been built against, so neither can
become the default by being the one that exists.

## Durability (defect-7 advisory, 15:41Z)

`for-each-ref` does not list an unreachable tip and `git bundle --all` does not
pack one, so both prescribed instruments are blind to the same class. Ran all
three sweeps — fsck-unreachable, reflog, and `--all HEAD` — and verified by
restoring the bundle rather than by `git bundle verify`. Durability numbers are
in the report; the operative predicate is **"is this object absent from every
store outside my container"**, not "is it reachable from origin/main", which
false-positives on every unmerged branch.

## Reject UX ruled: neither side, and the merge base splits

Owner ruled inline deactivated marker plus the original address in selectable,
copyable form. Neither implementation does this; it is new code, not a merge
pick. Flagged to the coordinator immediately per instruction.

Refinement to the coordinator's read: MAIN's DOM test is **not** wholly retired.
Of six assertion groups in c3e1b5c, **two die** (488–491 and 569–572, both title-
attribute delivery, killed by constraint 4) and **four survive**, including both
anti-vacuity controls (495–507, 576–582). The no-href assertions at 483–484 and
560–563 are constraint 1 verbatim.

**MAIN's canary could never have gone red on markup.** It asserts the payload
appears in a `title` attribute. An attribute value cannot contain elements, so
the assertion is structurally incapable of detecting an unsafeHTML render — inert
by the parser's construction, not by the code's. The ruled design (text node or
input value) is the first variant of this feature in which the mandated canary is
expressible at all.

**Merge base splits.** Rendering harness → 439b309 (only side with a lit+JSDOM
harness; a9e49ff has zero DOM tests). Validator → 633f8f2 (C3 ruled its way; Arm
B measures its return contract killing 3 of 5 accepts against MAIN's 0 of 16).
The harness column favours the requester's own track and is the weaker claim —
scaffolding ports cheaply, measured behaviour does not. Flagged, not decided.

## C1 decided, precondition named

**Reject `http://[::1]/x`; retire MAIN's fixture case "ipv6 host" rather than
port it.** Rests on exactly one precondition: **P1 — loopback is a category
controlled separately from plaintext http.** If P1 is false, C1 dissolves and
rows 64–71 are BLOCKING-only artefacts. Nothing else to unwind.

Grounds, measured under CARVEOUT: `LOCAL_HOSTNAMES` is over-inclusive
(`0x7f000001`, `0177.0.0.1`, fullwidth all normalise in) **and** under-inclusive
(`[::1]` is not in the set) simultaneously. It implements "block a two-element
string list", not "block loopback". Replacement is a predicate over the parsed
host; not written, because C2's ruled default is unimplemented on both sides.

## Flag rename: two defects, and the rename fixes only one

Polarity is wrong (ships `false`, ruled default is allow) **and scope is wrong** —
`LOCAL_HTTP_LINKS_ENABLED` governs http to `LOCAL_HOSTNAMES` only (d85bb5b:66
conjunction), while the ruled switch governs all plaintext http. Renaming alone
would put a whole-scheme name over loopback-scoped logic: a right-shaped name
over wrong-scoped code, the same defect class as the unit label and the phantom
SHA. Both must change together. Not implemented.

## Durability numbers

Sweeps: fsck **0** unreachable/dangling commits; reflog **6** SHAs promoted to
`refs/preserve/reflog/*`; refs 210 → 216. Bundles both kept:
baseline `--all` **3,059,832 bytes / 211 refs**, corrected `--all HEAD`
**3,060,450 / 217**. Delta +618 bytes, +6 refs — ref entries only, no object
payload, because this leg had nothing unreachable to rescue. Verified **by
restore**, not by `git bundle verify`: all five commits `cat-file -e` exit 0 in
both restores, 10 of 10.

Durability predicate — **absent from every store outside this container: 5 of 5**
(exit 1 against /workspace/farmtable). Ancestry deliberately not reported as the
finding. Canonical `main` resolved by name is 2982ffd; canonical HEAD sits on
`task-state-web-ui-v2`, so `FETCH_HEAD` would have returned 633f8f2 and the
ancestry test would have exited clean against the wrong branch.

All five commits still exist in exactly one place. The bundles are shared storage,
not a git store. **Do not retire this leg until the refs are fetched out.**
