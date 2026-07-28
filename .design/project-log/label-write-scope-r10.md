# #194 label-write scope — round 10

Base `06f01d7d6555a311fcd0728eac40335e654c1de6`, branch `label-write-scope-r10`.

Gate baseline reproduced in this clone at the base SHA before any edit:
`go build ./...` 0; `go vet ./...` **1**, exactly four pre-existing copylocks, all
reading `assignment copies lock value to ephReq`, at `internal/server/server.go:{1782,
1892,2100,2277}`; `git status --porcelain` empty. Same three at the end of the round, with
the same four vet messages and no new ones. `go test ./... -count=1 -skip 'TestWatchTasks'`
exits 0, with a tripwire grepping every run's output for `TestWatchTasks` (0 hits each
time, so the exclusion is doing what the flag says).

Probe cells left dirty: **zero**. Every mutation arm was reverted by `cp` from a `/tmp`
snapshot and `git status --porcelain` asserted empty after each group.

---

## D1 — the pricing-path collapse: EM's (b) CONFIRMED, and it is incomplete

**Prediction recorded before measuring** (from reading only): (b) is right that
`AllTerminalLabelStages`'s own guard short-circuits first, and wrong that it is *the*
cause, because `lifecycleStagesForLabels` falls through to `IssueToPhaseStage` →
`MapLabelsToStage`, which is separately guarded at `labels.go:393`. Predicted that
unguarding `:198` alone would change nothing and that non-terminal shapes would stay
collapsed even with both `terminal_label_stages.go` guards removed.

**Both halves of the prediction held.** Four mutation arms, eight label-delta shapes,
`LabelDeltaLifecycleStages` measured end to end through `GitHubPassThroughStore`:

| arm | mutation | result at `enabled=false` |
|---|---|---|
| A | none (baseline) | **8/8 shapes collapse to PRICED=false** |
| B | unguard `AllTerminalLabelStages` (`:198`) only | no change — 8/8 still collapsed |
| C | unguard `authorizationStage` (`:70`) only — **the r9 remedy** | no change — 8/8 still collapsed |
| D | unguard both | terminal shapes priced; the two non-terminal shapes still collapsed |
| E | D + unguard `MapLabelsToStage` (`:393`) | full parity with `enabled=true` |

**Positive control**: at `enabled=true` the same harness discriminates 7 of the 8 shapes
(`PRICED=true`), and correctly reports the eighth — adding an unrelated label — as free.
So a `PRICED=false` reading is a measurement, not a dead harness.

In arm C, `authorizationStage("ft:stage/completed")` returns `("completed", true)` at
`enabled=false` — the r9 remedy is demonstrably in place and working — and every shape is
still unpriced. **A round scoped to the r9 remedy would have fixed the backstop, passed
review, and left the finding open.** The EM's instinct to check this first was correct.

Where the EM's (b) needs amending: it names guard `:198` as "the cause". There are
**three** independent suppressors and no one or two of them is sufficient. Diagnosis by
"the first guard on the path" is what produced the single-cause framing, and it is the same
shape as the round-9 "the gate itself is at `server.go:840-860`" error the brief itself
flags.

Confirmed EM's (a) exactly: `len(labelToStage) == 10` at `enabled=false`. The mapping data
is toggle-blind; only accessors suppress it.

### A finding neither the brief nor r9 had: axis 2 is not a toggle problem

Measured at **`enabled=true`**, current config `push_prefix: "ft:"`:

```
add "ft2:stage/completed"   before=[accepted] after=[accepted]   PRICED=false
```

The foreign-prefix gap is live with the toggle **on**, under the **default** config, with no
config change of any kind. The brief already says axes 2 and 3 "need no toggle at all", so
this is not news to it; what is new is that its axis table frames every axis as
"priced-at-write FALSE, **later** authoritative", which reads as though the harm requires a
future config change to materialise. For axis 2 the underpricing is present today. This is
now a row in the matrix test and it fails against the pre-fix tree at `enabled=true`.

Also measured, and it corrected a fail-open bug in my own first draft: bare, unprefixed
lifecycle names are **already** priced today, because the pricing path's fallback runs
through `MapLabelsToStage`, which never required a prefix.

```
enabled=true, add "duplicate" to a CLOSED issue    wont_fix -> duplicate   PRICED
enabled=true, add "working"   to an OPEN   issue   accepted -> working     PRICED
enabled=true, add "shipped"   (configured alias)   wont_fix -> completed   PRICED
```

