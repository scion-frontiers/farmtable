# Farm Table Dogfooding Notes

Running observations from using Farm Table (`ft`) to manage its own development.

---

## 2026-05-09: Task-as-brief pattern

**Observation:** Giving a developer agent just a task ID works as a complete brief when the task description is detailed enough. The agent runs `ft task get <id>`, reads root cause + file locations + fix pattern, and implements the fix. Zero duplication between the coordinator's instructions and the task system.

**Evidence:** Developer agent fixed the critical graph traversal bug (a069231d) in 2 minutes with a one-sentence prompt + task ID.

**Implication:** Task descriptions should be written as self-contained briefs — not thin one-liners like "Fix timing-safe token comparison. Size: S." The richer the description, the less the coordinator needs to supplement.

---

## 2026-05-09: Agents skip ceremony

**Observation:** Developer agents reliably skip bookkeeping steps (ft task claim, stage transitions) even when explicitly told to do them. The graph traversal bug agent was told "Claim the task, fix the code..." — it skipped the claim and went straight to fixing.

**Evidence:** Task a069231d was closed with no assignee. Stage went from triage directly to completed, skipping `working`.

**Implication:** Don't design workflows that depend on developer agents remembering non-coding steps. Push assignment up to the coordinator (`ft task update --stage working` before starting the agent). Push audit capture down to the tool (auto-assign on close via C2 auth context). See `.design/agent-task-lifecycle.md` for full analysis.

---

## 2026-05-09: No --assignee flag on ft task update

**Observation:** When the coordinator tried to assign tasks before delegating (the recommended pattern from the lifecycle analysis), `ft task update` doesn't have an `--assignee` flag. Could only set `--stage working`, not the assignee.

**Impact:** Confirms the AUTH-4 gap. The coordinator can't do proper bookkeeping even when it tries to.

**Proposed fix:** AUTH-4 (`ft task claim --assignee override`) or a new `ft task assign` shorthand.

---

## 2026-05-09: Stale tasks from backlog decomposition

**Observation:** The TPM agent decomposed the roadmap into 69 tasks, but didn't cross-reference git history. All 14 "URGENT" remediation bugs (REM-1 through REM-11, CLI-1, CLI-5, INT-2) were already implemented in a prior sprint. Two eng-manager agents were dispatched to fix them, only to discover the work was already done.

**Evidence:** Both eng-store and eng-cli agents verified each fix was present in the codebase and closed the tasks without writing any code.

**Impact:** Wasted two agent-slots on verification of completed work. The verification itself was valuable (confirmed the remediation plan was fully executed), but the surprise was not.

**Proposed fix:** Backlog decomposition should cross-reference `git log` and `grep` the codebase before creating tasks. A `ft task search` command (FR filed as caedcde6) would also help detect duplicates.

---

## 2026-05-09: Thin task descriptions break task-as-brief

**Observation:** The remediation tasks had one-line descriptions like "Security fix: timing-safe token comparison. Source: INFRA-1. Size: S." — not enough for a developer agent to work from. The coordinator had to supplement with "read .design/remediation-plan.md for full specs."

**Contrast:** The graph traversal bug (a069231d) had a multi-paragraph description with root cause, evidence, affected files, and fix pattern. That task worked perfectly as a standalone brief.

**Implication:** The quality of the task description determines whether task-as-brief works. When creating tasks, write them as if a developer will read nothing else.

---

## 2026-05-09: Bulk stage updates work well

**Observation:** Moving 14 tasks from `triage` to `working` via repeated `ft task update <id> --stage working` calls worked smoothly. Each call returned the updated task confirming the stage change.

**Improvement opportunity:** A `ft task batch` command (CLI-8, filed) would reduce this to a single call.

---

## 2026-05-09: GetReadyTasks returns 0 — surprising default

**Observation:** `ft task ready` returns 0 results because it filters to `stage='ready'` by default. All tasks are created in `triage` stage. The `include_unblocked_open` flag exists but defaults to false and isn't surfaced in CLI help.

**Impact:** The most natural question — "what should I work on?" — returns nothing when no formal triage process has been run. For dogfooding without ceremony, this is confusing.

**Filed as:** c7b6188a (HIGH priority).

---

## 2026-05-09: Graph traversal only followed one relationship direction

**Observation:** `ft task critical-path` returned depth 1 when the actual longest chain was 4. Root cause: graph RPCs only iterated `SourceRelationships` for `type == "blocks"`, missing `TargetRelationships` for `type == "blocked_by"`. Since `--blocked-by` is the natural CLI pattern, most relationships were invisible to the traversal.

**Fixed in:** Commit 29991bc. Three functions in server.go now check both directions.

**Implication:** Both relationship representations (`A blocks B` and `B blocked_by A`) must be treated as equivalent throughout the codebase. Any new graph algorithm needs to handle both.

---

## 2026-05-09: Feature requests from coordinator usage

Three features that would have made graph analysis significantly easier, filed as tasks under Stream 4:

1. **ft task search** (caedcde6) — full-text search on names and descriptions
2. **ft task tree enhancements** (6edecdd2) — show cross-stream dependencies when viewing a scope-task's subtree
3. **Cross-stream dependency queries** (4e5d15ab) — "show everything that blocks or is blocked by tasks in Stream 5"

---

## 2026-05-09: --notify flag deprecated

**Observation:** `scion start --notify` now produces a deprecation warning — notifications are on by default. Minor, but the coordinator's instructions and CLAUDE.md should be updated.
