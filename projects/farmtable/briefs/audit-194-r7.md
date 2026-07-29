# Brief — audit-194-r7: independent SECURITY AUDIT of #194 round 7 (combined)

## Your working tree

**Your working tree is `/workspace`.** Confirm with `git rev-parse --show-toplevel`, then
verify BOTH branch and SHA:

- branch `label-write-scope-r7`, **HEAD `1d4442f1982b6e03233f1517106d0c369af1afe6`**
- base `6ced24e`

**Do NOT create any directory named in this brief.** If a path here does not exist, the
brief is wrong; tell me.

**[MEASURED by me, in a fourth repository]** `6ced24e`, `cc953e4`, `4df2d1e` and `15b7247`
are all ancestors of `1d4442f`; negative control `633f8f2` is not. Assert ancestry yourself
before using `git diff A B` as a range.

**[MEASURED by me]** Audit surface excluding `.design/`: **16 files, +1185 / −117.**

## The threat model, stated precisely, because it has been overstated once already

This service runs behind **IAP**. Only identity-authenticated principals inside that
boundary can reach it at all. **A-4 was never about an anonymous internet attacker** — it
is privilege escalation *between authenticated principals*: a caller holding `task:write`
reaching an effect that should require `task:close`. IAP removes a population that was
never in scope. **Do not credit IAP with mitigating anything in this diff, and do not
treat "it's behind IAP" as a reason to downgrade a finding.** Equally: do not describe
anything here as internet-exposed. It is not.

## What this round fixed

- **A-4** — a free, retryable primitive by which a caller with `task:write` could destroy a
  lifecycle label the authorization gate never priced. Fix: a new store seam
  `SnapshotLabelWriteRestrictor` (`internal/store/store.go`), routed via `MultiStore`,
  implemented by `GitHubPassThroughStore`, invoked from `UpdateTask`.
- **M-2** — `InsertTasksAfter` was ungated; it now rejects lifecycle-stage labels.
- **M-1** — the server binary was discarding the operator's GitHub label config, so a
  deployment's configured prefix was not reaching the mapper. Live in production.
- Ten previously-discarded label-write errors now propagate through one helper,
  `writeLabelSwap`.

## Your job

Independent security audit. Findings with explicit severity (Critical / High / Medium /
Low / Info), each with a concrete exploitation path or an explicit statement that you could
not construct one. **A code reviewer and a test engineer are auditing the same SHA in
parallel; you will not see their work and they will not see yours.** That is deliberate.
Do not hedge toward what you think they will say.

### 1. Does A-4's fix actually close A-4? Construct the attack, do not reason about it.

The strongest possible result you can produce is a working bypass of the new control.
The second strongest is a documented, failed attempt to build one, with the specific
reason it fails. **A "looks correct" is worth very little here** — the entire reason A-4
existed is that the previous control looked correct.

Leg A explicitly **rejected** using `p.Version` optimistic concurrency for this, on the
grounds that *"the attacker opts out — `p.Version` is caller-supplied and this request
path needs no version today. A control the adversary disables by sending less is not a
control."* Test that reasoning: is there anything else in the new control that a caller
can disable by **omitting** a field, sending an empty value, or sending a differently-cased
string? The matching is case-insensitive via `labelMatchKey` (lowercase + trim). Unicode
case folding, whitespace, and homoglyphs are all in scope for you.

### 2. Where the control is BOUND — the highest-value question in this brief

**[MEASURED by me, on leg A's tree, with a positive control: the same grep shape finds 34
`FarmTableService` handlers, so it is not a dead pattern]**

- `s.writeLabelSwap(...)` call sites in `passthrough.go`: **6**
- raw `gql.addLabels` / `gql.removeLabels` OUTSIDE that helper: **2** (both in `CloseTask`)
- `store.RestrictLabelWriteToSnapshot(` in the request path: **1** — `server.go:840`,
  inside `UpdateTask`

So the new control is bound at **one** of the paths that reach the underlying mutation.

