# Label Write Scope R9 — Code Review (#194 round 9)

Date: 2026-07-28
Role: Code reviewer (correctness & architecture leg, 1 of 3 independent legs)
Branch: `label-write-scope-r9`
Workspace: `/workspace`
Base: `158c8ae963faa5eef032e0857ecbc40d6a7c681a`
HEAD reviewed: `06f01d7d6555a311fcd0728eac40335e654c1de6`
Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r9.md`

## Verdict

**REQUEST CHANGES**, on one Required finding. Risk level MEDIUM. The round is good
work — the MUST 4 proof is correct, the property sweeps have real vacuity guards, and
the author's self-corrections are accurate.

## Gates (child-process exit codes, no pipes; verified on the restored tree)

| gate | result |
|---|---|
| `go build ./...` | 0 |
| `go test ./...` | 0, zero FAIL lines |
| `go vet ./...` | 1 — the same 4 copylocks, compared by **message and line**, not count |
| `git status --porcelain` | empty, before and after every probe |

No `TestWatchTasks` flake fired in either full-suite run.

## Findings

| id | severity | subject |
|---|---|---|
| R1 | **Required** | MUST 5(a) makes the write-side backstop depend on `enabled`, contradicting the round-9 ruling |
| O1 | Optional | MUST 4's mutant recipe does not reproduce as written (the claim it supports is nonetheless true) |
| O2 | Optional | `stageWritePolicy` sentinels moved `const` → `var`, i.e. mutable package state |
| F1 | FYI | "`enabled=false` removes lifecycle-label AUTHORITY entirely" is false — `hasExternalUnavailableLabel` is a counterexample |
| F3 | FYI | Harmless empty-key asymmetry between `applyLabelDelta` and `removeKeys` |

### R1 in one paragraph

`authorizationStage` serves both the read side and — at `passthrough.go:311`, inside
`assertStageWriteAllowed` — the **write-authorization** side. MUST 5(a)'s `!m.enabled`
guard therefore applies the toggle to a write-side control, which is exactly what the
round-9 ruling says must never happen. Measured: at `enabled=false` the backstop returns
`nil` where it previously refused, and `labelToStage` is fully populated (10 entries) at
both toggle settings, so the new guard is the sole cause. It is unreachable today — both
`stageWriteForbidden` call sites are fed by swaps that short-circuit to empty lists when
disabled, which I verified with positive controls — so this is latent, not live. It blocks
because the adjacent comment instructs the next author to propagate the inversion, and
because the natural r10 fix for the open finding would be born disarmed. Remedy: split into
a toggle-blind `lifecycleLabelClaim` (write side) and a toggle-respecting
`authorizationStage` (read side) sharing one body.

## Method notes worth keeping

- **Reconstruct, do not observe.** Every claim I relied on from the author's report was
  re-measured. Three of his claims reproduced exactly (the one-test mutation kill, the
  empty-list short-circuit, the `false`-is-now-a-compile-error arm). One did not (O1).
- **The mutation that mattered most was the one that failed to reproduce.** Taking MUST 4's
  comment literally produced 0 P4 failures, not 128. Chasing that discrepancy is what
  established both that the comment is unreproducible *and* that its underlying claim is
  true — via a different mutant I had to construct myself.
- **Predicted-and-missed, recorded:** I predicted `labelToStage` would hold the key
  `"stage/completed"`; it holds `"completed"`, because `stripForMatch` strips the `stage/`
  segment. My probe reported `false` and I nearly read it as "the table is empty when
  disabled" — the opposite of the truth, and it would have inverted R1's diagnosis. Corrected
  by re-probing with the right key and a table-size readout.
- **Negative claims carry positive controls.** The `enabled=false` empty-list result is
  paired with an `enabled=true` arm showing non-empty lists, or it would only have shown that
  my fixture was inert.
- All probes reverted by snapshot restore from `/tmp/snap` (never `git checkout`), with
  `git status --porcelain` asserted empty afterwards.

## Brief errors reported

Nine, listed in the full report — the material ones being that the range contains **seven**
commits rather than the stated six (the project-log commit is omitted from the table but
counted in the totals), that the per-file `+N` figures are `--stat` totals rather than
additions, and that "MUST 5 is the only real behavioural change" overlooks `3675bb9`'s
`stageWritePolicy` type change. Brief item 2's framing would also have found nothing: it
asks for accessors with their own `enabled` guard, whereas the residual risk in this package
is an accessor with **no** guard.

## Open item touched but not re-litigated

The Unicode case-folding collision is real and confirmed: U+212A KELVIN SIGN collides with
`k` under `labelMatchKey`, and `working` is a stage name containing `k`. Per instruction,
named and stopped. U+200B and NFC/NFD were checked and are *not* collision sources — they
yield distinct keys and fail closed.
