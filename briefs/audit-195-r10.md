# audit-195-r10 — security audit, `markdown-sanitize-r10` @ `0b52dcd`

**Read `/scion-volumes/scratchpad/projects/farmtable/briefs/_r10-baseline-block.md` FIRST and in
full.**

**You are one of three independent legs.** A code-review leg and a test-engineering leg are running
in parallel, in their own clones, on the same commit, on different axes. **You will not see their
reports and they will not see yours. Do not defer a security question to them.**

## Read this before you scope your work

**The diff contains no production code.** `markdown.ts` is byte-for-byte unchanged across
`13680c2..0b52dcd`; the only files touched are `markdown.test.ts` and a project log
`[MEASURED — me]`. **So auditing the diff is nearly worthless, and I am not asking you to do it.**

Your axis is the product: **is the markdown rendering path actually safe, and does this ten-round
test suite establish that it is?** A suite can be immaculate and still be evidence about the wrong
thing.

## The specific reason you exist this round

A parallel security audit on a *different* branch (the `url-scheme-validation` XSS fix) reached a
conclusion that lands squarely in your territory, and I have routed it here rather than letting that
branch widen its scope. **I am relaying it as `[REPORTED]` — I have not verified any of it. Verify
before you build on it, and tell me if it is wrong.**

Their finding, in substance:

> The XSS fix closes the `href`-binding route. It does **not** close the harm it names. Untrusted
> description and comment text still reaches the DOM through
> `unsafeHTML(renderMarkdown(...))` at `ft-inspector-desc.ts:233` and `ft-inspector-comments.ts:221`.
> DOMPurify's default configuration admits `mailto:`, `tel:`, `ftp:`, `sms:`, `cid:` and `xmpp:`
> schemes — **a wider scheme policy than the application's own allow-list** — plus `<form action>`
> and `<img src>`. And this path emits **no `target="_blank"`**.

That last clause is the one I want you to take most seriously, because the same audit established by
**settled execution in real Chromium** — not by reading code — that:

> `javascript:` with no `target`, or `target="_self"` → **EXECUTED**.
> The same payload with `target="_blank"` → **NOT_EXECUTED**. Positive control:
> `__popupsAllowed: true`.

`[REPORTED]`. If that is right, then `target="_blank"` was doing load-bearing security work on the
*other* route, nobody had pinned it, and **the markdown route does not have it at all.**

**`/usr/bin/chromium` is installed in this environment** `[REPORTED — the parallel leg used it;
verify it exists for you]`. You are therefore able to settle execution questions by observation
rather than by argument. **Do that.** A claim that a payload does or does not execute is worth
enormously more when it comes from a browser than from a reading of DOMPurify's source.

## What I want established, in priority order

1. **Can untrusted markdown produce a navigable or fetching URL of a scheme the application's own
   allow-list would reject?** Concretely: `<a href>`, `<form action>`, `<img src>`, and anything else
   you find. Build a differential corpus — inputs the server accepts, rendered through the real
   `renderMarkdown`, and check what survives into the DOM. **Give me your denominator and your
   method, and state what your method would miss.** The parallel audit ran an 80-input corpus with a
   deliberate positive-control class; a corpus with no positive control is not a measurement.

2. **Does anything execute?** Settle it in Chromium. Distinguish, in these words, **what you
   observed** from **what you inferred**. If nothing executes, say what is *preventing* it — and then
   ask whether that preventer is pinned by any test, because the whole lesson of the parallel round
   was a load-bearing mitigation that nobody knew was load-bearing.

3. **The asymmetry is the architectural finding, if it holds.** One route through this application
   validates URLs against a narrow first-party allow-list. Another route hands the decision to
   DOMPurify's defaults. **Two different scheme policies on the same origin, for the same class of
   untrusted input, is a defect independent of whether you can currently exploit either one** —
   because the narrow one is the one the team reasons about and the wide one is the one that actually
   renders. Rate it, and say plainly whether the fix is to narrow DOMPurify or to route both through
   one chokepoint. This is rule 24: the hazard is open-set, so the fix is a chokepoint, not a longer
   list.

