/**
 * Scheme allow-list for URLs that came from the server and are about to be
 * rendered into an `href`.
 *
 * This is defence in depth. The write boundary in Go
 * (internal/server/urlvalidate.go) rejects non-http(s) schemes, but rows
 * written before that check existed are still in the database and are returned
 * verbatim, so the render path cannot assume its input is clean.
 *
 * The scheme set is deliberately identical to the server's allow-list:
 *
 *  - `mailto:` is NOT included, even though it is harmless to render. The two
 *    fields that reach these bindings are a pull-request URL and an external
 *    source URL; both are http(s) by nature, and the GitHub adapter only ever
 *    writes https. Since the server rejects `mailto:` at ingress, a client that
 *    rendered it would be dead code for a value that can no longer be stored.
 *  - Any divergence between the two lists is a bug in one of them: a scheme the
 *    client allows and the server rejects is unreachable, and a scheme the
 *    server accepts and the client blocks is a broken feature.
 */
const SAFE_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * Returns `raw` if it is a URL safe to place in an `href`, otherwise
 * `undefined`.
 *
 * Callers should degrade to rendering the raw text in a non-link element rather
 * than dropping the value, so a rejected URL stays visible to the user.
 *
 * Note there is deliberately NO base argument to `new URL()`. Resolving against
 * `window.location.origin` would rewrite protocol-relative and relative inputs
 * into same-origin absolute URLs and then accept them:
 *
 *   new URL('//evil.com/x', origin).href  === 'https://evil.com/x'   (accepted!)
 *   new URL('not-a-url',    origin).href  === '<origin>/not-a-url'   (accepted!)
 *
 * Both of those are rejected by the server, so accepting them here would make
 * client and server disagree, and the first silently launders an attacker-chosen
 * origin into an allowed scheme. Without a base both inputs throw and are
 * rejected, which matches the server exactly.
 *
 * The returned value is the ORIGINAL string, not `URL.href`. `new URL()`
 * normalises its input (it strips tab/newline characters, lowercases the host
 * and can percent-encode), and we only want to make a keep/reject decision here,
 * not to rewrite what the user stored.
 */
export function safeHref(raw: string | null | undefined): string | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return undefined;
  }

  // `new URL()` lowercases the scheme, so no extra case folding is needed;
  // 'JaVaScRiPt:alert(1)' parses with protocol === 'javascript:'.
  //
  // It also strips ASCII whitespace and control characters before parsing, so
  // 'java\tscript:alert(1)' parses with protocol === 'javascript:' too. That is
  // precisely why this must be an allow-list: a denylist applied to the raw
  // string would not have seen that value as 'javascript:' at all.
  if (!SAFE_SCHEMES.has(parsed.protocol)) return undefined;

  // Reject http(s) URLs with no host, e.g. 'http:/\/\evil.com'.
  if (parsed.hostname === '') return undefined;

  return raw;
}
