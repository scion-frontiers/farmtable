# label-write-scope r8 — C-1 and the round-7 review backlog

Branch `label-write-scope-r8`, 8 commits off `1d4442f`.

Round 7 was reviewed by three independent legs; the security audit then produced
two addenda correcting itself twice. This round implements what they found: one
Critical, three other must-do items, four should-do items.

---

## C-1: the cross-list authorization bypass

`RestrictLabelWriteToSnapshot` narrowed a caller's label write against the
snapshot the authorization gate had priced. It filtered the add list and the
remove list **independently**. `applyLabelDelta` — the gate's prediction
function — is **remove-wins**. So a request naming the same label in *both*
lists was priced by the gate as "no change, charge nothing", and then the
restrictor kept the add and dropped the remove, and the free request applied a
terminal lifecycle label.

Because in this store the stage IS a label, that is an unpriced privilege change.

### The fix, and the general lesson

Fixed by **deriving rather than mirroring**:

```
after := applyLabelDelta(snapshot, add, remove)     // the gate's own function
emit the minimal (add, remove) carrying snapshot -> after
```

The restrictor's oracle *is* `applyLabelDelta`. There is no second copy of the
rule that can drift from the first.

The old docblock said "It is exactly the complement of applyLabelDelta … The two
must agree." That sentence was the bug: it asserted an invariant that nothing
enforced, and it read as a guarantee to everyone who came after. **A docblock
claiming two functions agree, with no mechanism making them agree, is a liability
rather than documentation.** This is the third time in this workstream that a
prose guarantee has substituted for a structural one (round 6's "cannot diverge"
comment was the second).

The same principle is why the audit missed C-1: its check reimplemented
`applyLabelDelta` instead of calling it, and the reimplementation had the same
blind spot as the code. **If your check mirrors F, your oracle must BE F.**

### Two findings that fell out of the redesign

- **Removals are now emitted in the snapshot's spelling, not the caller's.** This
  independently closes F-2. `labelNameToID` looks up
  `s.labelIndex[strings.ToLower(name)]`, and the index is built with
  `strings.ToLower(l.Name)` and **no `TrimSpace`**. A padded caller spelling
  therefore resolves to nothing and the removal silently evaporates. The
  snapshot's spelling is the only form guaranteed resolvable.
- **A dedup hazard, guarded.** If `ent.Task.Labels` ever carries two entries
  sharing a match key, `applyLabelDelta`'s dedup drops one and a naive derivation
  would emit a removal the caller never requested. The `removeKeys[key]` safety
  belt prevents it.

### Why both property pins ship

P1 (the write lands what the gate priced) and P2 (nothing returned is a no-op
against the snapshot) look redundant. They are not, and the measurement is stark
— 8192 triples per run:

| mutant | P1 failures | P2 failures |
|---|---|---|
| round-7 implementation (two per-list filters) | 3768 | 3768 |
| cross-list comparison uses `==` not `labelMatchKey` | 1920 | 1920 |
| case-blind (raw string) | 1536 | **0** |
| identity restrictor = the pre-A-4 production code | **0** | 8064 |

**P1 has zero failures against the exact code the fix replaced.** Its quantifier
is snapshot-relative, which is a structural blind spot, not an oversight in the
rows. P2 covers that half and is blind to the case-folding half. Neither
dominates. Shipping P1 alone would have shipped the original bug with a green
suite.

`labelMatchKey` in the cross-list comparison is load-bearing and now measured:
swapping it for `==` costs 1920 triples via case-split and pad-split.

---

## Stage ownership is now asserted at the writer

`writeLabelSwap` takes an explicit `stageWritePolicy`. `assertStageWriteAllowed`
**errors** on any label `authorizationStage` claims when the policy forbids stage
writes. Six call sites: stage arm, `ClaimTask`, and both caller-supplied
`add_labels`/`remove_labels` arms are allowed; the priority and type arms are
forbidden.

This is the structural backstop for the config-level check below — it holds for
every route into the writer, including those that never pass through `Validate`.

---

## The config layer: a key can capture a lifecycle label

`Validate` ran its collision check once per table and never compared keys
**across** `stages`/`priorities`/`types`. So `types: {duplicate: chore}` loaded
clean, put `duplicate` into `labelToType`, and made `TypeLabelSwap`'s remove loop
— which keys on `stripForMatch`, the same normalisation that maps our own
`ft:stage/duplicate` to `duplicate` — delete the issue's lifecycle label on every
type change.

`checkLifecycleKeyCollisions` rejects it, using `StageToLabel` and
`stripForMatch` themselves as the oracle.

Ships alongside the runtime assertion above, deliberately: the config check tells
the operator which line of their YAML is wrong at startup; the runtime assertion
is the backstop.

---

## Unvalidated `req.Type`

`UpdateTask(type=<arbitrary string>)` stripped the issue's type labels with no
validation anywhere. Reachable under `DefaultConfig()`, no operator config
required.

