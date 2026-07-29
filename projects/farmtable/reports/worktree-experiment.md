# Git Worktree Parallelization Experiment — Farmtable

**Date:** 2026-07-19
**Repo:** `scion-frontiers/farmtable` at `/workspace/farmtable`
**Status:** Complete — worktrees cleaned up, no artifacts left.

---

## Summary

**Recommendation: Yes — git worktrees are a good fit for running parallel developer agents on this repo.** The experiment was fully successful. A worktree created adjacent to the main checkout built, tested, and committed independently with no interference to the primary working tree. The only meaningful setup cost is ~91 MB for `node_modules` per worktree (one-time `npm install` + `npm run build` taking ~15 seconds total). Go module cache is global and shared, so Go deps cost nothing extra. There are no hardcoded absolute paths anywhere in the codebase.

---

## What I Tried

### 1. Worktree creation

```bash
mkdir -p /workspace/farmtable-worktree-experiment
git worktree add /workspace/farmtable-worktree-experiment/wt1 \
  -b experiment/worktree-test origin/main
```

- **Result:** Instant success. New worktree at 3.7 MB (source files only, no build artifacts).
- Main checkout remained on `feat/collection-settings-modal` with its dirty working tree — completely unaffected.

### 2. Independence verification

| Test | Result |
|------|--------|
| Worktree on its own branch (`experiment/worktree-test`) | OK |
| `git status` in worktree shows clean tree | OK |
| Trivial commit in worktree | OK — commit `a6c4219` created |
| Commit visible in main checkout? | No — fully isolated |
| Attempting to checkout same branch as main checkout | Correctly blocked: `fatal: 'feat/collection-settings-modal' is already used by worktree at '/workspace/farmtable'` |

The branch-exclusivity constraint is a **safety feature** for parallel agents: it prevents two agents from accidentally working on the same branch.

### 3. Build tooling — Go

```bash
cd /workspace/farmtable-worktree-experiment/wt1
go build ./...   # Fails until web/dist exists
go test ./...    # All packages pass
go build -o /tmp/ft-worktree-test ./cmd/ft   # OK
```

- **Go module cache** is at `~/go/pkg/mod` (global) — shared across all worktrees. Second worktree only downloads if a different `go.mod` introduces new deps.
- **First build** needed `web/dist` (see below) but otherwise worked identically to the main checkout.
- **All unit tests passed** on first try.

### 4. Build tooling — Web (npm/Vite)

```bash
cd web && npm install    # ~91 MB, takes a few seconds
npx vite build           # 3.2 seconds, produces web/dist/
```

- `web/dist` is gitignored, so it doesn't exist in a fresh worktree. **Each worktree must run `npm install` + `npm run build` before `go build` will succeed** (because `assets.go` uses `//go:embed all:web/dist`).
- `node_modules` **cannot be shared** between worktrees — npm hardlinks from its cache, so the actual disk cost is lower than 91 MB if the cache is warm, but each worktree gets its own `node_modules/` directory.

### 5. Absolute path check

```bash
grep -rn '/workspace/farmtable' --include='*.go' --include='*.ts' \
  --include='*.json' --include='*.yaml' --include='Makefile'
```

**Zero results.** The codebase uses only relative paths. The `Makefile` targets (`web`, `web-dev`, `build`, `test`) all use relative `cd` commands. No worktree-breaking path assumptions found.

### 6. Port conflict analysis

| Component | Default Port | Configurable? |
|-----------|-------------|---------------|
| `ft dashboard` | 8080 | `--port` flag |
| `farmtable-server` | 8080 | `PORT` or `FARMTABLE_PORT` env var |
| Vite dev server | 5173 | Vite auto-increments on conflict; also `--port` flag |

Two worktrees **can** run dev servers concurrently as long as each uses a different port. Both the Go server and Vite expose port configuration.

### 7. Cleanup

```bash
git worktree remove /workspace/farmtable-worktree-experiment/wt1 --force
git branch -D experiment/worktree-test
rmdir /workspace/farmtable-worktree-experiment
```

Clean, instant, no residual state.

---

## Gotchas

1. **`web/dist` must be built per worktree.** The `//go:embed all:web/dist` directive in `assets.go` means `go build ./...` fails until the web frontend is built. A worktree setup script should always run `cd web && npm ci && npm run build` first.

2. **`node_modules` is ~91 MB per worktree.** No way to share it via symlink (npm doesn't support that reliably). With npm cache warm, `npm install` takes only a few seconds.

3. **Branch exclusivity.** Git prevents two worktrees from having the same branch checked out. This is actually desirable for parallel agents (prevents conflicts), but the coordinator must ensure each agent is briefed with a **unique feature branch name**.

4. **`FARMTABLE_DB_PATH` and `ft` binary path.** The `CLAUDE.md` instructions point agents to `/workspace/.farmtable/bin/ft` and `/workspace/.farmtable/farmtable.db`. These are **outside** the repo, so they're shared across worktrees. This is fine for the `ft` CLI (read-only tool usage), but if two agents try to rebuild the dog-food binary simultaneously to the same output path, they'd race. Each worktree agent should build to its own output path (e.g., `go build -o ./bin/ft ./cmd/ft` using a repo-relative path).

5. **Port conflicts for dev servers.** If agents need to run `ft dashboard` or `make web-dev` concurrently, they must use different ports. The coordinator should assign unique ports per worktree.

6. **Total disk cost per worktree:** ~114 MB (3.7 MB source + 91 MB node_modules + ~19 MB build artifacts). Trivial on modern systems.

---

## Recommended Changes for the EM/Developer Brief Pattern

To use worktrees for parallel developer agents, the coordinator should:

1. **Create the worktree before launching the agent:**
   ```bash
   git worktree add /workspace/farmtable-wt-<feature> \
     -b feat/<feature-name> origin/main
   ```

2. **Brief each developer agent with its own worktree path** instead of the shared `/workspace/farmtable`. Example brief snippet:
   ```
   Working directory: /workspace/farmtable-wt-feature-22
   Branch: feat/feature-22
   ```

3. **Include a setup preamble** in the developer brief (or farmtable-dev skill):
   ```bash
   cd /workspace/farmtable-wt-<feature>/web && npm ci && npm run build
   ```

4. **Assign unique ports** if agents need to run dev servers:
   ```
   Dev server port: 8081  (use --port 8081 for ft dashboard)
   ```

5. **Build the `ft` binary to a worktree-local path:**
   ```bash
   go build -o ./bin/ft ./cmd/ft   # NOT /workspace/.farmtable/bin/ft
   ```

6. **Clean up worktrees** after the feature merges:
   ```bash
   git worktree remove /workspace/farmtable-wt-<feature>
   git branch -d feat/<feature-name>
   ```

---

## Verdict

**Yes — use worktrees.** For the farmtable repo specifically:
- The codebase has zero absolute-path dependencies.
- Go module cache is shared (no duplicate downloads).
- The only per-worktree cost is npm install (~91 MB, ~5 seconds with warm cache).
- Port conflicts are easily avoided via existing flags/env vars.
- Branch exclusivity is a built-in safety net against agents colliding.
- Cleanup is instant and leaves no residual state.

This is materially better than full clones (which would duplicate the entire `.git` directory and all Go module downloads) and is the standard Git mechanism for exactly this use case.
