# dev-xss-url — ADDENDUM 1 (corrections to the brief you were given)

Read this before you finish MUST 1. Two of the corrections change your scope; one changes
what you are allowed to claim in your report.

Source: `audit-195-r9`, an independent security audit that ran in parallel on the *other*
workstream (#195) and landed on the same two `href` sinks from a different direction, plus
four measurements I made myself against `7a0f220` after reading it.

---

## CORRECTION 1 — my field list was wrong, and it does not cover the sink I told you to guard

My brief said:

> "The proto declares `[(buf.validate.field).string.uri = true]` on **two** fields —
> `PullRequest.url` and `Attachment.url`."

**That is wrong. There are FOUR** `[MEASURED by me at 7a0f220: grep -c 'string.uri = true'
= 4]`:

| proto line | owning message | field |
|---|---|---|
| 241 | `Attachment` | `url` |
| 265 | `PullRequest` | `url` |
| 343 | `Task` | `remote_url` |
| **633** | **`UpdateTaskRequest`** | **`remote_url`** |

The failure is instructive and it is the project's own taxonomy form (6), *a confirmed lower
bound reported as a count*: I enumerated partially, found two, and wrote "two". The auditor
independently did the same thing and also wrote "two" — but **a different two** (`:343` and
`:265`). The union of our two confident lists is three of the four. Two independent partial
enumerations agreeing on a count is not corroboration.

**Why this matters to your fix, concretely:** MUST 2 tells you to guard
`href=${t.remoteUrl}` at `ft-inspector-meta.ts:611`. The field feeding that sink is
`Task.remote_url` / `UpdateTaskRequest.remote_url` — **neither of which appears in MUST 1's
ingress list.** As written, my brief had you validating ingress for two fields and guarding a
sink fed by a third. Fix ingress for **all four**.

The write path for `remote_url` is `internal/server/server.go:654-661`
`[MEASURED by me at 7a0f220]`:

```go
if req.RemoteId != nil || req.RemoteUrl != nil {
    p.RemoteData = map[string]any{}
    ...
    if req.RemoteUrl != nil {
        p.RemoteData["remote_url"] = req.GetRemoteUrl()
```

Note it lands in an untyped `map[string]any`, not a typed field.

## CORRECTION 1b — a second ingress path for the same data, which my brief never mentioned

`internal/server/export_import.go` imports the **whole `RemoteData` map raw from uploaded
JSON** (`:740`, and `:438`) `[MEASURED-BY-audit-195-r9; the line numbers re-measured by me]`.
So a scheme check applied only in `UpdateTask` is bypassable by collection import.

This is the same measurement hazard my brief already warned you about in a different costume:
I told you "put the check where BOTH paths reach it" and named the server/CLI split. There is
a **third** path. **Do not treat my list of paths as closed either.** Enumerate the writers of
these four fields yourself and report the denominator.

## CORRECTION 1c — an open question I could not close, flagged as open rather than clean

`proto/farmtable.proto:147` declares `CUSTOM_FIELD_TYPE_URL = 8` — users can define custom
fields whose declared type is URL. I grepped the inspector components for a URL-typed
custom-field renderer and **found nothing**. I am reporting that as **UNRESOLVED, not clean**,
because a narrow grep returning nothing is exactly the false negative I already made once on
this task and wrote into your brief as a worked example. If your MUST 3 sweep can settle
whether a URL-typed custom field value reaches any `href`/`src`, settle it. If not, say so.

---

## CORRECTION 2 — I over-claimed the exploit, and you must not repeat the claim

My brief states, flatly:

> "A user who opens the task inspector and clicks the link executes attacker script in the
> dashboard origin with their session."

**Nobody has measured that, and there is a specific reason to doubt it.** Both anchors carry
`target="_blank"` `[MEASURED by me at 7a0f220, both sinks — see below]`, and modern browser
engines block `javascript:` navigation into a *new browsing context*. `audit-195-r9` rendered
the real template under JSDOM, confirmed the href is emitted **verbatim** with no Lit
sanitization, and then **explicitly declined to assert execution** because JSDOM implements no
navigation and no real browser engine was available. That is the correct call and I should
have made it.

My measurement of the anchors at the production base:

```
ft-inspector-code.ts:106  <a class="pr-link" href=${pr.url} target="_blank" rel="noopener">
ft-inspector-meta.ts:610-612  <a
                                href=${t.remoteUrl}
                                target="_blank"
```

**What is established** (three independent legs, and verbatim rendering measured under JSDOM):
attacker-controlled text reaches an `href` attribute with no validation in Go, no validation in
TypeScript, and no sanitizer in Lit.

**What is NOT established:** that `javascript:` executes on click in a real browser.

**What follows for you.** The fix does not change — it gets *more* clearly correct, because
the reason to fix it no longer rests on one contested payload:

- The harm that **is** measured is an arbitrary attacker URL rendered under first-party
  dashboard chrome — credential phishing with a trusted affordance. The auditor's sharpest
  line: the markdown sanitizer forbids `<form>` precisely to prevent phishing, and the href
  path hands out the phishing link.
- `target="_blank"` is an **incidental** mitigation. It is there for tabnabbing, **nothing
  pins it**, and if it is ever removed this becomes critical with a fully green suite.
- `data:` and `vbscript:` are in the same open set and are not equally mitigated.

So: allow-list `http`/`https` at the chokepoint exactly as MUST 1 says. **But in your report,
state precisely what you measured and do not inherit my execution claim.** If you have any
way to test real navigation behaviour, that is valuable — and a negative there needs a
positive control just like everything else. **I have escalated this correction to the
coordinator**, who relayed my original framing upward.

**Consider adding a pin for `target="_blank"` itself** on both anchors, so that the
incidental mitigation stops being incidental. Your call; report the decision either way.

---

## CORRECTION 3 — additions to MUST 2 and MUST 3 from the audit

**3a. A concrete helper shape, and a scheme-set question I want you to decide on evidence.**
The auditor proposes `web/src/util/url.ts`:

```ts
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);
export function safeExternalHref(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  let u: URL;
  try { u = new URL(raw, window.location.origin); } catch { return undefined; }
  return SAFE_SCHEMES.has(u.protocol) ? u.href : undefined;
}
```

This matches my MUST 2 "one shared helper, not three copies". **But note it allows `mailto:`
and my server-side MUST 1 allows only `http`/`https`.** Do not silently adopt either set.
Decide, justify it from what these fields are actually for, and **make client and server
agree or explain in your report why they must differ.** A client that renders a scheme the
server rejects is dead code; a client that renders a scheme the server accepts and the client
blocks is a broken feature.

Also watch the `new URL(raw, window.location.origin)` base argument: it makes relative inputs
resolve to same-origin absolute URLs rather than being rejected. Measure whether that is what
you want.

**3b. Degrade, don't drop.** The auditor's pattern renders a non-link `<span>` when the URL is
rejected, so the user still sees the value. Prefer that over rendering nothing.

**3c. `ft-toolbar.ts:460-465` is confirmed as the good pattern** by a second leg — validate the
opaque identifier against `GITHUB_REPO_RE`, build the URL from a literal prefix, degrade to a
badge otherwise. My brief told you to verify it yourself. Still do.

**3d. NEW REQUIREMENT — add the rule to the guard, not just the fix to the sites.**
`web/src/util/markdown.test.ts` has a tree-wide `BANNED_SINKS` scanner with eight patterns and
**not one is about a URL-bearing attribute** `[MEASURED-BY-audit-195-r9]`. The auditor planted
`<a href=${this.description}>` into a scanned file and the whole suite stayed **GREEN at
79/127** — with a same-file, same-harness positive control (`.innerHTML =`) going **RED**, so
that is a real gap and not a broken probe.

Add a tree-wide rule along the lines of:

```ts
{ name: 'dynamic href/src binding', pattern: /\b(href|src)\s*=\s*\$\{/ },
```

allow-listing only call sites that go through your helper. **When a hazard is open-set, the fix
is a chokepoint, not a checklist** — your two site fixes are the checklist; this rule is what
stops the eleventh binding someone adds next month.

**COORDINATION CONSTRAINT, IMPORTANT.** `markdown.test.ts` is simultaneously being edited by
the `#195` round-10 leg. **You own the new URL-attribute rule; they own everything else in that
file.** Keep your change to that file additive and self-contained — a new fixture table plus one
tree-wide rule and its positive fixture. Do not refactor anything else there. A mechanical
merge conflict is my problem, not yours; a semantic one is expensive, so stay in your lane.

**3e. Any new detection pattern needs a positive fixture.** That file already diagnosed
"untested detection logic" as a defect in itself. A pattern with no fixture proving it fires is
the same defect.

---

## Standing items unchanged

Everything else in the original brief stands: parse don't pattern-match; allow-list; the
CLI-has-no-interceptor hazard; exit codes from the child process; a negative needs a positive
control; predict before measuring; a green control is a finding; revert every experiment;
`git diff --quiet` after. All five deliverables, and **never push**.

**Add to deliverable 4** (every place the brief was wrong): this addendum is now part of the
brief. Corrections 1, 1b, 1c and 2 are errors I am self-reporting — **you are still expected
to find the ones I have not.** Twelve consecutive rounds; assume there are more.

**You MUST produce all five deliverables and then mark the task complete.**
