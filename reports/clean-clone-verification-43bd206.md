# Clean-Clone Verification of main @ 43bd206

Verifier: dev-ci-release (CI-GREEN). Date: 2026-07-29.
Verdict: **all nine checks reproduce. No disagreements.**
Tree cleanliness: **`git status --porcelain` EMPTY after every individual check.**

## Provenance and tool versions

| | |
|---|---|
| Commit | `43bd20627e0b07c50f113fda266117d419a9b4ad` (asserted before measuring, re-asserted after) |
| Subject | `Merge commit 'refs/em-ci/node22' into integration/ci-green` |
| Source | local bundle `/scion-volumes/scratchpad/projects/farmtable/transfer/main-43bd206.bundle` (1844613 bytes; `git bundle verify` → complete history, sha1) |
| Clone | `/tmp/verify43b/ft`, fresh from the bundle |
| Go | `go1.26.5 linux/amd64`, confirmed *inside the module* (target `go.mod` pins `go 1.26.5`) — matches `golang:1.26` in the images |
| Node (system) | `v20.20.2` |
| Node (npx) | `v22.23.1` |
| `buf` | **absent in this box** — see Method note, this is load-bearing |
| Frontend | **never built.** `web/dist` holds only the tracked placeholder. |

## Disclosure: this run supersedes a first pass that was briefly dirty

The first pass of this verification created a scratch package
`zz_stubcheck/` *inside* the clone to execute check 8, then deleted it. The tree
was therefore **not** clean at the moment check 8 was measured, even though it
was clean before and after the pass as a whole. Under the tree-cleanliness rule
that is a discarded result, and I am not going to let a green stand on a
qualifier I would reject from anyone else.

Everything below is a **complete re-run against a fresh clone** that never
contained a scratch file. Check 8 was moved out of the tree entirely: the stub
program now lives in a separate module at `/tmp/verify43b/stubcheck` with a
`replace` directive pointing at the clone, so the target is only ever read.
Porcelain was sampled **after** each check, not only before, since `make lint`
and `go test` are the plausible artefact producers.

## Results — every line certified clean

| # | Check | Expected | Measured | Porcelain after | Verdict |
|---|---|---|---|---|---|
| 0 | clone + `checkout main` | HEAD = 43bd206 | **43bd206…9b4ad** | EMPTY | ✅ |
| 1 | `web/dist` contents | 1 entry, `.gitkeep` | 1 entry, `.gitkeep`, tracked | EMPTY | ✅ |
| 2 | `go list ./...` | exit 0, 32 pkgs | **exit 0, 32** (was exit 1, zero) | EMPTY | ✅ |
| 3 | `go build ./...` | exit 0 | **exit 0**, 0 stderr lines (was exit 1) | EMPTY | ✅ |
| 4 | `go vet ./...` | exit 0, 0 findings | **exit 0, 0 findings** (was exit 1, zero pkgs analysed) | EMPTY | ✅ |
| 5 | `go test ./...` | exit 0, 0 setup failures | **exit 0, 0 setup failures**; 10 `ok` + 22 `no test files` = 32 (was 4) | EMPTY | ✅ |
| 6 | `make lint` | exit 0, `go vet` only, no buf | **exit 0**, sole output `go vet ./...`, buf unmentioned | EMPTY | ✅ |
| 7 | `a1642b8` substance | 4× `proto.Clone` | 4 sites confirmed, +9/−8, one file | EMPTY | ✅ |
| 8 | `WebUI()` on stub tree | `ErrWebAssetsNotBuilt` | confirmed by execution, `errors.Is` true | EMPTY | ✅ |
| 9 | `ci-suite-manifest.mjs` | exit 0 | exit 0 on **both** runtimes, byte-identical | EMPTY | ✅ |

Final `git status --porcelain`: **0 lines.** Final HEAD: unchanged at `43bd206`.

---

## Method note 1 — a missing tool as a discriminator, not an obstacle

**`buf`'s absence from this environment is what gives the `make lint` result its
force.** It is not a limitation of the verification; it is the instrument.

At faf1c8c the `lint` target ran `buf lint proto` before `go vet`. Had the
merged target still reached that step, it would have died **command-not-found**
in this box. `make lint` instead exited 0 with sole output `go vet ./...`.

That is a *proof* of non-invocation, not a result merely consistent with it. A
box that has `buf` installed cannot distinguish "the target no longer calls buf"
from "the target calls buf and buf happens to pass" — both produce exit 0. The
deficient environment separates those two hypotheses; the well-equipped one
cannot.

The generalisation, which is worth more than this one check: **an environment's
deficiency can be discriminating power, and installing the missing tool destroys
the discriminator.** The reflex to treat a missing dependency as noise to route
around is how false cleans are manufactured. Before installing anything to make
a check run, ask what the absence would have proven.

This is the same instrument logic as the track rule that came out of F14 — *a
positive control validates the tool, never the referent* — applied from the
other side. There, a live instrument was mistaken for a verified claim. Here,
an instrument guaranteed to register the opposite outcome is what makes the
observed outcome mean something.

## Method note 2 — a guard must be shown to be *called*, not merely to exist

Check 8 as briefed asks whether `WebUI()` returns `ErrWebAssetsNotBuilt` on a
stub tree. Passing that says the guard *works*. It does not say anything reaches
it — and a guard nothing calls is precisely this track's defect pattern, the
same shape as F14's release path and as the `lint` target that sat unreachable
from CI at faf1c8c.

So the call sites were audited as well:

- `cmd/farmtable-server/main.go:99` → `log.Fatalf` on error
- `internal/cli/dashboard.go:118` → returns the wrapped error
- no direct `WebAssets` consumers anywhere outside `assets.go`

