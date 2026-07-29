# Brief: Engineering Manager — Decomposer Extras App

## Critical Constraints (read first)

- **This is a NEW binary in an EXISTING repo.** You're adding `cmd/decomposer/` and
  `internal/decomposer/` to `/workspace/farmtable`. Do NOT modify existing code in
  `cmd/ft/`, `cmd/farmtable-server/`, `internal/cli/`, `internal/server/`, etc. The only
  shared dependency is the generated gRPC client at `api/farmtable/v1/` — import it
  read-only.
- **Do NOT touch `go.mod` beyond adding the LLM client dependencies** the decomposer
  needs (`google.golang.org/genai` for Phase 1; Anthropic SDK for Phase 3). No version
  bumps on existing dependencies.
- **The decomposition prompt is a PLACEHOLDER.** The file at
  `/scion-volumes/scratchpad/projects/farmtable/decomposer-system-prompt.md` is a
  working-but-generic prompt for development and testing. The user (ptone@google.com) will
  provide a production prompt as a fast-follow. The binary MUST load the prompt from a
  file (`--prompt-file` flag) or an embedded default — so swapping the prompt requires no
  code change. **Flag this clearly in your PR description.**
- **Only one agent runs at a time** (dev OR reviewer, never simultaneously).
- **You do NOT merge anything.** Push the branch, open a PR via `gh pr create`, message
  the coordinator. The coordinator merges.
- **Reviewers must be blind** — fresh `code-reviewer` agent per round, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer agent:** `scion start decomposer-dev --type developer <task>` (no `--harness`
  flag — inherit project default). Reviewer: `scion start decomposer-review-rN --type
  code-reviewer --harness claude <task>`.
- **Keep the developer agent alive** across all fix iterations and phases — this is one
  continuous implementation, not separate tasks.
- **Verification is a REAL terminal transcript** of the decomposer binary running against
  the LIVE Farmtable service and producing a task DAG. Not a summary claim — full
  stdout/stderr captured verbatim. This is the equivalent of screenshots for UI work.
- **Do NOT touch or delete existing collections** on the live service (there are several
  from prior work). The decomposer must create its OWN test collection(s) — use clearly
  disposable names like `decomposer-test-<timestamp>`.
- **Live service connection:** `export FARMTABLE_SERVER=farmtable-qo7k5fvpda-uc.a.run.app:443`,
  `TOKEN=$(gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test)`.
- **LLM auth for testing:** The initial provider is Google GenAI (Vertex AI) using
  Application Default Credentials (ADC). The developer must have `gcloud auth
  application-default login` configured, and a Google Cloud project with the Vertex AI API
  enabled. Set `GOOGLE_CLOUD_PROJECT` (or use `--project` flag). No explicit API key is
  needed — ADC handles authentication automatically. If ADC is not configured, the binary
  must still compile and tests must pass (mock the LLM shim in tests) — note the missing
  credentials as a blocker for the live-run verification only, and message the coordinator.

## Context

You're implementing the design at
`/scion-volumes/scratchpad/projects/farmtable/design-decomposer-extras.md` — a standalone
Go binary that takes a design document (or high-level outcome statement) and recursively
decomposes it into a Farmtable task DAG using LLM inference.

