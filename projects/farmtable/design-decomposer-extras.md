# Design: Decomposer Extras App

**Status:** FINAL DRAFT — pending user's decomposition prompt for parser alignment  
**Date:** 2026-07-21  
**Author:** Architect agent  
**Source prompt:** `/scion-volumes/scratchpad/decomposer.md` (agent-based version this replaces)

---

## Problem & Goals

Farmtable supports rich task DAGs (parent/child hierarchy + BLOCKS/BLOCKED_BY relationships), but creating them today requires either an agent manually reading a design doc and issuing dozens of `ft` CLI calls, or a human doing the same. An existing agent-based decomposer (see `decomposer.md`) solves this by recursively spawning scion agents — each agent decomposes one task, spawns child agents for subtasks, and coordinates via inter-agent messaging. This works but has drawbacks: agent provisioning overhead, orchestration fragility (timeouts, stall detection, notification races), and opaque progress tracking.

**Goal:** Replace the agent-based recursion with a standalone Go binary that keeps the LLM's reasoning (decompose/terminal judgment, grouping, sequencing) but moves recursion, concurrency, and Farmtable task creation into deterministic Go code.

### Success Criteria

1. Takes a design document or high-level outcome statement as input, produces a well-structured Farmtable task DAG — comparable quality to the agent-based decomposer.
2. Recursive decomposition: each level produces 6–12 subtasks grouped into **parallel groups** (tasks within a group are unordered; groups are sequenced). Non-terminal subtasks are recursed further.
3. Tasks created directly on a Farmtable server via gRPC as the recursion proceeds — Farmtable is the source of truth, not an intermediate file.
4. Pluggable LLM backend via a thin inference shim interface.
5. Configurable max recursion depth.

---

## Non-Goals

- **Not an agent framework.** This replaces agent orchestration with deterministic code. It does not spawn or manage agents.
- **Not a task executor.** It decomposes and creates tasks; it does not implement them.
- **Not a cross-branch dependency resolver.** Dependencies are inferred among siblings only. Cross-branch edges are out of scope.
- **Not a review/approval workflow.** This is machinery — it runs, creates tasks, and exits. Human review happens afterward on the Farmtable board.

---

## Proposed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      decomposer CLI                         │
│                                                             │
│  ┌─────────┐   ┌────────────────────┐   ┌────────────────┐ │
│  │  Input   │   │  Decompose Engine  │   │   Farmtable    │ │
│  │  Reader  │──▶│  (recursive loop)  │──▶│   Writer       │ │
│  │          │   │                    │   │   (gRPC)       │ │
│  └─────────┘   │  ┌──────────────┐  │   └────────────────┘ │
│                 │  │  LLM Shim    │  │                      │
│                 │  │  (pluggable) │  │                      │
│                 │  └──────────────┘  │                      │
│                 └────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

Three clean boundaries:
1. **Input Reader** — reads a file or stdin, produces the initial task text.
2. **Decompose Engine** — recursive loop: calls LLM → parses output → creates tasks on FT → recurses.
3. **LLM Shim** — pluggable inference interface; the engine doesn't know which model or provider.

### Binary & Package Location

```
cmd/decomposer/main.go              # Entry point (flag parsing, wiring)
internal/decomposer/engine.go       # Recursive decomposition loop
internal/decomposer/llm.go          # LLM shim interface + implementations
internal/decomposer/prompt.go       # Prompt construction (system + context chain + schema)
internal/decomposer/parser.go       # JSON extraction + unmarshaling + validation
internal/decomposer/writer.go       # Farmtable gRPC task creation + relationship wiring
```

Builds with: `go build -o bin/decomposer ./cmd/decomposer`  
Compiles against `github.com/farmtable-io/farmtable/api/farmtable/v1` (same client code as `ft`).

---

### The Group Encoding Model

This is the core concept inherited from the agent-based decomposer. The LLM outputs subtasks tagged with a **parallel group number** (NN). The semantics:

- **Same group number** → tasks can be done in any order (parallel / unordered)
- **Higher group number** → depends on all tasks in the previous group completing first

```
Group 00: research-requirements, audit-existing-code      ← parallel, no deps
Group 01: design-api-schema, define-data-model             ← blocked by ALL of group 00
Group 02: implement-backend                                ← blocked by ALL of group 01
```

