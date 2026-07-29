# audit-194-r10 — security audit, `label-write-scope-r10` @ `6d8f19e`

Read `_194-r10-baseline-block.md` in this directory first, in full.

Write your report to
`/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r10.md`.

Verdict: findings with severity (Critical / High / Medium / Low / Info), and an overall
APPROVE or REQUEST CHANGES **on the diff**. If you approve the diff while holding an
open concern that is out of the diff's scope, say both clearly and separately — an
auditor did exactly that last round and it was the right call.

## Your axis

Threat modelling and exploitability. Mutation work is the test leg's axis; correctness
and architecture are the review leg's. Label anything outside your lane as an
impression rather than a finding.

## The vulnerability this round is closing

A principal holding a bare `task:write` scope could durably write a label that later
becomes authoritative for lifecycle purposes, without the write ever being priced
against the narrower scope such a label should require. Rated HIGH on a measured
differential. The privilege gain is: **write a label now, have it silently promoted to
an authoritative lifecycle signal later**, without ever holding the scope that governs
lifecycle transitions.

The ruling the code must now meet — restated after the dev leg finished, so **the leg
did not implement against this text**:

> Price a label based on whether its **suffix** matches a value authoritative under
> today's `Stages` / `Priorities` / `Types` configuration, **regardless of prefix**.
> `ft:stage/completed`, `ft2:stage/completed` and `anything:stage/completed` price
> identically. The unbounded thing was the prefix, not the suffix.

**Axis 3 is out of scope and is not a finding.** A suffix not in today's config —
`shipped`, say — is unknowable at write time by any syntactic means; its remedy is a
config-CHANGE-time control, tracked separately. Do not file its absence. **Do** file it
if the code claims to cover it, and do tell me if you think the residual risk from
deferring it is worse than I am treating it as.

## The claims I want independently checked

**1. `lifecycleStageClaim` is "a strict superset of `authorizationStage`, so it can
only refuse more."**

This is the safety claim the entire diff rests on, and it is the one whose failure is a
*regression* rather than a shortfall. If the new claim is not a strict superset, then
somewhere the fix **allows** a write the old code refused. Check it as a property over
inputs you choose, not on the leg's examples, and check the direction specifically:
your question is not "does it refuse more" but "is there any input it refuses **less**."

**2. Does the write-suppression partition hold, and can a disabled mapper now emit
labels?**

The leg found — correctly, and against a verdict vocabulary I supplied that would have
broken this — that **six of the config guards are write-SUPPRESSION and must keep their
guards**, because not emitting labels is what the toggle is for. Had my instruction been
followed, a mapper with `github.labels.enabled=false` would have started pushing
`ft:stage/` labels to third-party repositories.

That is the highest-consequence near-miss in the round and it deserves an independent
check rather than my say-so. **With the toggle off, does anything in the shipped code
emit a label that the pre-fix code would not have emitted?** Treat outbound label writes
to a repository the operator has deliberately disabled mapping for as an integrity and
trust-boundary issue, not merely a bug.

One guard is described as DUAL — serving both read and write meanings — with no single
verdict fitting it. Say whether that dual guard is safe in both directions or safe in
one.

**3. Coverage of `Priorities` and `Types`.**

The restated bound names three config maps. The leg's work is described throughout in
stage vocabulary — `lifecycleStageClaim`, `assertStageWriteAllowed`. **I do not know
whether `Priorities` and `Types` are covered, deliberately excluded, or simply not
considered**, and I am not going to guess. Determine which, and if they are unprotected,
determine whether the original privilege-escalation reproduces through them. A label
whose suffix matches a configured priority or type, written by a bare `task:write`
holder, is the same shape of defect if those maps feed any authorization or lifecycle
decision.

**4. The three-cause collapse, from an attacker's side.**

The leg measured three necessary contributors, none sufficient:
`terminal_label_stages.go:198`, `terminal_label_stages.go:70`, and `labels.go:393` via
the `IssueToPhaseStage` fallback. Full parity only when all three are addressed.

Your version of the question: **are three the complete set?** The leg found three where
I had asserted one, which is evidence the enumeration got wider under measurement, not
that it stopped widening. If there is a fourth path by which a written label becomes
authoritative — a scheduler, a fallback, a cached index, an import path — it is
unpriced. Note that a related finding on this branch involved enumerating *authorization
gates* when the thing that mattered was *schedulers*.

**5. Foreign-prefix reachability at `enabled=TRUE`.**

The leg measured that adding `ft2:stage/completed` is unpriced **today, at
`enabled=true`, default config, with no config change required.** This is the finding
that turned axis 2 from a toggle problem into a live one, and it contradicted my own
framing that only the toggle-off case could falsify. Confirm the pre-fix reachability
and confirm the post-fix closure, and state plainly whether the live exposure is closed
or narrowed.

## Scope fence

**In scope:** everything in `06f01d7..6d8f19e`, plus the security properties of the code
it touches.

**Out of scope, do not re-derive:** the `go vet` copylocks; the clean-checkout build
defect; CSP; the `Encrypt()` plaintext-passthrough finding; the Unicode case-folding
collision in `labelMatchKey`; the markdown and URL-scheme branches.

Short fence, deliberately. **If you find something outside it, surface it — do not
assume it is someone else's.** The fence exists so you do not spend your round on known
items, not so findings die at its edge.

## Method notes

- **A control catching your own error is a result worth reporting.** Last round an
  auditor's first Go gate returned **exit 0** on a build that compiled nothing, because
  it was issued from a subdirectory; only the `matched no packages` warning
  distinguished it. It discarded the run and said so, and that was among the most
  valuable paragraphs in the report.
- **Enumerate what survived; do not grep for what you expected.** A recent round
  surfaced three carriers nobody had thought to look for by enumerating every attribute
  on rendered output instead of grepping for the expected ones. The analogue here is
  enumerating every path by which a label reaches an authoritative decision, rather
  than checking the paths this brief names.
- If you build a differential, **assert which arm fired.**
- Treat a confidently wrong comment as security-relevant. On the sibling branch this
  week, six of ten findings were a false sentence over a correct measurement, and the
  auditor there recommended correcting comment text **before merge** on the grounds
  that in this codebase a wrong comment is the raw material for the next round's real
  defect. I agree with that and would apply it here.

## Deliverables

1. Findings with severity, and an overall verdict on the diff.
2. An explicit verdict on each of the five claims above — **including where you agree,
   stated at equal weight.** A confirmed green control is a result, not an absence of
   one.
3. Your determination on `Priorities` / `Types`: covered, excluded, or not considered.
4. Your read on whether three contributors is the complete set.
5. A numbered list of everywhere this brief is wrong. Required — and note the two
   failure modes in the shared block, one of which is that I state counts and single
   loci I have not measured.

Do not push. Do not modify production code. You MUST write the report file and then
mark the task complete.
