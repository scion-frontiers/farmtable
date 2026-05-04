# Code Review: CLI Layer (Review Group 3)

**Reviewer:** code-review agent
**Date:** 2026-05-04
**Scope:** `internal/cli/*.go` (13 files)

---

## Summary

The CLI layer is well-structured overall. The ExitError pattern is correctly centralized in `root.go` with no stray `os.Exit` or `log.Fatal` calls. Embedded mode lifecycle (bufconn/closer) is handled correctly across all 13 command handlers via `defer closer.Close()`. Config writes use `0o600` permissions. The main issues found are: silent validation failures for sort/order flags, a config permission gap on pre-existing files, and minor error-aggregation and robustness gaps.

**Findings: 0 critical, 2 high, 5 medium, 3 low**

---

## HIGH

### H1. Invalid `--sort` and `--order` values silently ignored

**File:** `internal/cli/task.go:168-176`

```go
if sort != "" {
    if v, ok := sortFieldValues[sort]; ok {
        req.SortField = v
    }
}
if order != "" {
    if v, ok := sortOrderValues[order]; ok {
        req.SortOrder = v
    }
}
```

If the user passes `--sort bogus`, the map lookup fails silently and the request is sent with the default (unspecified) sort. The user gets results in an unexpected order with no indication their flag was rejected. Every other enum flag (phase, stage, priority, platform, ci-status, pr-status) validates and returns an error.

**Fix:** Add validation errors:
```go
if sort != "" {
    v, ok := sortFieldValues[sort]
    if !ok {
        return exitError(ExitValidation, "VALIDATION_ERROR",
            fmt.Sprintf("invalid sort field %q; valid: created, updated, priority, due_date", sort))
    }
    req.SortField = v
}
```
Same pattern for `order`. Also applies to `comment list` at `internal/cli/comment.go:113-116`.

---

### H2. Config file permissions not enforced on pre-existing files

**File:** `internal/cli/config.go:99`

```go
return os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o600)
```

`os.WriteFile` only applies the permission mode when *creating* a new file. If the config file already exists with `0o644` (e.g., user created it manually or a prior version wrote it), `SaveConfigValue` will write the token into a world-readable file without changing permissions.

**Fix:** After `WriteFile`, explicitly `os.Chmod(path, 0o600)`:
```go
if err := os.WriteFile(path, content, 0o600); err != nil {
    return err
}
return os.Chmod(path, 0o600)
```

---

## MEDIUM

### M1. `embeddedCloser.Close()` discards `conn.Close()` error

**File:** `internal/cli/connect.go:186-189`

```go
func (c *embeddedCloser) Close() error {
    c.conn.Close()      // error discarded
    c.srv.Stop()
    return c.store.Close()
}
```

If `conn.Close()` fails, the error is silently lost. While gRPC client connection close errors are rarely actionable, the pattern violates Go conventions and could mask resource leaks in diagnostics.

**Fix:** Aggregate errors with `errors.Join`:
```go
func (c *embeddedCloser) Close() error {
    connErr := c.conn.Close()
    c.srv.Stop()
    storeErr := c.store.Close()
    return errors.Join(connErr, storeErr)
}
```

---

### M2. `resolveDBPath` silently ignores `UserHomeDir()` error

**File:** `internal/cli/connect.go:85`

```go
func resolveDBPath() string {
    if v := os.Getenv("FARMTABLE_DB_PATH"); v != "" {
        return v
    }
    home, _ := os.UserHomeDir()
    return filepath.Join(home, ".farmtable", "farmtable.db")
}
```

If `UserHomeDir()` fails (e.g., `$HOME` unset in a container), `home` is `""` and the path becomes `.farmtable/farmtable.db` — a relative path. This would create the database in whatever the current working directory happens to be, which could be surprising and cause data loss across invocations from different directories.

**Fix:** Return an error, or fall back explicitly:
```go
func resolveDBPath() (string, error) {
    if v := os.Getenv("FARMTABLE_DB_PATH"); v != "" {
        return v, nil
    }
    home, err := os.UserHomeDir()
    if err != nil {
        return "", fmt.Errorf("cannot determine home directory: %w (set FARMTABLE_DB_PATH)", err)
    }
    return filepath.Join(home, ".farmtable", "farmtable.db"), nil
}
```
This requires updating `startEmbedded()` to handle the error.

---

### M3. `isLocalhost` doesn't handle bracketed IPv6

**File:** `internal/cli/connect.go:99-105`

```go
func isLocalhost(addr string) bool {
    host := addr
    if idx := strings.LastIndex(addr, ":"); idx >= 0 {
        host = addr[:idx]
    }
    return host == "localhost" || host == "127.0.0.1" || host == "::1" || host == ""
}
```