My first draft excluded bare names from the write-side claim on round-4 reasoning. That
reasoning is correct for `authorizationStage` and wrong for the pricing path, and applying
it would have made the write claim **narrower** than what the read path already honours —
a fail-open gap introduced by a fix aimed at closing one. Caught by measuring rather than
by reasoning from the doc comment.

---

## D2 — every toggle guard, classified

**Method, with its own positive control.** `awk` over every non-test `.go` in
`internal/platform/github`, tracking the enclosing `func` and classifying each line
matching `\.enabled` as CODE or COMMENT. Control: injected a decoy function plus a decoy
comment into `resolver.go`, confirmed both were reported and the counts moved 12→13 CODE
and 5→6 COMMENT, then restored. Cross-check that no other spelling of the toggle exists:
`enabled` is assigned once, at `labels.go:117` from `cfg.Enabled`, and nothing else reads
the field.

**My count: 12 code guards and 5 comment mentions.** The brief says 14 guards + 3 comments.
Same total (17), different split — see defect 1.

Known limitation of the method: it attributes a comment to the *preceding* `func`, so the
two mentions at `labels.go:673/677` are reported under `IssueToPhaseStage` when they are
in fact in `TerminalLabelStage`'s doc comment. Corrected by hand below.

| # | site | function | verdict | reason |
|---|---|---|---|---|
| 1 | `labels.go:249` | `MapLabelsToStage` | **READ — leave** | Label→stage for display. The write path now reaches it through the `asIfEnabled` view, so the guard is bypassed for writes by construction rather than deleted. |
| 2 | `labels.go:283` | `MapLabelsToPriority` | **READ — leave** | Priority display only. Cannot make a label name a stage, so cannot affect a transition price. |
| 3 | `labels.go:299` | `MapLabelsToType` | **READ — leave** | Type display only. Same argument as 2. |
| 4 | `labels.go:315` | `StageToLabel` | **WRITE-SUPPRESSION — leave** | Returns `""` so no stage label is pushed with mapping off. "Do not write labels" is what the toggle is *for*; this is not a claim about what a label means. |
| 5 | `labels.go:331` | `PriorityToLabel` | **WRITE-SUPPRESSION — leave** | As 4. |
| 6 | `labels.go:393` | `StageLabelSwap` | **WRITE-SUPPRESSION — leave** | Returns no add/remove, so nothing is written. Fail-closed. |
| 7 | `labels.go:427` | `PriorityLabelSwap` | **WRITE-SUPPRESSION — leave** | As 6. |
| 8 | `labels.go:463` | `TypeToLabel` | **WRITE-SUPPRESSION — leave** | As 4. |
| 9 | `labels.go:503` | `TypeLabelSwap` | **WRITE-SUPPRESSION — leave** | As 6. |
| 10 | `labels.go:683` | `TerminalLabelStage` | **READ — leave, with a note** | Feeds `LifecycleStage`, display and availability. See the open question below: its claim-gate consumer deserves its own look, but it is not a scope-pricing path and is out of this round's scope. |
| 11 | `terminal_label_stages.go:70` | `authorizationStage` | **READ — leave** | Round 10 makes its role explicit: this is the read predicate. Write gates no longer call it. |
| 12 | `terminal_label_stages.go:198` | `AllTerminalLabelStages` | **DUAL — leave the guard, split the consumers** | The key row. Read consumer (`LifecycleStages`) needs it; write consumer (`lifecycleStagesForLabels`) must not have it. Resolved by routing the write consumer through the fully-enabled view rather than by deleting a guard both consumers share. |

