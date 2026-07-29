# dev-194-oracle — RED oracles for the three label-write pricing defects

Work item #194 (close-label-swap), hardening leg 6 of 6.
**Tests only. No production file is modified. No remedy is chosen.**

---

## 0. Base, population, and path filter

| Field | Value |
|---|---|
| `ROOT` | `/workspace/farmtable-194-oracle` (private clone, made from the local path `/workspace/farmtable`, never the network remote) |
| `BASE` | `2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e` = `refs/preserve/194-r11/branch` |
| Branch | `hardening/194-pricing-oracles` |
| `DIST` | **absent** (`web/dist` does not exist; nothing was created, cleaned or deleted) |
| Path filter | `ROOT` is a fresh clone and contains **no** `.claude/worktrees/`. Every count below has a denominator of exactly one checkout, not five. |

### The zero-package trap, measured

```
naive  go list ./...     ->  0 packages     <- a vet run over this is
                                               indistinguishable from a clean one
       go list -e ./...  -> 32 packages     <- DENOMINATOR used throughout
```

`assets.go:5` is `//go:embed all:web/dist`. With `DIST=absent` the pattern fails
to expand and `go list` reports nothing at all. **Every figure in this report
uses the 32-package denominator from `go list -e`, iterated one package at a
time.**

### Verification, stated against that denominator

`go vet`, per package, 32 packages:

```
VET RESULT: 27 clean / 5 failing, of 32 packages
```

The 5 are both pre-existing and both disclosed in the brief:

* **4 packages** (`farmtable`, `cmd/farmtable-server`, `cmd/ft`, `internal/cli`) —
  `assets.go:5:12: pattern all:web/dist: no matching files found`. This is the
  `DIST=absent` embed, EM-CI's item. Not mine.
* **1 package** (`internal/server`) — the four pre-existing **copylocks**
  findings. On this base they sit at `server.go` 1782 / 1892 / 2100 / 2277, in
  `GetReadyTasks`, `GetBlockedTasks`, `GetCriticalPath`, `GetBottlenecks`. Not a
  regression, not mine, nothing reverted over them.

**Near-miss control** — `internal/server` vetted with my file removed and then
restored produced **byte-identical** output both times, so the oracle file
contributes zero vet findings.

`go test`, per package, 32 packages:

```
PASS=27   TESTFAIL=1   BUILDFAIL=4   DENOMINATOR=32
```

The 4 build failures are the same `all:web/dist` packages. The 1 test failure is
`internal/server`, and it is **only** the oracles below: that package runs
**971** test functions, of which exactly **4** fail, all four mine and all four
intended.

### Correction to the brief, verified independently

The brief's original instruction to branch from `faf1c8c` was withdrawn, and I
confirmed the reason rather than taking it on trust. Files containing each
symbol, counted on each commit:

| symbol | on `faf1c8c` | on `2cbbd92` |
|---|---|---|
| `SameStageSet` | 0 | 8 |
| `LabelDeltaLifecycleStages` | 0 | 14 |
| `RestrictLabelWriteToSnapshot` | 0 | 7 |
| `assertStageWriteAllowed` | 0 | 6 |

Confirmed also: there are **three** `store.SameStageSet` gate sites in
`internal/server/server.go`, owned by `CreateTask`, `InsertTasksAfter` and
`UpdateTask`.

---

## 1. The gate-site table, and why it is a table

All three oracles are driven from one table, `pricingGateSites`, whose rows are
the gate sites **addressed by the RPC identifier that owns them** — never by
line number.

`TestPricingGateSiteCensus` parses `server.go` with `go/ast`, collects every
`store.SameStageSet` call and the function enclosing it, and asserts that set
equals the table. Consequences:

* A **fourth** gate site fails the census and has to be added as a row with a
  reachability verdict. It cannot be rediscovered a round later.
* The census counts calls in the file under test, so it **cannot be inflated**
  by other checkouts on disk.
* A row whose exploit is unreachable is a **verdict, not a deletion**:
  `CreateTask` and `InsertTasksAfter` carry `removalReachable: false`, and
  `assertRemovalUnreachable` pins the structural reason by checking the proto
  descriptors for a `remove_labels` field. If one is ever added, the row fails.

`TestPricingGateSiteCensus` **PASSES** — it is a pin, not an oracle.

---

## 2. DEFECT 1 — REVIEW-194-R11-C1 (Critical). Stage removal priced at zero.

### Security property asserted

> A caller holding only `task:write` must not be able to remove a lifecycle
> stage from a task.

The oracle deliberately does **not** assert *which* scope should be charged.
That is the architect's ruling, and an oracle that named a price would have to
be rewritten by it.

### Why the docblock's theorem does not save the gate

The theorem on `LabelDeltaLifecycleStages` is *true* and its conclusion
(`"Nothing here can be cheaper than what shipped"`) does not follow, because
what shipped charged nothing here either. **The theorem quantifies over the
inner cross-product loop; the defect is in the outer `if`.** `SameStageSet` is
an equality test, equality is not monotone, and the union that makes the price a
superset can push `AFTER` back onto **exactly** `BEFORE` — the one value that
costs nothing.