**Mapping to Farmtable relationships:**
- Tasks in group N get `BLOCKED_BY` edges pointing to every task in group N-1.
- Tasks in the same group have no edges between them.
- Transitive closure is implicit (group 02 is transitively blocked by group 00 through group 01).
- All tasks at a given decomposition level share the same `parent_task_id` (their parent from the level above).

This is simpler than arbitrary DAG edges between siblings, and it's what the existing prompt produces. It's also what the Farmtable board can display clearly.

---

### Core Loop: Recursive Decomposition

**Key insight (from discussion):** Group ordering is an *execution* constraint, not a
*decomposition* constraint. Each task is decomposed based on its ancestry chain alone — it
doesn't need to see what sibling branches were decomposed into. This means all non-terminal
subtasks can be recursed concurrently, with no barriers between groups. The group numbers
only affect the BLOCKED_BY edges written to Farmtable.

```
func (e *Engine) decompose(ctx, taskText, contextChain, parentTaskID, depth) error:
    if depth >= e.maxDepth:
        // Force terminal — don't call LLM, just stop
        return nil

    // 1. Acquire semaphore — bounds concurrent LLM calls globally
    e.sem <- struct{}{}

    // 2. Build prompt: system prompt + context chain + current task
    prompt := e.buildPrompt(contextChain, taskText, depth)

    // 3. Call LLM
    response, err := e.llm.Complete(ctx, prompt)

    // 4. Release semaphore IMMEDIATELY after LLM call returns
    //    (not after recursion — that would deadlock)
    <-e.sem

    // 5. Parse response into subtask groups
    groups := e.parser.Parse(response)
    //   groups is []Group, each Group has: groupNum int, subtasks []Subtask
    //   each Subtask has: slug, title, description, terminal bool

    // 6. Create ALL subtasks on Farmtable, wire BLOCKED_BY between groups
    //    Groups are iterated in order so we can accumulate previous-group IDs
    var allCreated []createdTask  // (subtask, farmtable task ID) pairs
    var prevGroupTaskIDs []string

    for _, group := range groups:
        var currentGroupTaskIDs []string
        for _, st := range group.Subtasks:
            task := e.writer.CreateTask(ctx, &pb.CreateTaskRequest{
                Name:              st.Title,
                Description:       &st.Description,
                CollectionId:      e.collectionID,
                ParentTaskId:      &parentTaskID,
                BlockedByTaskIds:  prevGroupTaskIDs,  // blocked by ALL of previous group
            })
            currentGroupTaskIDs = append(currentGroupTaskIDs, task.Id)
            allCreated = append(allCreated, createdTask{st, task.Id})
        prevGroupTaskIDs = currentGroupTaskIDs

    // 7. Recurse into ALL non-terminal tasks concurrently (no group barriers)
    //    Each child's decompose() acquires the semaphore for ITS OWN LLM call
    var wg sync.WaitGroup
    for _, ct := range allCreated:
        if ct.subtask.Terminal:
            continue
        wg.Add(1)
        go func(st Subtask, taskID string):
            defer wg.Done()
            childContext := append(contextChain, taskText)
            e.decompose(ctx, st.Description, childContext, taskID, depth+1)
        (ct.subtask, ct.taskID)
    wg.Wait()
```

**Semaphore placement is load-bearing.** The semaphore MUST be acquired around the LLM
call only, NOT around the entire recursive `decompose()` call. If the semaphore wrapped the
full recursion, a concurrency of 4 would mean only 4 top-level subtasks could be in-flight
— and if any of those spawned children, the semaphore would be held for the entire subtree,
causing deadlock when there are more non-terminal tasks than semaphore slots. Acquiring
around the LLM call only means the semaphore bounds active API calls, while allowing
unbounded goroutines to exist in the "creating tasks on FT" or "waiting for children" states.

**Key design decisions:**

1. **Create-with-blockers (single call).** We wire `blocked_by_task_ids` at creation time
   because we iterate groups in order — by the time we create group 01 tasks, all group 00
   task IDs are known. No separate UpdateTask pass needed.

2. **No group barriers during decomposition.** All non-terminal subtasks are recursed
   concurrently regardless of their group number. Group ordering is an execution constraint
   (BLOCKED_BY edges on Farmtable), not a decomposition constraint. Each branch decomposes
   based on its ancestry chain alone — it doesn't need sibling subtree structure as context.
   This maximizes parallelism and simplifies the concurrency model to pure fan-out.