Neither call site swallows the error, so a stub-built binary refuses to serve
rather than serving a blank dashboard. **"Does the guard fire?" and "does anyone
consult it?" are two separate questions, and only the second one distinguishes a
gate from decoration.** Any future guard-verification brief on this track should
carry both.

## Method note 3 — measure the commit, not the tree

*Generalised from check 8. This is now the project-wide standard on all four
tracks, replacing the earlier rule that asked legs to declare tree state.*

**Any result that will be reported, cited or merged on must be produced from a
fresh checkout of the commit, or from a separate module that can only read the
target. Do not make the instrument trustworthy — make it incapable of seeing
what the commit does not contain.** Declaring tree state survives only as a
fallback where that is impractical, and it is then a confession, not a
certificate.

The concrete technique, for executing code from a tree without becoming part of
it:

```
/tmp/<scratch>/probe/go.mod
    module probe
    go 1.26.5                                    # must match the target's pin, see note 2 below
    require github.com/farmtable-io/farmtable v0.0.0
    replace github.com/farmtable-io/farmtable => /tmp/<scratch>/<clone>
```

`go run .` from `probe/` compiles against the target and never writes to it. The
target cannot be dirtied by the act of measuring it, so there is no window to
declare, and no discipline to rely on.

Why the declaration rule was not enough — this report is the counterexample. The
first pass here was **clean before and clean after, dirty at the moment of
measurement**. That is a truthful "clean" under a declare-the-state rule and it
still misleads. A leg optimising for its own green answers honestly and moves
on. The remedy has to be structural, because the failure mode is a systems
property and diligence is not a fix for a systems property.

The failure this closes is a single shape appearing in several disguises: *the
tree had something the commit did not.* A built `web/dist` that a clean clone
would not have; a scratch package that no reviewer would ever see; a tool
present locally but absent on the runner. Method note 1 is the same idea run
backwards — there, the *absence* of `buf` was what made the result mean
something. Presence and absence both have to be properties of the commit, not
of the box.

---

## Check 7 detail — a1642b8 substance, not just exit code

Commit `a1642b8fe9ec2c1a27f83b2ab96d6a6d39e37f5b`, author dev-ci-build, single
file `internal/server/server.go`, +9/−8, standalone and independently revertable.

All four sites replace `ephReq := *req` with `proto.Clone`:

| Line | Method | Mutation on the copy |
|---|---|---|
| 1501 | `GetReadyTasks` | `CollectionId = &cidStr` |
| 1611 | `GetBlockedTasks` | `CollectionId = &cidStr` |
| 1819 | `GetCriticalPath` | `CollectionId = ephCID.String()`, `RootTaskId = nil` |
| 1996 | `GetBottlenecks` | `CollectionId = ephCID.String()` |

The stated justification holds: every site writes `CollectionId`, and
`GetCriticalPath` additionally nils `RootTaskId`, so a pointer alias to the
caller's request would have mutated the caller's message. `proto.Clone` yields an
independent message — the correct remedy, not merely a way to silence vet. The
underlying copylock was real (`protoimpl.MessageState` embeds a `sync.Mutex`) and
was unreachable before only because the embed made vet abort at zero packages.

## Check 8 detail — execution output

```
WebUI() err        = web dashboard assets were not built into this binary:
                     the embedded web/dist contains only the repository placeholder
                     (run `make web` and rebuild)
errors.Is(ErrWANB) = true
returned fs nil    = true
embedded web/dist  = [.gitkeep]
RESULT: stub correctly rejected
```

Matched by identity via `errors.Is`, not by string comparison. Run from an
external module; the target tree was never written to.

## Check 9 detail — JS, two labelled results, never merged

| Runtime | Exit | Output |
|---|---|---|
| node `v20.20.2` (system) — ENVIRONMENT-SCOPED, **not a gate signal** | 0 | `enumerated=1 executed=1 missing=0 (floor 1)` |
| node `v22.23.1` (npx) — corroborating, still my box | 0 | byte-identical |

Per the interpretation pre-committed *before* running: a node-20 green alone
would have been the **predicted false green**; the pair agreeing is the only
shape that carries information from this box. **Neither line closes the JS
side** — runner run `30460294525` at `v22.23.1` did. My npx-22 agrees with it;
had it diverged, the runner wins and I would have flagged rather than averaged.

Two fixes are visible in that output: the `test` script now targets a specific
file (`node --test .tmp-test/utils/task-ready.test.js`) rather than walking a
directory, which was the node-20/22 split; and `(floor 1)` shows the test-file
population floor from claim 2 of the premise audit is now enforced.

## Notes, non-blocking

1. **Bundle carries no HEAD ref.** `git clone <bundle>` warns `remote HEAD refers
   to nonexistent ref, unable to checkout` and yields an **empty working tree**;
   `git checkout main` is required. Reproduced on both clones. EM has taken this
   as his own and will include HEAD in the next bundle.
2. **Toolchain pinning.** The target `go.mod` requires `go 1.26.5`; the base
   toolchain here is `go1.26.1` and `GOTOOLCHAIN` resolution supplies 1.26.5
   inside the module. A scratch module declaring only `go 1.26` is refused
   outright — worth knowing for anyone else driving this tree from an external
   module. All measurements above ran at 1.26.5.
3. **Auth.** Nothing was edited. `a1642b8` is confined to four ephemeral
   request-construction sites and does not alter who is authenticated, what they
   may do, or how that is decided — despite `internal/server/server.go` also
   housing the token interceptors, which is exactly the coincidence that would
   make it *look* in scope.
4. Release images were not touched or built. F14 remains parked; no container
   runtime in this box.
