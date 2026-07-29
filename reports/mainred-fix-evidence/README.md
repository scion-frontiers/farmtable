# mainred-fix — raw measurement evidence

Supporting data for `../mainred-fix.md`. Preserved here because `/tmp` is per-container
and dies with the agent. **736K total.** The 492MB of working trees and the 21MB
`web/dist` were deliberately NOT preserved — see "reproducible" below.

## Tree state — required label

- `vet-clean.log`, `vet-server.log` → **PRISTINE** tree at cc92735, no build, `web/dist`
  absent. In this state `go vet ./...` fails at exit 1 with zero packages analysed, from
  the **root** `assets.go` (package `farmtable`) — *not* `internal/server`. The four
  packages that cannot load are `farmtable`, `cmd/farmtable-server`, `cmd/ft`,
  `internal/cli`. `internal/server` loads and vets fine here, which is why the scoped run
  works.
- Everything else → **THROWAWAY BUILT** trees (`make build` run, `web/dist` present).
- **Nothing here was measured in the main working copy, and nothing here is a CI figure.**

## Clock

Every run in this directory executed between **12:36:02Z and 12:55:59Z on 2026-07-29**.
No arm of any comparison ran before 12:33Z. See the straddle answer in the report thread.

## Contents

| Path | What it is |
|---|---|
| `discrim-results.tsv` | **The interleaved discriminator — the result the fix rests on.** armA 10/10 fail, armB 0/10, loads matched pair-by-pair. |
| `discriminator-armA-vs-armB.diff` | The instrument itself: the *entire* difference between the two arms, one 200ms sleep moved across `sub := s.eventBus.Subscribe(filter)`. 424 bytes. |
| `paired-results.tsv` | Experiment 1 (natural rate). Its *fixed* arm carries the MultiStore regression I introduced and later fixed. Superseded but reported in full. |
| `paired2-results.tsv` | Experiment 2 (natural rate, regression fixed). unfixed 1/10, fixed 0/10. **Underpowered — p=0.23 combined with exp 1. Does not establish the fix on its own.** |
| `discrim.sh`, `paired.sh`, `paired2.sh` | Run schedules, each with its pre-registration in a header comment written before the first run. |
| `vet-clean.log` | `go vet ./...` from a pristine unbuilt checkout at cc92735 — exit 1, ONE error, the web/dist abort. |
| `vet-server.log` | `go vet ./internal/server` — exit 1, the FOUR lock-copy findings the abort was hiding. |
| `raw-run-logs/` | Per-run `go test` output for the discriminator, both paired experiments, and the MultiStore verification. |
| `raw-run-logs-earlier-arms/` | Earlier arms: the superseded *sequential* discriminator, armC (refuted prediction), armD/armE (fix + widened window), probe output, pair/solo runs. |

## Reproducible from the branch, so not kept

`unfixed/` and `vetclean/` are cc92735. `fixed/` is the branch
`refs/preserve/mainred/fix-watchtasks-race-and-test-isolation` (faf1c8c). `armA/`/`armB/`
are cc92735 plus the 424-byte diff above. `web/dist` is `make build` (needs npm registry
access).

## Not reproducible — stated plainly

**The probe source is gone.** `zzprobe_test.go`, which measured the two facts underpinning
the `TestListUsers` mechanism — that a second store saw the first store's rows while both
were open (PHASE 2), and that the database survived until the last connection closed
(PHASE 4) — was deleted before commit. **Only its output survives**, in
`raw-run-logs-earlier-arms/probe1.log` and `probe2.log`.

That matters because Defect 2 is already the weaker half of the report: its mechanism is
measured but its exact failing interleaving was never reproduced, and my one prediction
about it was refuted. Anyone re-verifying Defect 2 will have to rewrite the probe from the
description in the report rather than re-run mine.
