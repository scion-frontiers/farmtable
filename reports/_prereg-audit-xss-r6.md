# PRE-REGISTRATION — audit-xss-r6

- Agent: `audit-xss-r6`
- ROOT: `/workspace/farmtable-audit-xss-r6`
- SHA: `c108acbcfa2357862576092469828709bb6c4090` (verified `git rev-parse HEAD`, tree clean)
- DIST: present (copied, not built here). node_modules top-level entries: 79.
- Written: before any code reading, before any execution.

---

## 0. CONTAMINATION DISCLOSURE — READ THIS FIRST

**My Phase One is contaminated and I am declaring it at the top rather than burying it.**

The dispatch message ordered: "READ THESE TWO FILES, IN THIS ORDER, BEFORE YOU DO ANYTHING
ELSE" — naming `_r6-COMMON.md` in full. Section 5 of that same file orders: write Phase One
to disk **before** reading section 7. Section 7 is *inside the file I was ordered to read in
full, first.* The two instructions cannot both be obeyed. I obeyed the dispatch order and
read the file in one pass, so **I read section 7 before Phase One existed on disk.**

This is not a recoverable error — I cannot unread it. What I can do is make its effect
falsifiable. So:

**Everything I know from section 7, enumerated now, so that no Phase One finding of mine can
later be quietly credited as cold when it was seeded:**

1. The guard is `internal/webguard/remotedata_consumers_test.go`; it censuses the **web** tree
   against a hand allowlist keyed on file + exact trimmed source text at exact multiplicity.
2. It has a non-vacuity companion test that duplicates part of the allowlist.
3. Measured arms: literal/differing-text -> RED/UNDECLARED; literal/byte-identical-duplicate ->
   RED/MULTIPLICITY; **computed access -> GREEN in both columns.**
4. Shipped bound: "catches the accidental addition; never observed catching a deliberate one."
5. Two known-unfixed in-tree inaccuracies: (a) project-log at c108acb carries a stale table with
   a deletion result in an additions table + a broader bound; (b) guard failure header says
   `SITE(S) NO LONGER MATCH` on a path that fires when a site matches **twice**.
6. `main` is RED today for `TestListUsers` (detached goroutine on `context.Background()`).
7. Five tests flake ~4.5%/run; ~27-row single-run matrix ~71% likely to carry a spurious RED.
8. Real `main` is `cc927355e5a23c45bfd983cd331eb540b0a61ad5`, 12 ahead of `7a0f220`, added
   `.github/workflows/ci.yml`.
9. Predicted unverified merge blocker: real `main` added `scripts/ci-suite-manifest.mjs`
   checking a hand-written web test list; this branch replaced the hand-list with discovery via
   `web/scripts/run-tests.mjs`; checker expected to fail closed.
10. `web/scripts/run-tests.mjs` is not this round's work (`5c65382`, `d92ae5e`, `d12f572`).

**Binding self-rule for the report:** every Phase One finding gets an explicit
`SEEDABLE-BY-S7: yes/no` tag. Any finding that section 7 could plausibly have handed me is
reported as **Phase Two regardless of when I actually found it.** I will only claim a finding as
cold if it is outside the ten items above. This makes my cold pass *under*-credited rather than
over-credited, which is the correct direction for the error to run.

I also had the role brief's own leads before Phase One (the `writable`-key lead and the
`ImportCollection` verbatim-copy lead at `7a0f220`). Those are likewise **not cold** and are
tagged accordingly.

---

## 1. WHAT I EXPECT TO FIND (outcome predictions)

Registered before reading a line of the diff.

- **P1 — The guard is real but measures the wrong population.** I expect the census to walk the
  **web** tree only, and I expect the security-relevant sink to be reachable **server-side**.
  Confidence 0.7. A guard scoped to web cannot go red for a Go consumer.
- **P2 — The `writable` lead holds at my SHA.** `writable` read in web, zero Go files.
  Confidence 0.75. (NOT COLD — briefed.)
- **P3 — `ImportCollection` copies the collection map verbatim with no key validation.**
  Confidence 0.7. (NOT COLD — briefed.)
