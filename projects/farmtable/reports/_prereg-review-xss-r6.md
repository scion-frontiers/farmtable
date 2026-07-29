# PRE-REGISTRATION — review-xss-r6

Agent: `review-xss-r6`. Root: `/workspace/farmtable-review-xss-r6`. SHA: `c108acbcfa2357862576092469828709bb6c4090`.
Written BEFORE any inspection of the diff or the code. Nothing below was revised after execution.

---

## 0. CONTAMINATION DISCLOSURE — READ FIRST, IT CHANGES HOW TO SCORE THIS LEG

**I read COMMON section 7 before Phase One was on disk. The cold pass on this leg is
compromised and I am declaring it rather than pretending otherwise.**

Mechanism, precisely:

- The dispatch message ordered: "READ THESE TWO FILES, IN THIS ORDER, BEFORE YOU DO ANYTHING
  ELSE", naming `_r6-COMMON.md` first.
- Section 7's embargo ("DO NOT READ UNTIL PHASE ONE IS ON DISK") is located **inside
  `_r6-COMMON.md` itself**, at line 168 of a 269-line file.
- A file read returns the whole file. There is no way to obey "read this file first" and
  "do not read the last third of this file" simultaneously. The embargo is unenforceable by
  construction.

**This is not my error to route around silently — it is a defect in the round's apparatus and
it will have fired on all three legs identically, because they were all given the same
ordering instruction against the same file.** It is filed as brief-error B1 in my report.

### What I am doing about it

I cannot un-read it. So I am pre-committing to an attribution rule that makes the damage
*visible* instead of letting it launder itself into a fake cold pass:

- Section 7 tells me, specifically: (a) the guard is `internal/webguard/remotedata_consumers_test.go`,
  keyed file+text at exact multiplicity, with a non-vacuity companion; (b) the computed-access
  blindspot and the "catches accidental, never observed catching deliberate" bound; (c) two known
  in-tree inaccuracies — the project-log table with a deletion row, and the `SITE(S) NO LONGER
  MATCH` header on a multiplicity path; (d) `main` is red via `TestListUsers`; (e) ~4.5% flake on
  five tests; (f) real main is `cc92735`, twelve ahead, added `.github/workflows/ci.yml`;
  (g) predicted merge blocker re `scripts/ci-suite-manifest.mjs` vs `web/scripts/run-tests.mjs`;
  (h) `run-tests.mjs` is not this round's work.
- **Any finding of mine that lands on (a)–(h) is labelled `PHASE ONE / CONTAMINATED` and is
  worth nothing as evidence that a cold read reaches it.** In particular the EM explicitly wanted
  to know whether a cold read independently reaches the two known inaccuracies (c). **I can no
  longer answer that question and neither can any leg briefed this way.** That measurement is
  lost for this round.
- **Only findings outside (a)–(h) count as this leg's independent yield.** That is the number to
  judge me on.

I will still run Phase One before re-reading section 7, and I will still write it to disk first,
because the ordering has residual value. But I am not going to claim it was cold.

---

## 1. PREDICTIONS — OUTCOME AND MECHANISM STATED SEPARATELY

Per COMMON §4: outcome and arm are two predictions. A red from the wrong arm is a different
result from a red.

### P1 — Production/apparatus ratio in `d305391..c108acb`
- **Outcome:** apparatus (tests, guard, docs, logs) exceeds production behaviour change by
  more than 3:1 in changed lines.
- **Mechanism/arm:** the round is the sixth on one axis, and the brief itself flags a prior
  round that was "thirteen commits around one substitution". I expect the same shape: a small
  scheme-validation edit plus a large pinning apparatus.
- **Falsifier:** a substantial production diff (multiple call sites, new policy module).

### P2 — The guard's maintenance burden
- **Outcome:** the guard fails on benign refactors (reformatting, renaming a variable, prettier
  run) in files it already covers.
- **Mechanism/arm:** it keys on *exact trimmed source text*. Text-keyed allowlists are
  whitespace- and rename-fragile. Arm matters: failing on a **moved** line is a different defect
  from failing on a **reformatted** one, and I predict the reformat arm specifically.
- **Falsifier:** normalisation in the census that strips formatting before comparison.

