# Security audit — `markdown-sanitize-r10` @ `0b52dcd`

**Verdict: APPROVE** (the change under review) — with two findings filed against the *product*
that this change does not introduce and does not fix.

**Auditor:** audit-195-r10 leg. **Tree:** `/workspace` @ `0b52dcdd6a06f694378084ea3ebefa7d9c473f15`,
branch `markdown-sanitize-r10`, `git status --porcelain` empty at start and end.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 2 |
| Low | 2 |
| Informational | 1 |

**Nothing executes.** I could not get script execution out of `renderMarkdown` in real Chromium,
and I tried with a harness whose positive controls fire. The sanitizer's core job is being done.

**Something fetches.** Thirteen distinct attacker-controlled carriers cause Chromium to make an
outbound request to an attacker-chosen origin with **no user interaction**, on render. That is the
finding of this audit and it is mine, not relayed.

### Why APPROVE

The diff is test-only (`markdown.ts` byte-identical, verified: `git diff 13680c2..0b52dcd --
web/src/util/markdown.ts` is 0 lines). It regresses nothing, introduces no attack surface, and is
careful work. Blocking a strict improvement over pre-existing issues it did not cause would be
dishonest. Finding 1 should be scheduled, not used as a merge gate. I am explicitly **not** inflating
a rating to be heard, per the brief.

---

## Verdict on the relayed finding (deliverable 2 — the one you cared most about)

**PARTIALLY CONFIRMED. Two of its clauses are wrong and one is right but inapplicable.**

| Relayed clause | My verdict | Evidence |
|---|---|---|
| Untrusted text reaches DOM via `unsafeHTML(renderMarkdown(...))` at `ft-inspector-desc.ts:233` and `ft-inspector-comments.ts:221` | **CONFIRMED** | Both line numbers exact. `Description: issue.GetBody()` at `internal/platform/github/github.go:163` — verbatim, unsanitised. |
| DOMPurify admits `mailto: tel: ftp: sms: cid: xmpp:` | **CONFIRMED, and the list is incomplete** | All six survive. So do **`callto:`** and **`ftps:`**, which the relay omitted. |
| ...plus **`<form action>`** | **REFUTED** | `form` is in `FORBID_TAGS`; `action` *and* `formaction` are in `FORBID_ATTR`. All 29 schemes × 3 form carriers = 87 renders, **zero** survivals. The relay names a hole the code closed deliberately, with a comment explaining why both halves are forbidden so neither is load-bearing alone. |
| ...plus `<img src>` | **CONFIRMED, and far wider than stated** | See Finding 1: 13 carriers, not one. |
| This path emits no `target="_blank"` | **CONFIRMED** — but see below | The suite *deliberately strips* `target` (check 27). |
| `javascript:` no-target/`_self` → EXECUTED; `target="_blank"` → NOT_EXECUTED | **CONFIRMED, and robustly** | Chromium 149.0.7827.196, 4 target variants × 2 popup-blocker settings. Identical result with the popup blocker **on and off**, so it is not a popup-blocker artifact — which is a stronger result than the relay's own `__popupsAllowed` control established. |

**The inapplicability, which matters.** The `target="_blank"` result is true and it does *not* bear on
the markdown route, because `renderMarkdown` **strips the `href` attribute entirely** before the
question can arise. Observed DOM: `<a id="T">x</a>` — no `href`. There is no `javascript:` URL left
for `target` to fail to protect. So the relayed inference "the markdown route lacks the load-bearing
mitigation" is **conditional, not live**: it would only bite if DOMPurify's URI filter were bypassed
or reconfigured. I rate that as Low (Finding 3), not High.

---

## Findings

### [MEDIUM] Finding 1 — Attacker-controlled markdown causes unconsented outbound network egress from inside the trust perimeter, via 13 carriers, with no user interaction

**Location:** `web/src/util/markdown.ts:218-224` (policy); rendered at
`web/src/components/inspector/ft-inspector-desc.ts:233` and
`web/src/components/inspector/ft-inspector-comments.ts:221`.

**Observation (measured, Chromium 149, real network).** I served real `renderMarkdown` output to
headless Chromium and logged every request it made. **14 of 15 candidates fetched**, including the
positive control; `blockquote[cite]` correctly did not (it is metadata, not a fetch). The 13
non-control carriers that fetched an attacker-chosen URL on render, with no click:

```
img-src   md-image   img-srcset   video-poster   video-src   audio-src
source-src   source-srcset   track-src   table-bg
svg-image-href   svg-image-xlink   svg-feimage
```

