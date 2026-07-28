/**
 * Scheme allow-list for URLs that came from the server and are about to be
 * rendered into an `href`.
 *
 * HOW MUCH WEIGHT THIS CARRIES, per binding. It is not uniformly "defence in
 * depth", and an earlier version of this comment said it was:
 *
 *  - PullRequest.url: this is the ONLY control for rows written before
 *    internal/server/urlvalidate.go existed. New writes are guarded at the
 *    write boundary (server.go UpdateTask, export_import.go ImportCollection),
 *    but legacy rows are returned verbatim by convert.go and are not migrated.
 *    Removing safeHref here re-opens those rows.
 *  - Task.remote_url: guarded at the write boundary AND re-checked on the way
 *    out in convert.go::taskToProto, so here it genuinely is a second layer.
 *    That read-path check exists because the GitHub passthrough store
 *    synthesises remote_url from the GraphQL response on every read and never
 *    persists it, so no write-boundary check can reach it.
 *
 * Either way: do not remove this on the grounds that "the server validates".
 *
 * SCHEME SET vs DECISION SET. The scheme set is deliberately identical to the
 * server's allow-list in internal/server/urlvalidate.go:
 *
 *  - `mailto:` is NOT included, even though it is harmless to render. The two
 *    fields that reach these bindings are a pull-request URL and an external
 *    source URL; both are http(s) by nature, and the GitHub adapter only ever
 *    writes https. Since the server rejects `mailto:` at ingress, a client that
 *    rendered it would be dead code for a value that can no longer be stored.
 *
 * The scheme SETS match. The DECISIONS do not, and a previous version of this
 * comment claimed they did ("a scheme the client allows and the server rejects
 * is unreachable"). That is false twice over: the server applies three further
 * rules this function does not replicate (a control-character pre-check, Go's
 * stricter url.Parse, and a non-empty Host requirement), and the server is not
 * the only writer, so "unreachable" does not follow even where it rejects.
 * Measured: 9 of 42 shared fixtures are decided differently. They are pinned in
 * testdata/url-scheme-cases.json, which is read by BOTH
 * testSharedFixturesMatchClientColumn() in safe-url.test.ts and
 * TestValidateURLFieldMatchesSharedFixtures in
 * internal/server/urlvalidate_differential_test.go, so neither side can drift
 * without going red. All 9 are http(s)-resolving, so none is a scheme
 * escalation; they are broken-link and inconsistency bugs, not XSS.
 */
export const SAFE_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:']);

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

  // Fail-closed backstop, and currently UNREACHABLE -- deliberately kept.
  //
  // Both entries in SAFE_SCHEMES are WHATWG "special" schemes, and the parser
  // requires those to have a non-empty host: `new URL('https://')` throws
  // rather than yielding an empty hostname, so nothing that gets past the
  // allow-list above can arrive here with hostname === ''. Measured: of every
  // empty-host shape tried, zero reach this line.
  //
  // It is NOT dead weight, because it is what makes widening SAFE_SCHEMES
  // fail closed instead of fail open: every script-bearing scheme
  // (javascript:, data:, vbscript:, blob:, mailto:) is NON-special and parses
  // with hostname === '', so if one is ever added to the allow-list by mistake
  // this line still refuses it. testHostGuardIsAFailClosedBackstop() in
  // safe-url.test.ts goes red the moment a non-special scheme is allow-listed,
  // i.e. the moment this branch stops being unreachable.
  //
  // Note the earlier comment here claimed this rejected 'http:/\/\evil.com'.
  // That was wrong: the WHATWG parser reads the backslashes as slashes and
  // yields hostname 'evil.com', so that input is ACCEPTED by this function.
  // Go's net/url yields Host == "" for it and the server rejects it -- a real
  // client/server divergence, pinned as "backslash host confusion" in
  // testdata/url-scheme-cases.json.
  if (parsed.hostname === '') return undefined;

  return raw;
}
