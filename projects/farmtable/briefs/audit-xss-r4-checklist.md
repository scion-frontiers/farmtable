# audit-xss-r4 — CHECKLIST (STEP 2) + DELIVERABLES

**Released to you because your open pass is on disk. Findings from here are
`[CHECKLIST]`, not `[OPEN]`.** Read Part II (`_xss-r4-method-block.md`) first if
you have not.

---

## STEP 2 — the security surface

### The class, in one sentence

Untrusted content from an external platform (`remote_data` from a GitHub/adapter response)
reaches a client-side rendering surface where a URL-valued field can carry a
`javascript:`/`data:` scheme or an HTML-bearing string, and the defence is (a) server-side
sanitization at the write sites and (b) a client-side URL guard — with **both** halves
policed by source-scanning meta-oracles rather than by types.

Round 4 is the round that went after the **meta-oracles**. So most findings available to
you are about **whether a control is actually on**, not about a new sink.

### A1 — THE RECURSION GAP WAS LIVE. Price it properly.

X3. The leg **measured** that `structpb.NewStruct` preserves nested maps, so
`remote_data.parent.html_url` reached the client unsanitized. Before this diff, sanitization
was top-level only.

I want your independent judgement on the **pre-fix** exposure, because it bears on how
Phase 2 gets described and on whether anything is owed beyond a code fix:

- **Was it exploitable, end to end, at `6805daa`?** Walk the chain: who controls
  `parent.html_url` (or any nested URL-valued key) on the platform side, what privilege that
  requires, whether it survives the adapter, whether it survives `structpb`, whether it
  reaches a DOM sink, and whether the client-side guard would have caught it anyway.
- **Is there existing poisoned data?** Sanitizing at write time does nothing for rows
  already in the database. If nested `remote_data` was persisted unsanitized before this
  fix, **the fix is not retroactive** and there is a data-remediation question this diff
  does not address. Say whether that is real and whether it needs a task.
- The leg says the client-side scrub is **NOT a compensating control** because
  `Task.remoteData` is read by nothing in `web/src`. **That cuts both ways and I want it
  examined:** if nothing reads it, the client-side exposure is currently nil — which lowers
  severity today — but it also means the field is **unguarded by any consumer-side control**
  the moment someone writes a consumer, and there is nothing that would stop them. Which is
  it, and what pins it?
- **MCP and gRPC-web are consumers too.** `web/src` is not the only reader. Check the MCP
  surface and the CLI: does `remote_data` reach any renderer, terminal escape path, or
  downstream tool there? A sanitizer scoped to an HTML threat model may be the wrong shape
  for a terminal or an LLM-context consumer.

### A2 — THE SIX WRITE SITES, AND THE EXEMPTION. Highest-value item.

My brief said four write sites. **There are six** — `export_import.go:139` and `:332` were
missed by me and found by the leg with a scanner rather than an audit.

- **Is six now complete, or is it "six that this scanner can see"?** Model the ways a write
  can evade a scanner: a write through a helper or wrapper, a struct literal assigned
  wholesale, a value round-tripped through a map, a proto built in another package, a
  migration or import path. **Do the sweep yourself and report your method and your
  coverage claim, including what your method cannot see.**
- **`export_import.go` is the one that worries me most on your axis.** Import is an
  ingestion path — it can carry attacker-supplied content in bulk, from a file, possibly
  with different authorization than the API path. **What authorization does import require,
  and can it write `remote_data` that the normal API path could not?** Export is the
  mirror: does export leak unsanitized data outward, and is *export* sanitization even the
  right call — sanitizing on export can silently corrupt a round-trip.
> **[CORRECTED 00:49Z — HALF FALSE, AND YOU GOT (a) RIGHT ANYWAY BY READING THE KEY
> CONSTRUCTION RATHER THAN TRUSTING ME. ORIGINAL BELOW, STRUCK.]**
>
> **(a) STANDS AND YOU ANSWERED IT.** What is at 661 is `p.RemoteData = map[string]any{}` — an
> empty-map construction, inbound, genuinely harmless. But the exemption's *stated rationale*
> refers to the values written at `:663`/`:669`, and those are INDEX writes the scanner's regex
> never matched in the first place. **The exemption suppresses a finding that would never have
> been raised, for a reason that is not true of it.**
>
> **(b) IS FALSE AS I WROTE IT.** The key is exact source **TEXT**
> (`exempt[strings.TrimSuffix(strings.TrimSpace(line), ",")]`), not a line number. It does not
> retarget on edits above it and it does not fail permissive on drift — it fails **CLOSED**
> (measured by `test-xss-r4`, G-7/R10: mutating the statement produced exit 2 and named the site).
>
> **THE REAL PERMISSIVE FAILURE IS THE ONE YOU FOUND WITHOUT MY HELP:** the key has **no file
> component** and the scan root is the whole `internal/server` directory, so a **byte-identical
> line in any other file in the package is silently exempted** (measured, G-7/R7, GREEN).
> **Your LOW rating survives the correction and your one-line fix — key on FILE+TEXT — is now
> IN SCOPE for round 4.** My "is not a Low" sentence was pressure applied on behalf of a
> mechanism that does not exist; disregard it. Rate the mechanism that does.

