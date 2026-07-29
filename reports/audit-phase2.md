# Security Audit — Phase 2 web UI (`7a0f220..633f8f2`)

**Auditor:** audit-phase2
**Workspace:** `/workspace`, branch `task-state-web-ui-v2`, HEAD `633f8f2`
**Range:** `7a0f220..633f8f2` — 39 commits, 73 files, +14063 / −378

## Pre-flight verification (executed)

```
git branch --show-current            -> task-state-web-ui-v2   ✓
git rev-parse --short HEAD           -> 633f8f2                ✓
git log --oneline 7a0f220..633f8f2|wc -l -> 39                 ✓
git diff --name-only 7a0f220..633f8f2 -- '*.go' -> (empty)     ✓ (0 Go files, as stated)
```

All three gates agree. Audited the correct tree.

---

## Verdict: **APPROVE**

No Critical, High, or Medium security findings. Phase 2 is **net security-positive**: it closes one live unauthenticated source-disclosure hole, removes a bearer token from production-reachable script storage, and introduces the URL-scheme validation that the two new external links required. The three findings below are all Low/Info and none is exploitable as written.

### Severity summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 2 |
| Info | 2 |

Separately noted: 2 pre-existing issues outside this line, filed for context only, **not** against Phase 2.

---

## Answers to the five questions asked

### 1. Does Phase 2 add any new path into the `unsafeHTML` sinks? — **No.**

*Verified by execution.* The complete set of raw-HTML sinks in `web/src` is two `unsafeHTML` calls, and all three relevant files are untouched by this range:

```
web/src/components/inspector/ft-inspector-comments.ts:221   untouched by Phase 2
web/src/components/inspector/ft-inspector-desc.ts:233       untouched by Phase 2
web/src/util/markdown.ts                                     untouched by Phase 2
```

An exhaustive sweep of `web/src` found **zero** occurrences of `unsafeSVG`, `unsafeStatic`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `srcdoc`, string-argument `setTimeout`/`setInterval`, inline `on*=` handlers, or any `html` tagged template assembled by string concatenation. All five `setAttribute` call sites use a literal attribute name; there is no dynamic-name `setAttribute` anywhere.

**No new attacker-controlled string reaches `unsafeHTML`, and no new shadow-root forgery surface is created.** On the last point specifically: the only change to the global stylesheet (`web/src/styles/theme.css`) is two CSS custom properties (`--ft-stage-wont-fix`, `--ft-stage-duplicate`) — **no new class selectors**. Phase 2's new `.attention` styling lives in `ft-inspector-relationships.ts` and `ft-dashboard-view.ts`, neither of which renders markdown, so sanitized-but-class-bearing markup injected via a description or comment cannot reach a shadow root where those classes are defined and cannot forge the attention warning.

### 2. New attacker-controlled data reaching the DOM — enumerated, all safe.

Every attribute-position interpolation added in the range carries an enum ordinal, a number, or a frozen string constant. Concretely, the new `title`/`aria-label` bindings are:

- `ft-kanban-column.ts:376,377` — `aria-description`/`title` from `DROP_REFUSAL.*`; the only variable is `this.label`, a `STAGE_LABEL` constant, not task data.
- `ft-dashboard-view.ts:338,366,367` — counts (numbers) plus `ATTENTION.label` / `ATTENTION.tileAction` / `ATTENTION.explanation`, all frozen constants in `task-state-utils.ts:291-299`.

**No task title, description, comment, label, assignee name, hold reason, or blocker title reaches a new attribute position.** Task data added in the range appears only in text position, where Lit escapes it (e.g. `ft-inspector-relationships.ts:242` `Remove ${blocker.name}`, `ft-filter-chips.ts:137` `Assignee: ${...}`).

All seven `style=` interpolations in the tree resolve to `STAGE_COLOR`/`PRIORITY_COLOR` lookup-table constants with hardcoded `??` fallbacks — the only input is a numeric stage ordinal, so no CSS injection is reachable.

### 3. Attention view data flow and authorization — **no new exposure.**

`attentionBlockers()` (`web/src/util/task-state-utils.ts:301-313`) resolves blockers through `store.getTask(rel.targetTaskId)`. `TaskStore` is a **client-side `Map` populated from the server's collection-scoped snapshot stream** — `getTask` is a local lookup, not a fetch. The attention view therefore renders a strict projection of data the server had already streamed to this client; it cannot surface a task the user could not already see.

