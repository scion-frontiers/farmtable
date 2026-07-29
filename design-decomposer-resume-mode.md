# Design: Decomposer Resume Mode

**Status:** Proposed  
**Date:** 2026-07-23  
**Context:** The flash-lite decomposer run (v3) was killed at 6,974 tasks before finishing all branches. The tool needs a resume mode to pick up where it left off.

## Problem & Goals

The decomposer currently only works in "fresh start" mode — it creates a new root task and decomposes from scratch. If the process is killed mid-run (timeout, crash, interrupt), partially decomposed trees are left with unfinished branches: leaf tasks that were never assessed for terminality.

**Goals:**
1. Resume decomposition on an existing task tree, finishing only the unfinished branches.
2. Mark terminal tasks with a label so resume can distinguish "terminal leaf" from "unprocessed leaf."
3. Short-term: re-assess all unlabeled leaves (idempotent, costs extra LLM calls on genuinely terminal tasks that weren't labeled).
4. Long-term: the label makes resume lightweight — skip labeled terminals, only process unlabeled leaves.

## Non-Goals

- Re-decomposing tasks that were already decomposed (have children).
- Modifying existing task content or structure.
- Deleting or reorganizing the existing tree.

## Proposed Design

### 1. Terminal Label (`decomposer:terminal`)

When the LLM judges a task as terminal (returns `{"terminal": true}`), the engine adds the label `decomposer:terminal` to that task via `UpdateTask`.

**Where this happens:**
- In `engine.go`, the terminal self-assessment block (line ~154) — after `e.terminalTasks.Add(1)`, call `e.writer.UpdateTaskLabels(ctx, parentTaskID, []string{"decomposer:terminal"})`.
- This applies to both fresh runs and resume runs.

**Writer interface addition:**

```go
// Add to TaskWriter interface
UpdateTaskLabels(ctx context.Context, taskID string, addLabels []string) error
```

```go
// GRPCWriter implementation
func (w *GRPCWriter) UpdateTaskLabels(ctx context.Context, taskID string, addLabels []string) error {
    ctx = w.authCtx(ctx)
    _, err := w.client.UpdateTask(ctx, &pb.UpdateTaskRequest{
        Id:        taskID,
        AddLabels: addLabels,
    })
    return err
}
```

### 2. Resume Entry Point

New method on Engine: `Resume(ctx, collectionID, rootTaskID)`.

**Algorithm:**

```
Resume(ctx, collectionID, rootTaskID):
  1. Fetch the root task from Farmtable.
  2. Walk the tree recursively via walkAndResume().

walkAndResume(ctx, taskID, depth):
  1. List children of taskID (ListTasks with ParentTaskId filter).
  2. If task has children:
     - It was already decomposed. Recurse into each child.
  3. If task has NO children:
     - Check labels. If "decomposer:terminal" is present → skip (already judged).
     - Otherwise → this is an unfinished leaf. Run decompose() on it.
       (decompose() is the existing recursive function — it will assess,
        decompose if needed, and recurse into new subtasks.)
  4. Respect maxDepth — if depth >= maxDepth, skip (same as fresh mode).
```

**Pseudocode:**

```go
func (e *Engine) Resume(ctx context.Context, collectionID, rootTaskID string) error {
    return e.walkAndResume(ctx, rootTaskID, 0)
}

func (e *Engine) walkAndResume(ctx context.Context, taskID string, depth int) error {
    children, err := e.writer.ListChildren(ctx, taskID)
    if err != nil {
        return err
    }

    if len(children) == 0 {
        // Leaf task — check if already terminal
        task, err := e.writer.GetTask(ctx, taskID)
        if err != nil {
            return err
        }
        if hasLabel(task.Labels, "decomposer:terminal") {
            e.terminalTasks.Add(1)
            return nil // Already judged terminal
        }
        // Unfinished leaf — decompose it
        return e.decompose(ctx, task.Description, nil, taskID, depth)
    }

    // Internal node — recurse into children
    var wg sync.WaitGroup
    var firstErr error
    var errOnce sync.Once
    for _, child := range children {
        wg.Add(1)
        go func(childID string) {
            defer wg.Done()
            if err := e.walkAndResume(ctx, childID, depth+1); err != nil {
                errOnce.Do(func() { firstErr = err })
            }
        }(child.ID)
    }
    wg.Wait()
    return firstErr
}
```

### 3. Writer Interface Additions

```go
type TaskWriter interface {
    // Existing
    CreateTask(ctx, name, description, parentTaskID string, blockedByIDs []string) (string, error)
    ResolveCollection(ctx, collectionFlag string) (string, error)
    CreateCollection(ctx, name string) (string, error)

    // New for resume mode
    GetTask(ctx context.Context, taskID string) (*TaskInfo, error)
    ListChildren(ctx context.Context, parentTaskID string) ([]TaskInfo, error)
    UpdateTaskLabels(ctx context.Context, taskID string, addLabels []string) error
}

type TaskInfo struct {
    ID          string
    Name        string
    Description string
    Labels      []string
}
```

### 4. CLI Changes

Add a `--resume` flag or subcommand:

```
# Fresh decomposition (existing behavior)
echo "Build an ecommerce..." | decomposer --collection "My Project" -

# Resume an incomplete decomposition
decomposer --resume --collection "Vintage Action Figures Ecommerce v3 - flash-lite" \
  --root-task 6a553a68-1463-4f08-acf8-a29fd4f753da
```

Flags:
- `--resume`: Switch to resume mode. Walks existing tree instead of creating new root.
- `--root-task`: Task ID to resume from (required in resume mode). Could be the original root or any subtree root.

When `--resume` is set, the `--collection` flag resolves the collection (must exist), and `--root-task` specifies where to start walking.

### 5. Context Chain in Resume Mode

**Limitation:** When resuming, the context chain (parent task descriptions accumulated during recursion) is not available — the original run built it in-memory. 

**Short-term:** Pass an empty context chain for resumed leaves. The LLM still gets the task's own description, which should be sufficient for terminal assessment and decomposition.

**Future enhancement:** Reconstruct the context chain by walking up the parent chain from the leaf to the root, collecting descriptions. This requires `GetTask` calls up the tree but is O(depth) per leaf and could be cached.

## Alternatives Considered

### A. Re-run from scratch, deduplicate against existing tasks

Create a fresh decomposition and diff against the existing tree, only creating tasks that don't already exist. Rejected: complex matching logic (slug? title? fuzzy?), LLM non-determinism means re-runs produce different decompositions, and you'd lose the existing task IDs/relationships.

### B. Checkpoint file

Write decomposition state to a local file, resume from checkpoint. Rejected: couples resume to a specific machine/filesystem, doesn't work across agent sessions, and the real state of truth is in Farmtable anyway.

### C. Re-assess all leaves without labels (user's short-term suggestion)

For immediate use: skip the label implementation, just re-assess every childless task. Works correctly (idempotent), costs extra LLM calls on tasks that were already terminal. This is viable as a stepping stone — implement resume walking + re-assessment first, add labels as an optimization.

**Recommendation:** Implement labels from the start — it's minimal additional code (one `UpdateTask` call) and makes resume dramatically cheaper. But the walk-and-assess logic works identically with or without labels, so if we want to ship faster, we can do option C first and add labels in a follow-up.

## Migration / Rollout

1. No breaking changes. Fresh mode still works identically.
2. Label addition is backward compatible — tasks that don't have `decomposer:terminal` are treated as unprocessed (safe default).
3. Existing completed runs (v2) won't have labels, so resuming against them would re-assess all leaves. Correct but costs LLM calls.

## Implementation Phases

1. **Phase 1:** Add `UpdateTaskLabels`, `GetTask`, `ListChildren` to writer. Add label on terminal judgment in engine.
2. **Phase 2:** Implement `walkAndResume()` in engine. Add `--resume` and `--root-task` CLI flags.
3. **Phase 3:** Test by resuming the flash-lite v3 collection. Verify it finishes the unprocessed branches.

## Open Questions

1. **Context chain reconstruction:** Should resume mode reconstruct the parent chain for better LLM context, or is the task description alone sufficient? (Recommend: start without it, add if decomposition quality suffers.)
2. **Stats reporting:** Should resume stats show only newly processed tasks, or cumulative including pre-existing? (Recommend: show both — "Existing: N, New: M, Total: N+M".)
3. **Concurrency during walk:** The walk phase (listing children, checking labels) is lightweight. Should we bound it with the same semaphore as LLM calls, or let it run unbounded? (Recommend: unbounded walk, semaphore only on LLM calls, same as current design.)

## Acceptance Criteria

- [ ] Fresh decomposition adds `decomposer:terminal` label to terminal tasks.
- [ ] `--resume --root-task <id>` walks existing tree and decomposes only unlabeled leaves.
- [ ] Already-labeled terminal tasks are skipped (no LLM call).
- [ ] Internal nodes (have children) are traversed, not re-decomposed.
- [ ] Max-depth is respected during resume.
- [ ] Flash-lite v3 collection can be resumed to completion.
- [ ] Existing tests still pass; resume mode has its own test.
