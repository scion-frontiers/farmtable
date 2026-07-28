# Label Write Scope R9 — Security Audit (#194 round 9)

Date: 2026-07-28
Role: Security Auditor (authorization axis)
Branch: `label-write-scope-r9`
Workspace: `/workspace`
Base: `158c8ae963faa5eef032e0857ecbc40d6a7c681a`
HEAD audited: `06f01d7d6555a311fcd0728eac40335e654c1de6`
Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r9.md`

## Verdict

**REQUEST CHANGES**, narrowly, on one item introduced by this round. The change is a net
improvement and the fix leg's own report is unusually honest; it also contains one regression
that contradicts the ruling it cites, inside the commit that cites it.

Critical 0 · High 1 · Medium 3 · Low 1 · Informational 2.
Only Finding 1 is introduced here. Findings 2 and 3 are pre-existing but **wider than the
escalation on record**, which matters because r10 will be scoped from that escalation.

## Gate baseline, reconstructed rather than inherited

`go build ./...` 0 · `go test ./...` 0 (no FAIL lines, flake did not fire) ·
`go vet ./...` 1 with the **same 4** copylocks compared by message · `git status --porcelain`
empty before and after every probe. Exit codes read from the child's `$?`, never through a pipe.

## Findings

1. **[Medium] MUST 5(a) moves a write-side gate onto the `enabled` toggle.**
   `authorizationStage` (`terminal_label_stages.go:69-72`) is shared by the read side and by
   `assertStageWriteAllowed` (`passthrough.go:302`), the `stageWriteForbidden` control. Putting
   `!m.enabled` inside it makes the write side vary with the toggle, which the round-9 ruling
   forbids. Measured against a reconstruction of the pre-commit predicate: at `enabled=false`
   the old code returned `("completed", true)` and the gate **refused**; the new code returns
   `("", false)` and the gate **permits**. Not observable today — the two `stageWriteForbidden`
   call sites get empty lists because the swaps short-circuit first, which I re-verified — but
   the guard's stated purpose is the caller that does not exist yet, and for that caller it
   inverts the safety direction. Fix: drop the guard (it is redundant on the read side), or split
   into `authorizationStageForRead` / `…ForWrite`.

2. **[High] The ruled open finding covers more than `server.go:840-860`.** All three gates —
   CreateTask `:198`, InsertTasksAfter `:382`, UpdateTask `:840` — call the same
   `LabelDeltaLifecycleStages` and inherit the same toggle dependency. Measured: at
   `enabled=false` every shape collapses to unpriced, including **removal** (stripping a
   maintainer's `ft:stage/wont_fix`) and **CreateTask with labels**, which reopens the round-6 /
   audit A-1 hole. r10 should fix the *helper*, not the call site.

3. **[Medium] The ruling as written is too narrow.** *"Must never depend on `enabled`"* covers
   one axis of at least three. Measured: `push_prefix` `ft:`→`ft2:` and a later-added
   `stages: {shipped: completed}` alias both produce "free to write, authoritative later" with
   the toggle **on** the whole time. Precondition, honestly: the label must already exist in the
   repo, since `labelNamesToIDs` drops unknown names and `AutoCreateLabels` is never read.
   Recommended restatement: price a write against the labels that could *ever* be authoritative
   under any configuration, not those authoritative today.

4. **[Medium, adjacent]** `crypto.go:63` — `Encrypt` returns the input unchanged when it already
   carries the `enc:v1:` prefix, and `CreateLinkedAccount` passes `req.GetAuthToken()` verbatim.
   A caller sending `enc:v1:<credential>` stores it in plaintext. Mechanism verified in source;
   exploitation inferred, not observed. Routed to whoever owns credentials.

5. **[Low, adjacent]** `cli/connect.go:301-305` installs no auth interceptors (its sibling at
   `:162` installs both), so `RequireScope` fails open there. **Downgraded from a fan-out
   search's "EXPLOITABLE"**: reaching that server requires a GitHub token with repo write, and
   such a holder can edit labels directly anyway. Incremental privilege ≈ 0.

6. **[Info]** Normalisation (`labelMatchKey`, `stripForMatch`) is **not** an authorization bypass
   here — measured over Kelvin sign, dotted/dotless I, ZWSP, NBSP, padding, case and empty, with
   a positive control. Every deviation is fail-closed and the read and write sides agree.

7. **[Info, adjacent]** `labelIndex` is keyed by `strings.ToLower` with no collision handling, so
   two GitHub-distinct labels can collapse to one key, last write wins. Surfaced, not chased.

## Denominator

12 label-writer paths, derived backwards from the 3 GraphQL sinks and cross-checked forwards
from the proto. Two GitHub writers bypass `assertStageWriteAllowed`: **CreateTask →
`createIssue(labelIds)`** (`passthrough.go:544`, undocumented in the policy comment) and
**CloseTask's inline swap** (`:891`/`:899`, documented and legitimately privileged). Two more
(REST `PushTask`, adapter `SyncCollection`) are ungated but have **no production callers** —
verified by me with a positive control, since the same grep does find their definitions and the
interface.

## Method

Probes were new `_test.go` files only; no production file was modified; reverted by `cp -a` from
a `/tmp` snapshot, never `git checkout`; `git status --porcelain` empty and HEAD unchanged after
each. Every negative claim carries a positive control. Two fan-out searches were used for
breadth and **every load-bearing claim from them was re-verified before entering the report** —
one was downgraded as a result.

**Prediction I got wrong:** I predicted MUST 5(a) would be observable today through the
priority/type arms. It is not. Chasing that wrong prediction is what produced the pre-MUST-5
counterfactual, which became the actual evidence for Finding 1.

## Brief errors

Nine recorded in the report, including two the sender self-corrected mid-task. The two that cost
real analysis time: the brief presents `server.go:840-860` as *the* gate when there are three
structurally identical ones (Finding 2 follows directly), and it infers that method-body gate
placement rescues the interceptor-less CLI path, which it does not because `RequireScope` fails
open on the absent `authEnforcedKey` (Finding 5).