### The vector — on stock defaults, no config trickery

Issue labels `[ft:stage/completed, ft:stage/wont_fix]`; edit removes
`ft:stage/wont_fix` and adds the markerless `stage/wont_fix`, which this
deployment does **not** honour:

```
BEFORE      [completed wont_fix]   read view over the raw labels
base AFTER  [completed]            <- the deployment REALLY loses wont_fix
union AFTER [completed wont_fix]   <- the claim arm canonicalises the addition
                                      "stage/wont_fix" -> "ft:stage/wont_fix"
price       FREE
```

### RED output

```
--- FAIL: TestPricingGate_UnprivilegedCallerCannotRemoveALifecycleStage (0.01s)
    --- PASS: .../CreateTask (0.00s)
    --- PASS: .../InsertTasksAfter (0.00s)
    --- FAIL: .../UpdateTask (0.01s)
        SECURITY PROPERTY VIOLATED — an unprivileged caller removed a lifecycle stage for free.
          gate site:   UpdateTask
          scopes held: [task:read task:write task:claim collection:read]  (task:accept and task:close deliberately absent)
          edit:        remove [ft:stage/wont_fix], add [stage/wont_fix]
          stage set:   [completed wont_fix] -> [completed]   (wont_fix present after? false)

        The masked-removal vector pushed the union AFTER back onto BEFORE, SameStageSet
        reported no transition, and the outer if skipped the whole cross-product charge.
        The monotonicity theorem on LabelDeltaLifecycleStages quantifies over the inner
        loop and does not constrain this.

        THIS ORACLE DOES NOT SAY WHAT THE PRICE SHOULD BE. It says a bare task:write
        holder must not complete this write.
        IMPACT CONFIRMED: wont_fix is gone from the authoritative stage set. This is a
        real privilege change, not a no-op that returned success.
```

**Per-site RED verdict:** `UpdateTask` RED. `CreateTask` and `InsertTasksAfter`
PASS as *reachability verdicts* — both price additions against a task that does
not exist yet, so `BEFORE` cannot lose an element, and both are pinned so the
verdict fails if a `remove_labels` field ever appears.

### Mutation arms

| # | Mutation | Expected | Observed |
|---|---|---|---|
| M1a | Remove the equality short-circuit at the `UpdateTask` site only | oracle GREEN | **GREEN** — mutant killed |
| M1b | Make `SameStageSet` order-insensitive (a true set comparison) | oracle still RED | **still RED** |

M1a proves the oracle is wired to the actual control rather than to something
incidental. M1b proves D1 is **not** an artefact of D2.

---

## 3. DEFECT 2 — `SameStageSet` is order-sensitive despite its name. Merge-blocking.

`store.SameStageSet` compares elementwise. Its docblock licenses this with *"Both
are produced in a deterministic order by the same function"* — but **on the write
path they are not**. `BEFORE` comes from `AllTerminalLabelStages`, which emits a
canonical order. `AFTER` comes from `unionStages`, which preserves its first
argument's order and **appends** anything only the second names. So the position
of a restored element depends on which stage was removed.

### RED output

```
--- FAIL: TestSameStageSet_IsOrderSensitiveDespiteItsName (0.00s)
    store.SameStageSet([completed wont_fix], [wont_fix completed]) = false.

    These name the SAME SET. A function called SameStageSet that answers false for a
    permutation is an elementwise comparison wearing a set comparison's name, and it is
    consumed at 3 authorization gate sites in internal/server/server.go.

--- FAIL: TestPricingGate_AuthorizationDoesNotDependOnCanonicalStageOrder (0.01s)
    THE AUTHORIZATION OUTCOME IS DECIDED BY CANONICAL STAGE ORDER.

      mask wont_fix  (canonically LAST)  -> ALLOWED (free)
      mask completed (canonically FIRST) -> PermissionDenied: missing required scope "task:close"

    Same edit shape, same scopes, same number of stages removed, and the only difference
    is where unionStages appended the restored element.
```

Two writes of identical shape and identical set semantics, **opposite
authorization outcomes**, decided purely by canonical stage position.

### Blast radius: three gates, not one

All three sites in `pricingGateSites` consume this same `SameStageSet`. Any
upstream reordering — the stage declaration order, the union's append position,
a `sort` added to a mapper — is an **undeclared authorization change at every one
of them**.

### Can a real caller control the order? — YES, with a qualification

**Yes.** The caller controls the order of `AFTER` relative to `BEFORE` by
choosing *which* stage to mask, which selects the union's append position. That
is a caller-controlled authorization input.

**But it does not give D1 a second trigger that avoids removing a stage.** I
searched for one and found none: a pure addition can only grow `AFTER`, and a
grown `AFTER` is never equal to `BEFORE`, so the bypass direction still requires
a removal. What the ordering gives the caller is the **choice of which removals
are free**, and what it gives any upstream refactor is the power to flip that
choice silently.