It also **fails closed**: when a `targetTaskId` resolves to nothing in the store (a blocker in another collection, or one the server withheld), the `if (blocker && ...)` guard skips it rather than rendering a placeholder or leaking the ID. There is no authorization decision made in the web layer at all here, so there is no web-layer assumption for the store to fail to enforce.

### 4. URL and navigation surface — **no open redirect, no state injection.**

*Verified by reading every navigation site in `web/src`.* There is **no** `location.assign`, `location.replace`, or `window.open` anywhere in the tree. Every one of the ten `pushState`/`replaceState` calls passes a `URL` object derived from `new URL(window.location.href)` and mutated only via `searchParams.set`/`delete` — the destination is structurally same-origin and cannot be redirected.

Inbound params are validated at `ft-app.ts:924-958`: `view` against an explicit `VALID_VIEWS` allowlist, `layoutdir` against `'TB'|'LR'`, `solo` against `'1'`, and `collection` is round-tripped through a server `getCollection()` call that falls back to the collection list on failure. `?token=` was previously removed and the removal is documented at `grpc-client.ts:418-421`.

On the dashboard tile's `view-change`-then-`filter-change` sequence: **the filter state is never written to the URL**, so a crafted link cannot preload the attention filter or any other filter into a misleading state.

**The `safe-url` contract test is real and binding, not a self-built oracle.** Both `web/test/safe-url.contract.test.ts:2` and `web/src/util/safe-url.test.ts:1` import the real exported `safeExternalUrl`/`LOCAL_HTTP_LINKS_ENABLED` symbols; neither re-implements the logic. I proved bindingness by mutation — see the mutation table below. I did find one coverage gap in the contract test (Finding L-2).

### 5. Supply chain and build pipeline — **dev-only proven, not assumed.**

Two new dependencies, **both `devDependencies`**: `jsdom@^26.1.0`, `vitest@^3.2.7`. Zero additions or version changes to `dependencies` (confirmed against the lockfile: of 74 new entries, **0** were version-changed pre-existing packages).

Lockfile hygiene: all 74 new entries are `dev:true`, all integrity-pinned, all resolved from `registry.npmjs.org`. No git URLs, no alternate registries. `npm ci` and `npm ci --dry-run` both exit 0 with an empty `git status` afterward — no drift.

Because `//go:embed all:web/dist` (`assets.go:5`) ships anything in `dist/` inside the binary, "dev-only" was proven at **three** layers, not one:

1. **Lockfile** — all new entries `dev:true`.
2. **Built `dist/`** — after `rm -rf dist && npm ci && npm run build`: `vitest`, `jsdom`, `describe(`, `expect(`, `beforeEach`, `vi.fn`, `@testing-library` all → NO MATCH. 0 `.ts` files in `dist`. 0 test artifacts. `dist/` is 4108 files but only **4** are application files (`index.html`, `favicon.svg`, one JS bundle, one CSS bundle); the other 4104 are Shoelace SVG icons.
3. **Compiled Go binary** — `go build -o /tmp/farmtable-server ./cmd/farmtable-server` (42M), then grepped: `vitest`, `jsdom`, `describe(`, `beforeEach`, `test/helpers` → all not found, with `shoelace/assets` and `farmtable` as positive sanity controls confirming the grep actually reaches embedded content.

`vite-plugin-static-copy`'s glob is rooted at `node_modules/@shoelace-style/shoelace/dist/assets/**/*` and cannot escape to `src/` or `test/`; that source tree contains only SVGs, a LICENSE, and `icons.json`. The `build` script is unchanged and never invokes vitest; `vitest.config.ts` is a separate config not loaded by `vite build`.

`npm audit --audit-level=low` → **0 vulnerabilities**; `npm audit --omit=dev` → **0**. Production tree is 27 packages, 8 direct.

### 5b. #196-adjacent — Phase 2 does not merely avoid the leak, it **fixes** it.

*Verified by execution.* `find dist -name '*.map' | wc -l` → **0**. The bundle is minified (max line length 65679). Comment-phrase greps in `dist`: `security-relevant` → 0, `go:embed` → 0, `TODO`/`FIXME`/`XXX`/`HACK` → 0, `eslint-disable` → 0. (One `FORBID_TAGS` hit is a DOMPurify runtime config key, not repo source — `grep -rn FORBID_TAGS src/ test/` returns nothing.)

