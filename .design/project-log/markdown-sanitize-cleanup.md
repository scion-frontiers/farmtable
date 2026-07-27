# markdown-sanitize cleanup — pre-merge round on #195

Branch: `markdown-sanitize`, from `204af7e`.
Commits: `f202448 Harden markdown sanitizer: dialog, class, svg style; bind sinks (#195)`,
`7084880 test: pin the markdown sanitizer check total (#195)`

Follow-up to `.design/project-log/markdown-sanitize.md`. All three reviewers
(`review-195`, `audit-195`, `test-195`) returned **APPROVE**; this round is the
short cleanup commit the code review recommended before merge, plus one new
finding surfaced while doing it.

## Change

Sanitizer config, `web/src/util/markdown.ts`:

```
FORBID_TAGS  += dialog, style
FORBID_ATTR  += class
```

- **`dialog`** (review M1). The HTML Standard's default rendering gives a
  non-modal `<dialog>` `position: absolute` over an opaque
  `background-color: Canvas`. That is the overlay-spoofing primitive forbidding
  the `style` *attribute* was meant to deny, obtained with no `style` attribute.
- **`style`** (new finding this round, ruled in scope by the EM). DOMPurify
  strips `<style>` in the HTML namespace by default but **allows it in the SVG
  one**, so `<svg><style>` passed arbitrary CSS into the shadow root both sinks
  render into. See "New finding" below.
- **`class`** (audit LOW-1). Both sinks inject inside the Lit shadow root that
  carries the component's own stylesheet, so attacker class names resolved
  against real component CSS and forged a comment header with no inline `style`.

Checkbox renderer: the glyph regains the assistive-technology semantics the real
`<input type=checkbox>` carried, via `role="img"` and `aria-label` (review M2),
and `U+FE0E` pins text presentation so `☑`/`☐` render consistently rather than
one colour emoji beside one thin outline (review L2). The now-stripped
`ft-task-checkbox` class was dropped rather than left as dead code. The variation
selector is written as an escape, not the literal character, because the literal
is invisible in source and would be deleted by accident sooner or later.

Tests: **32 → 49 checks**, all against the real exported `renderMarkdown`.

- SVG section (test-195 G2): `foreignObject`, `script`, event handlers,
  `animate`/`set`, `xlink:href`, `use`, `image`, and the new `style` cases.