### Mutation arm — and a warning for the architect

| # | Mutation | Expected | Observed |
|---|---|---|---|
| M2a | Make `SameStageSet` order-insensitive | D2 oracles GREEN | **both GREEN** — mutants killed |

**⚠ THE OBVIOUS D2 REMEDY MAKES THE SECURITY HOLE WORSE.** With `SameStageSet`
made a genuine set comparison, I re-measured both rows:

```
mask_wont_fix  (canonically LAST)   before=[completed wont_fix] after=[completed wont_fix]  SameStageSet=true  price=FREE
mask_completed (canonically FIRST)  before=[completed wont_fix] after=[wont_fix completed]  SameStageSet=true  price=FREE
```

The `mask completed` case went from **`task:close`** to **FREE**. Fixing D2 in
isolation does not close D1 — it *widens* it from one stage to both, and D1's
oracle stays RED throughout (M1b). **D2 must not be remedied on its own.**

---

## 4. DEFECT 3 — live over-denial at `InsertTasksAfter`. Merge-blocking.

### LIVE ON `faf1c8c` (main)? — **NO.**

Explicit answer, as requested. Verified two ways:

1. The symbols do not exist on `faf1c8c` at all (table in §0).
2. An independent read of `faf1c8c:internal/server/server.go` found **zero**
   label-keyed authorization gating in all three RPCs. All authorization there
   is keyed on the typed `req.Stage` enum. In `InsertTasksAfter` the per-step
   loop validates only name, description and priority, and copies
   `Labels: step.GetLabels()` verbatim into `CreateTaskParams`. **There is no
   denial mechanism on main for this defect to over-fire.**

**D3 is introduced by the r11 diff and dies with r11. It costs us nothing if r11
is dropped.**

### The defect

The `InsertTasksAfter` site does not price — it **rejects** — and it decides what
to reject using `LabelDeltaLifecycleStages`, whose `AFTER` arm is the wide claim
view. That view canonicalises the caller's additions, so a bare `duplicate`
becomes `ft:stage/duplicate` and reads as a lifecycle statement.

`duplicate` is a **stock GitHub default label, shipped on every new repository.**
The existing r11 pin `TestInsertTasksAfter_RejectsLifecycleStageLabels` has an
`ordinary_label_reaches_the_store` arm, but its ordinary label is `"bug"`, which
the claim view does not recognise. One sample, and it missed the class.

### RED output

```
--- FAIL: TestInsertTasksAfter_DoesNotOverDenyStockGitHubLabels (0.02s)
    --- FAIL: .../duplicate (0.00s)
        OVER-DENIAL — a legitimate operation was refused.
          label:  "duplicate"  (a GitHub stock default label)
          answer: InvalidArgument: steps[0].labels: [duplicate] names a lifecycle stage
                  ([accepted duplicate]). InsertTasksAfter creates every step in triage and
                  has no authorization gate for a stage transition, so it will not accept a
                  label that sets one. Create the task and move it with UpdateTask, which
                  prices the transition
    --- PASS: .../wontfix        --- PASS: .../invalid       --- PASS: .../bug
    --- PASS: .../enhancement    --- PASS: .../question      --- PASS: .../documentation
    --- PASS: .../good_first_issue                           --- PASS: .../help_wanted
```

**1 of 9** stock labels is refused. The other 8 return `Unimplemented` — they got
*past* the control and were refused by the pass-through store. That 8/9 split is
the built-in non-vacuity evidence: this oracle is discriminating, not a blanket
assertion that everything should be allowed.

The remediation advice in the error text (*"move it with UpdateTask"*) does not
apply, because the label was never a lifecycle statement in this deployment.

### Mutation arm

| # | Mutation | Expected | Observed |
|---|---|---|---|
| M3a | Disable the `InsertTasksAfter` rejection block | oracle GREEN | **GREEN** — mutant killed |

M3a also turns the **existing** r11 control
`TestInsertTasksAfter_RejectsLifecycleStageLabels` RED. That is a second finding
worth the architect's attention: **the trivial D3 remedy — deleting the gate —
re-opens round 7's M-2.** D3's remedy has to *narrow the predicate*, not remove
the gate.

---

## 5. Scope statement

* **No production file was modified.** `git diff 2cbbd92 -- internal/server/server.go
  internal/store/store.go internal/platform/github/` is empty. All mutations
  above were applied to a scratch copy, measured, and reverted; the reverts are
  verified by that empty diff.
* **No remedy is chosen.** Every oracle asserts a property a remedy must satisfy,
  never a price. The pricing ruling is the architect's and cannot invalidate
  these tests.
* Every file was staged by explicit path. No directory or glob pathspec, no
  `-A`, no `-u`, no `commit -a`, no `stash -u`. Nothing pushed.
* `web/dist` was not created, cleaned or deleted at any point.
* `TestWatchTasks*` did not fail on any run in this report.
