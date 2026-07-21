# Feature: Decomposer Binary

**Date:** 2026-07-21
**Branch:** `feat/decomposer-extras`
**Status:** Implementation complete, pending review

## Summary

Added a standalone Go binary (`cmd/decomposer/`) that takes a design document and
recursively decomposes it into a Farmtable task DAG using LLM inference. This replaces
the agent-based decomposer with deterministic Go code for recursion and concurrency
while keeping the LLM's reasoning for task decomposition.

## Key Design Decisions

1. **Semaphore around LLM call only** — The semaphore bounds concurrent API calls but
   does NOT wrap the full recursion. This prevents deadlock when non-terminal tasks
   exceed semaphore slots.

2. **No group barriers during decomposition** — All non-terminal subtasks are recursed
   concurrently regardless of group number. Group ordering is an execution constraint
   (BLOCKED_BY edges), not a decomposition constraint.

3. **Context chain propagation** — Each recursion level appends the parent task text to
   a context chain, giving the LLM full ancestry awareness.

4. **JSON output format** — The LLM returns structured JSON with groups and tasks.
   Parser extracts JSON from response (handles markdown fences), with corrective retry
   on parse failure.

5. **Google GenAI as primary provider** — Uses Vertex AI with ADC auth (no API key
   management). Anthropic available as second provider via `--provider anthropic`.

## Files Added

- `cmd/decomposer/main.go` — CLI entry point
- `internal/decomposer/` — Engine, LLM clients, parser, prompt builder, writer
- Unit tests for parser and engine (22 test cases)
- Makefile target: `make decomposer`

## Live Verification

Successfully created a 94-task DAG (2 depth levels) from a design document for a
"Real-Time Collaborative Document Editor" on the live Farmtable service. Task hierarchy
and BLOCKED_BY relationships verified via `ft` CLI.

## Notes

- The system prompt is a placeholder. Production prompt from project owner is pending.
  Swap via `--prompt-file` flag or by replacing `prompt_default.txt`.
- No existing code was modified except adding a Makefile target.
- The `google.golang.org/genai` dependency was added to `go.mod`.
