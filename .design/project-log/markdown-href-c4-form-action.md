# C-4 — `<form action>` bypassed the sink that F-1 closed

2026-07-29. Branch `hardening/markdown-href`, clone `/workspace/farmtable-mdhref`.
Raised by `review-markdown-href` on the re-gate of `b634c602`, which confirmed
F-1 as written is closed at `markdown.ts:126` and then found this beside it.

## The defect, reproduced before it was believed

```
<form action="https://github.com@evil.example/"><button>View pull request #482</button></form>
```

One submit control. No `method`, so GET. Clicking it contacts `evil.example` and
hands it the userinfo `github.com:`, with the button's own label chosen by the
same author who chose the address. That is **F-1's own impact sentence at F-1's
own sink** — reads as one host, contacts another, leaks credentials on click —
and it walked past the URL policy untouched.

Measured on a faithful replica of the shipped pipeline before anything changed
(`/workspace/mdhref-rig/measure-form-action.mjs`), with the hook as it stood at
`b634c602`:

```
SURVIVES  form action              <form action="https://github.com@evil.example/">…
SURVIVES  form action, method=post
refused   input formaction         <form><input type="submit"></form>
refused   button formaction        <form><button>Go</button></form>
refused   a href (control)         <p><a>x</a></p>
```

## Why it got through, and what it was NOT

**The predicate was never wrong.** `isPermitted` returns the correct answer for
`https://github.com@evil.example/` and always did — it is refused at
`markdown.ts:126` on userinfo, exactly like the `href` form of the same URL. The
hook simply never asked it, because `LINK_ATTRS` did not contain `action`.

So C-4 is not a second parser, not a carve-out, and not a policy gap. **It is an
enumeration that fell behind the thing it enumerates.** The fix is one array
entry. Anything larger would be redesigning a component that measured correct.

The failure that let it sit there is in the prose, and it is worth more than the
fix. The docblock at the list said:

> NOT MEASURED: whether any further attribute permitted by a **future**
> DOMPurify default navigates.

Every word true, and the tense wrong. `action` was permitted **then**, navigated
**then**, and was absent from the list **then**. A reader checking whether the
list was complete would have read that sentence as "a risk about later versions"
and stopped — the sentence routed them past a live hole while sounding careful.
**A present-tense gap written in the future tense is worse than no disclosure,
because it consumes the attention that would have found it.** It is now stated
in the present tense, and it says plainly that nothing reconciles this list
against DOMPurify's allowed-attribute set today.

## What landed

| | |
|---|---|
| `markdown.ts:54` | `LINK_ATTRS = ['href', 'xlink:href', 'action']` — one entry |
| `markdown.ts:38-53` | the list's docblock: why `action`, the measured `formaction` negative, and the gap restated in the present tense |
| `markdown.ts:215-236` | scope paragraph: names all three attributes, and corrects the accepted-risk count (below) |
| `markdown-href.test.ts` | `testFormActionIsPoliced`, pinned, both polarities |

`url-binding-scan.test.ts` is untouched, as instructed — it has zero changes
across `89a974da..b634c602` and stays that way.

### RED before GREEN

Written before the array entry, against `b634c602`:

```
Error: a credential-bearing form action survived
  (got https://github.com@evil.example/, want null)
  at testFormActionIsPoliced (markdown-href.test.js:510:5)
not ok 4 - web/.tmp-test/util/markdown-href.test.js
```

GREEN after, with the arm carrying four rows so it cannot pass by accident:
the GET vector refused; the POST vector refused (the URL policy makes no
distinction between methods and neither may the arm); an ordinary
`https://example.com/search` action KEPT; a same-origin `/tasks/search` action
KEPT. Plus the Option B row — the button's label survives the refusal, because
removing the `action` must not remove the control's own text.

`formaction` is deliberately **not** pinned. DOMPurify's defaults strip it before
any hook runs, measured on this version; pinning somebody else's behaviour as if
it were ours makes a guard look wider than its evidence. It is recorded in the
docblock instead, with the consequence: if `formaction` ever survives an upgrade,
it belongs in the list.

## R-2 — the accepted risk was sized at one attribute and it is four

Separate from C-4, prose only, and **the `src` ruling is not re-litigated**. The
scope paragraph named `src` alone as the credential leak that is knowingly not
guarded. Measured on the same replica, all four survive with credentials intact
and all four fetch **on render, with no click at all**:

| attribute | measured survivor |
|---|---|
| `src` | `<img src="https://github.com@evil.example/x.png">` |
| `srcset` | `<img srcset="https://github.com@evil.example/x.png 1x">` |
| `poster` | `<video poster="https://github.com@evil.example/p.png">` |
| `background` | `<table background=…>` **and** `<td background=…>`, both kept |

The ruling stands and no guard was added. Only the count changed: **a disclosure
that understates its own scope is not a disclosure**, and whoever revisits the
`src` decision is revisiting four attributes, not one.

## The general shape, since this is the second time tonight

C-1/C-2/C-3 were a bespoke parser that was weaker than the function it carved
around. C-4 is a list that was shorter than the attribute set it filtered.
**Both are the same failure at different sizes: a local restatement of a fact
that lives somewhere else.** The predicate was fixed by deleting the restatement
and asking the platform. The list cannot be fixed that way today — nothing walks
DOMPurify's allowed-attribute set and asserts that nothing navigable is missing
here. That reconciliation is the durable fix and IT IS NOT BUILT; until it is,
every DOMPurify upgrade silently re-opens this question and no gate will say so.
Filed, not closed, and stated in the code rather than only here.

## Gates, re-run

