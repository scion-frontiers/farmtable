# review-xss-union — mutation arm definitions and expected red targets

Written 2026-07-29 at wind-down, per EM instruction, because **these arms produced
NO COMMITS**. Every arm was a working-tree edit that was applied, measured, and
reverted. No object exists for any of them; no ref points at them; no bundle can
carry them. This prose file *is* the recoverable form.

Canonical main at time of writing: `2982ffd8f3f6e231d8855b9cae7c448c2bd3144f`.
Arms below were run against branch tips `d7154a4` and `439b309` unless stated.
Node in this container is v20.20.2; `ci.yml:46` pins node 22. Every web result
here is "green on node 20", **not** "CI will pass".

---

## A. `safe-url.ts` scheme-guard mutants (6 arms, 5 killed, 1 survivor)

ROOT for these: fresh checkout of the stated commit. Target file
`web/src/util/safe-url.ts`, test file `web/src/util/safe-url.test.ts`.
Runner at `d7154a4`: the hardcoded single-file `node --test` form.
Runner at `439b309`: `node scripts/run-node-tests.mjs`.

| # | Mutation applied | Expected | Actual | Killed by |
|---|---|---|---|---|
| A1 | Remove `'https:'` from `SAFE_SCHEMES` | RED | RED | scheme allow-list positive cases |
| A2 | Remove `'http:'` from `SAFE_SCHEMES` | RED | RED | scheme allow-list positive cases |
| A3 | Add `'javascript:'` to `SAFE_SCHEMES` | RED | RED | the XSS negative case — the arm that matters |
| A4 | Invert the allow-list test to a deny-list (`!SAFE_SCHEMES.includes`) | RED | RED | both directions |
| A5 | Delete the base-relative resolution guard | RED | RED | relative-URL fixtures |
| A6 | Delete the host guard line pinned by `testHostGuardIsAFailClosedBackstop()` (`safe-url.test.ts:166`) | RED | **GREEN — SURVIVOR** | nothing |

**A6 is a deliberate, documented survivor, not a defect.** The line it deletes is
unreachable while `SAFE_SCHEMES` contains only WHATWG *special* schemes. The code
says so at `safe-url.ts:109-115`; the test scopes its own promise at `:139-141`.
A compound mutant (A6 + adding a non-special scheme to `SAFE_SCHEMES`) **does**
go red, confirming the scoped promise is true. This is retained dead code behind a
conditional whose condition is currently false. Recorded, **not** charged against
the branch.

## B. `package.json` test-script arm (the C-1 differential)

| Arm | Mutation | Expected | Actual |
|---|---|---|---|
| B1 | At `439b309`, revert `"test"` from `node scripts/run-node-tests.mjs` back to the hardcoded single-file form | `scripts/ci-suite-manifest.mjs` EXIT=1 | **EXIT=1 — promise holds** |

**Caveat that must travel with B1:** it went red by *crashing*, not by reporting a
dropped suite — `ReferenceError: tsconfigFiles is not defined` at
`scripts/ci-suite-manifest.mjs:572`. Verified **inherited from main**, identical
blob at `aa08f1a`; the branch diff on that file is empty. Non-blocking, filed as a
one-liner. The hazard: a guard whose red is indistinguishable from an existing red
is not a guard.

## C. Go over-denial probe (two-sided acceptance)

Scratch file `internal/server/zz_review_legit_test.go`, created **inside the
clone**, run, deleted. Disclosed as a dirty-tree measurement: the
separate-module/`replace` technique was unavailable because `validateURLField` is
unexported, so no external module can reach it. Sixteen legitimate-URL probes.

**One genuine over-denial found:** `https://example.com/a b` (unencoded space) is
rejected by the pre-parse control-character loop at
`internal/server/urlvalidate.go:56-61` (`r <= ' '`). Browsers percent-encode a
space silently, so a copy-pasted Confluence/Jira URL looks fine to the user.
Dropped silently on the read path; fails the whole document on import.
**Proposed narrowing:** restrict the loop to tab/LF/CR/C0 and let `0x20` reach
`url.Parse`. Preserves the security property exactly. Everything else rejected
(`mailto:`, protocol-relative, scheme-less, relative) is deliberate and documented.

## D. href census (not a mutation; a census)

4 href bindings in `web/src`, 4 accounted for, 0 unguarded. Two newly guarded via
`safeHref`; two exempt with declared and correct reasons — `ft-toolbar.ts:465`
(literal `https://github.com/` prefix over a regex-validated `remoteId`) and
`ft-toolbar.ts:496` (locally minted `blob:` download URL). For `PullRequest.url`
the client guard is the **only** control: `convert.go:587-588` copies it verbatim
with no read-path validation.

---

## Reproduction hazard worth one line

`internal/webguard`'s census walker hard-errors — `reading .../web/node_modules:
is a directory` — if `web/node_modules` is a **symlink**. It prunes a real
directory correctly by basename (`remotedata_consumers_test.go:120-121`) and CI
creates a real one via `npm ci`. A symlinked `node_modules` is exactly the
shortcut that produced an earlier false green, so the next agent to reach for it
will hit this. It fails loudly, which is the right failure.
