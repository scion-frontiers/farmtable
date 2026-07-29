# GitHub GraphQL Phase 1: Config Parser & Label Mapper

**Date:** 2026-05-10
**Author:** Developer agent

## What was done

Implemented the config parser and bidirectional label mapper for the GitHub GraphQL migration (Phase 1):

### Files created
- `internal/platform/github/config.go` — `GitHubConfig`, `LabelConfig` types, `LoadConfig()` with YAML parsing and env var override, `DefaultConfig()`.
- `internal/platform/github/labels.go` — `LabelMapper` with 8 public methods: `MapLabelsToStage`, `MapLabelsToPriority`, `MapLabelsToType`, `StageToLabel`, `PriorityToLabel`, `StageLabelSwap`, `PriorityLabelSwap`, `IssueToPhaseStage`.
- `internal/platform/github/config_test.go` — 6 test functions covering YAML loading, missing file graceful fallback, disabled mode, env var override, defaults.
- `internal/platform/github/labels_test.go` — 21 test functions covering all mapper methods, precedence, case insensitivity, custom mappings, prefix stripping.

### Design decisions
- **Prefix stripping for pull direction**: Labels like `ft:stage/working` are normalized by stripping the push prefix and path segment, allowing the same label format to work in both push and pull directions.
- **Precedence order**: Stage conflicts resolved via a hardcoded precedence list (blocked > working > in_review > ...) rather than config, since this reflects workflow semantics.
- **`phaseForStage` helper**: Maps stages to their natural phase (e.g., working→in_progress, blocked→on_hold) for consistent phase derivation from label-based stage detection.
- **DefaultConfig as base for LoadConfig**: YAML unmarshals into a DefaultConfig, so unspecified fields keep their defaults rather than going to zero values.

### Issue encountered
- Priority labels use `priority:high` format (colon separator) while stage labels use `ft:stage/working` (slash path). The `stripForMatch` function needed to handle both `priority/` and `priority:` prefixes for correct bidirectional matching.

## Verification
- `go build ./...` passes
- `go test ./internal/platform/github/...` passes — all 37 new test cases green