**[ORIGINAL TEXT, HALF FALSE, RETAINED FOR THE RECORD:]**
- ~~**`server.go:661` is EXEMPT, and the exemption is keyed by EXACT SOURCE LINE.** On your
  axis: (a) **is the exemption correct** — what is at 661 and why is it genuinely safe? and
  (b) **the exemption is a decaying control**: it silently retargets when anyone edits above
  it, and it fails **permissive**. Rate that. A security control whose failure mode is
  silent and permissive and triggered by an unrelated edit is not a Low.~~

### A3 — THE CONTROLS THAT WERE OFF. What was the window?

Two of the three meta-oracles had measured fail-opens, and one whole suite had **no
executor in the documented workflow**. On your axis this is not a test-quality issue, it is
a **control-effectiveness** issue:

- **For how long, and over what merged work, was the client-side URL guard not executing?**
  If it was never run in CI or in either container build, then every merge that passed
  "review" on this branch passed with that control **off**. Establish the window from the
  history and say what landed inside it. There is **no CI/CD on this project** (Part I) — factor that in.
- Same question for the guard tracer's four holes and the regex adapter-key scanner's
  `top=[] nested=[]`: **what did they let through while broken?** The leg fixed the
  instruments; nobody has re-run the fixed instruments over the *history* the broken ones
  cleared. **Do that, or say why it cannot be done, because that is the actual security
  deliverable here.** Running the fixed adapter-key AST scanner and the fixed guard tracer
  across the current tree and reporting every finding they surface that the broken versions
  missed is, in my view, the highest-value hour available to any of the three legs.
- **Phase 1 is merged, deployed, and LIVE IN PRODUCTION.** If the fixed instruments surface
  a finding in Phase 1 code, **report it — do not touch it.** That is a task for me and the
  coordinator, not a fix for this round.

### A4 — X8 IS PARTIAL, AND THAT IS A JUDGEMENT CALL, NOT A MEASUREMENT

Carried as a **claim to be tested**, not as an accepted caveat.

The leg reports `convert.go:358` **discards the error**, so **one unrepresentable value
nulls the ENTIRE `remote_data` silently.** Also `convert.go:530,555,558`. The leg decided
this was out of scope and disclosed it clearly.

Your questions:

- **Is silent whole-field nulling a security property or a correctness one?** I think it is
  at least an **availability/integrity** issue: an attacker who can plant one
  unrepresentable value in a remote payload can make an entire `remote_data` field vanish
  for every consumer of that task — **a data-destruction primitive reachable from the
  external platform.** Test that framing. Is it right? Is it reachable? What does
  "unrepresentable" actually mean for `structpb` — NaN, +Inf, non-UTF8 bytes, an
  unsupported type, a depth or size limit? **Which of those can an external actor supply?**
- The mirror question: does the discarded error ever cause a **fail-open** rather than a
  fail-closed null — i.e. is there a path where the error is discarded and a partially
  converted, partially unsanitized value is used?
- **Is "out of scope" being used to move a live defect out of the round?** Scope arguments
  are claims. Give me a yes or a no and your reasoning.

### A5 — THE STRANDED MUTANT, as a process security finding

Read Part II's section on it. Summary: a crash left mutant **P5cn** live in the
dev working tree; the recovery snapshot `27e0ee0` **captured the mutant**; the mutant had
**SURVIVED the suite**, so a green run would not have caught it — inspection did.

I want your **security-process** opinion, briefly:

- The general shape is **a probe's state escaping into a durable artefact through a channel
  the probe's own cleanup does not cover** — third instance on this project, second in one
  night. What is the class of harm if this happens to a *merged* branch rather than a
  preserve ref? A deliberately weakened security control committed as if it were work, in a
  diff whose test suite is green, is a supply-chain-shaped risk.
- The mitigation applied was to **encode the warning in the ref NAME** rather than in a
  note. Is that sufficient, and is there a residue — e.g. anyone who fetches by SHA, or any
  tooling that enumerates `refs/preserve/*` and does not read names?
- **What should the standing procedure be**, in one paragraph, so the check is not
  structurally blind to a poisoned tree? (Our existing procedure verifies *fidelity* —
  byte-identity between tree and snapshot — which is exactly incapable of detecting that
  what was captured was poisoned. **Preservation fidelity and preservation safety are
  different properties.**) I will fold your paragraph into `em-tooling/`.

