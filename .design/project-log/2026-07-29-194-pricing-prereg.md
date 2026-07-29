# #194 Pricing — PRE-REGISTERED EXPECTED RESULTS

Written by `dev-194-pricing` BEFORE the run that settles them. Adopted from
test-xss-r8's per-arm prediction table, per EM instruction 2026-07-29T14:45:52Z.

The point of this file is that it cannot be quietly reconciled afterwards. Any
row where the observed result differs from the prediction below is REPORTED AS A
FINDING, including — especially — rows where I was wrong in the direction that
flatters my diagnosis.

## Artefact under measurement

Named explicitly, per EM instruction 1 (a fresh checkout proves you measured the
commit, not that you measured the right thing):

- **ARTEFACT:** the Go test binaries for packages `internal/server` and
  `internal/platform/github` in the `farmtable` module.
- **NOT** `ft dashboard` (Dockerfile), **NOT** `farmtable-server`
  (Dockerfile.server, the binary deploy logs show is live). No claim in this
  file is about a container, a deployed service, or a shipped image. The gate
  code these tests exercise is compiled into `farmtable-server`, but I have
  measured the package, not the image, and I do not claim the image.
- **COMMIT:** `2ffc22a` (`refs/preserve/194-oracle/branch`), base `2cbbd92`
  (`refs/preserve/194-r11/branch`). Not main. Main is `43bd206` and does not
  contain these symbols at all.

## Table A — the new directional oracle, at 2ffc22a

`TestLabelWritePrice_ChargesBothDirectionsInOneBuild`, package `internal/server`.

| arm | prediction at 2ffc22a | why |
|---|---|---|
| `departure_is_charged` | **RED** (`err == nil`, write allowed) | claim view restores the departed stage to AFTER; difference collapses to empty |
| `entry_under_a_foreign_prefix_is_charged` | **GREEN** (`PermissionDenied`) | the config-blind union is present and load-bearing on the entry side |

A RED departure arm and a GREEN entry arm IS the intended initial state. If the
entry arm comes back RED at 2ffc22a, my claim that the union is load-bearing is
wrong and the whole directional diagnosis needs re-deriving, not patching.

Premise guards that must NOT fire (if one does, the fixture is wrong and the
result is void, not favourable):

- departure arm: `f.lifecycleStages(t)` must resolve to exactly 2 stages.
- either arm: a non-`PermissionDenied` error means the fixture misfired.

## Table B — after the directional split lands

Predicted on the same artefact, same packages.

| test | prediction | note |
|---|---|---|
| `..._ChargesBothDirectionsInOneBuild/departure_is_charged` | GREEN | the fix's purpose |
| `..._ChargesBothDirectionsInOneBuild/entry_..._foreign_prefix` | GREEN | must NOT regress |
| D1 `..._UnprivilegedCallerCannotRemoveALifecycleStage` | GREEN | same defect as the departure arm |
| D2a `TestSameStageSet_IsOrderSensitiveDespiteItsName` | GREEN | set difference is order-insensitive |
| D2b `..._AuthorizationDoesNotDependOnCanonicalStageOrder` | GREEN | ditto |
| D3 `TestInsertTasksAfter_DoesNotOverDenyStockGitHubLabels` | **RED, DELIBERATELY** | ruled unsound; premise measurably false; not discharged |
| `TestLabelWriteScope_IsBlindToTodaysConfig` | GREEN | 4 cells that the union-deletion mutation turned red must stay green |
| `TestLabelWriteScope_PriorityAndTypeAxesDoNotPriceStages` | GREEN | 2 positive controls in it must stay green |
| `TestInsertTasksAfter_RejectsLifecycleStageLabels` | GREEN | existing control; I am not deleting the rejection |
| `TestPricingGateSiteCensus` | GREEN | I am editing all three sites, not adding a fourth |
| `TestLabelWritePrice_DoesNotDependOnLabelSpelling` (D4) | GREEN | passes today; a negative result, not a guard |

**I am predicting one deliberate RED (D3) and I am predicting it now, in advance,
so that it cannot later be presented as an unexpected casualty of my own fix.**

## Table C — what I expect CI to say

CI has never run this branch. Recorded before it can.

| gate | prediction | confidence |
|---|---|---|
| `go build ./...` | pass | high — measured locally at 2ffc22a |
| `go vet ./...` | **unknown, and I will not predict a pass** | the 5 known pre-existing vet failures were characterised on main at 43bd206, NOT on 2ffc22a. I have not measured vet on this base. If they surface here I report them; I do not fix them inside this change and I do not weaken the gate. |
| go-test membership vs `.github/expected-go-tests.txt` | **FAIL on landing, and I CANNOT fix it on this branch** | see "Manifest" below |
| `scripts/ci-suite-manifest.mjs` | not applicable | JS/TS only; untouched |

### Manifest — the gate is not on my base, and I am not creating it

- **MEASURED.** At `2ffc22a` (my base), `git ls-tree -r --name-only HEAD -- .github`
  returns exactly two paths: `.github/ISSUE_TEMPLATE/bug_report.md` and
  `.github/PULL_REQUEST_TEMPLATE.md`. There is no workflow and no
  `expected-go-tests.txt`. At `43bd206`, read from `ROOT=/workspace/farmtable`,
  `.github/expected-go-tests.txt` exists and is 501 lines of
  `<import path>\t<TestName>`.
- **NOT MEASURED.** Whether the membership gate, when it runs against a merge of
  this branch, keys on top-level test names only or also on subtest names. Every
  sampled row is a top-level name, but I did not read the matcher. If it keys on
  subtests, two more lines are needed, not one.
- **PRECONDITIONS.** This only bites at the moment 194 is merged onto a main that
  carries the manifest. It cannot bite on this branch. I checked: the gate is
  absent from my base, so nothing I do here can satisfy or violate it.

I am NOT creating `.github/expected-go-tests.txt` on this branch. Authoring a
501-line manifest from scratch to make a gate pass is regeneration by another
name, and regeneration is forbidden without exception. The two lines that must be
appended — by whoever lands this on main, not by me — are exactly:

```
github.com/farmtable-io/farmtable/internal/server	TestLabelWritePrice_ChargesBothDirectionsInOneBuild
github.com/farmtable-io/farmtable/internal/platform/github	TestLabelWritePrice_DoesNotDependOnLabelSpelling
```

(Tab-separated, matching the file's existing format. Sorted into place, appended
nowhere else, and nothing else in the file touched.)

**Divergence protocol.** If CI re-measures any row above and disagrees, the
disagreement is the finding and it goes to the EM loudly. A red-on-my-tree arm
that returns green in CI is a false result caught by a better instrument, and
that is the outcome this file exists to make impossible to bury.
