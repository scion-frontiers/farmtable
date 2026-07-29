# Task State Model Phase 1 Security Audit R2

Date: 2026-07-27
Branch: `task-state-core`
Head: `9894398734ffe29a0f2a4535327d49560ba51fc5`
Report: `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-core-r2.md`
Verdict: `REQUEST CHANGES`

## Summary

Second-pass security audit completed against `origin/main`.

The prior blockers were rechecked:

- GitHub pass-through claim bypass: fixed for the reviewed path.
- Ent claim availability race: substantially fixed with transactional recomputation and final predicates.
- Beads accepted-to-blocked projection: fixed through hold-reason-aware projection.

One remaining security blocker was found: native direct write paths can set or create `stage=working` without invoking the claim gate, so unavailable work can bypass computed availability and self-assignment semantics.

Dependency audit also found reachable vulnerabilities in the configured Go toolchain and indirect modules. Patch targets are Go `1.26.5`, `golang.org/x/net v0.55.0`, and `golang.org/x/text v0.39.0`.

## Verification

- `git diff --check origin/main...HEAD`: pass.
- Focused state/security package tests: pass.
- Focused import/claim/adapter tests: pass.
- `go test ./...`: pass.
- `npm audit --omit=dev` in `web/`: found 0 vulnerabilities.
- Installed and ran official `govulncheck`: found 9 reachable Go vulnerabilities.

## Required Follow-Up

- Reject or route `UpdateTask(stage=working)` through `ClaimTask` so availability, already-assigned, self-assignment, version, and audit semantics cannot be bypassed.
- Reject direct native `CreateTask(stage=working)`, or define a separate privileged start-on-create operation with the same claim/start semantics.
- Upgrade Go and vulnerable indirect modules, then rerun `go test ./...` and `govulncheck ./...`.
