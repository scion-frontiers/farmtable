## Problem

When a Scion project's repo is checked out one level below `/workspace` (i.e. `/workspace/<repo>`), the current worktree-per-agent mode places per-agent worktrees **inside** the project directory (at `<projectDir>/workspace/worktrees/<agentName>`). This nesting means the worktrees live within the project's own directory tree, where they risk being swept up by the project's build globs, linting rules, gitignore patterns, or other tooling that recursively walks the project root.

An experiment on the [farmtable](https://github.com/scion-frontiers/farmtable) repo found that **adjacent (sibling) worktrees** — placed alongside the project directory (e.g. `/workspace/farmtable-wt-<agent>/`) — work cleanly and avoid this friction entirely.

## Evidence from experiment

A hands-on experiment was conducted against `scion-frontiers/farmtable` (checked out at `/workspace/farmtable`). A worktree was created as a sibling at `/workspace/farmtable-worktree-experiment/wt1`. Key findings:

- **No absolute-path issues.** `grep` across `.go`, `.ts`, `.json`, `.yaml`, and `Makefile` found zero hardcoded absolute paths. The codebase uses only relative paths, so the worktree location does not matter.
- **Shared Go module cache.** `~/go/pkg/mod` is global. Second worktrees incur zero additional Go dependency downloads.
- **Cheap per-worktree npm setup.** `node_modules` is ~91 MB per worktree, but with a warm npm cache `npm install` takes only a few seconds. This is the only meaningful per-worktree cost.
- **Port configurability.** Both the Go server (`--port` flag / `FARMTABLE_PORT` env var) and Vite dev server (`--port` flag, plus auto-increment on conflict) support concurrent instances on different ports.
- **Branch exclusivity as safety net.** Git's built-in constraint that prevents two worktrees from checking out the same branch acts as a natural collision guard for parallel agents.
- **Clean lifecycle.** `git worktree remove` + `git branch -D` leaves zero residual state. Total disk cost per worktree: ~114 MB (3.7 MB source + 91 MB node_modules + ~19 MB build artifacts).
- **Full independence.** Commits in the worktree are invisible to the main checkout. `git status` in each tree is fully isolated.

**Caveat:** This is based on a single experiment against one repo (farmtable). Other projects may have different path assumptions, but the pattern is likely generalizable to any repo without hardcoded absolute paths.

## Current behavior

Scion's worktree-per-agent mode (implemented in `pkg/agent/provision.go`) places worktrees at:

```
<projectDir>/workspace/worktrees/<agentName>
```

This works well when the project has a deep path or when the `.scion/` directory and worktrees directory are gitignored. But when the project is at `/workspace/<repo>` (common in containerized setups), the worktrees end up nested inside the repo's own tree.

## Proposed behavior

When a project's repo lives one level below `/workspace` (or more generally, when placing worktrees as siblings is feasible), Scion should support creating worktrees **adjacent** to the project directory:

```
/workspace/<repo>/                    # main checkout
/workspace/<repo>-wt-<agent-name>/    # agent worktree (sibling, not nested)
```

### Concrete ask

1. **Sibling worktree placement convention.** Add a worktree placement strategy that creates worktrees as siblings of the project directory rather than nested inside it. This could be a project-level setting (e.g. in `.scion/settings.yaml`) or auto-detected based on the repo's depth below `/workspace`.

2. **CLI convenience.** Ideally `scion start <name> --worktree` (or similar) would handle `git worktree add` at the sibling path automatically as part of agent startup, so project coordinators don't have to hand-roll worktree creation in ad hoc briefs.

3. **Cleanup integration.** `scion delete <name>` should handle `git worktree remove` and branch cleanup for sibling worktrees the same way it does for nested ones.

## Relationship to existing issues

- **#158** (worktree-per-agent for hub-managed workspaces) covers bringing the worktree model to hub-managed projects. This issue is complementary — it's about *where* the worktrees are placed, not *whether* they're created.
- **#523** (in-place workspace-mode conversion) covers switching between workspace modes. Sibling placement would be a property of the worktree-per-agent mode itself.
- **#168** (shared worktree teardown) covers refcounting and cleanup. Sibling worktrees would need the same lifecycle management.

## Motivation

Without this, project coordinators who want parallel developer agents on a repo at `/workspace/<repo>` must either:
- Accept nested worktrees and manually add the worktree directory to every relevant ignore/exclude pattern, or
- Hand-roll sibling worktree creation and cleanup in coordinator briefs, duplicating boilerplate across every project that uses this pattern.

Both are workable but add friction that Scion could eliminate with a first-class sibling placement option.