### P3 — Policy statement seam (URL scheme policy stated in two places)
- **Outcome:** URL scheme policy is stated in at least two places that are not derived from a
  single source, and at least one prose statement of it is already false at `c108acb`.
- **Mechanism/arm:** the brief names two branches defining scheme policy. Duplicated policy
  drifts. Arm: I predict **prose-vs-code** drift ahead of **code-vs-code** drift, because
  code-vs-code would likely have been caught by a test.
- **Falsifier:** one canonical allowlist constant, imported everywhere, with comments generated
  from or adjacent to it.

### P4 — Comment/log truth audit yields at least one false assertive sentence beyond the two
  the EM already knows about
- **Outcome:** yes, at least one.
- **Mechanism/arm:** the brief states this project has shipped comments describing tests that
  cannot fail. That is a repeated failure mode, and repeated failure modes are rarely
  singletons. Arm: I predict the false sentence sits in **test-adjacent prose** (a guard comment
  or a doc block describing coverage), not in production code prose.
- **Falsifier:** every assertive sentence checks out against the code.

### P5 — The guard's own vacuity
- **Outcome:** the non-vacuity companion test does NOT fully protect against the failure mode it
  claims to, i.e. there exists an edit that empties or narrows real coverage while both tests
  stay green.
- **Mechanism/arm:** a companion that "duplicates part of the allowlist" pins that part only.
  The unduplicated remainder is unprotected. Arm: **partial-pin gap**, not total vacuity.
- **Falsifier:** the companion pins the census mechanism rather than allowlist contents.

### P6 — Build/gate state in my tree
- **Outcome:** Go gates pass in my tree at `c108acb`.
- **Mechanism/arm:** `web/dist` is present and, per my role brief line 8, was built in my own
  tree — so the `//go:embed all:web/dist` failure mode described in COMMON §2 should not fire
  for me. Note COMMON §2 says the opposite about my tree; see brief-error section.
- **Falsifier:** any embed-unrelated compile failure.

### P7 — Merge blocker vs real `main` (`cc92735`)
- **Outcome:** confirmed — `scripts/ci-suite-manifest.mjs` on real main is incompatible with
  this branch's discovery runner.
- **Mechanism/arm:** fail-closed manifest checker meeting a branch that deleted the hand-list it
  checks. Arm: I predict failure by **missing-file / empty-list**, not by mismatch-of-contents.
- **Falsifier:** the checker tolerates absence, or the branch kept the hand-list.

---

## 2. WHAT WOULD FLIP MY VERDICT — pre-committed, per role brief

I am pre-registering the verdict-flipping conditions before I know the answer, so that I cannot
retrofit them.

**I will REQUEST CHANGES if any one of these holds:**

- F1. The production change is incorrect — a scheme bypass survives, or a legitimate URL is
  broken, at `c108acb`.
- F2. A sentence in shipped production code or in a shipped comment asserts something false
  about the code's behaviour. (Project-log prose is weaker; see F5.)
- F3. The guard can go green while the property it exists to protect is violated, by a route a
  normal contributor would plausibly take (not an adversarial one — that is another leg's
  question).
- F4. The guard imposes maintenance cost with no discoverable remedy: it fires, and the message
  does not tell the person who tripped it what to do.
- F5. Two or more assertive-but-false sentences in round artefacts, or one that would mislead a
  future maintainer into an unsafe change.

**I will APPROVE if:** production change is correct, assertive prose is true or trivially
correctable, and the guard's costs are bounded and documented — even if the guard is inelegant.
Inelegance is not a blocker. Per the code-review skill: the standard is "definitely improves
overall code health", not "is how I would have written it".

**Pre-committed non-blockers:** guard style, allowlist verbosity, test naming, the
apparatus/production ratio on its own. A high ratio is a *fact about the round*, not a defect in
the code, and I will not blocking-file it.

---

## 3. EXPECTED VERDICT, STATED IN ADVANCE

Prior: **REQUEST CHANGES at ~60%**, driven mostly by P4 (false assertive sentence) rather than
by P1 or F1. I expect the production change itself to be correct. I expect the defects to be in
what the round says about itself. Stating this now so that "found what I expected" is checkable
against "expected what I found".