3. **Context chain propagation.** The existing prompt pattern copies the parent chain into
   each child's `task.md`. The Go equivalent: a `[]string` context chain that grows at each
   recursion level. The LLM sees the full ancestry when decomposing, giving it the same
   contextual awareness the agent-based version had.

4. **Terminal = leaf.** When the LLM marks a task terminal, we create it on Farmtable and
   don't recurse. When `depth >= maxDepth`, we force-terminal everything regardless of the
   LLM's judgment.

5. **Concurrency bounded by semaphore around the LLM call only.** A shared buffered
   channel (`e.sem`) limits concurrent LLM calls globally. Critically, the semaphore is
   acquired before the LLM call and released immediately after — NOT held during task
   creation or child recursion. This avoids deadlock: goroutines can exist in "creating
   tasks on FT" or "waiting for children" states without holding a semaphore slot.

6. **Cross-branch dependencies are out of scope.** Dependencies are siblings-only (group N
   blocked by group N-1 within the same parent). Cross-branch awareness is an execution-time
   concern — the agent or human picking up a blocked task will read the completed upstream
   tasks' results and adapt. If this proves insufficient, a post-decomposition "refinement
   pass" (a second LLM sweep reading the full tree) is a cleaner extension than baking
   cross-branch context into the recursion.

---

### LLM Shim Interface

```go
// Thin inference interface — the engine knows nothing about providers
type Inferencer interface {
    Complete(ctx context.Context, messages []Message) (string, error)
}

type Message struct {
    Role    string  // "system", "user", "assistant"
    Content string
}
```

Implementations are separate files, each behind a build tag or selected by flag:

```go
// internal/decomposer/llm_genai.go  (initial provider — Google GenAI + ADC)
type GenAIClient struct { client *genai.Client; model string; project string; location string }
func NewGenAIClient(ctx context.Context, model, project, location string) (*GenAIClient, error) {
    // Uses Application Default Credentials (ADC) — no explicit API key.
    // Local dev: `gcloud auth application-default login`
    // Production: service account key, workload identity, or metadata server.
    client, err := genai.NewClient(ctx, &genai.ClientConfig{
        Project:  project,
        Location: location,
        Backend:  genai.BackendVertexAI,
    })
    ...
}
func (c *GenAIClient) Complete(ctx, msgs) (string, error) {
    // Map []Message → []*genai.Content for GenerateContent call
    // System message → config.SystemInstruction
    // User/assistant messages → contents slice
    ...
}

// internal/decomposer/llm_anthropic.go  (Phase 3 — second provider)
type AnthropicClient struct { apiKey string; model string }
func (c *AnthropicClient) Complete(ctx, msgs) (string, error) { ... }
```

**Load-bearing decision:** The interface takes `[]Message` (not a flat string) so the
engine can structure system/user/assistant messages properly. This is necessary for
Google GenAI, Anthropic, and OpenAI APIs alike. Tool-use / function-calling / JSON mode
is NOT in the interface — the engine asks for text output containing JSON and the parser
extracts it. This keeps the shim maximally thin: adding a new provider is just "implement
Complete() → string."

**Authentication: ADC (Application Default Credentials).**
The GenAI client uses Google Cloud's standard ADC chain — no explicit API key flag needed
for the initial provider. ADC resolves credentials in this order:
1. `GOOGLE_APPLICATION_CREDENTIALS` env var (path to service account JSON)
2. User credentials from `gcloud auth application-default login`
3. Attached service account (GCE, Cloud Run, GKE workload identity)

This means the decomposer works out of the box in any GCP-authenticated environment.
For local development, the developer runs `gcloud auth application-default login` once.
The `--project` and `--location` flags (or `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION`
env vars) specify the Vertex AI endpoint.

---

### LLM Output Format: JSON Template

The decomposition prompt includes a JSON template that the LLM fills in. This makes
the output generally parseable by Go's `encoding/json` — no custom state-machine parser
needed. The template is part of the prompt (user-configurable), so the schema can evolve
without changing the binary.

**JSON schema per decomposition call:**

```json
{
  "groups": [
    {
      "group": 0,
      "tasks": [
        {
          "slug": "research-requirements",
          "title": "Research and document system requirements",
          "description": "Review all existing documentation, stakeholder inputs, and ...",
          "terminal": false
        },
        {
          "slug": "audit-existing-code",
          "title": "Audit existing codebase for reusable components",
          "description": "Survey the current codebase to identify ...",
          "terminal": true
        }
      ]
    },
    {
      "group": 1,
      "tasks": [
        {
          "slug": "design-api-schema",
          "title": "Design the API schema and data model",
          "description": "Based on requirements from group 0, design ...",
          "terminal": false
        }
      ]
    }
  ]
}
```