- **P4 — The interesting harm is not `writable`.** If P3 holds, the verbatim copy is a generic
  attacker-controlled-key primitive and the question is what *else* rides it. Confidence 0.6.
- **P5 — There is at least one consumer of `remote_data` that the allowlist does not and
  cannot see**, because it is not a literal identifier in the web tree. Confidence 0.65.
- **P6 — At least one *authorization* (not render) consumer exists.** Confidence 0.6.
- **P7 — I expect to find at least two errors in the briefs.** Confidence 0.8. (One is already
  banked: the section 5 / dispatch ordering contradiction above.)

## 2. MECHANISM PREDICTIONS (registered separately, per COMMON section 4)

A red from the wrong arm is a different result from a red.

- **M1** — If P1 goes red, the mechanism is **scope of the walked directory tree**, not a
  defect in the matching logic. Distinguishable: read the census root; if it is a web path
  constant, M1 is confirmed and any Go-side consumer is invisible *by construction*.
- **M2** — If P3 goes red, the mechanism is **absence of a key allowlist at the deserialize
  boundary**, not absence of authz on the import endpoint. These need separate checks: an
  authenticated user importing their own document is still the attacker in this model.
- **M3** — If P5 goes red, the mechanism I expect is a **computed/aliased access** (bracket
  index, destructure, or a variable holding the string), matching the GREEN row already
  disclosed in s7 item 3. If instead I find a *literal* miss, that is a **different and worse**
  result — it would mean the census under-collects inside its own declared population.