Worth stating plainly: `web/vite.config.ts` in this range changes `sourcemap: true` → `sourcemap: false`. **At `7a0f220` — which is live in production — `dist/` shipped the full unminified client, embedded in the binary and served unauthenticated.** Phase 2 closes that. The accompanying comment correctly reasons that `'hidden'` would have been insufficient because it still writes the `.map` into `dist/`.

---

## Mutation testing

The standing bar on this workstream is that "verified" means *proved by breaking it*. Baseline before and after every mutation: **22 files, 407 tests, all pass, ~4s**. Working tree confirmed clean (`git status --porcelain` empty) after every restore. **No production code was left modified.**

| # | Mutation | File | Result |
|---|---|---|---|
| M1 | Remove the embedded-credential check `if (url.username \|\| url.password) return null;` | `safe-url.ts:63` | **DEAD** — but see L-2 |
| M2 | `return url.href` → `return raw` (defeat WHATWG normalization) | `safe-url.ts:65` | **DEAD** (5 failures) |
| M3 | `LOCAL_HTTP_LINKS_ENABLED` → `true` (ship the dev loopback carve-out) | `safe-url.ts:33` | **DEAD** |
| M4 | `document.createTextNode(message)` → `insertAdjacentHTML('beforeend', message)` | `ft-app.ts:877` | **SURVIVED** → Finding L-1 |
| M5 | Drop the `isUnsuccessfulTerminalStage` guard | `task-state-utils.ts:308` | **DEAD** (12 failures across 4 files) |
| M6 | Drop the `BLOCKED_BY_DEPENDENCY` gate | `task-state-utils.ts:302` | **DEAD** (3 failures) |
| M7 | `safeExternalUrl(t.remoteUrl)` → `t.remoteUrl` (bypass at render site) | `ft-inspector-meta.ts:603` | **DEAD** (10 failures) |
| M8 | `safeExternalUrl(pr.url)` → `pr.url` (bypass at render site) | `ft-inspector-code.ts:108` | **DEAD** (7 failures) |

Selected actual failing output:

```
# M1 (killed by the Node runner only)
Error: https: with user:pass is rejected: expected null, got https://user:pass@evil.example/
    at assertRejected (file:///workspace/web/.tmp-test/util/safe-url.test.js:8:5)

# M3
Error: Node test runner must exercise the production (https-only) configuration: expected false, got true

# M7
FAIL test/ft-inspector-meta.safe-url.test.ts > renders no href for remoteUrl "javascript:alert(document.domain)"

# M8
FAIL test/ft-inspector-code.safe-url.test.ts > renders no href for pull request url "JaVaScRiPt:alert(document.domain)"
```

M7 and M8 are the two that matter most: they prove the `javascript:`-URL defence is pinned **at the render sites**, not merely in the utility module. That is the difference between a tested helper and a tested defence.

---

## Findings

### [LOW] L-1 — Toast HTML-escaping is unpinned, on a path Phase 2 newly widened to carry user-controlled task titles

- **Location:** `web/src/components/ft-app.ts:877` (the sink); `web/src/components/ft-app.ts:882-891` (the new caller branch); `web/src/util/task-state-utils.ts:134-136` (`crossBandToast`); `web/src/components/ready-queue/ft-ready-queue-view.ts:376-382,416`
- **Status:** Not exploitable as written. The current code is correct. This is a **missing regression test**, reported because the property it fails to pin now guards genuinely attacker-controlled data.
- **Description:** `showErrorToast` builds the toast body with `document.createTextNode(message)` — the correct, injection-proof construction. Phase 2's H-2 change added a new branch to `onWriteError` (`ft-app.ts:887-889`) that routes client-side *refusal* messages through the same sink. One of those refusals interpolates a raw task title:

  ```ts
  // task-state-utils.ts:134
  crossBandToast: (taskName: string, bandLabel: string) =>
    `Drag reordering works within one priority band. Change the priority of ` +
    `“${taskName}” to move it into ${bandLabel}.`
  ```

  called at `ft-ready-queue-view.ts:416` with `dragged.name`. So Phase 2 both refactored the sink into a new method **and** introduced a new class of caller carrying fully user-controlled text — while adding no test that pins the sink's escaping.