**Go types for parsing:**

```go
type DecompositionResult struct {
    Groups []Group `json:"groups"`
}

type Group struct {
    GroupNum int       `json:"group"`
    Tasks   []Subtask `json:"tasks"`
}

type Subtask struct {
    Slug        string `json:"slug"`
    Title       string `json:"title"`
    Description string `json:"description"`
    Terminal    bool   `json:"terminal"`
}
```

**Parser behavior:**
1. Extract JSON from the LLM response — find the first `{` to last `}` span (LLMs
   often wrap JSON in markdown code fences or add commentary before/after).
2. `json.Unmarshal` into `DecompositionResult`.
3. Validate: groups are in ascending order, each group has ≥1 task, slugs are unique
   within the decomposition, descriptions are non-empty.
4. On parse failure: retry once with a corrective prompt ("Your response was not valid
   JSON. Please respond with only the JSON object, no other text."). If still
   unparseable, treat the current task as forced-terminal.

**Why JSON over the text-based format originally proposed?**
- Universally parseable by `encoding/json` — no custom parser needed.
- The JSON template in the prompt gives the LLM a concrete example to follow, improving
  output consistency.
- Adding fields later (priority, labels, type) is just adding a struct field with
  `omitempty` — backward-compatible.
- The earlier concern about JSON reliability (bracket-matching, escaping) is mitigated
  by the extract-and-retry strategy, and modern LLMs handle JSON well when given a
  template.

---

### Prompt Construction

The prompt has three layers, assembled by `prompt.go`:

```
┌─────────────────────────────────────┐
│  System Prompt (from file/embed)    │  ← decomposition instructions, output format,
│                                     │     terminal criteria, group semantics
├─────────────────────────────────────┤
│  Context Chain (accumulated)        │  ← "Your parent tasks, in order:"
│  - Level 0: "Build a web platform  │     Each level appends its task text
│    for managing inventory..."       │     so the LLM has full ancestry
│  - Level 1: "Design the data       │
│    model and persistence layer"     │
├─────────────────────────────────────┤
│  Current Task (this level's input)  │  ← "Decompose this task:"
│  "Define the database schema for    │     The task text to break down
│   the inventory tables..."          │
└─────────────────────────────────────┘
```

The **system prompt** is loaded from a file (`--prompt-file` flag) or an embedded default. The user will provide the initial version. The engine injects output format instructions (the GROUP/TASK/TITLE/DESCRIPTION/TERMINAL structure) into the system prompt so the LLM knows what format to produce.

The **context chain** grows at each recursion level. This is the Go equivalent of the agent prompt's "copy parent task.md and append" pattern. It gives the LLM the full ancestry so it can decompose with awareness of the broader project.

The **current task** is the specific text to decompose at this level.

---

### Farmtable Writer

```go
type Writer struct {
    client       pb.FarmTableServiceClient
    collectionID string
}

func (w *Writer) CreateTask(ctx, req *pb.CreateTaskRequest) (*pb.Task, error)
func (w *Writer) CreateCollection(ctx, name string) (*pb.Collection, error)
```

Thin wrapper around the generated gRPC client. The writer:
- Sets `collection_id` on all requests (from config)
- Sets `parent_task_id` (from the recursion level above)
- Sets `blocked_by_task_ids` (from the previous group's task IDs)
- Sets `stage` to `TASK_STAGE_TRIAGE` for non-terminal, `TASK_STAGE_READY` for terminal+unblocked
- Stores the task description as the full subtask description from the LLM

Authentication uses the same pattern as `ft`: token from flag → `FARMTABLE_TOKEN` env var → config file.

---

### CLI Interface

```
decomposer [flags] <input-file-or-"-">

Flags:
  --server          Farmtable server address (or FARMTABLE_SERVER env)
  --token           Auth token (or FARMTABLE_TOKEN env)
  --collection      Collection ID or name (required; creates if name doesn't exist)
  --provider        LLM provider: "genai", "anthropic" (default: "genai")
  --model           LLM model name (default: provider-specific, e.g. "gemini-2.5-pro")
  --project         Google Cloud project (or GOOGLE_CLOUD_PROJECT env; required for genai)
  --location        Google Cloud location (or GOOGLE_CLOUD_LOCATION env; default: "us-central1")
  --api-key         LLM API key (for non-ADC providers, e.g. ANTHROPIC_API_KEY env)
  --prompt-file     Custom system prompt file (overrides embedded default)
  --max-depth       Maximum recursion depth (default: 3)
  --concurrency     Max parallel LLM calls (default: 4)
  --verbose         Log LLM prompts/responses to stderr
```

**Example usage:**
```bash
export FARMTABLE_SERVER=farmtable-qo7k5fvpda-uc.a.run.app:443
export FARMTABLE_TOKEN=$(gcloud secrets versions access latest --secret=farmtable-token)
# GenAI uses ADC — no API key needed, just:
#   gcloud auth application-default login   (for local dev)
export GOOGLE_CLOUD_PROJECT=my-project

decomposer --collection "My Project" --max-depth 3 design.md
```

Or from a high-level statement:
```bash
echo "Build a real-time collaborative document editor with conflict resolution" | \
  decomposer --collection "Collab Editor" -
```

---

### Root Task & Entry Point

When the decomposer starts, it creates a **root task** on Farmtable representing the
top-level input. This root task's description contains the original input text (the full
design doc or outcome statement). All first-level subtasks are children of this root task.

```
decomposer --collection "My Project" design.md

  → Creates root task: "My Project" (description = contents of design.md)
  → Decomposes root → creates 6-12 children of root
  → Recurses into non-terminal children → creates grandchildren
  → ...
```

The root task is always non-terminal (otherwise there's nothing to decompose). The initial
`decompose()` call uses the root task's ID as `parentTaskID` and the input text as
`taskText`. The context chain starts empty.

**Output on completion:** The binary prints a summary to stdout:
```
Collection: My Project (id: 5d1e4eea-...)
Root task:  Build inventory system (id: dceae211-...)
Tasks created: 47 (18 terminal, 29 non-terminal)
Max depth reached: 3
Dashboard: https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=5d1e4eea-...
```

With `--verbose`, each task creation is logged to stderr as it happens:
```
[depth=0] Creating 00-research-requirements (group 00, non-terminal)
[depth=0] Creating 00-audit-existing-code (group 00, terminal)
[depth=0] Creating 01-design-api-schema (group 01, non-terminal)
[depth=1] 00-research-requirements → Creating 00-stakeholder-interviews (group 00, terminal)
...
```

### Task Count Bounds

With 6–12 subtasks per level and max depth 3, the worst case is 12³ = 1,728 leaf tasks
(plus ~156 non-terminal intermediates). This is likely too many for a useful board.

**Mitigations:**
- The LLM's terminal judgment naturally caps most branches at depth 2 (most tasks are
  concrete enough to be terminal after one split). Empirically, the agent-based decomposer
  produced ~24 tasks from a moderately complex design doc.
- `--max-depth` defaults to 3 (not unlimited).
- A `--max-tasks` flag (future enhancement) could hard-cap total task creation.
- The prompt's instruction to produce 6–12 subtasks is a soft target; in practice, the LLM
  tends toward the lower end for focused tasks and the higher end only for broad ones.

No hard cap in v1 beyond `--max-depth`. If task explosion proves a problem in practice,
`--max-tasks` is a straightforward addition.

---

### Error Handling & Resilience

| Failure | Behavior |
|---------|----------|
| LLM transient error (429, 500, timeout) | Retry with exponential backoff, up to 3 attempts |
| LLM persistent error (auth, bad request) | Log, skip this subtree, continue siblings |
| LLM unparseable output | Retry once with "please format your response as..." nudge; if still unparseable, treat task as forced-terminal |
| Farmtable task creation failure | Log and abort current branch (tasks already created remain) |
| Farmtable connection lost | Fatal — exit with error (partial tree is valid on server) |
| Recursion depth exceeded | Force-terminal all remaining tasks (no LLM call) |
| Context cancelled (Ctrl-C) | Graceful shutdown: finish in-progress LLM calls, don't start new ones |

**Partial results are always valid.** Since tasks are created on Farmtable as we go, an interrupted decomposition leaves a valid (but incomplete) task tree. The collection is always in a consistent state.

---

### Traversal Order: Concurrent Fan-Out (No Barriers)

```
Root: "Build inventory system"
│
│   ┌──────────── all non-terminal subtasks decomposed concurrently ──────────┐
│   │                                                                         │
├── 00-research-requirements  ←──┐  01-design-api-schema  ←──┐  02-implement  │
│   │                            │  │                         │  │            │
│   ├── 00-stakeholder [TERM]    │  ├── 00-endpoints [TERM]   │  ├── ...      │
│   ├── 00-competitor  [TERM]    │  └── 01-validation [TERM]  │  └── ...      │
│   └── 01-requirements [TERM]   │                            │               │
│                                │                            │               │
│   00-audit-existing-code  ←────┘  01-define-data-model ←────┘               │
│   │                               │                                         │
│   ├── 00-scan-models [TERM]       ├── 00-schema [TERM]                      │
│   └── 01-reusable    [TERM]       └── 01-migrations [TERM]                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                            wg.Wait() (all branches)

FT relationships (execution ordering, NOT decomposition ordering):
  01-design-api-schema    BLOCKED_BY  00-research-requirements, 00-audit-existing-code
  01-define-data-model    BLOCKED_BY  00-research-requirements, 00-audit-existing-code
  02-implement-backend    BLOCKED_BY  01-design-api-schema, 01-define-data-model
```

All non-terminal subtasks are decomposed concurrently (bounded by the global semaphore).
Group numbers affect only the BLOCKED_BY edges written to Farmtable — they do not gate
decomposition. The single `wg.Wait()` at the end of each `decompose()` call ensures all
children are fully decomposed before returning to the caller.

---

## Alternatives Considered

### Alt 1: Keep Agent-Based Recursion (Status Quo)

Continue using the scion agent decomposer prompt as-is.

**Rejected because:** The user explicitly wants deterministic Go code for recursion. The agent-based approach has real operational costs: agent provisioning latency (~200ms+ per spawn), notification fragility (stall detection false positives, message delivery races), and poor observability (progress is scattered across agent logs). Moving recursion to Go eliminates all of these while keeping the LLM reasoning that actually adds value.

### Alt 2: ft Subcommand Instead of Standalone Binary

Add `ft decompose <file>` as a subcommand to the existing CLI.

**Rejected because:** The user specified a standalone binary. The LLM dependency is large and conceptually different from `ft`'s core function (task CRUD). Bundling it would bloat `ft` for users who don't need decomposition. Separate binary = separate release cycle, separate dependency tree.

### Alt 3: Group-Sequential Decomposition (DFS with Barriers)

Decompose all group 00 subtrees completely before starting group 01 decomposition, matching the agent-based version's traversal order.

**Rejected because:** After discussion, we established that group ordering is an execution constraint, not a decomposition constraint. Each task decomposes based on its ancestry chain alone — it doesn't need sibling subtree structure. Removing barriers maximizes parallelism and simplifies the concurrency model. The agent-based version used barriers because agents were stateful and provisioning was sequential; the Go binary has no such constraint.

### Alt 4: Custom Text-Based Format (Originally Proposed)

Use structured text markers (GROUP NN: / TASK: / TITLE: / DESCRIPTION: / TERMINAL:)
parsed by a custom state machine.

**Rejected in favor of JSON.** Per user direction, JSON is generally parseable without
custom parser code, a JSON template in the prompt gives the LLM a concrete format to
follow, and adding fields later is trivial. The text format's robustness advantages
(no bracket-matching, no escaping) don't outweigh JSON's universality.

### Alt 5: Tool-Use / Function-Calling for Guaranteed JSON

Use provider-specific structured output APIs (Anthropic tool_use, OpenAI function_calling)
instead of prompting for JSON.

**Considered but deferred.** Tool-use APIs vary across providers and would leak
provider-specific details into the engine, complicating the pluggable shim. Prompt-based
JSON with extract-and-retry is provider-agnostic and sufficient for v1. If JSON
reliability proves problematic with a specific provider, a provider-specific adapter
that uses tool-use can be added behind the same `Inferencer` interface without changing
the engine.

---

## Migration / Rollout

Greenfield — no existing behavior to migrate.

1. New `cmd/decomposer/` directory with its own `main.go`
2. New `internal/decomposer/` package for the engine
3. LLM client dependencies added to `go.mod` (`google.golang.org/genai`; no impact on existing binaries — Go links per-binary)
4. Makefile target: `make decomposer` (separate from existing `make build`)
5. The agent-based `decomposer.md` prompt continues to work independently — this is an alternative, not a replacement, until the Go binary is proven

---

## Resolved Decisions

| # | Question | Resolution |
|---|----------|------------|
| R1 | Output target | Direct to Farmtable via gRPC. No intermediate file. |
| R2 | LLM provider | Pluggable via thin `Inferencer` shim. Start with Google GenAI (Vertex AI + ADC), add Anthropic in Phase 3. |
| R3 | Cross-branch dependencies | Siblings only. Cross-branch is an execution-time concern. |
| R4 | Review gate | None. This is machinery — fire and forget. |
| R5 | Recursion order | No group barriers during decomposition. Concurrent fan-out. |
| R6 | Collection auto-creation | Yes — if `--collection` name doesn't exist, auto-create it. |
| R7 | Task description content | Lean — just the LLM's subtask description. Parent hierarchy in FT provides the context chain. |
| R8 | Task metadata | Minimal for v1 — title, description, terminal, group only. Priority/type/labels deferred. |
| R9 | LLM output format | JSON. Template provided in the prompt. Parsed by `encoding/json`. |

## Open Questions

1. **Decomposition prompt content.** The user will provide an initial prompt adapted from
   the agent-based `decomposer.md`. The JSON template is now defined (see "LLM Output
   Format" section); the prompt needs to include this template as an example and instruct
   the LLM to output in this format. The prompt also defines the terminal criteria, group
   semantics, and decomposition philosophy — these are the most impactful remaining design
   inputs. → _Awaiting prompt from user._

2. **Post-decomposition refinement pass.** Noted as the designed extension point for
   cross-branch awareness if it's needed later. A second LLM sweep reads the full tree and
   adjusts relationships/descriptions. Not v1.

---

## Implementation Phases

### Phase 1: Single-Level Decomposition (MVP)
- `cmd/decomposer/main.go` — CLI flags, wiring
- `internal/decomposer/engine.go` — single-level decompose (no recursion yet)
- `internal/decomposer/llm.go` — `Inferencer` interface + Google GenAI implementation (ADC)
- `internal/decomposer/prompt.go` — system prompt + task text assembly
- `internal/decomposer/parser.go` — JSON extraction, unmarshaling, validation
- `internal/decomposer/writer.go` — Farmtable gRPC CreateTask with parent + blocked_by
- **Acceptance:** `decomposer design.md` → creates 6-12 tasks on Farmtable with correct grouping and blocking relationships. No recursion.

### Phase 2: Recursive Decomposition
- Add recursion loop with concurrent fan-out (no group barriers)
- Context chain propagation
- `--max-depth` enforcement
- `sync.WaitGroup` + semaphore concurrency
- Terminal detection (LLM-judged + depth-forced)
- **Acceptance:** Multi-level task tree created correctly. Verified by `ft task ready` / `ft task blocked` / `ft dependency-tree` on the resulting collection.

### Phase 3: Second LLM Provider + Polish
- Add second `Inferencer` implementation (Anthropic — `--provider anthropic` + `--api-key` / `ANTHROPIC_API_KEY`)
- `--verbose` logging
- Retry logic for LLM errors
- Graceful Ctrl-C shutdown
- **Acceptance:** Works with at least two LLM providers. Handles errors without panicking or leaving corrupted state.

### Phase 4: Enhancements (Post-MVP)
- Task metadata (priority, type, labels) in LLM output + parser
- `--dry-run` mode (print proposed tree without creating tasks)
- Collection auto-creation
- Config file support
- `--resume` for interrupted decompositions

---

## Acceptance Criteria

1. `decomposer design.md --collection "My Project"` reads the file, calls the LLM, and creates a multi-level task DAG on the Farmtable collection.
2. Tasks have correct parent/child hierarchy (parent_task_id) reflecting the decomposition tree.
3. Tasks have correct BLOCKED_BY relationships reflecting the group encoding (group N blocked by group N-1, siblings only).
4. Terminal tasks are leaf nodes — no children. Non-terminal tasks at max-depth are forced-terminal.
5. The context chain is visible in child task descriptions or LLM prompts — the LLM always sees the full ancestry when decomposing.
6. `--max-depth` is respected as a hard bound.
7. Partial interruption leaves a valid (but incomplete) task tree on Farmtable.
8. The binary compiles independently: `go build ./cmd/decomposer` succeeds without affecting `ft` or `farmtable-server`.
9. At least two LLM providers work via the shim interface.
10. The decomposition quality (task granularity, grouping coherence, terminal judgment) is comparable to the agent-based decomposer on the same input.
