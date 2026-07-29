# audit-194-r11 — security audit, `2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e`

**Read `_194-r11-baseline-block.md` in this directory FIRST, in full.** It has your
tree, your inputs, the gate table, the environment I built by hand, and the rules.

Write your report to
`/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r11.md`

Verdict: **APPROVE** or **REQUEST CHANGES** on `6d8f19e..2cbbd92`.
Findings classified **Critical / High / Medium / Low / Info**, each with reachability.

---

## Your axis, and what is not

You own **threat modelling, reachability, privilege boundaries, and whether a stated
mitigation actually removes the harm it names.**

Architecture is the review leg's axis; mutation adequacy is the test leg's. Where you form
a view outside your axis, label it an impression and name the axis.

**Impact before severity.** Establish whether a defect is covered indirectly before you
rate it. And state, for every finding, whether it is **LIVE TODAY**, **LATENT** (reachable
only under a config or code change), or **INTRODUCED BY THIS DIFF**. Those have gone
wrong on this branch in both directions.

---

## STEP 1 — THE OPEN PASS. DO THIS BEFORE READING SECTION 2.

Threat-model the diff yourself, unscoped, and write your findings down before you read my
checklist. Then read it.

**Attribute every finding `[OPEN]` or `[CHECKLIST]`.** My targeting has steered a round
away from the defect before — every sentence true, the round still misses. Your open pass
is the control on my brief.

**If any message I send you contradicts this ordering, the brief wins and tell me.**

---

## STEP 2 — the security surface of this round

### The class, in one sentence

A principal holding a bare `task:write` can durably write a label that later becomes
authoritative for lifecycle purposes, without that write ever being priced against the
narrower scope such a label should require. **Round 10 fixed it and reopened it from the
other side** — it priced so widely it denied legitimate work, and a review leg measured a
`task:write` holder closing a task **for free** at `DefaultConfig`. Round 11 is the fix
for round 10.

Bounding fact you should carry, and **do not overstate the finding beyond it**: this
surface is IAP-bounded in the deployed configuration. That does not make it not a
vulnerability; it bounds who can reach it.

### A1 — THE FORCED RESIDUE. Round 11 deliberately leaves a hole. Price it.

This is the item I most want your independent judgement on, because it is the one place
the diff **knowingly declines to close** something.

The leg's argument: `ft2:completed` and `release:completed` are the **same string shape** —
`<namespace><delimiter><bare stage name>` — because `release:` is itself a legal
`push_prefix`. **No predicate can price the first and free the second.** Round 10 priced
both and denied legitimate work. Round 11 frees both and leaves the residue. They say
reaching it requires an operator to change `push_prefix` to the exact foreign prefix
already planted, and the axis-2 comment now says **NARROWED, not CLOSED**, naming the
residue inline.

What I want:

- **Is the dichotomy real?** "No predicate can distinguish them" is a strong claim. It is
  true of a predicate over the label string alone. Is it true of a predicate with access
  to anything else — write provenance, the caller's scopes, the existing label set, a
  timestamp? Do not accept an impossibility claim without testing its scope.
- **Is the reachability story right?** "An operator changes `push_prefix` to a prefix an
  attacker already planted" is presented as remote. Model it properly: who plants,
  who changes, and is there any path where the same principal does both, or where the
  planting is a *consequence* of a legitimate integration (a `release:` label from a
  release tool, an `epic:` label from a planning tool) rather than an attack?
- **What is the blast radius when it is reached?** Freed means unpriced means a bare
  `task:write` performs it. What does the resulting authoritative label do — close a task,
  release a hold, remove it from `ft ready`?

### A2 — the fail-open direction, and whether the union is complete

The leg's own general result, and it is a good one: **because the price is a DIFFERENCE, a
wider AFTER predicate is fail-CLOSED for ENTERING a stage and fail-OPEN for LEAVING one.**
Measured: `push_prefix " "`, OPEN issue carrying `ft:stage/completed`,
`add=[stage/completed] remove=[ft:stage/completed]` → the read predicate charges
`task:accept`, the claim-only AFTER charged **FREE**, and the write really does reopen the
task.

They fixed it with a union: BEFORE fixed at base, AFTER = union(read's AFTER, claim's
AFTER).

**This is taxonomy form (13), named on this branch: a TRUE property of a predicate does
not bound a gate that consumes a DIFFERENCE of two evaluations.** Your question:

- Does the union close the fail-open direction **for every shape**, or for the shape they
  measured? Enumerate the shapes: enter a stage, leave a stage, swap stages, add and
  remove the same label, remove a label that is not present, operate on a CLOSED issue.
- **Are there other difference-shaped gates in this codebase with the same defect?** This
  is the highest-value question in the brief. The form was named because of this gate; it
  is a form, not an instance. A short sweep for "gate that compares a before-state to an
  after-state" is worth more than another cell in this one.

### A3 — B4, constraining `push_prefix` at config validation

`Validate()` now rejects a `push_prefix` outside the delimiter class the claim recognises.

- **This is a fail-closed change at load time, which is the right polarity — but confirm
  the polarity is actually what ships.** Does an invalid prefix abort the load, or log and
  continue with a default? A validator that warns is a validator that is off.
- **Availability**: a deployment whose config was legal yesterday now fails to start. Is
  that reachable? The ruling cited is "zero operational cost" and is scoped in the comment
  to this deployment. **Is that scoping accurate for the deployed config?** Check the
  actual default config in the tree, not the assumption.
- Does the constrained class **exclude** any prefix that would otherwise have been safe,
  and does it **include** any that widens the claim?

### A4 — O7, the empty alias key

The leg found and measured, at r11 HEAD with `Stages: {"": "completed"}`:

