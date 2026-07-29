# Farm Table — Remaining Work Assessment & Engineering Manager Restructure

**Author:** architect-reviewer (independent, commissioned directly by the owner)
**Date:** 29 July 2026, ~14:15 UTC
**Status:** DRAFT — for owner review

---

## 0. Provenance and independence

Read for this: the 27 Jul design contract, the 26 Jul c-phase decisions, the 29 Jul
progress summary, the repository, and the project scratchpad. **No project agent was
consulted.** Repository figures below were measured for this document, not relayed.

**One disclosure.** Earlier today I messaged the task-state engineering manager twice,
unprompted, with technical corrections. They were adopted into its Bulletin 20.1 and
credited to me. I am therefore an input to the bulletin process, and **my judgement of
that process specifically should be discounted.** Everything structural below rests on
artifacts I did not influence.

Markers: **[measured]** = measured for this document. **[relayed]** = from the progress
summary, whose own author states they ran no repository commands.

---

## 1. The three findings that should change what happens next

**Finding 1 — The restructure you asked me to design already happened, about thirty
minutes before you asked.** The three-EM structure (`em-task-state-model-v2`,
`em-hardening`, `em-ci`) was briefed today at **13:44Z**. The cut is broadly sound. My
recommendation is therefore *not* a new topology — proposing one would repeat the
project's characteristic move. See §5.

**Finding 2 — The refactor is not trapped behind the security work. It was separated
today, and the escalated owner decision is moot.**

The progress summary's central structural claim is that the 39 web commits are "the lower
portion of one of [the] three security branches, with eight commits of security work
stacked on top," and that pulling them out means "separating two things that are currently
one line of development," which "nobody has attempted or costed."

**That is not the case.** [measured]

- `task-state-web-ui-v2` (= `attention-view`, identical sha `633f8f2`) is a **standalone
  branch**, 39 ahead / 20 behind main. It is not underneath anything.
- `origin/phase2-web-ui-r5` (`61ca67e`) is that same work **already rebased onto
  CI-bearing main**, 39 ahead / 8 behind, merge base `cc92735` (the CI merge). It carries
  6 commits the old branch lacks and `git cherry` shows it content-supersedes the old tip
  entirely.
- No security commits sit on top of either.

The "eight commits of security work stacked on top" appears to be a misreading of
**"8 behind"**. And the 47-commit branch that the 39 + 8 arithmetic seems to point at is
`scopedeny-93-deny-unrecognised-type` — an unrelated auth branch.

**Consequence:** the decision the summary puts to the owner — *leave the refactor behind
hardening, or pay an uncosted separation to split it out* — is a false choice. The
separation is done. Someone performed it today. The refactor can land on its own merits.

**Finding 3 — The entire user-facing half of the refactor is blocked on one unmade
decision, and it is not a security decision.** [measured]

`origin/phase2-web-ui-r5` does not merge cleanly into main. It conflicts in exactly **two
files**:

| File | main | branch |
|---|---|---|
| `web/package.json` | `tsc -p tsconfig.test.json && node --test .tmp-test` | `vitest` + `jsdom` |
| `web/tsconfig.test.json` | 4 include globs | narrowed to `src/**/*.test.ts` |

That is the whole blocker. But it is not mechanical: roughly **11,000 of the branch's
14,420 added lines are tests written against vitest**, while main's CI (PR #205)
standardised on `node --test`. This is a test-runner decision with a large sunk cost on
one side. A paused WIP commit in `/workspace/farmtable-ci-manifest` (`eea40f5`) was
investigating precisely this and stopped.

**Nobody owns this decision.** It sits exactly between `em-ci` (owns the runner on main)
and `em-task-state-model-v2` (owns the branch). It is the single highest-leverage
unresolved item in the project.

---

## 2. Immediate risk — irreversible, and fixable in minutes

Everything is on one filesystem. `/workspace` and `/scion-volumes` are both device `2049`
(`/dev/root`, 47G free of 194G). [measured] The salvage bundles in
`/workspace/farmtable/salvage/` are on that same device, so they are replication, not
backup.

**Ten commits exist in exactly one place and are on no remote** [measured]:

