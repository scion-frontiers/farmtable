# Pre-registration: runner canaries for C-1 and R-1

Written **before** the runner executes. Nothing below may be edited after the first run.

**Bundle:** `/scion-volumes/scratchpad/projects/farmtable/transfer/review-canaries.bundle`
(1.8M, self-contained — contains `43bd206`, so it clones standalone).

| Branch | SHA | Parent | Delta vs 43bd206 |
|---|---|---|---|
| `canary/c1-gitkeep-untracked` | `f410023361645f1bfb2b4499124c84d1f91abd4d` | `43bd206` | `D web/dist/.gitkeep` (one deletion, nothing else) |
| `canary/r1-tskip-defeats-membership` | `930fdb119e870cedd7263490d5cf72b50dda2b66` | `43bd206` | `M internal/server/watch_test.go` (`+ t.Skip("in a hurry")` in `TestWatchTasks_CreatedEvent`, one line) |

Round-trip verified: clone from the bundle reproduces both SHAs, `--porcelain` empty,
`43bd206` present as a commit object, and `go list ./...` on `f410023` returns **0 packages**.

---

## Control run required first

**Ask:** confirm a green runner record exists for `43bd206` itself. If there is none, run it as
branch three. Without a baseline green from the same runner, a red on either canary is
uninterpretable — the positive-control rule applied to this experiment rather than to the code.

---

## Branch 1 — `canary/c1-gitkeep-untracked` @ `f410023`

**What it tests:** the *detection* claim only — given a commit whose clean clone does not
compile, does the gate suite notice? It does **not** test how one arrives at such a commit;
the vite-deletion mechanism is a separate, already-measured fact.

### Predicted outcome: GREEN, with these specific step outputs

Pre-registering the outputs, not just the colour, so a green for the *wrong* mechanism is
still detectable:

1. `Assert web/dist holds no build output before the build` → passes, printing exactly
   `OK: web/dist does not exist on a clean checkout.` (the `ci.yml:122-125` arm).
2. `Build` → succeeds.
3. `Assert web/dist has real build content` → passes, printing
   `web/dist: 4109 files, 1 hashed js, 1 hashed css` (±churn on the file count).
4. `Lint (go vet)` → passes.
5. `Go test membership` → `OK: all 501 manifest tests executed.`
6. Job conclusion: **success**.

### What each colour means

- **GREEN with those outputs ⇒ C-1 confirmed.** The gate suite certifies a commit that cannot
  be compiled from a clean clone. Act on the fix.
- **GREEN with *different* outputs — in particular if step 1 prints the `stray` branch or the
  tracked-files branch instead ⇒ my mechanism is wrong even though the colour matched.** Treat
  as inconclusive and tell me; I modelled the wrong arm.
- **RED at step 1, 2, 3, 4 or 5 ⇒ C-1 is REFUTED and must be downgraded.** Something on the
  runner catches this that I did not model. Send me the step and its log; I will retract.
- **RED anywhere else** — `Check out`, `Set up Go`, `Set up Node`, `Install web dependencies`,
  `Which JS suites will actually run`, `Web tests`, `Upload`, `Makefile self-check` —
  **refutes nothing.** Those are unrelated to the claim (network, cache, flake). Re-run.

Both colours do **not** confirm me: a red at steps 1–5 kills the finding outright.

---

## Branch 2 — `canary/r1-tskip-defeats-membership` @ `930fdb1`

**What it tests:** whether the membership gate distinguishes "ran" from "was skipped".

### Predicted outcome: GREEN, with these specific step outputs

1. `Go tests (invoked directly)` → passes; log contains
   `--- SKIP: TestWatchTasks_CreatedEvent`.
2. `Go test membership` → `package-qualified Go tests executed: 501`,
   `go test failure lines matched: 0`, and
   **`OK: all 501 manifest tests executed.`** — while `TestWatchTasks_CreatedEvent` did not run.
3. No `::error::` and no `::notice::` from that step.
4. Job conclusion: **success**.

### What each colour means

- **GREEN with those outputs ⇒ R-1 confirmed.** The gate emits a true-sounding, false
  certificate.
- **RED at `Go test membership` with `TestWatchTasks_CreatedEvent` listed under
  `Go tests listed in the manifest DID NOT RUN` ⇒ R-1 is REFUTED.** Send it; I will retract.
- **RED at `Go test membership` with `(unterminated)` rows ⇒ refutes nothing about R-1, and is
  a NEW finding.** It would mean the awk's per-package-contiguity assumption in `ci.yml:294-319`
  is sensitive to the runner's CPU count / `-p` parallelism in a way my machine did not
  reproduce. If that happens, re-run the `43bd206` control: if the control reds the same way,
  the parser is fragile on the runner and that outranks R-1.
- **RED at `Go tests (invoked directly)` ⇒ wrong-reason red.** Skipping
  `TestWatchTasks_CreatedEvent` would have to have destabilised a sibling test through shared
  state. Off-runner the full suite exits 0 with the skip in place, so I do not expect it.
  Inconclusive; send me the failing test.
- **RED anywhere else ⇒ refutes nothing.** Re-run.

---

## Standing measurement note

All off-runner results cited in the review were produced by **reading only committed objects**:
fresh clones of `43bd206` and of the four canary commits, each with `git status --porcelain`
empty. The single tree-shaped leg (what `npm run build` does to `web/dist/.gitkeep`) is
irreducibly a statement about a build, not about a commit; its input was a fresh clone of
`43bd206`, and its consequence was re-measured as commit `f410023`. Restating it in the
coordinator's third clause: **the guarantee is not that nothing was written — it is that
nothing uncommitted was read.**
