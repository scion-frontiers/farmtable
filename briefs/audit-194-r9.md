# audit-194-r9 — security audit of `label-write-scope-r9` @ `06f01d7`

**Read `/scion-volumes/scratchpad/projects/farmtable/briefs/_r9-baseline-block.md` FIRST and in
full.** It contains your tree, your commit, the gate baseline, a baseline correction I got wrong for
many rounds, the flake, and the method rules. Everything there applies to you.

**You are one of three independent legs reviewing this change.** A code-review leg and a
test-engineering leg are running in parallel, in their own clones, on the same commit, on different
axes. **You will not see their reports and they will not see yours. Do not defer a security question
to them.**

**Your axis is authorization**: after this round, what can a caller do that they should not be able
to do — and what durable state can they create now whose consequences are priced later?

## Context you need

This is round 9 of a long sequence on issue #194. The property under construction: **writing a
lifecycle-prefixed label (`ft:stage/*`) must require the scope that the resulting lifecycle
transition requires** — a bare `task:write` holder must not be able to move a task to `completed` by
writing the label directly, because the label is authoritative for the task's computed stage.

`158c8ae..06f01d7`, six commits, **+1663 / −97 across 12 files**. Only four are production:
`internal/platform/github/config.go` (+78), `internal/platform/github/passthrough.go` (+86),
`internal/platform/github/terminal_label_stages.go` (+26), `cmd/farmtable-server/main.go` (+26).
The gate itself is at `internal/server/server.go:840-860`.

The author's report is at `/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-r9.md`.
**Form your own view of the trust boundary first**, then read it, and treat every claim as unverified.

## Already found and already ruled — do not re-derive it, GENERALISE it

The author found, measured and correctly escalated this rather than guessing:

> With `github.labels.enabled=false`, the gate at `server.go:840-860` prices **nothing**. Measured
> differential: `enabled=true` → PermissionDenied, labels stay `[bug]`. `enabled=false` → accepted,
> labels become `[bug ft:stage/completed]`; **after the toggle is later flipped on**,
> `stages=[completed]`, `available=false`. A bare `task:write` holder has banked a privileged
> lifecycle transition. `LabelDeltaLifecycleStages` failing closed on `ErrEmptyLifecycleStageSet`
> does NOT save it — the gate is **not reached**, rather than reached and refused.

**The ruling** (already made, going into r10 — do not design this fix): the scope required to WRITE
a lifecycle-prefixed label must never depend on `enabled`. Only the read/authorization-derivation
side varies with the toggle; the write side does not vary at all. A write creates durable state in
GitHub, which never hears about the toggle, so the write's future consequence is identical regardless
of `enabled` at write time.

**What I want from you is the generalisation, and this is your highest-value task:**

> **Where else in this system is a WRITE gated by a predicate that only describes the CURRENT
> read-time interpretation of the thing being written?**

That is the abstract defect: a check that is conditioned on how the system reads state *today*,
guarding an action whose consequences are decided by how the system reads state *tomorrow*. The
`enabled` toggle is one instance. Config reloads, feature flags, label-prefix configuration,
collection-level settings, scope sets that can be widened later, and anything read from
`config.go` are all candidate axes. **Enumerate the candidates, give me your denominator and your
method, and state what your method would miss.** Report second instances even if you cannot exploit
them.

## Specific things I want established

1. **Does MUST 5 create a second instance of the ruled defect?** `794bdce` deliberately moves
   *authority* onto the `enabled` toggle ("authority follows the toggle, validation ignores it").
   That is the correct half of the ruling — but verify it did not also move any **write-side** gate
   onto the toggle, and that "validation ignores it" is true at every validation site rather than
   the one the commit message has in mind.

2. **Is the gate reachable by any path that does not traverse `server.go:840-860`?** Enumerate every
   writer that can place a label on a task: gRPC `UpdateTask`, collection import, the GitHub
   passthrough store, the CLI pass-through registration (which installs **no interceptors** —
   established in a parallel audit, so method-body placement matters), MCP tools, and any bulk or
   insert path. This project has previously shipped an ungated `InsertTasksAfter` and a server that
   silently discarded label config, so the enumeration is not a formality. **Give me your denominator
   and your method.**

