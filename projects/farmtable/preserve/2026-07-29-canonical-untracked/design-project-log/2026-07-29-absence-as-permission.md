# 2026-07-29 — Absence as permission: measured population

**Type:** security enumeration (analysis only — no code changed)
**Measured at:** `7a2ad51`. Re-checked at `43bd206`; unchanged.
**Tree state:** see "Tree state and an exception to the read-only rule" below — the first
version of this entry said "clean tree" and that claim has been amended.
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/audit-absence-as-permission.md`
**Owner of the findings:** `farmtable-architect-auth`

## Why this exists

Three separate defects had been reported over the week that turned out to be one habit:
**an absent value is read as permission.** This entry records the attempt to turn that running
total of three into a measured population, so the auth design owner inherits a denominator
rather than an anecdote.

## Disposition

The owner directed that the auth architecture be left as-is; these findings are measured and
transmitted to the auth design owner. **Every site is LIVE.** A finding parked by an owner
decision is a disposition, not a closure. Nothing here has been patched, and no patch was
proposed — that would prejudge a design assigned elsewhere.

## Predicate (declared before searching)

A code path where an ABSENT value — nil, empty slice/string, unset env var, missing context key,
missing header, missing prefix, zero value, absent config or **absent constraint** — causes the
code to **grant** permission, capability, trust or authenticity, where the alternative available
to it was to deny or to error.

Sharpened from the starting definition in three ways: the grant must be a security outcome (not
a benign default); the counting unit is the code location, not the habit; and **authenticity**
counts, not only authorization.

## Result

| | |
|---|---|
| Tracked `.go` at `7a2ad51` | 208 |
| In scope (hand-written, non-test, non-generated) | **83** |
| Confirmed sites | **21** — 16 reachable, 5 latent |
| Unconfirmed candidates | 11 |
| Of the 21, attributable to the original three items | 6 |
| New | 15 |

The original three all **survive** the predicate; none was retracted. They expand to six sites
because unary and stream, and the three `Require*` functions, are separate locations. The two
most consequential new sites are **not in `internal/server`**: `CredentialEncryptor.Decrypt`
skips AES-GCM verification when the `enc:v1:` prefix is absent, and `matchesFilter` returns
`true` for a nil task, crossing the per-collection subscription filter. An enumeration confined
to the auth package would have missed both.

Two structural notes for the design owner: `DefaultScopesForUserType` returning nil grants
nothing on its own — it grants *via* the empty-scopes-is-wildcard rule, which is the
load-bearing half; and `GitHubPassThroughStore.LookupToken`, which fabricates a valid token for
any hash, is latent only because `MultiStore` routes past it. One absence-driven fallback is
what currently neutralises another. That is a coincidence, not a design.

## Method

Four instrument kinds: code-shape grep, intent-comment grep, execution with positive controls,
and an independent second sweep run without sight of the first site list. The second sweep
raised the count from 13 to 21; each promotion was confirmed at `7a2ad51` rather than adopted,
one of its conclusions was **rejected** (`ScopeTokenManage` is unenforced, but there are no
token-management RPCs, so nothing is granted), and eleven of its items are recorded as
explicitly unconfirmed rather than folded into the headline number.

Controls validate the instrument, never the substrate. Every control in the enforcement probes
**denied**; the empty-IAP-audience control **accepted** on the matching-audience path. A probe
that cannot produce both outcomes proves nothing.

Work was done in throwaway clones outside `/workspace`. No production code, no staging, no
commit, no push.

## Tree state, and an exception to the read-only measurement rule

The first version of this entry claimed a clean tree. That was true before and after the run and
**misleading during it**: the execution results were obtained with scratch probe `_test.go`
files present in the clone. Clean before, clean after, dirty at the moment of measurement.
Amended here rather than relabelled. **All values were re-measured under the corrected protocol
and reproduced identically.**

Worth recording for anyone auditing this repository in future: the prescribed remedy — measure
from a separate module that only reads the target — **cannot be applied to Farm Table's core.**
Go forbids external modules from importing `internal/…`, and essentially all of this codebase
lives under `internal/`. A probe module with a `replace` directive fails at load with
`use of internal package … not allowed`. The technique works for a public API surface; it does
not work here.

The substitute used instead: two clones at `7a2ad51`. A **pristine** clone for every read
(greps, counts, `git ls-files`, code reading) with porcelain sampled empty after each check; and
a separate **mutation** clone for execution probes, where porcelain showed exactly one line
(`?? internal/server/zz_probe_test.go`) and `git diff --stat` was empty at every sample, proving
the tracked tree unmodified. Porcelain was sampled after each of the five probe runs, not once
at the end. The dirt is a single named file and the dirt is the point — the probe is the
instrument.

The file-count denominators (208 tracked, 83 in scope) are structurally immune either way: they
come from `git ls-files`, which cannot see an untracked file.

## Corrections recorded against this work

- An earlier draft claimed the package denominator "is 32, not 33". **That was wrong.** Main is
  32 of 32; the XSS branch is 33 of 33 (`internal/webguard` exists only on the branch). Both are
  correct for their own tree. The rule that catches it: cite the tree with the number.
- The credential-encryptor family was excluded on the first pass as "confidentiality, not
  permission". Too broad — skipped AES-GCM verification is an authenticity failure, which the
  predicate names. Reversed, and it became one of the two most consequential sites.
- The `go vet`/`web/dist` caveat was true at `7a2ad51` (0 packages listed) and false from
  `43bd206` (32). Recorded as SHA-anchored rather than as having been wrong.

## Inverse exemplar worth generalising

`WebUI()` / `ErrWebAssetsNotBuilt` in `assets.go` (from `43bd206`) is the exact inverse of the
habit: it stats `index.html` and returns a **named error** when only the repository placeholder
is embedded, instead of serving a blank dashboard. It distinguishes "never provided" from
"provided and valid" and gives the former its own error type. That is the pattern the permission
model wants.

Related prior art in this repo: `scripts/ci-suite-manifest.mjs` already names the same habit on
a different axis — absence as *evidence of correctness* — with "a check that cannot see is not a
check that passes".