- Sink-binding guard (test-195 G1): a static scan asserting every `unsafeHTML(`
  in `src/` takes `renderMarkdown(` as its argument, and that no other raw-HTML
  sink (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`) exists.
  Nothing previously bound the sinks — dropping either wrapper reintroduced the
  whole bug class with all 32 checks still green.
- Check-total pin (test-195 G7, reopened by the EM after the first pass). See
  "Tests that disappear instead of failing" below.

Dependency: `jsdom` `^29.1.1` → **`^26.1.0`** (review L1, expanded by the EM).

## New finding: `<svg><style>` CSS injection — Medium

```
in : <svg><style>:host{position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;z-index:9999}</style></svg>
out: <p><svg><style>:host{position:fixed;...;z-index:9999}</style></svg></p>
```

Live `<style>` element in the SVG namespace, CSS text intact, reachable through
every markdown container path tried (raw block, list item, table cell,
blockquote). Strictly more capable than either `<dialog>` or class-reuse: the
attacker writes arbitrary rules into the component's shadow root instead of
reusing the classes that happen to exist.

Rated **Medium**, not High: no script execution, and no in-page credential
capture, because all form controls are already stripped. But it carries an
**exfiltration dimension the other two do not** — `@import url(...)` is a remote
fetch, and `url()` in an attribute-selector rule leaks content presence
off-origin, both with no user interaction. Recorded separately rather than folded
under "spoofing" at the EM's instruction.

Fixed here by one word in `FORBID_TAGS`, on the EM's ruling, with the
remote-fetch vector pinned by its own test rather than only the visual one.

## Tests that disappear instead of failing (G7)

This suite printed its own check count and asserted nothing about it. A deleted
or unreached check therefore did not fail — it ceased to exist, and the suite
stayed green one count lower. Which means every mutation count in the table
below, the evidence this branch's merge decision rests on, was a number nothing
checked.

Pinned in `run()`: `EXPECTED_CHECKS = 49`, compared against `checks`, reported
through the existing `failures` array so it formats like every other failure and
does not mask earlier ones. It is not counted as a check itself, so the printed
total still means "sanitizer checks that ran".

Mutation-verified both directions: deleting the `dialog` check with the pin in
place gives `1 of 48 ... expected 49 checks to run, 48 did`; the *same* deletion
with the pin removed prints `48 checks passed`, exit 0, with the `dialog` control
proved by nothing. The two original mutation counts were re-measured with the pin
in place and are unchanged (14 and 33 of 49), because a mutated control fails
checks without removing them.

Worth recording beyond this branch: within the same hour, `test-phase2`
independently hit the same defect class on the Phase 2 branch by a different
mechanism — two test files building their case list by filtering a stage list
through the predicate under test, so narrowing the predicate deleted tests rather
than failing them (407 → 405 and 407 → 402, green both times). Two agents, two
branches, one class. A suite that reports a count should assert it.

## Item 4 (jsdom) — resolved empirically, not by judgement

`#195` declared `jsdom@^29.1.1`; the Phase 2 branch declares `^26.1.0`. The
ranges are **disjoint**, so npm would install exactly one and silently re-host
one of the two suites on a DOM major it was never tested against — the decision
landing on whoever resolves a 73-file rebase.

Determined empirically instead. The markdown suite passes on `^26.1.0`, and
beyond pass/fail, `renderMarkdown`'s output is **byte-identical on 26.1.0 and
29.1.1 across a 95-payload corpus** (sanitize output and one-pass idempotence,
0 diffs), re-confirmed against the final post-cleanup config. All 49 checks pass
on both majors. So `^26.1.0` is declared here and the Phase 2 conflict is gone.

`@types/jsdom` stays at `^28.0.3`. The skew flips direction but cannot be closed:
DefinitelyTyped publishes nothing for jsdom 22–26 (its list jumps 21.1.7 →
27.0.0) and jsdom ships no types of its own, so no matching major exists.
Recorded as a comment in `markdown.test.ts` — `package.json` cannot hold one.

## Verification

Every control added this round was mutation-tested with real failing output
(pasted in the report). Summary:

| Mutation | Result |
|---|---|
| remove `dialog` | 1 of 49 fails |
| remove `style` | 3 of 49 fail |
| remove `class` | 2 of 49 fail |
| desc sink bypasses `renderMarkdown` | 1 of 49 fails |
| comments sink bypasses `renderMarkdown` | 1 of 49 fails |
| new `innerHTML` sink added to `src/` | 1 of 49 fails |
| renderer drops `role`/`aria-label` | 1 of 49 fails |
| delete a check, pin in place | 1 of 48 fails (`expected 49 ... 48 did`) |
| delete a check, pin removed | **48 passed, exit 0** — the defect, shown live |
| original 1 — drop FORBID config | 14 of 49 (original **8** all present) |
| original 2 — drop `DOMPurify.sanitize` | 33 of 49 (original **20** all present) |
| review 3 — drop checkbox renderer | 3 of 49 (was 2 of 32) |
| review 4 — renderer ignores `checked` | 3 of 49 (was 2 of 32) |

Gate: `npm test` 49 passed · `npx tsc --noEmit` 0 · `npx tsc -p
tsconfig.test.json --noEmit` 0 · `npm run build` 0 · `npm audit --audit-level=low`
0 vulnerabilities · `go build ./...` 0.

`find dist -name '*.map' | wc -l` → **1**. See below.

## Not done, and why

- **`find dist -name '*.map'` returns 1, and that is correct.** The cleanup brief
  said to expect `0` and to stop and report `1` as a lost sourcemap fix. Reported;
  the EM confirmed the brief was wrong. `#195` forks from `origin/main`, and the
  sourcemap fix (`b35f36e`) is not on main — it lives on the Phase 2 line and
  reaches main only when Phase 2 merges last. `1` is the expected number on this
  branch. `vite.config.ts` still has `sourcemap: true` and was **not** touched.
  `audit-195` (LOW-3) and `test-195` both independently recorded `1` at `204af7e`.
- **`optgroup` not added to `FORBID_TAGS`** (review L4). The brief scoped item 1
  to `dialog` — "one word". `optgroup` is inert with `select`/`option` forbidden.
  Raised with the EM, who **declined it for this round and routed it to the
  follow-up cleanup branch** rather than dropping it. Logged, not lost.
- **Review L3 (unreachable `action`/`formaction` comment) — explicitly out of
  scope** in the brief. The comment still reads as though they are active
  controls. Untouched.
- **Audit INFO items — explicitly out of scope.** INFO-3 (renderer output is
  injected pre-escaped in marked's loose-list path) is the one worth taking
  later; it is a comment, not a defect.
- **test-195 G3–G6, G8, G9 not addressed.** Only G1 and G2 (the two Highs) were
  in scope. G7 was originally listed here as out-of-scope-but-recommended; the EM
  reopened it and it is now done (see above). Listing a gap as both out of scope
  and as undermining every other test in the suite was not a coherent position.
- **No CSP** (audit LOW-2). Still the highest-value follow-up: `form-action
  'self'` makes this entire bug class structurally impossible, and `style-src`
  would have independently blunted the `<svg><style>` finding above. Belongs with
  deploy config, needs its own issue.
- **Sink binding is proved statically, not by rendering.** A test that mounts the
  two Lit components and asserts on the shadow DOM would be stronger, but needs
  custom elements, adopted stylesheets and the Shoelace/gRPC imports they pull
  in — none of which the plain `node` runner has. That is a
  vitest-and-component-harness change, i.e. Phase 2's job. The static scan's
  known weakness (an aliased or dynamically-built sink) is unreachable today.
- **Still jsdom, not Chromium** (audit rec 6, test-195 G9). Unchanged from the
  previous round, and now pinned across two jsdom majors rather than one, which
  narrows the risk without removing it.