For `[::1]:8080`, `LastIndex(":")` returns the port separator, leaving `host = "[::1]"`. This doesn't match `"::1"` (no brackets), so IPv6 loopback addresses in bracket notation are treated as remote — meaning TLS will be used for a connection to localhost.

**Fix:** Use `net.SplitHostPort` which handles brackets correctly:
```go
func isLocalhost(addr string) bool {
    host := addr
    if h, _, err := net.SplitHostPort(addr); err == nil {
        host = h
    }
    return host == "localhost" || host == "127.0.0.1" || host == "::1" || host == ""
}
```

---

### M4. `newConfigPathCmd` uses `Run` instead of `RunE`

**File:** `internal/cli/config_cmd.go:97`

```go
Run: func(cmd *cobra.Command, args []string) {
    fmt.Println(defaultConfigPath())
},
```

Every other command uses `RunE`. While `config path` can't fail today, using `Run` is inconsistent and means any future error in this handler can't propagate through the ExitError pattern.

**Fix:** Change to `RunE`:
```go
RunE: func(cmd *cobra.Command, args []string) error {
    fmt.Println(defaultConfigPath())
    return nil
},
```

---

### M5. Config loaded multiple times per command invocation

**Files:** `internal/cli/connect.go:30,41,53,76`

Each `resolve*` function independently calls `LoadConfig()`, which opens and parses the config file. A single command that resolves server, token, collection, and output will load the config file four times.

This is not a correctness bug but is wasteful I/O and would also cause inconsistency if the config file is modified between reads (unlikely but possible).

**Fix:** Load config once in the command setup (or lazily with `sync.Once`) and pass it through the `globalFlags` struct.

---

## LOW

### L1. Date parsing uses UTC for bare dates

**File:** `internal/cli/task.go:722-731`

```go
func parseDate(s string) (*timestamppb.Timestamp, error) {
    for _, layout := range []string{
        time.RFC3339,
        "2006-01-02T15:04:05Z",
        "2006-01-02",
    } {
```

When a user provides `--due-date 2026-05-15`, it parses as `2026-05-15T00:00:00Z` (UTC midnight). Users likely expect the due date to represent end-of-day in their local timezone. The `"2006-01-02T15:04:05Z"` layout is also redundant with RFC3339.

**Suggestion:** Document the UTC behavior in the flag help text, or parse bare dates in `time.Local`.

---

### L2. Token stored in plaintext in config file

**File:** `internal/cli/config.go:49` (token field), `config_cmd.go:83` (`config set` allows setting token)

The token is stored as plaintext in `~/.config/farmtable/config.toml`. While the file is created with `0o600`, this is a general security concern for sensitive credentials. The `config show` command correctly masks the token for display (config_cmd.go:33-39).

**Suggestion:** Consider supporting OS keychain integration for token storage, or at minimum document the plaintext storage in user-facing help.

---

### L3. `resolveCollectionFromServer` auto-detection silently fails

**File:** `internal/cli/connect.go:56-65`

```go
func resolveCollectionFromServer(ctx context.Context, client pb.FarmTableServiceClient, flagVal string) string {
    if c := resolveCollection(flagVal); c != "" {
        return c
    }
    resp, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{})
    if err != nil || len(resp.GetItems()) != 1 {
        return ""
    }
    return resp.GetItems()[0].GetId()
}
```

When server auto-detection fails (auth error, network issue, multiple collections), the function returns `""` silently. The calling command may then fail with a confusing "collection is required" error rather than indicating the auto-detection failed and why.

**Suggestion:** Consider logging the auto-detection failure reason at verbose/debug level.

---

## Positive observations

- **ExitError pattern is complete:** `os.Exit` only appears in `root.go:47,50`. All 13 command handlers return errors via `exitError()` or `handleGRPCError()`. No `log.Fatal` calls anywhere.
- **Embedded closer lifecycle is sound:** All command handlers use `defer closer.Close()`. The `startEmbedded()` function correctly cleans up on all error paths (lines 150-152 for dial failure, lines 159 for default collection failure).
- **Dual-output error pattern is consistent:** `handleGRPCError` and `exitError` both write structured JSON to stdout and human-readable messages to stderr, enabling both machine and human consumption.
- **`version` command gracefully degrades:** If the server is unreachable, it still prints the CLI version (version.go:34-41). This is the right UX choice for a diagnostic command.
- **Config write permissions are correct:** `SaveConfigValue` uses `0o600` for new files (config.go:99).
- **Flag validation is thorough** for phase, stage, priority, platform, CI status, and PR status — with clear error messages listing valid values.
- **Token/server/collection resolution order is correct and consistent:** flag > env var > config file, across all three resolve functions.