```
""            claim=(completed,true)  auth=(,false)
"ft:"         claim=(completed,true)  auth=(completed,true)   <- bare local prefix reads as completed
":"           claim=(,false)          auth=(,false)
"anything:"   claim=(,false)          auth=(,false)
```

At round 10 the last two would have claimed a stage. This round's marker requirement
removes that. **What survives is the bare local prefix `ft:` reading as `completed`.**

The leg calls it a config-authoring hazard, says the remedy is a load-time check in
`checkLifecycleKeyCollisions` rather than a write-time control, scopes it as axis-3-shaped,
and does **not** fix it.

- Is "axis-3 shaped, out of scope" correct, or is it being used to move a live defect out
  of the round? Axis 3 is genuinely out of scope this round; **scope arguments are also
  claims.**
- Relevant history you should know: `checkLifecycleKeyCollisions` has an open finding
  against it already — it uses the **writer's** oracle rather than the **authorization**
  oracle. If the proposed remedy lives there, the proposed remedy lives in a function with
  a known oracle defect. Say whether that matters.

### A5 — B5 and B8: the race and the nil receiver

- **B5.** Round 10 shipped a data race: `writeViewMapper` mutated `m.writeView` unlocked on
  a shared cached mapper. Round 11 builds the view eagerly in `NewLabelMapper` so
  `LabelMapper` is immutable again. The comment names the **worse** race a previous audit
  found — a read of the new mapper's config field racing construction, **every outcome of
  which biases toward pricing a write free.** Verify the eager construction actually
  removes both, and that the publication of the constructed mapper is safe (a fully-built
  object published through a racy field is still a race).
- **B8.** `assertStageWriteAllowed` refuses when `s.mapper == nil`, at the gate rather than
  in the predicate. Round 10's asymmetry was that `authorizationStage` **panicked** on a
  nil receiver while `lifecycleStageClaim` **allowed**. Confirm both halves are now safe,
  and check whether a nil mapper is reachable at all in production — a fix for an
  unreachable state is fine, but I want it labelled.

### A6 — THE FOURTH AUTHORITATIVE PATH, which nobody has fixed

Standing open finding, **LIVE TODAY, not caused by this diff**:
`hasExternalUnavailableLabel` is a fourth authoritative path and is **unpriced in both
directions** — a bare `task:write` **releases an operator's explicit hold.**

This round does not claim to address it. **Verify it is still unpriced at `2cbbd92`**, and
say whether anything in this diff changes its reachability in either direction. A round
that widens the write-side claim could incidentally cover it, or could incidentally make
it *cheaper*. I do not know which and I have not measured it.

### A7 — the diff's own security narrative

`.design/project-log/label-write-scope-r11.md` is inside the artefact you are auditing.
Every security-relevant sentence in it is a claim by the party under review. Two to weigh
specifically:

- *"The claim governs the WRITE side. Claiming more there can only ever REFUSE a write.
  Refusing is not deciding a privilege question in anyone's favour, so a wider claim cannot
  hand a stock label the authority round 4 took away from it."* — the **directional**
  argument for why the round-4 seam is intact. Test it. A2 above is a counterexample to
  the *unqualified* form of this reasoning; is it a counterexample to this instance?
- *"The seam was already broken at round-10 HEAD by a mechanism the audit did not name":*
  `canonicalLifecycleLabels` rewrote a label the deployment does not honour into the local
  authoritative spelling and handed it to the READ predicate — **laundering a mere claim
  into authority on the endpoint that decides how much the caller owes.** If true, that is
  a live defect that shipped in round 10 and was missed by a full three-way review. **Say
  whether you agree it was live at `6d8f19e`, and if so, why the r10 audit did not see it.**
  A missed-class post-mortem is worth more than another finding.

### A8 — the repair commit and the known-broken commit

`bc93200` is live-broken with the round-10 Critical (self-reported, and the leg measured it
by detached worktree). `93ae124` repairs it. **The history therefore contains a commit
that, if anyone ever checks it out or bisects to it, is exploitable.** The merge-time
decision on whether to squash is mine, not yours — but I want your **security** opinion on
whether a live-broken commit in merged history is a real exposure or a bookkeeping issue,
because that opinion is an input to my decision.

---

## Method notes

- **A stated mitigation is not a mitigation.** For every "this is now prevented," find the
  code that prevents it and the case it lets through.
- Prefer a **chokepoint** over a checklist when the hazard is an open set — **but name the
  mechanism that makes it bite.** A control that looks structural and is inert is worse
  than none, and we have shipped one.
- **Every zero needs a positive control**, including yours. A grep that returns 0 because
  the glob was eaten is indistinguishable from a clean result.
- Do not treat another leg's approval as corroboration, and do not offer yours as one.

---

## Deliverables — all required

1. **Verdict**, with findings classified and each labelled **LIVE / LATENT / INTRODUCED**.
2. Your **open pass**, before the checklist, findings attributed `[OPEN]`/`[CHECKLIST]`.
3. **A1**: your independent judgement on the forced residue — is the impossibility claim
   real, is the reachability story right, and what is the blast radius.
4. **A2**: your sweep for **other difference-shaped gates** with the same form-(13) defect.
   This is the highest-value item in the brief.
5. **A6**: is `hasExternalUnavailableLabel` still unpriced at `2cbbd92`, and did this diff
   move it?
6. **A7**: your verdict on whether the seam was live-broken at `6d8f19e`, and if so, why a
   three-way review missed it.
7. **A8**: your security opinion on the live-broken commit in history.
8. Your **prediction accuracy** as a fraction, with the misses.
9. **A numbered list of everywhere this brief is wrong.** Required.

Do not push. Do not modify production code — your independence depends on it; restore
every probe cell and report the count you left dirty. **You MUST write the report file at
the absolute path above and then mark the task complete.**