Fixed in two layers, and the split is the interesting part:

- **Destructive half in the store.** `TypeLabelSwap` returns `(nil, nil)` when the
  new type maps to no label and the type is non-empty. `TypeToLabel` had nothing
  to add; the remove loop ran anyway.
- **Shape half at the RPC boundary.** Blank-but-not-empty and >128 runes rejected.

**No allow-list, on purpose.** There is no set of valid types the server can know:
the Ent schema declares `field.String("type")` so native collections can use
arbitrary types, and on a GitHub collection the valid set is the operator's
`github.labels.types`. Validation belongs where the knowledge is — which is why
the destructive half is fixed in the store and not the server.

---

## Configuration loading is no longer silent

`DefaultConfigPath` is **relative**. A server started from an unexpected working
directory found no file, loaded `DefaultConfig` — correct behaviour for a
genuinely absent config — and said nothing. Since B6 the `push_prefix` in that
file decides which labels may feed an authorization answer, so this was M-1
disarmed again by the working directory alone.

`LoadConfigWithSource` now reports the resolved **absolute** path, whether the env
var overrode it, and whether a file was read; `farmtable-server` logs it. Not
fatal — a missing file is the documented way to ask for the defaults — but never
again silent.

Generalisable: **a security parameter that can silently take a value the operator
did not write needs a startup line, even when the fallback is correct behaviour.**

---

## Lessons about measurement

Three of this round's own measurements were wrong before they were right. All
three were caught by a discipline rather than by luck, which is the only reason
they are in this log instead of in the next round's review.

1. **A pin caught a defect in my own fix as I wrote it.** `validateTaskType` had
   been wired into `UpdateTask` and into `ListTasks` — a read-only *filter* —
   leaving `CreateTask` and `InsertTasksAfter` unvalidated: the same
   two-of-three shape as the original finding. RED on exactly those rows.

2. **A mutant that does not compile measures nothing.** One mutation exited 1
   with *zero* failing tests, because deleting the code left an import unused. An
   exit code alone would have scored it as killed. **Check the failure count, not
   just the exit status.**

3. **Reconstructing the artefact you are measuring is the same error class as
   reimplementing the function you are checking.** I first measured the round-7
   version of a test using a reconstruction of it and reported the wrong result.
   Extracting the real file from `1d4442f` reversed the finding — see below.

Also: **commit before running mutation experiments.** A `git checkout --` in one
of my own scripts destroyed an entire uncommitted change. Every matrix in the
report was subsequently run against a committed tree with `git diff --quiet`
asserted after each revert.

### Mutants that survive are findings

Two survived. Both were reported as survivors rather than dropped:

- One revealed a **weak control**: the stage-alias rows meant to protect the
  `stages` exemption used keys that never exercised it. Strengthened, now RED.
- One is **genuinely equivalent** and cannot be killed: the hardcoded-prefix form
  of the collision check is equivalent by construction, so no config separates it
  from the derived form. The derived form is still correct to prefer — it is
  robust to a change in either function's spelling — but that is a *structural*
  argument, not a measured one, and the code comment now says so. The equivalence
  itself is pinned so that the day it stops holding is a test failure.

---

## Where the incoming review was wrong

Recorded because the next round will read these documents as ground truth.

- **"`TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel` is vacuous — it
  cannot fail."** Half right. Its fixture did issue zero label writes under a
  correct implementation. But reintroduce the F7 defect it was written for and
  the old test goes **RED** — the defect is what creates the write.

  | defect | round-7 test | round-8 test |
  |---|---|---|
  | swap ignores ownership when removing | **RED** | RED |
  | stage swap emits nothing at all | **GREEN** | RED |

  The real gap was narrower: it could not distinguish "declined to delete" from
  "issued no write at all". Acting on the word *vacuous* would have deleted a
  test that was carrying real coverage. **"Cannot fail" is a claim that has to be
  measured against the specific defect, not inferred from the fixture.**

- **The `CloseTask` call site does not exist.** `CloseTask` never routes through
  `writeLabelSwap`; it kept its own inline best-effort swap that swallows errors
  on purpose.

- **The caller-supplied `add_labels`/`remove_labels` arms are priced** by the
  server's label-delta gate and must keep stage-write permission. Forbidding them
  breaks 10 server tests.

---

## Baselines confirmed

- `go vet ./...` still exits 1 on exactly 4 pre-existing copylocks in
  `internal/server/server.go`, **same messages**, same four RPCs, uniform `+45`
  line shift from this round's additions. No new findings.
- `TestWatchTasks*` flakiness is real but needs genuine CPU contention: 0 failures
  in 24 ordinary full-suite runs, 4 of 6 batches RED under 6 concurrent
  `-count=20` runs. All failures are 5.00–5.02s timeouts. **The identical rate at
  base `1d4442f`** confirms it is pre-existing and untouched by this work.