- **M4** — If the harm is closed, I expect it to be closed by a **conjunction of unrelated
  facts** (per the role brief's "held inert today only by...") rather than by a single named
  control. An inertness conjunction is a latent finding, not a closed one.

## 3. PRE-COMMITTED RESPONSE TO EVERY OUTCOME, INCLUDING THE ONE THAT KILLS MY HEADLINE

Registered now so I cannot rationalise later.

- **If P3 is REFUTED** (ImportCollection does validate keys): my likely headline dies. I will
  report **"refuted"** as a first-class result in the findings table with the evidence, and my
  verdict moves toward the round being right. I will *not* go looking for a replacement headline
  to keep the report interesting. A quiet audit is a legitimate audit.
- **If P1 is REFUTED** (the guard does walk Go too): I withdraw the population criticism
  entirely and say so in one unhedged sentence, and the round's bound is stronger than claimed.
- **If the guard turns out to be vacuous** (passes with an empty allowlist despite the companion
  test): that outranks everything above and becomes the headline regardless of P1–P6.
- **If everything checks out**: verdict is APPROVE with the bound restated. I pre-commit that
  "found nothing exploitable" is an acceptable outcome and will not be inflated into a
  medium-severity list of style items to justify the round.
- **If I find a live remote-exploitable path**: I stop expanding scope, write it up immediately
  with a PoC, and message eng-manager before finishing the rest of the report.

## 4. SEVERITY / MEASUREMENT-STATUS PRE-COMMITMENT

I bind myself to the role brief's four statuses now, so I cannot slide a derived finding into a
demonstrated one after the fact:

- **live and demonstrated** — I executed something and observed the harm. Requires a command in
  the run log.
- **live and derived** — read from code, reachable, but I did not execute it. Must be labelled
  derived **in the finding title**.
- **latent** — real defect, currently unreachable, held by a conjunction. Must name every
  conjunct and the file each lives in.
- **refuted** — I predicted it and it is not there. Reported, not deleted.

I pre-commit that **no finding is filed as `live and demonstrated` without a line in
`_run-queue-log.md`** bearing ROOT and DIST.

## 5. EXECUTION INTENT

I expect to need **no build token** for the main body of this audit: it is a read of source,
plus at most one targeted single-package `go test -run '^TestName' -count=1`, which the fence
permits with logging. If I need `go test ./...`, `npm test` or a `web/dist` rebuild I will ask
eng-manager and say what and why. I pre-commit to **not** verifying any build by a reported exit
code, and to checking output artefact existence and mtime instead.

If a red I observe could be one of the five ~4.5% flakes, I pre-commit to **repeating it before
filing it as a property**, per COMMON section 4.

---

# POST-HOC SCORING (appended after the report was written; predictions above unedited)

| pred | outcome | note |
|---|---|---|
| P1 guard measures the wrong population (web-only) | **CONFIRMED** | Demonstrated by planted Go consumer -> GREEN. But the guard *declares* the limit; the round's claim does not. Finding is against the claim, not the guard. |
| P2 `writable` in web, zero Go files | **PARTIALLY REFUTED** | Two Go occurrences at c108acb (convert.go:716,718), both comments added by this round. Conclusion (no server-side read-only notion) survives; the count did not. |
| P3 ImportCollection copies map verbatim, no key validation | **CONFIRMED** | export_import.go:332 -> entstore.go:2116-2117. sanitizeRemoteData filters values under URL-ish keys only; never keys. |
| P4 the interesting harm is not the key itself | **CONFIRMED** | The generic primitive is "attacker chooses keys in a map that is stored verbatim". `writable` is one instance. |
| P5 a consumer the allowlist cannot see | **CONFIRMED, but via M-other** | Not a computed access in web (M3's expected arm). The unseen consumers are **Go-side** and literal. Different mechanism from the one I pre-registered. |
| P6 an authorization (not render) consumer exists | **CONFIRMED** | capabilities.ts:99, ft-app.ts:257. Also independently found by the round. |
| P7 at least two brief errors | **CONFIRMED** | Five filed. |

| mech | outcome |
|---|---|
| M1 scope of walked tree, not matching logic | **CONFIRMED** — `webRoot()` returns `<module>/web`; census cannot reach Go. |
| M2 absence of key allowlist at deserialize, not absence of authz | **CONFIRMED** — authz is present (RequireIdentity + ScopeCollectionAdmin); key validation is absent. The two are correctly separated. |
| M3 P5's mechanism is computed/aliased access | **REFUTED** — I predicted the web computed-access arm. The actual gap I demonstrated is out-of-population (Go), which is a *different* mechanism. Registering this as a miss: my pre-registered mechanism was wrong even though the outcome prediction was right. This is exactly why the arm is a separate prediction. |
| M4 closed by a conjunction of unrelated facts, not a named control | **CONFIRMED** — forced-farmtable at import + FARMTABLE early-return in capabilities.ts. Two files, neither annotated. |

## Pre-committed responses — did I honour them?

- **"If P3 is refuted my headline dies and I report refuted as first-class."** P3 held, so this
  was not tested. But the analogous case arose: my predicted import->relink escalation chain was
  **refuted**, and I filed it as **R1**, a first-class row, rather than deleting it. Honoured.
- **"If P1 is refuted I withdraw in one unhedged sentence."** Not triggered.
- **"If the guard is vacuous that outranks everything."** It is not vacuous — `filesScanned == 0`
  is checked, the non-vacuity companion genuinely duplicates rather than derives, and the guard
  passes at my SHA with the two known consumers found by name. Checked and cleared.
- **"'Found nothing exploitable' is acceptable and will not be inflated."** Honoured. I found no
  live exploitable defect and said so in the verdict's first paragraph. F1 is filed **latent**,
  not promoted to HIGH. F6 is filed **INFO** with "this is not exploitable and I am not inflating
  it" stated in the finding itself.
- **"No finding filed as `live and demonstrated` without a line in the run log."** Honoured. Two
  findings carry that status (F3, F5); both have logged runs with ROOT and DIST.
- **"Repeat a red before filing it as a property."** No flaky red encountered; the only reds I
  filed are deterministic static-analysis outcomes (F5) and a controlled negative (F3).

## The one that surprised me

I expected the interesting gap to be *inside* the census's declared population — a literal miss,
which M3 flagged as "different and worse". It was not. The census is sound within its population.
The gap is the population. **My outcome prediction was right for the wrong reason**, and I would
have recorded a clean hit if I had only pre-registered the outcome. The arm is the reason I did not.