**Read the design doc in full before starting.** It contains pseudocode, the JSON output
schema, the concurrency model, and critical architectural decisions (especially the
semaphore placement — there's a documented deadlock pitfall). The design was iterated
with ptone@google.com over multiple rounds; don't deviate from it without good reason.

The binary replaces an agent-based decomposer prompt at
`/scion-volumes/scratchpad/decomposer.md` (read it for context on the mental model — the
Go binary inherits its group-encoding concept but moves recursion into deterministic code).

## Feature Spec (3 Phases, 1 PR)

Deliver this as a SINGLE PR covering all three phases — they're one coherent feature, not
separately deployable increments. But implement in phase order and verify each phase
works before building on it.

### Phase 1: Single-Level Decomposition (MVP)

Build the skeleton that does one level of decomposition end-to-end:

| File | Responsibility |
|------|---------------|
| `cmd/decomposer/main.go` | CLI entry point. Cobra or plain `flag` (match the repo's convention — `ft` uses Cobra). Parse flags, wire components, run. |
| `internal/decomposer/engine.go` | The `Engine` struct and `decompose()` method. Phase 1: one LLM call, no recursion. |
| `internal/decomposer/llm.go` | `Inferencer` interface: `Complete(ctx context.Context, messages []Message) (string, error)`. One concrete implementation: Google GenAI (Vertex AI) using ADC (`google.golang.org/genai` SDK). |
| `internal/decomposer/prompt.go` | Builds the `[]Message` for the LLM: system prompt (from file/embedded) + context chain + current task. |
| `internal/decomposer/parser.go` | Extracts JSON from LLM response (find first `{` to last `}`), unmarshals into `DecompositionResult`, validates (groups ascending, slugs unique, descriptions non-empty). |
| `internal/decomposer/writer.go` | Farmtable gRPC wrapper: `CreateTask` (sets collection_id, parent_task_id, blocked_by_task_ids), `CreateCollection` (auto-create if name doesn't exist). Auth via token flag / `FARMTABLE_TOKEN` env / config file — follow `ft`'s pattern in `internal/cli/connect.go`. |

**Phase 1 acceptance:** `decomposer --collection "test" design.md` → creates 6-12 tasks on
Farmtable with correct parent (root task) and BLOCKED_BY relationships between groups.
One level only — non-terminal tasks are created but NOT recursed into.

### Phase 2: Recursive Decomposition + Concurrency

Add the recursion loop, context chain propagation, and concurrent fan-out:

- `decompose()` calls itself recursively for non-terminal tasks.
- Context chain (`[]string`) grows at each level — parent chain included in LLM prompt.
- `--max-depth` flag (default 3) enforces a hard recursion cap.
- Concurrency: `sync.WaitGroup` per decompose level, shared semaphore (buffered channel)
  for LLM calls globally. **CRITICAL: acquire the semaphore around the LLM `Complete()`
  call ONLY, release immediately after — NOT around the entire recursive `decompose()`
  call. Wrapping the full recursion will deadlock.** See the design doc's semaphore section.
- All non-terminal subtasks within a parent are recursed concurrently (no group barriers
  during decomposition — group ordering is an execution constraint only).
- LLM returns `{"terminal": true}` → task is a leaf, stop recursing.
- `depth >= maxDepth` → force-terminal all tasks, no LLM call.

**Phase 2 acceptance:** Multi-level task tree created on Farmtable. Verify with
`ft task list -c <collection>`, `ft dependency-tree -c <collection>`,
`ft task ready -c <collection>`, `ft task blocked -c <collection>`.

### Phase 3: Second LLM Provider + Error Handling + Polish

- Add a second `Inferencer` implementation: Anthropic Claude (using `--api-key` /
  `ANTHROPIC_API_KEY`). Selected via `--provider anthropic` flag.
- Retry with exponential backoff for transient LLM errors (429, 500, timeout).
- Corrective retry on unparseable JSON: re-prompt with "Your response was not valid JSON."
  If still unparseable, force-terminal.
- `--verbose` flag: log LLM prompts/responses to stderr.
- Graceful Ctrl-C: context cancellation, finish in-flight LLM calls, don't start new ones.
- Stdout summary on completion: collection ID, root task ID, task counts, dashboard URL.
- Collection auto-creation: if `--collection` is a name that doesn't exist, create it.

**Phase 3 acceptance:** Works with both LLM providers — GenAI (ADC) and Anthropic
(API key) — or gracefully errors if credentials are missing. Handles errors without
panicking. `--verbose` shows prompts/responses. Ctrl-C produces a valid partial tree.

## CLI Interface (Exact Flags)

```
decomposer [flags] <input-file-or-"-">

Required:
  --collection      Collection ID or name (auto-creates if name not found)

Farmtable connection:
  --server          Farmtable server address (or FARMTABLE_SERVER env)
  --token           Auth token (or FARMTABLE_TOKEN env)

LLM:
  --provider        "genai" or "anthropic" (default: "genai")
  --model           Model name (default: provider-specific, e.g. "gemini-2.5-pro")
  --project         Google Cloud project (or GOOGLE_CLOUD_PROJECT env; required for genai)
  --location        Google Cloud location (or GOOGLE_CLOUD_LOCATION env; default: "us-central1")
  --api-key         LLM API key (for non-ADC providers, e.g. ANTHROPIC_API_KEY env)
  --prompt-file     Path to custom system prompt file (overrides embedded default)

Engine:
  --max-depth       Maximum recursion depth (default: 3)
  --concurrency     Max parallel LLM calls (default: 4)
  --verbose         Log LLM prompts/responses to stderr
```

## Key JSON Types (parser.go)

```go
type DecompositionResult struct {
    Terminal *bool   `json:"terminal,omitempty"` // if true, task is a leaf
    Groups   []Group `json:"groups,omitempty"`
}

type Group struct {
    GroupNum int       `json:"group"`
    Tasks    []Subtask `json:"tasks"`
}

type Subtask struct {
    Slug        string `json:"slug"`
    Title       string `json:"title"`
    Description string `json:"description"`
    Terminal    bool   `json:"terminal"`
}
```

Note: when the LLM judges the CURRENT task as terminal (not decomposable), it returns
`{"terminal": true}` — this is the `DecompositionResult.Terminal` field. When the LLM
decomposes, it returns the `groups` array with individual subtask-level terminal judgments.

## Key Locations

- **Design doc (READ FIRST):**
  `/scion-volumes/scratchpad/projects/farmtable/design-decomposer-extras.md`
- **Placeholder system prompt:**
  `/scion-volumes/scratchpad/projects/farmtable/decomposer-system-prompt.md`
  (copy into `internal/decomposer/` as embedded default; also loadable via `--prompt-file`)
- **Agent-based decomposer (mental model reference):**
  `/scion-volumes/scratchpad/decomposer.md`
- **Repo:** `/workspace/farmtable`, base off current `main`. Use a feature branch
  `feat/decomposer-extras`.
- **Generated gRPC client (import, don't modify):**
  `/workspace/farmtable/api/farmtable/v1/` — package `farmtablev1`
- **ft CLI connection pattern (follow this for auth):**
  `/workspace/farmtable/internal/cli/connect.go`
- **Existing Cobra setup (follow for CLI conventions):**
  `/workspace/farmtable/internal/cli/root.go`, `/workspace/farmtable/cmd/ft/main.go`
- **Makefile:** add a `decomposer` target, don't change existing targets.
- **go.mod:** `/workspace/farmtable/go.mod` — add LLM SDK dependencies only.

## Deliverables

1. A pushed feature branch (`feat/decomposer-extras`) + open PR against `main`, confirmed
   CLEAN/MERGEABLE, containing:
   - `cmd/decomposer/main.go`
   - `internal/decomposer/` package (engine, llm, prompt, parser, writer)
   - Updated `Makefile` with `decomposer` target
   - Updated `go.mod` / `go.sum` with LLM SDK dependencies
   - Unit tests for the parser (JSON extraction + validation edge cases) and engine
     (mock LLM + mock writer — verify correct task creation order, parent IDs, blocked_by
     wiring, recursion depth enforcement)
2. A REAL terminal transcript of the decomposer running against the LIVE Farmtable service
   with the placeholder prompt, showing a multi-level task DAG being created. Saved at
   `/scion-volumes/scratchpad/projects/farmtable/reports/decomposer-live-run-transcript.txt`.
   Followed by `ft` CLI commands verifying the resulting DAG structure (task list,
   dependency-tree, ready tasks, blocked tasks).
3. A feature log at
   `/scion-volumes/scratchpad/projects/farmtable/reports/decomposer-implementation-log.md`
   covering: what was built, how each phase was verified, any deviations from the design
   (with justification), the LLM provider(s) tested, and any issues encountered.
4. A message to the coordinator with PR URL, summary, live-run verdict, and the test
   collection ID(s) created on the live service.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for PR-ready, progress updates,
  blockers, API key issues.
- Do not message ptone@google.com directly.

## Termination

You MUST complete all three phases in a single PR, produce the live-run transcript and
feature log, and message the coordinator with the summary. Then signal task_completed.
Keep the developer agent alive until the coordinator confirms the merge.

## Fast-Follow Note (for PR description)

Include in the PR description:
> **Prompt is placeholder.** The decomposition system prompt at
> `internal/decomposer/prompt_default.go` (or wherever embedded) is a generic placeholder.
> A production prompt from the project owner is incoming — swapping it requires only
> replacing the file content or using `--prompt-file`. No code change needed.
