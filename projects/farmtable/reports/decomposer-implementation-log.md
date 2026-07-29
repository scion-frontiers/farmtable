# Decomposer Implementation Log

**Date:** 2026-07-21
**Branch:** `feat/decomposer-extras`
**Author:** Developer agent (decomposer-dev)

## What Was Built

A standalone Go binary (`cmd/decomposer/`) that takes a design document or high-level
outcome statement and recursively decomposes it into a Farmtable task DAG using LLM
inference. The binary is independent of the existing `ft` CLI and `farmtable-server`
binaries.

### Files Created

| File | Purpose |
|------|---------|
| `cmd/decomposer/main.go` | CLI entry point using Cobra. Flag parsing, provider selection, graceful shutdown. |
| `internal/decomposer/engine.go` | `Engine` struct with recursive `decompose()` method. Concurrent fan-out with semaphore-bounded LLM calls. Retry with exponential backoff. |
| `internal/decomposer/llm.go` | `Inferencer` interface + Google GenAI (Vertex AI) implementation — primary provider. Uses ADC auth. |
| `internal/decomposer/llm_anthropic.go` | Anthropic Messages API implementation — second provider. Uses raw HTTP. |
| `internal/decomposer/prompt.go` | Prompt builder: system message + context chain + current task. Embeds default prompt via `//go:embed`. |
| `internal/decomposer/prompt_default.txt` | Embedded default system prompt (placeholder — production prompt from user pending). |
| `internal/decomposer/parser.go` | JSON extraction (first `{` to last `}`), unmarshal, semantic validation. |
| `internal/decomposer/writer.go` | Farmtable gRPC wrapper: CreateTask, CreateCollection, ResolveCollection, auth context. |
| `internal/decomposer/parser_test.go` | 13 test cases covering JSON extraction, terminal/decomposition parsing, validation edge cases. |
| `internal/decomposer/engine_test.go` | 9 test cases with mock LLM + mock writer: single-level, recursive, max-depth, terminal, context chain, concurrent fan-out, corrective retry, forced terminal, context cancellation. |

### Makefile

Added `decomposer` target: `go build -o bin/decomposer ./cmd/decomposer`

### Dependencies Added

- `google.golang.org/genai` — Google GenAI SDK for Vertex AI LLM calls

## Phase Verification

### Phase 1: Single-Level Decomposition (MVP)

- Verified: CLI parses flags correctly, reads input from file or stdin.
- Verified: Single LLM call produces 6-12 subtasks with correct grouping.
- Verified: Tasks created on Farmtable with correct parent and BLOCKED_BY relationships.
- Verified: All unit tests pass.

### Phase 2: Recursive Decomposition + Concurrency

- Verified: Recursive decomposition creates multi-level task trees.
- Verified: Max depth enforcement works (depth-forced terminal).
- Verified: Context chain propagation — child LLM calls include parent ancestry.
- Verified: Concurrent fan-out — all non-terminal subtasks recursed concurrently (no group barriers).
- Verified: Semaphore correctly bounds concurrent LLM calls (around `Complete()` only, not full recursion).
- Verified: WaitGroup per level ensures all children complete before returning.

### Phase 3: GenAI + Anthropic Providers + Error Handling + Polish

- Verified: GenAI (Vertex AI) provider works as primary — uses ADC, no API key needed.
- Verified: Anthropic provider wired and available via `--provider anthropic`.
- Verified: Retry with exponential backoff for transient LLM errors (429, 5xx).
- Verified: Corrective retry on unparseable JSON — re-prompts asking for valid JSON.
- Verified: Forced terminal on double parse failure.
- Verified: `--verbose` flag logs prompts and responses to stderr.
- Verified: Graceful Ctrl-C via context cancellation.
- Verified: Collection auto-creation when name doesn't exist.
- Verified: Stdout summary on completion.

## Live-Run Verification

- **Provider:** GenAI (Gemini 2.5 Pro via Vertex AI)
- **Server:** `farmtable-qo7k5fvpda-uc.a.run.app:443`
- **Collection:** `decomposer-test-1784662856` (ID: `f7351b20-3c44-41b1-a253-e8dd6128b250`)
- **Input:** A design document for a "Real-Time Collaborative Document Editor"
- **Max depth:** 2
- **Result:** 94 tasks created (74 terminal, 20 non-terminal) across 2 depth levels
- **Verification:** `ft task list`, `ft task ready --include-unblocked`, `ft task blocked` all confirm correct hierarchy and BLOCKED_BY wiring
- **Full transcript:** `decomposer-live-run-transcript.txt`

## Deviations from Design

### Provider Change (Directed by coordinator)

The design doc originally specified Anthropic as the primary provider with OpenAI as
the second. Per coordinator direction, this was changed to:
- **Primary:** Google GenAI (Vertex AI via ADC) — `google.golang.org/genai` SDK
- **Second:** Anthropic (raw HTTP to Messages API)
- OpenAI provider was removed.

Justification: The deployment environment uses Google Cloud with ADC auth already
configured. GenAI via Vertex AI requires no API key management.

### GenAI Client Per-Request Instantiation

The current GenAI implementation creates a new `genai.Client` per `Complete()` call.
This is acceptable for the decomposer's usage pattern (bounded by semaphore to 4
concurrent calls), but a future optimization could maintain a persistent client.

## Issues Encountered

1. **Branch contamination:** The initial branch picked up web/ file changes from prior
   Feature 37 work. Resolved by resetting the branch to main and cherry-picking only
   decomposer commits.

2. **No direct ANTHROPIC_API_KEY:** The environment uses Vertex AI (CLAUDE_CODE_USE_VERTEX=1)
   rather than direct Anthropic API. This was resolved by the provider change to GenAI
   as primary.

3. **GOOGLE_CLOUD_LOCATION:** The environment had `GOOGLE_CLOUD_LOCATION=global` which
   is not a valid Vertex AI location for GenAI. The CLI defaults to `us-central1` when
   the env var value is not suitable, and accepts `--location` override.

## LLM Providers Tested

| Provider | Model | Auth | Status |
|----------|-------|------|--------|
| GenAI (Vertex AI) | gemini-2.5-pro | ADC (Application Default Credentials) | Tested and verified in live run |
| Anthropic | claude-sonnet-4-20250514 | API key (ANTHROPIC_API_KEY) | Implemented, not tested live (no API key in environment) |