3. **The removal half.** Most of this sequence has been about *adding* a lifecycle label. Deleting
   one is also a lifecycle transition (it can move a task *out* of a terminal stage, making it
   available again). Is removal priced at the same scope as addition, on every path, including when
   the same label appears in both the add and remove lists of one request? There is a known
   prior finding in exactly that shape.

4. **`labelMatchKey` normalisation as an attack surface.** Comparisons run through
   `strings.ToLower(strings.TrimSpace(raw))`. Anything that normalises before comparing invites a
   collision: two distinct labels that compare equal, or one label that evades a match. Consider
   Unicode case folding (the Kelvin sign and dotted/dotless I are the classic pairs), zero-width and
   bidi characters, NFC/NFD, and the empty string. **A known open item exists in this area** — if you
   land on it, name it and stop rather than re-deriving it at length. What I want is whether it
   creates an *authorization* bypass here, not a restatement that it exists.

5. **Blast radius if the gate is wrong.** If a bare `task:write` holder can set a terminal lifecycle
   stage, what does that actually get them in this product? Be concrete and be honest about the
   trust boundary: this deployment sits behind IAP, so attacker and victim are both already inside
   it. Previous rounds have both **over**-stated and **under**-stated this. Say what is established
   and what is inferred, in those words.

6. **Anything adjacent.** Surface it, do not chase it. Adjacent territory has been unusually
   productive on this project — two separate audits this week found real issues from unrelated
   directions.

## Out of scope — assigned elsewhere, do not open fixes

- The 4 pre-existing vet copylocks; the `TestWatchTasks` flake; the `web/dist` clean-checkout
  condition (task #100).
- A stored-XSS fix in the dashboard, an absent Content-Security-Policy, a markdown sanitizer with a
  scheme policy wider than the app's own, `FARMTABLE_OPEN_ACCESS` failing open, and an
  `ImportCollection` scope-escalation path. **All are separately owned and already tracked.** If any
  of them changes your assessment of THIS change's blast radius, say so and use it — a rating that
  ignores the surrounding trust boundary is not honest. Just do not open fixes.

## Method requirements

- **Do not push. Do not modify production code.** Probes are fine; revert by snapshot restore
  (`cp` from `/tmp`), **never `git checkout`**, and assert `git status --porcelain` empty afterwards.
- **Do not touch or inspect the production deployment.** Confine yourself to this tree.
- **A negative claim needs a positive control.** "I grepped and found nothing" is not a result unless
  you also show the grep finding something it should find.
- **Do not assert exploitation you did not observe.** Say what is established and what is inferred.
- **Do not build binary probe payloads in bash string literals** — a parallel audit had both arms of
  a NUL-byte experiment silently truncated by the shell, and the two arms returned identical errors
  that read exactly like a real auth result. Write payloads from a file or a Go/Python harness.
- **Beware colliding oracles.** Two arms returning the same value for different reasons is the
  recurring way this project has fooled itself — read messages, not codes or counts.

## Deliverables — you are not done until all six exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r9.md`** with a
   verdict — **APPROVE** or **REQUEST CHANGES** — findings numbered, severity-classified
   (Critical/High/Medium/Low/Informational), each with location, evidence, impact, recommendation.
2. **The generalisation deliverable**: your enumeration of other writes gated by read-time
   predicates, with method and blind spots. This is the one I care most about.
3. **Your label-writer denominator** for item 2, with method and what it would miss.
4. **A before/after statement**: what a `task:write` holder could do at `158c8ae`, and what they can
   do at `06f01d7`.
5. **A project log entry** in `.design/project-log/`, **committed** (the only thing you commit).
6. **An explicit list of every place this brief is wrong.** At least fifteen consecutive rounds have
   contained one; assume there are more here.

**You MUST produce all six deliverables and then mark the task complete. Do NOT push.**
