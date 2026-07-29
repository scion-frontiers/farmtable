/**
 * URL validation for links built from untrusted task data.
 *
 * Lit escapes attribute *values* but does not validate URL *schemes*, so a
 * `javascript:` (or `data:`, `vbscript:`, ...) URL stored on a task would
 * execute script in the app origin when the user clicks the rendered anchor.
 * Every anchor whose `href` comes from task/platform data must go through
 * `safeExternalUrl()` and render nothing when it returns `null`.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

/**
 * Whether `http:` loopback URLs may be rendered as links.
 *
 * The carve-out exists for local development integrations, so it must not ship:
 * in production a task whose `remoteUrl` is attacker-influenced could otherwise
 * render a one-click link to a service on the victim's own machine. WHATWG
 * normalization makes that worse than it looks — `http://0x7f000001/`,
 * `http://2130706433/`, `http://127.1/`, `http://0177.0.0.1/` and fullwidth
 * `http://127．0．0．1/` all parse to hostname `127.0.0.1`, so the obfuscated
 * forms defeat an operator eyeballing the stored value.
 *
 * Gated on `import.meta.env.DEV`, the same flag as the localStorage token
 * fallback, so `vite build` constant-folds this to `false` and the branch below
 * is removed from the production bundle entirely.
 *
 * The `typeof` guard is load-bearing: this module is also compiled by
 * `tsconfig.test.json` and executed under plain Node, where `import.meta.env`
 * does not exist. Node therefore takes the production answer — the strict one —
 * so the test suite pins production behaviour and fails closed either way.
 */
export const LOCAL_HTTP_LINKS_ENABLED =
  typeof import.meta.env !== 'undefined' && import.meta.env.DEV === true;

/**
 * Normalize `raw` to a URL that is safe to place in an `href`.
 *
 * Returns the normalized `URL.href` for `https:` URLs, and — in development
 * builds only — for `http:` URLs whose host is exactly `localhost` or
 * `127.0.0.1`. Everything else returns `null`: other schemes, non-local
 * `http:`, URLs carrying embedded credentials, empty or missing values, and
 * anything `new URL()` rejects.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let url: URL;
  try {
    // `new URL()` lowercases the scheme and strips leading/trailing control
    // characters and spaces, so casing and whitespace tricks such as
    // `JavaScript:` or `\tjavascript:` normalize into the checks below.
    url = new URL(raw);
  } catch {
    return null;
  }

  // Userinfo is the classic destination-confusion pattern: both call sites
  // render static link text, so `https://github.com@evil.example/` reads as
  // github.com in the status bar and lands on evil.example. No legitimate task
  // remoteUrl or PR url carries credentials, and a `user:pass@` form would also
  // leak them to the target on click.
  if (url.username || url.password) return null;

  if (url.protocol === 'https:') return url.href;
  if (LOCAL_HTTP_LINKS_ENABLED && url.protocol === 'http:' && LOCAL_HOSTNAMES.has(url.hostname)) {
    return url.href;
  }

  return null;
}
