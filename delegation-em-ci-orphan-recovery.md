# DELEGATION → farmtable-em-ci: recovery and incorporation of single-copy work

**From:** architect-reviewer, at ptone's direction ("take the work you have identified as
worth keeping and delegate it to em-ci for recovery and incorporation").
**Measured:** 2026-07-29 ~15:06Z, against `origin/main` @ `aa08f1a` re-fetched.
**Escalate to ptone.** Not to me, not to the other EMs.

---

## 1. The topology problem, which is the actual finding

`/workspace/farmtable` (canonical) has a real network remote:
`https://<redacted>@github.com/scion-frontiers/farmtable.git`. Off-device durability is
therefore *available*.

None of the at-risk work can reach it. Measured remotes:

| Repo | Branch | Remote points at | Upstream |
|---|---|---|---|
| `/workspace/dev-p2-rebase` | `p2-land` @ `e64138c` | `p2` → `/workspace/farmtable-dev-p2-land` | `p2/p2-land` |
| `/workspace/dev-scopedeny-93` | `hardening/deny-unrecognised-type` @ `951502d` | `/workspace/farmtable` | `origin/main` |
| `/workspace/farmtable-194-pricing` | `dev/194-pricing-ruling` @ `7b392b1` | `/workspace/farmtable-194-oracle` | none |
| `/workspace/farmtable-ci-manifest` | `docs/floor-predicate` @ `e811abf` | `/workspace/farmtable` | none |
| `/workspace/farmtable-ci-workflow/farmtable-ci-workflow` | `fix/ci-review-findings` @ `2016940` | `/workspace` | none |
| `/workspace/farmtable-mainred-fix` | `docs/watchtasks-cold-flake` @ `0589615` | `/workspace` `/farmtable` | none |

Every remote is a **local filesystem path**. `dev-p2-rebase` pushes into another agent's
clone, which itself has no route onward. The chains terminate in working directories on
a single device. 129 git repositories exist on this host; the count is not the problem,
the absence of any path to `origin` from the working clones is.

## 2. What is single-copy right now

63 commits exist in exactly one repository and are absent from every ref reachable in
canonical (986 commits). By owner:

| Repo | Single-copy commits | Owning agent state |
|---|---|---|
| `dev-p2-rebase` | **43** | running, active seconds ago — **LIVE, do not stomp** |
| `dev-scopedeny-93` | **14** | completed |
| `farmtable-194-pricing` | 3 | running (also 6 uncommitted files) |
| `farmtable-ci-manifest` | 1 | **no agent of that name is running** |
| `farmtable-ci-workflow` | 1 | running (1 uncommitted file) |
| `farmtable-mainred-fix` | 1 | blocked |

An earlier survey put this at 10 across 4 repos. It grew to 63 across 6 because agents
kept committing during the review. Treat any figure in this project older than ~15
minutes as stale.

## 3. What is worth keeping — the 43 in `dev-p2-rebase`

This is the Phase 2 web UI work, rebased onto current main (`docs: log phase 2 rebase
onto main aa08f1a`, 15:05:34Z). It contains, among 43 commits:

- `test(web): add Lit component test harness and task-state UI tests` — **the vitest +
  jsdom harness** that is the subject of the test-split briefing sent separately.
- `Resolve tsconfig.test.json to main's include set and widen the runner to …` —
  **`dev-p2-rebase` has independently already performed the reconciliation that briefing
  recommends.** Two parties converged on the same resolution without contact. That is
  corroboration, and it also means the merge question is largely settled in fact.
- 12 `test(web):` commits pinning drop refusals, escaping, rank arithmetic, cardinality.
- `fix(web): stop writing phase, add terminal lanes, refuse drops visibly` and
  `refactor(web): finish the phase->stage migration in the dependency view` — the
  phase→stage contract migration.
- Two security fixes: `validate external URL schemes before rendering hrefs`,
  `gate the localStorage token fallback behind a dev build flag`.

The 14 in `dev-scopedeny-93` are the empty-scope-set / unrecognised-user-type hardening
with paired RED oracles, and its agent has finished. Nothing is pulling them anywhere.

## 4. Requested actions, in order

1. **Durability first, incorporation second.** Get every single-copy commit to a second
   location, ideally `origin`, before any merge work. This is reversible-cheap and the
   current exposure is total loss on container death.
2. **Do not disturb `dev-p2-rebase` while it is live.** It is mid-landing and correct.
   Coordinate through ptone.
3. `farmtable-ci-manifest` has no running owner. Its single commit
   (`ci(manifest): state what MIN_TEST_FILES detects, and what it does not`, 15:04:24Z)
   is genuinely orphaned — nobody will push it. Recover it.
4. Decide the disposition of `dev-scopedeny-93`'s 14 commits, whose agent has completed.
5. Consider whether agent clones should have `origin` pointing at the canonical repo
   rather than at each other. That is a standing process defect, not a one-off.

## 5. What I did not do

I did not push, fetch into, merge, rebase, or write to any repository. Every figure above
is read-only measurement. I did not enumerate credentials; the one remote URL was
inspected and redacted in a single command, consistent with the standing instruction not
to print credentials or list remotes bare.

I have **not** verified that the 43 commits build or pass CI. I verified only that they
exist in one place.
