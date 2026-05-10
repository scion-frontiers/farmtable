# GitHub GraphQL Migration — Phase 1

**Date:** 2026-05-10
**Scope:** Add GraphQL client foundation to GitHub platform adapter

## Changes

1. **Dependency** — Added `github.com/shurcooL/githubv4` (and transitive `shurcooL/graphql`). Build verified clean with `go build ./...`.

2. **`internal/platform/github/graphql.go`** — New file with:
   - `graphqlClient` struct: wraps `githubv4.Client` with owner, repo, and config fields.
   - `newGraphQLClient()` constructor: creates oauth2 token source, wraps transport with existing `newRateLimitTransport`, and initializes the v4 client.

3. **`internal/platform/github/github.go`** — Extended `GitHubAdapter`:
   - Added `gql *graphqlClient` and `config *GitHubConfig` fields.
   - Added `NewWithConfig()` constructor that delegates to `New()` then conditionally initializes the GraphQL client when config is non-nil.
   - Existing `New()` constructor unchanged — backward compatible.

4. **`internal/platform/github/graphql_test.go`** — Three unit tests:
   - `TestNewGraphQLClient` — non-nil client, correct owner/repo.
   - `TestNewWithConfig_WithConfig` — gql initialized when config provided.
   - `TestNewWithConfig_NilConfig` — gql nil when no config.

## Observations

- `config.go` (with `GitHubConfig` type) was already committed by the concurrent agent, so the full build compiles cleanly.
- Rate limit transport is reused for both REST and GraphQL clients, ensuring consistent retry/backoff behavior across both API surfaces.
- All 22 tests in the github package pass, including all existing tests.