- **Impact if regressed:** Stored XSS in the app origin. An attacker who can set a task title (any user with write access to the collection, or a compromised/malicious upstream platform adapter) plants `<img src=x onerror=...>` in a title; any user who drags that row across a priority band executes it. Same origin as the session cookie.
- **Proof of concept — *executed*:** I replaced `alert.append(icon, document.createTextNode(message));` with `alert.append(icon); alert.insertAdjacentHTML('beforeend', message);` and ran the full suite:

  ```
  Test Files  22 passed (22)
       Tests  407 passed (407)
  ```

  The entire 407-test suite tolerates converting the only new dynamic-DOM path in the range into an HTML-injection sink. Restored immediately; tree verified clean.
- **Recommendation:** Add one component test asserting the toast renders hostile text literally. Follow the existing pattern in `test/ft-inspector-meta.safe-url.test.ts`:

  ```ts
  it('renders a refusal message as text, never as markup', async () => {
    const app = await fixture<FtApp>(html`<ft-app></ft-app>`);
    const hostile = '<img src=x onerror="globalThis.__xss=1">';
    app.dispatchEvent(new CustomEvent('write-error', {
      bubbles: true, composed: true, detail: { message: hostile },
    }));
    await app.updateComplete;

    const alertEl = document.body.querySelector('sl-alert')!;
    expect(alertEl.querySelector('img')).toBeNull();
    expect(alertEl.textContent).toContain(hostile);
    expect((globalThis as Record<string, unknown>).__xss).toBeUndefined();
  });
  ```

  This kills M4. It is a test-only addition and does not touch production code.

### [LOW] L-2 — `safe-url` contract test has no embedded-credential case; the check is pinned by only one of the two suites

- **Location:** `web/test/safe-url.contract.test.ts:27-44` (the `cases` table)
- **Description:** `safeExternalUrl` rejects URLs carrying userinfo (`safe-url.ts:63`) specifically to defeat destination confusion — both call sites render *static* link text, so `https://github.com@evil.example/` reads as github.com in the status bar. The contract test's case table covers schemes, whitespace and malformed input but contains **no `user:pass@` or `@`-bearing input at all**.
- **Proof of concept — *executed*:** Deleting the credential check leaves the contract test fully green:

  ```
  $ npx vitest run test/safe-url.contract.test.ts     # with the check removed
   Test Files  1 passed (1)
        Tests  22 passed (22)
  ```

  The mutation is caught only by the plain-Node suite (`src/util/safe-url.test.ts:49-53`). So the defence currently rests on a single suite run by a different runner under a different config.
- **Impact:** No current vulnerability — the check exists and one suite does guard it. The risk is structural: if the Node runner is ever retired in favour of Vitest (a plausible consolidation, given Phase 2 just built the Vitest harness), the credential check silently loses all coverage.
- **Recommendation:** Add three rows to the contract table at `safe-url.contract.test.ts:44`:

  ```ts
  { input: 'https://github.com@evil.example/', expected: null },
  { input: 'https://user:pass@evil.example/',  expected: null },
  { input: 'https://:pass@evil.example/',      expected: null },
  ```

  Note these also strengthen the existing `accepted.length` invariant at `:66`, which counts non-null expectations.

### [INFO] I-1 — `onViewChange` casts `e.detail.view` with no runtime validation

- **Location:** `web/src/components/ft-app.ts:570`
- **Description:** `const view = e.detail.view as 'kanban' | ... ;` is a compile-time cast only, and the value is written straight into the URL via `searchParams.set('view', view)` at `:572`. By contrast the inbound path (`applyRoute`, `:930`) validates against an explicit `VALID_VIEWS` allowlist.
- **Why this is Info and not a finding with teeth:** the event is same-origin and internal; dispatching it requires script execution, at which point the attacker has already won. `searchParams.set` percent-encodes, so nothing escapes the query-string context. And any bogus value is discarded on the next load because `applyRoute` re-validates — the state is self-healing.
- **Recommendation (optional):** hoist `VALID_VIEWS` to module scope and reuse it in `onViewChange` so the inbound and outbound paths share one allowlist. Consistency, not security.

### [INFO] I-2 — Add a CI guard binding the sourcemap fix

- **Description:** `web/dist/` is gitignored but embedded, so the binary's contents depend entirely on the release machine performing a clean build. A stale or locally-dirty `dist/` — for instance one built before the `sourcemap: false` change — would be embedded silently with **no git signal at all**.
- **Recommendation:** In the release job, build the binary only after `rm -rf web/dist && npm ci && npm run build`, and assert `[ "$(find web/dist -name '*.map' | wc -l)" -eq 0 ]`. This converts Phase 2's sourcemap fix from a config value into an enforced invariant. Given that the pre-Phase-2 state of this exact setting was a live unauthenticated source disclosure, the guard is worth its cost.

