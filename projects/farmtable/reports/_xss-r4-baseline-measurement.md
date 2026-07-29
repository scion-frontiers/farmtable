# SHARED BASELINE MEASUREMENT — xss r4

**Consumable by all three r4 legs. Do not re-run this. Cite it.**

SHA: `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1`
Clone: the `review` leg clone (all three clones built from one loop, verified to the same
SHA with the same hand-copied `web/dist` + `web/node_modules`)
Measured by: EM (`farmtable-em-task-state-model-v2`), serialized, nothing else building
Tree state at every measurement below: `HEAD = e6bda716…`, `git status --porcelain` = **0 lines**

---

## READ THIS BEFORE YOU CONSUME THE GREEN

**An unvalidated green and a validated green look identical. Only this section
distinguishes them.**

Round 4 is the round that made `make test` execute the web guard suite at all. So a
baseline produced by `make test` is **a measurement produced by the instrument under
review**. *Nothing downstream of X can falsify X.* Therefore the gate was validated
**before** these samples were published, not after, and the validation is attached here so
that no leg can receive the green without also receiving the evidence that the gate can go
red.

**You may cite the green as "the gate is green at `e6bda71`." You may NOT cite it as
evidence that the gate WORKS — cite section V for that, and note its limits.**

---

## V. INSTRUMENT VALIDATION — done first, at 23:57Z

**Method.** Inject a break into a web guard test, run `make test`, read `$?` **directly**
(no pipe — `cmd | tail` reports `tail`'s exit code). Then restore and re-assert green.

**The break was deliberately COUNT-NEUTRAL**, and this matters. `web/src/util/assertions`
carries `EXPECTED_ASSERTIONS = 380`, a count pin. *Appending* a failing test would have
changed the assertion count, so the RED could have come from the count-pin arm rather than
from the assertion arm — **a positive control that trips a different arm than the one it
guards is the recurring defect on this project.** So instead one existing row was corrupted
in place, holding the row and assertion count fixed:

```
web/src/util/safe-url.test.ts:54
-    ['javascript', 'javascript:alert(1)'],
+    ['javascript', 'https://example.com/'],
```

**Result — RED, and the correct arm fired:**

```
make_test_exit_BROKEN = 2          <- read from $? directly

Error: safeHref("https://example.com/") should be undefined for "javascript",
       got "https://example.com/"
  at testRejectsUnsafeSchemes (.tmp-test/util/safe-url.test.js:108:9)

#assertions 1
#assertions 157
#assertions 10
FAIL: 1 of 4 test file(s) failed:
  src/util/safe-url.test.ts (exit 1)
```

**Arm attribution:** the failure is the `testRejectsUnsafeSchemes` **assertion**, named at
its own source line. The count pin never evaluated — the broken file reported
`#assertions 1` and exited before reaching its total. So the RED is the assertion arm and
**not** the count-pin arm. That is the arm we wanted.

**Restore, and re-assert GREEN:**

```
git checkout -- web/src/util/safe-url.test.ts
dirty_after_restore = 0
git diff --stat e6bda71 = empty
make_test_exit_RESTORED = 0
PASS: 4 test file(s), 380 assertions.
```

**WHAT THIS VALIDATION DOES AND DOES NOT ESTABLISH.** It establishes that a failing
assertion inside an *already-enumerated* web test file propagates to a non-zero `make test`
exit. It does **NOT** establish that a *new or renamed* test file is discovered, that a
file which fails to compile is distinguished from one that passes, or that the gate runs in
any environment other than this one. **Those are open items and they belong to the test
leg (T1).** Do not let this section close them.

---

## Gate results

| gate | sample 1 (23:45Z) | sample 2 (23:55Z) | provenance |
|---|---|---|---|
| `go build ./...` | **0**, no output | **0**, 0 output lines | EM-MEASURED |
| `make test` | **0** — `PASS: 4 test file(s), 380 assertions` | **0** — same | EM-MEASURED |
| assertion split | 9 / 204 / 157 / 10 | 9 / 204 / 157 / 10 | EM-MEASURED |
| `go test -count=1 ./...` | — | **0**, 10 ok, 0 cached, 0 FAIL | EM-MEASURED 23:55Z |
| `git status --porcelain` | 0 | 0 (and 0 after validation) | EM-MEASURED |

Sample 1 is retained as valid retroactively, and here is the **condition I checked rather
than assumed**: the instrument was unchanged between the two samples — same SHA
`e6bda71`, `git status --porcelain` = 0 at both, and `Makefile` last touched by `2f6500f`
(in-diff), with no working-tree edit since. Both samples measure the same instrument.

---

## THE CACHE TRAP — why "run it twice" nearly bought nothing

You were promised two samples because of the flake. **Sample 2's Go half came back
`(cached)` on 10 of 10 packages.** Go caches test *results*, so a second `make test` at an
unchanged SHA re-runs nothing on the Go side.

**A cached green cannot flake.** So two `make test` runs is **one** Go sample, and the
error is silent and in the flattering direction — the "twice-run" mitigation for a flake
that lives in `TestWatchTasks_*` (Go side) would have been defeated by the cache while
still reporting two runs. The web half is not result-cached, so *it* genuinely got two
samples.

The real second Go sample was therefore taken with `go test -count=1 ./...`:
**exit 0, 10/10 ok, `(cached)` count = 0, FAIL count = 0.**

**Rule for anyone re-running anything on this project: `-count=1` or it is not a sample.**

## Suite cost, which is not where you think

Per-package timings from the uncached run:

```
cmd/farmtable-server 0.009s   internal/cli        0.022s   internal/decomposer 0.009s
internal/mcp         0.010s   platform/beads      0.016s   platform/github     0.021s
internal/server      0.603s   internal/serverapp  0.031s   internal/store      0.778s
internal/streaming   0.910s
```

Positive control on that implausibly small total: `internal/server` really does hold
**214 test functions** (`go test -list '.*' | grep -c '^Test'`), and **14 `TestWatchTasks_*`
functions are defined**, so the fast number is not a suite that failed to run.

**The whole uncached Go suite is ~2.4s of test time.** The expensive resource on this
project is **COMPILATION**, not test execution — and each leg container has its own cold
`GOCACHE`, so the cost is *per container, on first build*. That is worth knowing when you
scope a run request: **your first build is the expensive one; everything after it is
cheap.** Ask for the first one, then batch the rest.

## The flake, restated against this measurement

`TestWatchTasks_*` — five tests at ~4.5%, Wilson CI [2.39%, 8.33%]. **Neither uncached
sample showed a failure**, which is consistent with a ~4.5% rate and is **not** evidence the
flake is gone. It is also load-sensitive, and the load is EM parallelism — which is now
capped at one builder. Run mutation rows at least twice, with `-count=1`, and say so.

## Not measured here

`go vet ./...` (expected 1 — four pre-existing copylocks, message `assignment copies lock
value to ephReq`; **the literal string `copylock` does not appear**),
`gofmt -l`, and any container build. Ask if you need one.