**Read the next paragraph before you write anything about this.** "The other paths are
ungated" is very probably NOT the finding, and rounding up to it is the fastest way to get
a real finding dismissed. Most other paths are gated by something else — your job is to
determine *which*, path by path, and to name the gate. The claim I want tested is narrower
and sharper: **the control was bound where the bug was reported rather than at the
narrowest point every path must traverse.** `writeLabelSwap` is that narrower point and
it is new this round. Is there a reason it could not live there? If binding it there is
correct, say so and say what it would cost. If some path is genuinely reachable and
genuinely ungated, that is a finding and I want the exploitation path.

### 3. An unconfirmed lead from leg A — confirm or kill it

Leg A reported, explicitly flagged **UNCONFIRMED, reading-derived, no colliding config
constructed**: `PriorityLabelSwap` and `TypeLabelSwap` may be real ungated GitHub label
writes reachable under bare `task:write`, not covered by
`RestrictLabelWriteToSnapshot`. Leg A did not build a config that collides. **Build one, or
demonstrate that none can exist.** A clean kill is as valuable as a confirmation; an
unresolved "maybe" is the least valuable of the three outcomes.

### 4. Something I measured myself that is NOT in this diff — assess, do not rediscover

**[MEASURED by me, `internal/server/scopes.go:74`]** `RequireScope` has **two** fail-open
branches:

```go
if ctx.Value(authEnforcedKey) == nil { return nil }  // open-access mode
if len(scopes) == 0 { return nil }                   // "nil/empty scopes = wildcard
                                                     //  (backward compatible)"
```

**[MEASURED by the coordinator against the live deployment, not by me]** Open-access is NOT
active in production. But the credential carrying live dashboard traffic for the last 19
days has **NULL scopes**, so branch two is active for it: every scope check in #194 is
computed and discarded for that credential. The one properly-scoped token was created this
week and has never been used.

I am giving you this so you do not spend budget rediscovering it, and because it bounds
what #194 buys. **What I want from you is different from the fact itself**: given branch
two exists, is there anything in *this diff* whose correctness silently depends on scopes
being non-empty? A control that is a no-op under the live credential is not thereby
harmless — it may be load-bearing in review, in a test, or in a comment someone will cite
later. **Do not file the fail-open branch itself as your finding; it is already tracked and
already routed to the product owner.**

Also note for anyone drafting remediation: **removing branch two would break the live
dashboard immediately.** Correct order is grant scopes, verify traffic, then close the
branch. If your report recommends closing it, say the order.

## Gates

`make web` first (0; `go build` genuinely fails without it — gitignored `web/dist`, ~4109
files, not a finding), then `go build ./...` (0), `go test ./...` (0; known `WatchTasks`
flake ~0.06%, re-run and say so, do not chase), `make race` (0).
`go vet ./...` **exits 1** on **exactly 4** pre-existing `copylocks` findings in
`internal/server/server.go` (`GetReadyTasks`/`GetBlockedTasks`/`GetCriticalPath`/
`GetBottlenecks`). Confirm still 4 and still those four RPCs; ignore line numbers, they
moved by a uniform +73.

## Known-open — already tracked, do not re-litigate the category

r8 items: the `SameStageSet` stage-collapse seam; the 12-cell custom-prefix label-WRITE
matrix. Also tracked: GitHub-backed tasks have no audit trail at all; keying `duplicate`
off the native close `state_reason` instead of labels; enumerating *schedulers* rather than
only authorization gates. **A NEW instance of any of these is still a finding — I want
instances, not categories.**

## Standing bars

- **Positive control before any negative claim.** "I could not exploit it" is only
  meaningful from a harness that has been shown to be able to report a successful exploit.
- **Any harness ABORTS on a failed prerequisite.** Fourteen void harnesses on this
  workstream so far; every one printed a clean, confident, wrong number.
- **Exit codes from the child process, never through a pipe.**
- **Quote every glob**: `--include='*.go'`. Unquoted under zsh, `grep` returns empty, exit 0.
- **Do not push. Do not modify production code** — your independence depends on it.

## Deliverables

1. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r7.md`: verdict, findings
   with severity and exploitation paths, the §2 path-by-path gate enumeration, the §3
   confirm-or-kill result, **what you could not verify**, **your void runs**, and a
   **WHERE THIS BRIEF IS WRONG** section. Every leg for five rounds has found a real error
   in my brief; assume there is one.
2. A project-log entry committed in `.design/project-log/`.

**You MUST write the report file, commit the project-log entry, and then mark the task
complete.**