---

## Pre-existing issues — context only, **not filed against Phase 2**

Both predate `7a0f220` and are live today. Phase 2 neither introduces nor worsens either.

1. **[LOW] Static assets are served with no auth middleware.** `internal/serverapp/unified.go:101` registers `mux.Handle("/", http.FileServer(assets))` raw. Every auth mechanism in the file (`SessionToBearerMiddleware` at `:66`, `iapMiddleware` at `:86`, the gRPC token interceptors) wraps `grpcWebHandler` only. The comment at `unified.go:83` says *"Wrap the mux with IAP middleware"* but the code wraps the gRPC handler — an operator reading it would reasonably believe static assets are IAP-checked in-process. In `AuthModeProxy` they are not. Mitigating: GCP IAP normally enforces at the load-balancer edge. **This is exactly the assumption that makes `sourcemap: false` load-bearing rather than cosmetic**, which is why I flag it here. Out of scope for this line (0 Go files changed) — recommend filing separately.

2. **[INFO] `rel` inconsistency on the pre-existing GitHub link.** `web/src/components/ft-toolbar.ts:552` uses `rel="noopener"` without `noreferrer`, whereas both anchors Phase 2 adds (`ft-inspector-code.ts:112`, `ft-inspector-meta.ts:616`) correctly use `rel="noopener noreferrer"`. The URL there is safe — hardcoded `https://` prefix with `remoteId` gated by `GITHUB_REPO_RE` at `:549` — so this is referrer hygiene only. Worth aligning opportunistically; not a reason to hold Phase 2.

### #195 interaction — checked, none found

Phase 2 leaves `markdown.ts`, `ft-inspector-desc.ts` and `ft-inspector-comments.ts` untouched, adds no third `unsafeHTML` sink, and adds no global class selector that sanitized markup could carry to forge UI. **The two branches do not interact on any security-relevant surface.** The only overlap is `web/package.json` / `package-lock.json` / `tsconfig.test.json`, which is a merge-sequencing matter and already tracked.