| Repo | Unique commits | Content |
|---|---|---|
| `/workspace/farmtable-dev-xss-r9` | **7** | branch `xss-url-scheme-union` — a union merge of `url-scheme-validation-r8` with current main, plus two server fixes and an audit answer. Real integration work. |
| `/workspace/farmtable-194-oracle` | 1 | `d8bb923` — RED oracles pinning the three #194 pricing defects |
| `/workspace/farmtable-ci-manifest` | 1 | `eea40f5` — the paused test-runner WIP named in Finding 3 |
| `/workspace/farmtable-mainred-fix` | 1 | `0589615` — cold-condition investigation of the main flake |

**No uncommitted work anywhere is unique or valuable** — of 23 working copies with
modifications, 22 are `package-lock.json` churn and one is a gofmt realignment. [measured]
The exposure is exactly these 10 commits.

**Recommended action, today, before any restructuring:** push those four branches to
`origin`, or bundle them to storage on a different device. This is minutes of work against
the only irreversible risk in the project. It should not be filed inside a "census" track.

*(Caveat: those four repos had commits timestamped 14:05–14:09, i.e. agents were committing
during the survey. Re-measure before acting.)*

---

## 3. What the contract actually requires

**Correction to a circulating figure:** the contract is described as having "roughly twenty
acceptance criteria." It has **fourteen** (§14), plus **four review-point gates** (§13) —
eighteen conditions. [measured]

| Class | Count | Criteria |
|---|---|---|
| Mechanically testable | 10 | 1, 3, 4, 5, 6, 7, 8, 9, 10, 12 |
| Split mechanical / UI | 1 | 11 |
| Multi-surface checklist | 1 | 2 |
| Vague as written, rescued by cross-reference | 2 | 13, 14 |

Thirteen of eighteen are mechanical. **The verification burden is smaller and more
automatable than the project believes.** Two planning notes:

- **Criterion 2 is not one criterion.** It requires seven removed vocabulary items to be
  absent across fourteen surfaces. Track it as its own checklist with an owner.
- **Criterion 14 is satisfiable by writing a sentence** — it permits "explicit tests **or**
  documented limitations." Legitimate, but exercise it deliberately.

**Contract status:**

| Part | Scope | Status |
|---|---|---|
| 1 | Contract & migration review | Satisfied; no code by design |
| 2 | Core data, API, CLI, MCP | **Merged and live** — 23 commits, `a2442ff..7a0f220`, 102 files [measured] |
| 3 | Web UI | **Not merged** — `origin/phase2-web-ui-r5`, 74 files, +14,420/−378 |
| 4 | Documentation | Not started |

---

## 4. Live defects in production today

| # | Defect | On a branch? | Note |
|---|---|---|---|
| D1 | Old status control still offers a forbidden state (`web/src/components/ft-toolbar.ts:33-39`) | No | Live contract violation. Confirmed in the options list; **not** confirmed to render. |
| D2 | Endpoint writes stored access tokens with no caller permission check | **No** | Live, covered by no branch work [relayed, UNVERIFIED] |
| D3 | XSS — `javascript:` URLs from task text execute in a session holding a long-lived token | Yes | 9 rounds, not closed |
| D4 | #194 — authorization bypass; `SameStageSet` equality guard is not monotone (`internal/server/server.go:847`), so a label write can be priced at zero | Yes | 11 rounds, **zero remedies adopted** |

**D2 is first.** Live, unfixed, on no branch — so no merge-queue decision helps it, and
none blocks it.

**Owner signal already on record.** The `em-hardening` brief quotes you: *"iap is in front
of everything. we will still want to fix app layer auth on these endpoints. but there is
not the same urgency."* Read together with Finding 2, that removes the last reason to hold
the refactor behind security.

---

## 5. Assessment of the 13:44 structure, and what to change

### 5.1 What the current cut gets right

Three managers, cut as refactor / security / integration. That is close to what I would
have proposed independently, and **it should not be re-cut.** The project has reorganised
once today; reorganising again would cost more than it returns.

### 5.2 The gaps

**Gap A — roughly 40% of effort has no delivery owner and no termination condition.**
The preserve/relocate/census/reconcile cluster and the predicate/methodology cluster are
coordinator-run, assigned to no EM, and have no exit criteria. By artifact volume they are
~41 MB against 23 MB for eleven days of all reports. By briefs they are ~1 in 5; by agent
hours the honest estimate is **35–50%**.