4. **Does this suite test the thing that matters?** Ten rounds have hardened a scanner that checks
   *how the sanitizer is invoked and imported* — ownership, arity, banned sinks, module specifiers.
   That is real work. But if item 1 comes back positive, then the suite has spent ten rounds securing
   the plumbing around a filter whose *policy* is wider than the app's. **Say whether the suite's
   subject matter is the right subject matter.** The author states in the report that no `href`/`src`
   URL-attribute rule was added to `markdown.test.ts`, and that `markdown.ts` was not inverted to an
   allow-list. Those are both true statements about scope; I want your judgement on whether the scope
   is the right one.

5. **What actually runs the guard.** `[MEASURED — me]` `npm test` at `0b52dcd` does invoke
   `markdown.test.js`; the `Makefile` invokes only `npm ci && npm run build` and `npm run dev`;
   `Dockerfile.server` runs `npm ci` and `npm run build`; there is no CI in this repository.
   `[MY INFERENCE — check it]` therefore no pipeline ever runs this suite. **A guard that no pipeline
   invokes is a guard that is one careless commit away from being absent, and nothing will go red.**
   Confirm or refute, and rate it. Note that this is a *different* claim from "the guard is
   registered" — being in the list and being executed are different claims.

6. **Anything adjacent.** Surface it, do not chase it. Adjacent territory has been unusually
   productive on this project — two separate audits this week found real issues from unrelated
   directions, and the single most valuable finding of the parallel round came from a leg chasing its
   own wrong prediction.

## Explicitly out of scope

- The absent Content-Security-Policy. It is **already tracked as its own approved workstream (#85)**
  and the coordinator has ruled on it. You may cite it as context for blast radius — a rating that
  ignores the surrounding trust boundary is not honest — but **do not re-derive it at length and do
  not open a fix.**
- Inverting `markdown.ts` to an allow-list (#18). You may *recommend* it; do not implement it.
- The `url-scheme-validation` branch itself, audit F7a–F7e, the Go workstreams, and task #100.

## Trust boundary — be honest in both directions

This deployment sits behind IAP, so attacker and victim are both already inside it. Previous rounds
on this project have **both over-stated and under-stated** this. Say what is established and what is
inferred, in those words, and do not inflate a rating to be heard.

## Method

- **Do not push. Do not modify production code.** `markdown.ts` must end byte-identical. Probes are
  fine; revert by snapshot restore (`cp` from `/tmp`), **never `git checkout`**; assert
  `git status --porcelain` empty afterwards.
- **Do not touch or inspect the production deployment.**
- **Do not assert exploitation you did not observe.**
- **Do not build binary probe payloads in bash string literals** — a parallel audit had both arms of
  a NUL-byte experiment silently truncated by the shell, and the two arms returned identical errors
  that read exactly like a real result.
- `npm ci` yourself. Do not accept a handed `node_modules`.

## Deliverables — you are not done until all six exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r10.md`**, verdict
   **APPROVE** or **REQUEST CHANGES**, findings numbered and severity-classified
   (Critical/High/Medium/Low/Informational), each with location, evidence, impact, recommendation.
2. **A verdict on the relayed finding** in item 1/2 — confirmed, refuted, or partially, with your
   own evidence. **This is the one I care most about.**
3. **Your differential corpus result with denominator, method, positive control, and blind spots.**
4. **A one-paragraph answer to item 4**: is this suite auditing the right subject?
5. **A project log entry** in `.design/project-log/`, **committed** (the only thing you commit).
6. **The numbered list of every place this brief is wrong** — including anything I relayed as
   `[REPORTED]` that turns out to be false. I would genuinely rather be corrected than confirmed.

**You MUST produce all six deliverables and then mark the task complete. Do NOT push.**