**Impact.** `Description` is `issue.GetBody()`, mirrored verbatim from GitHub with no server-side
sanitisation. So the *injector* need not be inside IAP at all — anyone who can open an issue on a
mirrored repo qualifies — while the *victim* is an authenticated operator inside it. On render the
attacker learns: viewer IP, User-Agent, and the precise time a given task was viewed, repeatable per
task. `svg-feimage` and `table-bg` additionally survive in contexts where a reviewer eyeballing the
markdown source would not expect a fetch.

Being honest in both directions, as asked: IAP protects **inbound** access, not **outbound**
requests, so it does not mitigate this. Equally, this is **not** XSS, reads no application data, and
steals no credentials. It is a tracking-and-reconnaissance primitive that crosses a trust boundary,
which is why it is Medium and not High. The absent CSP (#85) is the reason nothing downstream
catches it; cited as blast-radius context only, per scope.

**The part that makes this a defect rather than a design choice.** The suite already reasons about
exactly this threat — check 36, *"svg style cannot reach an attacker origin"*, whose comment says
`@import` and `url()` "reach an attacker origin with **no user interaction**, so the fix has to be
pinned against the remote-fetch vector specifically". That is the correct threat model, applied to
CSS. Meanwhile check 48, *"images with safe src render"*, **pins the `<img src>` channel open** as
required behaviour. The same threat model reached opposite conclusions on two channels that achieve
an identical effect, and the media channel is the easier one.

**Ablation (measured).** I added `ADD_ATTR: ['ping']` to the sanitizer config — `<a ping>` is a pure
egress primitive that POSTs on click. **`npm test` exit 0, 83/83 green.** The suite cannot see
egress-widening. Control: adding `ALLOW_UNKNOWN_PROTOCOLS: true` gave **exit 1, 1 of 83 failed**, so
the suite does catch scheme-widening. Both mutations reverted by `cp` from `/tmp` snapshot; md5
restored to `2cfe203b…`; **0 of 2 cells left the tree dirty.**

**Recommendation.** Decide the policy deliberately, then pin it. If remote images are wanted, say so
in a comment and pin the rest closed:

```ts
// Media that fetches on render is an egress channel: mirrored markdown is
// third-party, so every one of these reaches an attacker origin with no user
// interaction. Same argument as the <svg><style> @import case.
const FORBID_TAGS = [
  'form', 'input', 'button', 'select', 'textarea', 'option', 'dialog', 'style',
  'video', 'audio', 'source', 'track',            // + media egress
];
const FORBID_ATTR = [
  'style', 'class', 'formaction', 'action', 'download', 'slot',
  'srcset', 'poster', 'background', 'ping',       // + egress attributes
];
```

`<img src>` and SVG `<image href>` remain the open question — they cannot be closed without losing
legitimate images. If they stay open, that is defensible, but it should be a written decision with a
test that says so, not a default.

---

### [MEDIUM] Finding 2 — No pipeline executes the guard suite; its only trigger is an honour-system checkbox

**Location:** repo-wide. **Brief item 5: CONFIRMED, with one correction to the stated fact.**

**Observation.** Every `npm` invocation in the repository (excluding `node_modules`):

```
Makefile:17          cd web && npm ci && npm run build
Makefile:20          cd web && npm run dev
Dockerfile:4,6       npm ci ; npm run build
Dockerfile.server:4,6  npm ci ; npm run build
```

**None runs `npm test`.** `.git/hooks/` is empty — not even the default `.sample` files. There are no
workflow files: the only YAML in the repo is `buf.gen.yaml` and `proto/buf.yaml`.

**Correction to the brief:** *"there is no CI anywhere in this repository"* is wrong as stated —
**`.github/` does exist.** It contains `PULL_REQUEST_TEMPLATE.md` and `ISSUE_TEMPLATE/bug_report.md`
and **no `workflows/` directory**, so your *inference* survives intact. But the detail is material,
because the PR template contains the line `- [ ] Tests pass`. That checkbox is the **entire**
enforcement mechanism for ten rounds of guard work.

**Inference (labelled as such).** Every behavioural assertion in this 5,583-line suite can be deleted
or eviscerated and **every container build stays green**. The suite's own comment at line 49
concedes the related half of this: `EXPECTED_CHECKS` pins *deletion* of a check but not its
*evisceration*, measured green at 69 with a check body replaced by an early return.

**One thing that is not rot-proof but is compile-proof.** `npm run build` = `tsc --noEmit && vite
build`, and `tsconfig.json` has `"include": ["src"]`, so the build **does** type-check
`markdown.test.ts`. I verified this rather than assuming it: `npx tsc --noEmit --listFiles | grep -c
markdown.test.ts` → **1**. So the file cannot silently stop compiling, and the baseline block's
warning is correct: a test-only dependency would break the production container build. Type-checked
is not executed, though — the assertions never run.

**Recommendation.** One line in both Dockerfiles or a `make check` target:

```make
check:
	cd web && npm ci && npm test && npm run build
```

Given there is no CI, a git `pre-push` hook is the cheaper honest option. Until something invokes it,
the guard's strength is a property of reviewer diligence, not of the repository.

---

### [LOW] Finding 3 — Two scheme policies, one of which is an inherited default nobody chose

**Corrects the brief's premise.** Brief item 3 says *"One route validates URLs against a narrow
first-party allow-list. Another hands the decision to DOMPurify's defaults."* **On this branch the
first route does not exist.** There is no URL allow-list anywhere in `web/src` (grepped for
`allowed_scheme|isSafeUrl|safeUrl|sanitizeUrl|scheme`, with a positive control confirming the grep
finds things that are there). The three `href` bindings —
`ft-toolbar.ts:465`, `ft-inspector-code.ts:106`, `ft-inspector-meta.ts:611` — bind
`href=${url}` **raw, with no validation at all**, each with `target="_blank" rel="noopener"`.

So the asymmetry is real but **prospective**: it arrives when `url-scheme-validation` merges. Today
the asymmetry runs the *other* way — the DOMPurify route is the **better**-defended of the two, and
the raw-binding route is protected only by the `target="_blank"` behaviour I measured above, which
nobody pinned. That inverts the brief's severity framing.

**Measured scheme policy on the markdown route** (survive into `href`): `http https ftp ftps mailto
tel callto sms cid xmpp`; plus `data:` into media `src`/`href` only. Blocked: `javascript vbscript
blob file jar view-source ms-msdt search-ms ms-officecmd steam slack zoommtg vscode itms-services
intent chrome about evilproto`. None of the survivors is XSS.

**Recommendation — chokepoint, not a longer list (rule 24).** The hazard is open-set, so route both
through one function and set the policy once:

```ts
// web/src/util/url-policy.ts — single source of truth for both routes
export const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|#|\/|\.\/|\.\.\/)/i;
```

Pass it to DOMPurify as `ALLOWED_URI_REGEXP` *and* use it for the raw `href` bindings. That is
strictly better than narrowing DOMPurify alone, because it makes the two routes incapable of
drifting apart. I am **recommending, not implementing** (#18 is out of scope).

---

### [LOW] Finding 4 — Stripping `target` removes the layer measured to be load-bearing elsewhere

Check 27 strips `target` to prevent tabnabbing. Correct on its own terms, and modern browsers imply
`noopener` for `target="_blank"` anyway, so what it buys is modest. But I measured that
`target="_blank"` is precisely what stops `javascript:` executing. The markdown route has therefore
removed, for a weak benefit, the layer that would contain a URI-filter failure. Not live — `href` is
stripped — so this is a defence-in-depth note, not a bug. Worth a comment recording that the
trade-off is now known, since the whole lesson of the parallel round was a mitigation nobody knew was
load-bearing.

---

### [INFO] Finding 5 — `82` vs `83` is not a discrepancy

The baseline block asked me not to smooth this over, so: there is nothing to reconcile.
`markdown.test.ts:5327-5328` reads `EXPECTED_CHECK_CALL_SITES = 82` and
`EXPECTED_CHECKS = EXPECTED_CHECK_CALL_SITES + (REQUIRED_SINKS.length - 1)`. `REQUIRED_SINKS.length`
is 2 and one `check()` call site sits inside a loop over it, so 82 call sites produce 83 executions.
I count 81 static `check('…')` literals plus 1 template-literal call site in that loop = 82. Both
numbers are correct and describe different things.

---

## Deliverable 3 — Differential corpus: denominator, method, controls, blind spots

**Denominator: 1,073 renders** = 29 schemes × 37 carriers. **238 attribute survivals.**

**Method.** Generated (scheme × carrier) inputs through the **real** `renderMarkdown` (the compiled
`.tmp-test/util/markdown.js`, same artifact `npm test` runs, under JSDOM as the suite does). Rather
than grepping for attributes I chose in advance, I **re-parsed the output** and enumerated *every
attribute of every element*, flagging any carrying my `PAYLOAD11` sentinel. That is what surfaced
`table[background]`, `feimage[xlink:href]` and `source[srcset]`, none of which I would have thought
to look for. Execution and egress were then settled in **Chromium 149**, injected via
`shadowRoot.innerHTML` — which is the faithful model, since Lit's `unsafeHTML` injects the same way.

**Positive controls — 6/6 passed in the corpus, 2/2 in the browser:**
must-survive (`https` link, `https` image, `<em>`), must-strip (`javascript:`, `<script>`,
`onerror`); in Chromium, a raw `onerror` and a raw `javascript:` href both **EXECUTED**, and the
auto-fetch arm had a known-good `<img>` that **FETCHED**.

**A control caught me making the exact error the brief warned about.** My first Chromium run
reported all six payloads `NOT_EXECUTED` — a clean-looking result. **The positive control also
reported `NOT_EXECUTED`, so the run was invalid and I discarded it.** Cause: a literal `</script>` in
my control payload terminated the page's inline script (`JSON.stringify` does not escape `/`), so
nothing on the page ran. Without the control I would have reported "nothing executes" from a page
that executed nothing *because it was broken*. Two arms, same value, different reasons — exactly the
failure mode the baseline block names. Fixed by escaping `</` and by switching the control to
`onerror` (since `innerHTML` never runs `<script>` — itself an unpinned mitigation of the real sink).

**Blind spots — what this method would miss:**
1. **Marked's parser, not just DOMPurify.** I varied schemes and carriers, not markdown *grammar*.
   Nested-emphasis, HTML-comment and CDATA edge cases that change what Marked emits are untested.
2. **mXSS via re-serialisation.** I parsed output once with JSDOM. Sanitiser bypasses that depend on
   parse→serialise→reparse differences between JSDOM and Blink would not show up.
3. **JSDOM ≠ Blink for the sanitisation step.** The sanitising DOM was JSDOM (as in production tests);
   only rendering was Blink. A Blink-specific parser quirk would be invisible.
4. **Single sentinel shape.** All payloads were `scheme:PAYLOAD11`. Encoded, whitespace-obfuscated,
   or newline-embedded scheme prefixes (`java\nscript:`) were not swept.
5. **No CSS-context or `srcdoc` fuzzing**, and no NUL/binary payloads — deliberately avoided,
   per the brief's warning about shell truncation.
6. **Click-driven navigation** was tested only for `javascript:`, not for whether e.g. `mailto:` or
   `steam:` hands off to an OS handler — that is host-configuration-dependent and not observable here.

---

## Deliverable 4 — Is this suite auditing the right subject?

**Mostly yes, and it should say what it has decided not to cover.** The suite's subject is *sanitiser
integrity* — that `renderMarkdown` is the sole chokepoint, that it owns its own `marked` and
DOMPurify instances, that no sink smuggles raw HTML past it, that its arity cannot become a
configuration channel. That is genuinely the right first-order subject, it is defended to an unusual
standard, and Ablation A shows it is not decorative: a one-word scheme-widening turns it red. The
private-instance work in particular closed a real, *measured* hole. My criticism is narrow and it is
about **scope, not quality**: the suite pins *how the filter is invoked* thoroughly and *what the
filter's policy is* only at one edge — the unknown-protocol boundary. Between "known-good" and
"unknown" sits the set DOMPurify allows by default, which nobody on this project has ever chosen, and
beneath that sits an egress channel the suite explicitly closes for CSS and explicitly pins open for
media. Ten rounds of hardening the plumbing is not wasted work, but the next round's marginal value
is much higher spent on one `href`/`src` policy rule than on an eleventh evasion table — and the
author is right that no such rule exists, which is the honest disclosure that makes this easy to act
on.

---

## Positive observations

- **`markdown.ts` is byte-identical.** Verified, not assumed. The method discipline held.
- **The core sanitiser works.** Six payload classes, real Chromium, controls firing: nothing executed.
  `href` is removed outright rather than blanked — a stronger posture than the relay assumed.
- **`<form action>` was closed deliberately and correctly**, with both the tag *and* the attribute
  forbidden "so that neither rule is load-bearing on its own". That reasoning is exactly right, and it
  is why I could refute that clause of the relayed finding.
- **The comments record measured falsifications of their own earlier claims** (the round-7
  justification, the `Function.length` reasoning, the stale cross-reference). A codebase that
  documents where it was previously wrong is rare and it made this audit much faster.
- **Check 36 shows the right threat model** — "reach an attacker origin with no user interaction" is
  the correct frame. Finding 1 is a request to apply it consistently, not to invent it.

---

## Deliverable 6 — Numbered list of every place the brief is wrong

1. **Clone path.** Baseline block §"Your tree": *"Your clone is
   `/workspace/farmtable-195-r10-<review|test|audit>`"*, tagged `[MEASURED — me, this session]`.
   **Wrong for this leg** — `git rev-parse --show-toplevel` returns **`/workspace`**. The SHA was
   right, which is exactly the argument the block itself makes. A `[MEASURED]` tag on a wrong claim
   is the most expensive kind.
2. **Diffstat.** *"markdown.test.ts +1169"*. You self-corrected mid-round; I verified independently
   rather than absorbing it, per your own advice: `--numstat` gives **1071 / 98**. Confirmed, and
   confirmed that `+1187 / -98` for the two-file total was right.
3. **"There is no CI anywhere in this repository."** Wrong as stated: **`.github/` exists**
   (PR template + issue template). No `workflows/`, so the inference holds — but the PR template's
   `- [ ] Tests pass` is the only invocation mechanism that exists and belongs in Finding 2.
4. **Only `Dockerfile.server` is named.** There are **two** Dockerfiles — `Dockerfile` and
   `Dockerfile.server` — both running `npm ci` and `npm run build`. Doesn't change the conclusion;
   does change the remediation surface.
5. **Relayed: `<form action>` reaches the DOM. REFUTED.** `form` ∈ `FORBID_TAGS`, `action` and
   `formaction` ∈ `FORBID_ATTR`; 87 form-carrier renders, zero survivals.
6. **Relayed scheme list is incomplete.** Omits **`callto:`** and **`ftps:`**, both measured to
   survive into `href`. It also omits that **`data:`** survives into media `src`/`href`, which the
   relay's framing ("DOMPurify's defaults are wider") understates rather than overstates.
7. **Brief item 3's premise is false on this branch.** *"One route validates URLs against a narrow
   first-party allow-list"* — **no such allow-list exists here.** The three `href` bindings are raw.
   The asymmetry is prospective, and today runs the opposite way from how the brief frames it. This
   inverts the severity: I rate it Low, not the architectural Medium/High the framing implies.
8. **"If you cannot reconcile 82 with 83, that discrepancy is worth a line."** There is no
   discrepancy — it is arithmetic in the source (`EXPECTED_CHECKS = 82 + (REQUIRED_SINKS.length-1)`).
   Presenting it as a possible defect is a false lead, though a cheap one.
9. **`origin/main` does not resolve** — correct, but stated in a way that invites the stronger
   reading. `origin/HEAD`, `origin/markdown-sanitize-r10` and `origin/markdown-sanitize-r9` all
   resolve fine. Only `main` is absent.
10. **Brief item 2's weighting is misplaced.** You asked me to take the missing `target="_blank"`
    "most seriously". The underlying browser claim is **true** (I confirmed it more strongly than the
    relay did), but it is **inapplicable to the markdown route**, because `href` never survives. The
    thing you weighted highest is the thing that turned out not to matter here — while the thing
    nobody mentioned (egress) is the actual finding. Not an error of fact; an error of priority, and
    the more costly kind since it steers effort.
11. **Not an error, recorded because you asked to be corrected rather than confirmed:** the
    `[MEASURED]` claims I could check — `markdown.ts` byte-identical, `npm test` invoking
    `markdown.test.js`, `tsconfig.test.json`'s `include`, the Makefile's two `npm` lines, 15 commits,
    gates green at 83/131 — **all verified true.** The failure rate is concentrated in `[REPORTED]`
    and in framing, not in what you measured yourself. That is an argument for the tagging system
    working.

**My own error, for symmetry:** my first Chromium execution arm was invalid (§Deliverable 3) and I
would have reported a false clean result had I not run a positive control. Recorded because a report
that lists only the author's errors is not an honest document.

---

## Recommendations (proactive)

1. **Decide the URL policy once, in one file, and pin it** — the chokepoint in Finding 3. Do this
   *before* `url-scheme-validation` merges, or the two policies ship and drift.
2. **Add one `href`/`src` attribute-policy check** to `markdown.test.ts`. Highest marginal value
   available to this workstream, and it is the gap the author already disclosed.
3. **Make something execute the suite** (Finding 2). A guard nothing invokes is worth what it costs
   to delete.
4. **Record the `target` trade-off** (Finding 4) in a comment so the next reader does not rediscover
   it the expensive way.
5. **Adjacent, surfaced not chased, per item 6:** the three raw `href=${url}` bindings at
   `ft-toolbar.ts:465`, `ft-inspector-code.ts:106`, `ft-inspector-meta.ts:611` take `remoteUrl` /
   `pr.url` straight from mirrored platform data with no validation. That is the *other* route, it is
   on this branch, and on this branch it is the less defended of the two. It is where I would look
   next.
