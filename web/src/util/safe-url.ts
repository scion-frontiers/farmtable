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
 * Normalize `raw` to a URL that is safe to place in an `href`.
 *
 * Returns the normalized `URL.href` for `https:` URLs, and for `http:` URLs
 * only when the host is exactly `localhost` or `127.0.0.1` (local development
 * integrations). Everything else — other schemes, non-local `http:`, empty or
 * missing values, and anything `new URL()` rejects — returns `null`.
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

  if (url.protocol === 'https:') return url.href;
  if (url.protocol === 'http:' && LOCAL_HOSTNAMES.has(url.hostname)) return url.href;

  return null;
}