### A6 — the two claimed-equivalent mutants, on your axis

**P2cn (claimed equivalent)** and **P11 (claimed a redundant guard)** are being attacked by
the test leg as mutants and by the review leg as code. **Your angle is narrower and
different:** if the equivalence argument is WRONG, what is the security consequence? Rate
the downside of each being wrong. A mutant that is equivalent-except-under-attack is the
only kind that matters to you.

For **P11** specifically: "redundant" means "the other guard is total." **Name the partner
guard and find the input where it does not fire.** Redundancy deleted on the strength of a
totality claim is how defence in depth disappears.

### A7 — the diff's own security narrative

`.design/project-log/url-scheme-validation-r4-fix-round.md` is **inside the artefact you
are auditing**. Every security-relevant sentence is a claim by the party under review.
Weigh specifically:

- The claim that **`server.go:661`'s exemption is safe**. **[00:49Z: the exemption IS safe for
  the statement it names, but the log's stated REASON for it is about `:663`/`:669`, which the
  scanner regex never matched. A true conclusion resting on a false reason — weigh the reason,
  not just the conclusion.]**
- The claim that **the client-side scrub is not a compensating control** (A1 above).
- The claim that the recursion fix now covers **every depth**. Depth-unbounded claims are
  rarely true; find the bound and say what happens there.

And the retrospective question, which is worth more than another finding: **round 3 was a
full three-way review of this branch and it did not find that the web guard suite was never
executed.** Why not? A missed-class post-mortem here is a deliverable.

### A8 — fenced, but flag if claimed

Out of scope: the four `go vet` copylocks; the `web/dist` clean-checkout defect; **CSP
absence**; the `#195` markdown/DOMPurify branch and its two `unsafeHTML(renderMarkdown(...))`
sinks; the `#194` branch; the absence of CI; the three-URL-policy merge seam; and the
`scopes.go` formatting drift (a declared decision — see the baseline block, not a handoff
defect). **Do not file these as defects of this diff. DO flag it if this diff claims to
handle any of them.**

CSP deserves one sentence from you even though it is fenced: given that this branch's whole
defence is source-scanning for the absence of bad sinks, **say whether a CSP would
subsume a meaningful fraction of this instrumentation.** That is a scheduling input for me.

---

## Method notes

- **A stated mitigation is not a mitigation.** For every "this is now prevented," find the
  code that prevents it and the case it lets through.
- **Every zero needs a positive control**, including yours. A grep that returns 0 because
  the glob was eaten is indistinguishable from a clean result. **`cmd | tail` reports
  `tail`'s exit code.**
- Prefer making the bad state **unrepresentable** over detecting it — **but name the
  mechanism that makes the control bite.** A control that looks structural and is inert is
  worse than none, and we have shipped one.
- Do not treat another leg's approval as corroboration, and do not offer yours as one.
  **Divergence between legs is a RESULT.**

---

## Deliverables — all required

1. **Verdict**, findings classified and each labelled **LIVE / LATENT / INTRODUCED**.
2. Your **open pass**, before the checklist, findings attributed `[OPEN]`/`[CHECKLIST]`.
3. **A1**: end-to-end exploitability of the nested-`remote_data` gap at `6805daa`, the
   persisted-poisoned-data question, and the non-`web/src` consumers (MCP, CLI, gRPC-web).
4. **A2**: your own independent sweep for write sites — method, coverage claim, and what
   your method cannot see — plus your rating of the `server.go:661` exemption **[AMENDED
   00:49Z: the TEXT-keyed, file-agnostic exemption. It is not line-number-keyed; see the
   correction at A2 above.]**
5. **A3**: **the fixed instruments re-run over the tree**, and every finding they surface
   that the broken versions missed. Report Phase 1 findings; do not touch Phase 1.
6. **A4**: your verdict on **X8 / `convert.go:358`** — is silent whole-field nulling an
   externally-reachable data-destruction primitive, and is "out of scope" correct?
7. **A5**: your one-paragraph standing procedure for preservation **safety**, not fidelity.
8. **A6**: the security downside if **P2cn** or **P11** is wrong, and P11's partner guard.
9. **A7**: your missed-class post-mortem on why round 3 did not find the unexecuted suite.
10. Your **prediction accuracy** as a fraction, with the misses.
11. **A numbered list of everywhere this brief is wrong.** Required.

Do not push. Do not modify production code — your independence depends on it; restore every
probe cell, verify by `git diff` against the SHA, and report the count you left dirty.
**You MUST write the report file at the absolute path above and then mark the task
complete.**