This work is not illegitimate — it found the 10 orphan commits. But it is unbounded.
*Recommendation:* assign it to `em-ci` as a **time-boxed** integration-hygiene item with
the §2 action as its first and possibly only deliverable, then close it.

**Gap B — no owner for the test-runner decision** (Finding 3). It falls precisely between
two managers. *Recommendation:* give it to `em-ci`, since main's runner is the incumbent
and the cost of change is on the branch side — but it needs an explicit ruling and a
deadline, not another round.

**Gap C — adoption authority is conferred by message, not by role.** Eleven rounds on #194
adopted nothing. The coordinator's fix today was to grant authority ad hoc to whoever was
free. The diagnosis was right; the mechanism was wrong. *Recommendation:* each EM has
standing authority to adopt a remedy in its track, with one narrow escalation trigger —
**any change to what a legitimate user can or cannot do goes to the owner.**

**Gap D — work creation outpaces retirement.** [measured] 399 briefs; 76 genuinely new in
24h (~3.2/hour, ~2× the lifetime average) and still accelerating. **246 of 801 briefs and
reports (31%) contain SUPERSEDED, WITHDRAWN or VOID.** The EM state file is 756 KB /
12,521 lines; the rules-about-briefs file is 1,842 lines.

No topology survives this. *Recommendation:* a standing cap on concurrent briefs per EM,
and a rule that any new **meta**-work states its termination condition in its brief or is
not started.

**Gap E — CI is not yet an instrument you can read.** [relayed, and the CI EM says so
itself] The gate has never fired: an unanchored vitest regex manufactures passes, the
failure summary matched 0 of 31 real failure lines on every run, `if-no-files-found: warn`
keeps jobs green, and branches predating CI produce *no run*, which is indistinguishable
from green. Main did go green today (`faf1c8c`, run 30457818557) — but on a ~15%/run flake
that is a likelihood ratio of ~1.18, which the CI EM correctly declines to call
verification. **Until the gate demonstrably fails on a known-bad commit, no merge should
be justified by a green CI result.**

### 5.3 The coordinator

The progress summary names a coordinator failure: eleven hours went to a credential
investigation and "nobody put [it] to the owner as a choice until he asked." Today the
coordinator also attempted to reassign your independent reviewer onto an unrelated track.
Same failure — **taking scope decisions that are the owner's.**

*Proposed scope, narrow:* (1) surface cost/scope trade-offs to the owner as choices before
capacity is spent; (2) sequence across managers where their work interacts; (3) nothing
else. Explicitly excluded: reassigning owner-commissioned agents, changing an EM's scope
unilaterally, granting decision authority by message.

---

## 6. Recommended sequence

**Now (minutes):** push or off-device bundle the 10 orphan commits (§2).

**Today:** rule the test-runner question (Gap B). Assign or terminate the unowned 40%
(Gap A). Fix the CI gate so it can fail (Gap E) — a known-bad commit must produce red.

**Next:** land `origin/phase2-web-ui-r5` — 39 commits, the entire user-facing half of the
refactor, blocked only by Gap B and Gap E. Ship D1 and D2, neither of which needs the
queue. Then the security branches, with hardening at the urgency you already assigned it.

**Then:** prove the eighteen gates (13 mechanical), and contract part 4.

---

## 7. Alternatives considered

**A. Re-cut the EMs from scratch (my initial instinct).** *Rejected on evidence.* The cut
is hours old and broadly right; the failures are gaps in it, not its shape. Re-cutting
would consume a day and repeat the project's dominant failure mode.

**B. One EM per branch.** *Rejected.* 206 local branches, and the count changes on every
merge.

**C. Add a release manager over the existing three.** *Rejected.* Adds a layer without
authority over the branches feeding the gate — which is `em-ci`'s current position and
exactly why the gate is stuck.

**D. Collapse to one EM.** *Rejected*, though it would fix the coupling outright. Exceeds
one manager's span at current volume, and removes the independent-path property.

**E. Five or six EMs, one per defect class.** *Rejected.* Proliferation is the disease.