On the `jsdom` range skew (#195 `^29.1.1` vs Phase 2 `^26.1.0`): I have no security basis to prefer either. Both are dev-only and unreachable from `dist/` — proven above at three layers — so neither choice changes the production attack surface. Resolve it on test-compatibility grounds alone.

---

## Second opinions on the deferred items

Asked in the shared context. These are judgement calls, and I answer them only from where security bears on them; where it does not, I say so.

1. **`ft-inspector-relationships.ts` unanchored copy (`:224,:228,:229,:308`) — follow-up, not a blocker.** No security consequence: all four strings are static literals in text position, and the duplicated `'Blocked by dependency'` at `:308` is a hand-written twin of a constant, not a divergent *security* control. The mild security-adjacent angle is that this is a *warning* users act on, and two wordings of a warning that can disagree in the same panel is a comprehension risk. But that argues for fixing it soon, not for holding a deploy. Worth noting the fix is mechanical and testable — the same literal→constant move already applied to `ft-task-card.ts` in item 4.

2. **`matchesTaskFilters`'s required seventh `store` parameter — right call, and right for a safety reason the dev stated correctly.** An optional store lets a forgetful caller return "nothing needs attention" — a **fail-open** answer indistinguishable from a correct one, which would silently hide precisely the stranded tasks the feature exists to surface. Requiring it makes the compiler enforce the safe path. Seven positional parameters is a genuine readability cost, and an options object is the better long-term shape, but that is a refactor to schedule, not to perform immediately before a deploy. Endorse as-is. I confirmed by mutation (M5, M6) that the underlying predicate is well pinned, so a later refactor will have a real safety net.

3. **"Needs attention" on the Available Queue showing "All clear!" — ship it; do not special-case.** No security dimension. The behaviour is *correct*: attention tasks are unavailable by definition, so the queue truthfully lists none, and it is consistent with the existing `unavailable`/`Held` handling. Special-casing would mean one filter value behaving differently from its siblings in the same control — that inconsistency is a worse trap than the empty state, because it teaches users the control is unpredictable. The dashboard tile already routes to the board, so the discoverable affordance never lands anyone here. The dev was right to ask rather than special-case, and right not to.

4. **The `ft-task-card.ts` scope exception — correct.** Purely literal→constant, and it kept the vocabulary anchor's central claim true on the day it was written. Leaving it would have shipped a documented invariant that was already false. No security impact.

---

## Positive observations

Credit where the code earns it — these are the reasons the verdict is APPROVE and not merely "nothing found":

- **Three real hardening wins, all in this range:**
  - `vite.config.ts` — `sourcemap: true → false`, closing a live unauthenticated full-source disclosure from the embedded, unauthenticated `dist/`. The comment correctly reasons that `'hidden'` is insufficient.
  - `grpc-client.ts:424-434` and `ft-app.ts:318-320` — the localStorage bearer-token fallback is now gated on `import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_TOKEN === 'true'`. **I verified the constant-folding claim by execution:** `grep -rl "farmtable.token" dist/` and `grep -rl "VITE_ENABLE_LOCAL_TOKEN" dist/` both return nothing. The token is genuinely unreadable from script in a production bundle, not merely guarded at runtime.
  - `safe-url.ts` — new, and correct on the details that usually get missed: WHATWG normalization before the scheme check, embedded-credential rejection, and both call sites rendering an unlinked fallback rather than a broken anchor.
- **The dev-only loopback carve-out provably does not ship.** `grep -rlF "127.0.0.1" dist/` → no match, confirming the `import.meta.env.DEV` gate is folded away, exactly as `safe-url.ts:24-31` claims. The `typeof` guard making the plain-Node runner take the *production* answer is a genuinely good piece of design: the strict path is the one under test, so the suite fails closed either way.
- **`document.createTextNode` in `showErrorToast`** is the right construction for a sink that receives raw server error text. The naive `innerHTML` version would have been a real XSS, and all three toast implementations in the tree (`ft-app.ts:877`, `ft-toolbar.ts:842`, `ft-dependency-view.ts:1391`) use the safe form consistently. L-1 asks for a test, not a fix.
- **`run-node-tests.mjs` uses `execFileSync`, never a shell**, with paths from a filesystem walk rather than interpolated input — no command-injection surface in the new tooling. Its source/compiled count assertion (`:54-62`) is also a nice fail-loud touch.
- **`attentionBlockers` fails closed** on unresolvable blocker IDs, and `matchesTaskFilters` calls the real predicate rather than re-deriving it — mutation-confirmed (M5, M6) as genuinely covered, with no self-built oracle among the security-relevant tests I examined. Both safe-url suites import the real exported symbols.
- **Supply-chain discipline:** two new dependencies, both dev, zero production version bumps smuggled in under a test-infrastructure change, every new lockfile entry integrity-pinned and registry-sourced.

## Recommendations (priority order)

1. Add the toast-escaping test (L-1). Test-only; kills a surviving mutant on the range's own new data path.
2. Add the three credential rows to the safe-url contract table (L-2). Three lines.
3. Add the CI clean-build + zero-`.map` assertion (I-2), so the sourcemap fix cannot silently regress.
4. File the `unified.go:83` comment/code mismatch separately — Go-side, out of this line, but it is the assumption underwriting item 3.
5. Opportunistically align `ft-toolbar.ts:552` to `rel="noopener noreferrer"`.

None of these is a merge blocker.

---

## Scope and honesty notes

- **Verified by execution:** the three pre-flight gates; the full 407-test baseline; all eight mutations M1–M8 with restore-and-verify-clean after each; the `dist/` greps for `farmtable.token`, `VITE_ENABLE_LOCAL_TOKEN`, `127.0.0.1`, `localhost`; the clean `rm -rf dist && npm ci && npm run build`; the `dist/` file inventory and test/dev-dep leakage greps; the compiled-Go-binary greps with positive sanity controls; `npm audit` (both modes); `npm ci --dry-run`; `git status --porcelain` clean at end.
- **Reasoned about, not executed:** the exploitability narrative in L-1 (I proved the mutant survives; I did not stand up a live server and land a real XSS through a task title); the claim that `TaskStore` cannot exceed the server's collection scope, which follows from reading `task-store.ts` and `attentionBlockers` rather than from an authorization test against a running backend; the browser's same-origin enforcement on `pushState`.
- **The single `localhost` hit in the production bundle** is inside `@improbable-eng/grpc-web`'s XHR feature detection (`o.open("GET","https://localhost")`, never sent) — third-party, pre-existing, benign. Not a finding.
- **No production code was modified.** Every mutation was applied from a `/tmp` backup, tested, and restored; `git status --porcelain` was verified empty after each and at the end of the audit. Nothing was committed or pushed.