Comment mentions, corrected attribution: `config.go:289` (`Validate`), `labels.go:673`,
`labels.go:677` (both `TerminalLabelStage`'s doc comment), `terminal_label_stages.go:47`,
`:57` (`authorizationStage`'s doc comment). Two of those five stated things that were false
and are rewritten — see C1.

**No guard was classified UNREACHABLE.** All twelve are reachable.

---

## D3 — the fix

New file `internal/platform/github/lifecycle_claim.go`.

`lifecycleStageClaim` is the write-side predicate: a **strict superset** of
`authorizationStage`, so substituting it can only ever refuse more, never allow more. It is
blind to `Enabled` and blind to the `PushPrefix` **value** (not merely to the toggle), and
it includes everything today's config honours, which is what keeps it a superset of the
read side.

`lifecycleStagesForLabels` now computes both endpoints through `writeViewMapper()` (the
`asIfEnabled` reconstruction) over `canonicalLifecycleLabels(labels)` (foreign spellings
rewritten to this deployment's own). `AllTerminalLabelStages` and `IssueToPhaseStage` are
called **unchanged, with their guards intact** — the demotion rule, the closed-issue
`state_reason` rule and the terminal-first ordering are inherited rather than restated.

`assertStageWriteAllowed` switches from `authorizationStage` to `lifecycleStageClaim`
(Ruling 2), so the gate and the price share one label set by construction.

**Mechanism chosen: `asIfEnabled` reconstruction, not toggle-blind accessor variants.**
The reason is the one `checkLifecycleKeyCollisions` already gives at `config.go:289-310`:
it is the same functions asked under a different configuration, not a second
implementation that can drift. Twelve toggle-blind accessor variants would have been twelve
places to keep in sync. Termination is by construction — the reconstructed config has
`Enabled=true`, so it never builds a third mapper.

**The read side is deliberately unchanged.** `LifecycleStage` and `LifecycleStages` keep
their guards. Read and write giving different answers at `enabled=false` is the intended
end state, not an inconsistency.

### What is NOT closed, stated plainly

Ruling 1 as written — "any configuration this deployment might adopt" — **is not literally
satisfiable**, and the round did not pretend otherwise.

- **axis 1 `Enabled`** — CLOSED.
- **axis 2 `PushPrefix`** — CLOSED, and it was a live gap at `enabled=true` too.
- **axis 3 `Stages`** — **NOT CLOSED, and not closable at write time.** `Stages` is
  `map[string]string` with arbitrary keys, so the set of labels that could become
  authoritative under *some* future alias is the set of *all* labels. Pricing every label
  as a stage assertion would deny legitimate work on every ordinary label edit — a bug this
  workstream rates as seriously as an underpriced write. Aliases the operator has
  **already** configured are honoured. Future ones need a config-**change**-time control
  (refuse or warn when a new alias would retroactively grant authority to labels already on
  issues), which is a different control in a different place. **Open finding, carried.**
- **axes 4/5 `Priorities`, `Types`** — NOT APPLICABLE, and this was checked rather than
  assumed: neither can make a label name a stage, and stages are the only thing
  `TransitionScope` prices. `checkLifecycleKeyCollisions` already refuses a config that
  aims a priority or type key at a lifecycle label, closing the crossover at load time.
  Pinned by `TestLabelWriteScope_PriorityAndTypeAxesDoNotPriceStages`, which carries its own
  positive control because it is a negative claim.

---

## D4 — the four-cell matrix

`internal/server/authz_config_blind_write_scope_test.go`. Two principals × five config
axes. Narrow principal is constructed in-process (`task:read`, `task:write`), never read
from a token table — the only narrow-scoped production token has never been used, so
depending on one would assert against a population of size zero.

**The falsifying cell is narrow-principal × config-does-not-recognise.** Proven falsifying
by running the new tests against the **pre-fix** tree:

| axis | wildcard (control) | narrow, pre-fix | narrow, post-fix |
|---|---|---|---|
| `axis0_recognised_today` | PASS | **PASS** (always charged) | PASS |
| `axis1_enabled_false` | PASS | **FAIL** | PASS |
| `axis2_foreign_push_prefix` (toggle ON) | PASS | **FAIL** | PASS |
| `axis2_foreign_prefix_and_disabled` | PASS | **FAIL** | PASS |
| `axis3_configured_alias_while_disabled` | PASS | **FAIL** | PASS |

All five wildcard controls pass on **both** sides, which is what makes the narrow-column
refusals attributable to scope rather than to a broken fixture. `axis0` passing in both
columns pre-fix shows the matrix is not simply red everywhere.

Both new tables carry executed-counter and vacuity guards.

---

## D5 — C1, C2, C3

**C1.** Confirmed with a positive control, then corrected. `hasExternalUnavailableLabel`
holds `blocked` / `ft:blocked` / `ft:stage/blocked` / `deferred` identically at both toggle
settings, and correctly frees `ft:stage/completed` and `ordinary-label` at both — so the
function discriminates and the reading is real. Behaviour unchanged (fail-closed,
pre-existing); the false sentence is rewritten and
`TestExternalUnavailableLabel_IsToggleBlind` now pins it.

**C2.** Reproduced all six cells independently. The literal reading of the comment,
`l != strings.TrimSpace(l)`, was silent with the belt **deleted** — the comment described a
mutant that proves the opposite of its claim, and an engineer following it would have
deleted the belt as dead code. Chose the stronger of the brief's two options: **fixed the
sweep, not just the prose.** `snapVocab` gains a padded entry, so the literal reading now
distinguishes (silent with belt, 128/32768 without), and the unmutated sweep stays green.
The comment now carries the full six-cell table and a note that the padded entry and the
paragraph are one artefact in two files.

**C3.** Reproduced (`absent[:0]` / `spellings[:0]` → exit 0, GREEN) before fixing. Added
executed-counter guards with named diagnostics; verified red on the emptied tables and
green on the restored ones.

---

## D7 — where the brief is wrong

Ten. Two of them (2 and 5) would have changed what this round delivered.

**1. The guard count is wrong, and the brief contradicts itself nine lines later.** Line 148
says "**14** `!m.enabled` guards in non-test code, plus **3** comments". Line 155 says "that
list is **12** code sites from my grep". The list itself has 12 entries. Measured: **12 code,
5 comment**, total 17 — the same total, so the error is in the split, and 14/3 is the reading
that survives if a leg copies the header sentence. The two comment mentions the 14/3 split
loses are `labels.go:673` and `:677`, in `TerminalLabelStage`'s doc comment; counting them as
code is exactly the kind of thing that makes a fix look like it changed one more guard than
it did.

**2. "Every one of those guards sits on either the read side or the write/authorization
side" (line 160) is a false dichotomy, and the verdict vocabulary it forces — READ (leave) /
WRITE (must become config-blind) / UNREACHABLE — supplies the wrong answer for half the
table.** Six of the twelve (`labels.go:315, 331, 393, 427, 463, 503`) are on the write side
by any reading and **must keep their guards**: they suppress label *emission*, which is the
entire purpose of `github.labels.enabled=false`. Making them config-blind, as the vocabulary
instructs for anything classified WRITE, would make a deployment that has switched label
mapping off start pushing `ft:stage/...` labels to its issues. A leg that filled in the
brief's table honestly would have had to either mis-file six guards as READ or ship that
regression. The distinction the vocabulary is missing is **write-suppression** (do not emit)
versus **write-authorization** (what could this label ever mean), and only the second must be
config-blind. Separately, one guard (`terminal_label_stages.go:198`) is genuinely **dual** —
a read consumer needs it and a write consumer must not have it — and no single-verdict
vocabulary can express that; it is resolved by splitting the consumers, not by picking a
verdict. And no guard is UNREACHABLE; all twelve are reachable, so that third option is
inert.

**3. Deliverable 1 is a compound question with a single-cause premise (lines 277-279).**
"Does the pricing-path collapse come from `AllTerminalLabelStages`'s own guard, **such that**
splitting `authorizationStage` alone would not fix it?" The two clauses are not equivalent
and the true answers differ: the second clause is **true** (measured, arm C), the first is
**false as stated** (there are three necessary contributors — `:198`, `:70` and
`labels.go:393` — and no proper subset is sufficient, measured, arms B/C/D/E). A yes/no answer
to the question as posed is wrong either way. This is the leading-question defect the EM
asked me to watch for, and it is the same single-gate reasoning the brief itself flags at
line 139 ("the *second* time in this workstream I have pointed at one gate as if it were the
gate") — third time.

**4. "(a) The mapping data is already toggle-blind ... Nothing needs rebuilding" (lines
117-119) is a correct fact carrying a wrong inference.** `len(labelToStage) == 10` at
`enabled=false` is right, and reproduced. But the write path does not only need to *read*
label→stage; it needs to write stage→label to canonicalise a foreign spelling, and
`StageToLabel` returns `""` at `enabled=false` (guard 4 in the D2 table). So a rebuilt mapper
**is** required, and the `asIfEnabled` reconstruction the brief itself points at nine lines
later is what supplies it. The brief warns about this exact failure at line 271 — "a correct
fact carrying a wrong inference is more dangerous than a wrong fact" — and then commits it.

**5. "The bottom-right cell is the only one that can fail if your fix is wrong" (line 250) is
false, measured.** Against the pre-fix tree, the top-right cell — mapping **enabled**, narrow
principal, foreign push prefix `ft2:stage/completed` — also fails. A leg that took line 250
at its word would have built one cell, watched it go green, and left a gap that is live today
at default settings. The brief's own matrix labels the top-right cell "must be REFUSED"
without marking it falsifying, which is what makes the sentence load-bearing rather than
merely loose.

**6. Ruling 1 as literally written is unsatisfiable, and "close the class" (line 81) cannot be
done at write time.** `Stages` is `map[string]string` with operator-chosen keys, so "labels
that could ever be lifecycle-authoritative under any configuration this deployment might
adopt" is the set of *all* labels. A fix obeying the ruling literally prices every label edit
as a stage assertion and denies routine work. The round closes axes 1 and 2 and states axis 3
as an open finding needing a config-change-time control, which is a narrower thing than the
ruling asks for; anyone reading the ruling as satisfied should read D3 instead.

**7. The axis table's "later authoritative" framing (lines 73-75) understates axis 2.** All
three rows are written as "priced-at-write FALSE, later authoritative", i.e. the harm needs a
future config change. For axis 2 the underpricing exists **under the current default config,
right now**, with no change and with the toggle on. Measured above.

**8. There is no "transition scope" (line 246).** The matrix header describes the narrow
principal as having "explicit `task:write`, no close/transition scope", which implies a scope
by that name. The scope constants are `task:read`, `task:write`, `task:claim`, `task:accept`,
`task:close` and the collection/token/user set (`scopes.go:15-25`); `TransitionScope` is a
*function* that returns one of those. Minor, but it cost a lookup to be sure the narrow
principal I constructed was the one the brief meant.

**9. C2's two remedies are presented as a free choice (lines 208-210) when one strictly
dominates.** "Fix the comment (or add a padded entry to `snapVocab` ...); the test leg
deliberately did not choose between those, and neither will I." Correcting the prose leaves
the sweep structurally unable to reach the belt through a trim-based drift, so the belt's
protection claim stays unfalsifiable by the mutant the comment names — the defect is
documented, not removed. Adding the padded entry removes it *and* makes the prose true. Not
choosing is defensible for a reviewer; presenting them as equivalent options is not, because
the cheaper one leaves the tree in the state C2 was raised about. This round did both.

**10. Deliverable 3's scope is fixed before deliverable 1 can answer.** "Scope to the helper
and the predicate" (line 173) and "I adjudicated for the split" (line 99) pre-commit the
round to a remedy shape, while deliverable 1 exists to test whether that remedy addresses the
finding. It happened to survive — the split is *necessary*, just not *sufficient* — but had
D1 refuted (b) in the other direction, the brief's scope section would have been instructing
a fix its own first deliverable had just invalidated. Ordering, not content: put the scope
section after D1, or mark it conditional.

### Checked and found correct

A defect list is a negative claim about everything not on it, so here is the positive control:
I resolved every line reference in the brief against the base SHA and **all nine are right** —
`terminal_label_stages.go:69-72` and `:46-48`, `passthrough.go:311`, `:1060`, `:1266-1274`,
`scopes.go:83-85`, `config.go:24` and `:308-310`, `treewalk.go:217`, `multistore.go:299-301`,
`server.go:{199,383,841}`. The vet baseline matches by message. The C2 mutation table
reproduces cell for cell, including the 128/16384. `web/dist` being both untracked and
absent from `git status --porcelain` looked like a contradiction and is not —
`.gitignore:17` has `dist/`. Measurement (a), `len(labelToStage)=10`, reproduces; only the
inference hung off it is wrong. And the EM's instinct on (b) — check it before writing
anything — was right, and is the reason this round is not a fix to the wrong function.

---

## Open findings carried out of this round

1. **Axis 3 is open**, as above. It needs a config-change-time control, not a write-time
   one. Anyone scoping that work should start from the fact that the write-time framing is
   provably unbounded.
2. **`TerminalLabelStage`'s claim-gate consumer.** Guard 10 is classified READ, and its
   read consumers are display and availability. But `LifecycleStage` also reaches
   `issueUnavailableForClaim`, so with mapping off an issue carrying `ft:stage/completed`
   is claimable where with mapping on it is not. This is *not* a scope-pricing bypass —
   `task:claim` is charged either way, and the task's own stage genuinely is `accepted`
   under a config that ignores labels — so it is left alone. Flagged because "READ side, so
   toggle-dependence is fine" is the general rule and this is the one consumer where the
   rule deserves a second look rather than an assumption.