**F. Change nothing structural; just do §6.** *Not rejected — it is the honest fallback.*
Most of §6 is executable under today's structure. If you want the smallest intervention
that unblocks delivery, it is §2 plus Gap B. Gaps A, C and D would remain and would
re-accumulate, but delivery would move.

---

## 8. Open questions — owner input required

**Status as of 15:25Z. Three of five are now closed.**

1. ~~**Test runner:** vitest+jsdom or node:test?~~ **CLOSED — the question was malformed.**
   It is not a choice. The branch's `test:node` is byte-identical to main's `test`, the two
   globs provably do not overlap, and main's CI gate already had purpose-built vitest
   support waiting for a suite that did not exist. They compose. No 11k lines migrate and
   nothing is discarded. I framed this as the refactor's critical path; it was not a fork
   at all, and the cost of the wrong framing was that two tracks each believed the other
   had to give way. Resolution: 30-file merged suite, 7 conflicting paths (5 to
   task-state, 2 carved to hardening), CI fixes land first.
2. **The unowned 40%:** assign with a termination condition, or stop it? **STILL OPEN.**
3. ~~**D2** — ship the unauthenticated token-write endpoint fix standalone?~~ **CLOSED by
   owner.** Production is an early test deployment; the allowance is a deliberate decision
   between ptone and the auth architect. My "live in production" framing overstated it.
   Also note D2 was `[relayed, UNVERIFIED]` and I never confirmed it myself.
4. **111 older unmerged branches and 21 remote-only refs** unassessed. **STILL OPEN — this
   is the survey.** Partially overtaken: em-ci's sweep put 204 single-copy tips on origin
   under `refs/salvage/<clone>/<branch>`, so the *durability* half is closed. What remains
   is triage — which of those refs matter. Survey first, decisions after; the only thing it
   needs pre-agreed is a **termination condition**, not a default answer.
5. **Does the old status control (D1) actually render?** **STILL OPEN**, and still cheap.
   `dev-onhold-toolbar` established the option is emitted unconditionally but writes
   nothing — it is a filter, not a phase setter — so the likely resolution is that D1 is
   not a defect. Unconfirmed on screen; the branch's new jsdom harness now makes it
   testable for the first time.

---

## 9. Acceptance criteria for this restructure

A reviewer should be able to confirm:

1. The 10 orphan commits exist on a device other than `2049`, or on `origin`.
2. Every in-flight track names an EM, or has been explicitly stopped.
3. Every meta-work brief states a termination condition.
4. The test-runner question has a written ruling with a date.
5. The CI gate has been demonstrated to **fail** on a deliberately-bad commit.
6. Each EM has written adoption authority and the single escalation trigger.
7. New-brief rate over a 24h window is below the current 3.2/hour.
8. `origin/phase2-web-ui-r5` has either merged or has a named blocker that is not "review
   round N+1".

---

## Appendix — figures measured for this document

| Item | Value |
|---|---|
| Local branches / remote refs / registered worktrees | 206 / 124 / 127 |
| `/workspace/farmtable-*` dirs | 243 (121 worktrees, 120 standalone clones, 2 non-repos) |
| Commits existing in exactly one place | 10, across 4 repos |
| Working copies with unique uncommitted content | **0** |
| Contract acceptance criteria | 14 (+4 review gates) |
| Phase 2 merged | 23 commits, 102 files, +5,710/−1,458 |
| Phase 3 outstanding | `origin/phase2-web-ui-r5` @ `61ca67e`, 74 files, +14,420/−378 |
| Merge conflicts blocking it | 2 files |
| Briefs total / new in 24h | 399 / 76 (~3.2/hr) |
| Briefs+reports marked SUPERSEDED/WITHDRAWN/VOID | 246 of 801 (31%) |
| All storage on device | `2049` (`/dev/root`), 47G free |

**Canonical artifact note.** The 39 commits exist in four places: local
`task-state-web-ui-v2`/`attention-view` @ `633f8f2`; two bundles in
`/workspace/farmtable/salvage/`; stale `origin/task-state-web-ui-v2` @ `6c0fcfb` (only 22
commits ever pushed); and **`origin/phase2-web-ui-r5` @ `61ca67e`, which supersedes all of
them and is the one to use.** Any plan should name it explicitly.