| gate | result |
|---|---|
| `npm test` | 7 files, 7 pass, 0 fail |
| `go build ./...` | exit 0 |
| `go vet ./...` | exit 0 |
| `go test ./...` | 11 ok, 0 FAIL |
| `node scripts/ci-suite-manifest.mjs` | exit 0 — `enumerated=7 executed=7 missing=0 (floor 7)`, surplus=0, required=4 |
| fixtures | `cases=45 divergent=13 base_dependent=6`, suite floor 7 |

Nothing pushed; `main` unmoved at `7bb0c756`.

---

## R-3 — the disclosure was resized twice and the second size was the worse error

Re-gate of `2031c384`. C-1, C-2, C-3, C-4 and F-1 all closed on that object.
R-3 was the only Required item and it is a comment: no code, no guard, no new
pin, no `LINK_ATTRS` change.

**Correction to the record first.** F-1's closure line is `markdown.ts:145`, the
userinfo refusal — not `:148`. The same-origin carve-out at `:146` returns true
before `:148` is reached, so a same-origin credential reference is refused *only*
by `:145`, because `URL.origin` excludes userinfo. Mutation-proved by the gate.
Nothing to change; the line is recorded here so the log names it correctly.

### What was wrong

The R-2 paragraph in the section above said the accepted risk was **four
attributes wide**. Measured against the shipped policy, with `<a href>` and
`<form action>` as negative controls in the same run (both refused, so the
survivals are results and not a dead harness):

| survivor | spelling |
|---|---|
| `style` | `background-image:url(…)`, `background:url(…)`, `list-style-image:url(…)` |
| SVG functional IRIs | `fill="url(…)"`, `filter="url(…)"`, and also `mask=` and `clip-path=`, which the finding did not name |

So the number was wrong. But the number being wrong is not the finding — **the
number was the finding's defect.** "`src`" reads as an example; "four attributes
wide" reads as the output of an audit, and there was no audit. A count in that
paragraph would need precisely the reconciliation that the `LINK_ATTRS` docblock
four screens above declares IS NOT BUILT. The disclosure would have re-committed,
in itself, the error it exists to describe.

The first fix instruction I was given was to widen the count to six. That is the
same defect one notch along, and it was withdrawn before I wrote it. **A
discovery-bounded count restated after each discovery is not converging on the
truth; it is reporting the search history as if it were the boundary.** The
paragraph now states the class — *any permitted attribute that causes a fetch on
render* — and gives the known members as expressly non-exhaustive examples.

### Why the class exists, verified in the library rather than inferred

`style` is not an oversight in our hook. Read in the installed build rather than
taken on report:

- `node_modules/dompurify/dist/purify.cjs.js:683` — `DEFAULT_URI_SAFE_ATTRIBUTES`
  contains `style`.
- `:1801` — the attribute loop reaches `else if (URI_SAFE_ATTRIBUTES[lcName]) ;`
  **before** the `IS_ALLOWED_URI` test. A URI-safe name is accepted by an empty
  statement and the URI policy is never evaluated for it.

So DOMPurify is not failing to parse CSS. **It is declining to police the
attribute at all, by configuration, by default.** That is a stronger and more
useful fact than "DOMPurify does not parse CSS", because it says where to look
next: `DEFAULT_URI_SAFE_ATTRIBUTES`, not the CSS grammar.

Two mechanisms populate the class, and neither is a hole in this hook:

1. `style` — exempted from the URI policy entirely (above).
2. `src`/`srcset`/`poster`/`background` — genuinely checked, and they pass,
   because DOMPurify's default URI policy has no rule about userinfo. That is
   the same fact that made F-1 possible at `href`.

The reusable half: **a URL can sit inside an attribute value rather than be one,
and an attribute-name policy cannot see it.** Distinct from C-4, where the
attribute *was* URL-typed and the list was merely short.

**This widening was derived from `ALLOWED_ATTR` and
`DEFAULT_URI_SAFE_ATTRIBUTES`, not from fixtures** — which is why it reached a
class the fixtures had no case for. A fixture corpus can only re-find what
somebody already thought of.

### Two NOT MEASURED, in those words

- Whether a browser **transmits the userinfo on a subresource fetch**. Browsers
  block embedded credentials there, so the fetch is live and the credential half
  may already be mitigated by the platform. JSDOM cannot answer it. This applies
  to the whole class, including the members disclosed before the note existed.
  Not resolved in either direction.
- Whether any browser **dereferences an external SVG functional IRI at all**.
  Several restrict `fill`/`filter`/`mask`/`clip-path` to same-document
  references, in which case those members are survival without a fetch. Survival
  is measured; dereference is not.

Neither was upgraded to "safe" and neither to "vulnerable". The measured claim is
narrow: the value survives sanitising with the userinfo intact.

### Gates

`npm test` 7/7/0 · `go build` 0 · `go vet` 0 · `go test` 11 ok / 0 FAIL ·
`ci-suite-manifest` exit 0 · fixtures 45 cases / 13 divergent ·
`url-binding-scan.test.ts` **zero changes vs `89a974da`**, checked with a
control path in the same invocation that did report a diff, so the empty result
is a measurement and not a dead command. `url-scheme-validation-r2-fix-round.md`
untouched. Nothing pushed.

**Method note, since it nearly cost me two gate numbers.** My first gate run
reported `go build=0`, `go vet=0` and a clean `url-binding-scan` diffstat that
were all measured from the wrong working directory — the earlier `cd` into
`web/` persisted, so `./...` matched no packages and the repo-relative pathspecs
matched nothing. The control path caught it: a file I *knew* had changed also
reported empty. `manifest exit=1` in a later run was the same fault, and that one
crashed loudly, which is the safe direction. **A gate re-run in the wrong
directory produces the same bytes as a gate that passed**, and the only reason
this log does not contain four fabricated zeroes is the positive control.
