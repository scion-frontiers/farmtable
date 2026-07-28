# #195 markdown-sanitize — round 5 security audit (audit the sanitizer, not the guard)

**Branch:** `markdown-sanitize` · **SHA audited:** `53296af`
**Scope:** security-audit leg only. **Zero files changed** — no production code,
no test code. This entry is the record; the report is at
`reports/audit-195-r5.md`.
**Gate:** `npm ci` → exit 0; `npm test` → exit 0, `markdown sanitizer: 61 checks
passed`, exit code read directly from the child. Tree clean at `53296af` before
and after all work.

**Verdict: APPROVE.** 0 Critical, 0 High, 1 Medium, 4 Low, 2 Info.

## Why this round was aimed where it was

Rounds 3, 4 and 5 changed no production code — all of it went into the static
guard in `markdown.test.ts`. The 71-line file that is the actual XSS boundary,
`web/src/util/markdown.ts`, had not been substantively re-audited since round 2.
The EM flagged this as a probable misallocation of attention rather than letting
the reviewer discover it. This leg was weighted accordingly: the sanitizer first,
the guard last.

That weighting was correct. Everything of value this round came from the
sanitizer and the dependency tree. Nothing new came from the guard.

## The method mattered more than usual

The first harness returned **42 INCONCLUSIVE out of 69** and that was the
point. It ran each vector down two paths — production `renderMarkdown` and a
"weakened twin" with the forbid lists stripped — but the twin still ran
DOMPurify. For any vector DOMPurify's *defaults* handle, both paths came back
clean, and the harness could not distinguish "the reviewed config blocked this"
from "nothing here was ever expressible". Reporting that run as a clean pass
would have been precisely the false negative standing bar 3 was written about.

Adding a third path — `marked` output with no DOMPurify at all — turned it into
a discriminator: BLOCKED-BY-CONFIG vs BLOCKED-BY-DEFAULTS vs INCONCLUSIVE, with
INCONCLUSIVE counted as failure. Every detector proves it can fire against its
own positive control before any vector runs.

That third path produced the round's central measurement, which two paths could
never have surfaced:

> Of 46 blocked vectors, **36 were blocked by DOMPurify's defaults and only 10
> by the reviewed configuration.**

Every subsequent harness got the same treatment: the prototype scanner must find
a planted V25 decoy or abort; the slot probe must demonstrate a *successful*
slot assignment before its negative counts; the mutation driver must turn the
suite red on a self-check before any green is believed.

## Findings

**M1 [Medium] — the subtractive forbid-list posture is wrong for verbatim
third-party content.** Measured by execution: **157 tags reach the shadow root;
markdown emits 22; 138 are pure excess**, including the whole SVG and MathML
namespaces where essentially every DOMPurify bypass of the last five years has
lived. Combined with the 36-vs-10 number above, the security of this boundary is
overwhelmingly a property of DOMPurify's default allow-list — which this file
neither states nor pins, and which moves between releases. `<dialog>` is the
worked example already in the tree: a tag that became dangerous *after* the list
was written, caught only because a human reasoned about UA default styles. Not a
live exploit; a change-over-time risk. Recommended `ALLOWED_TAGS`/`ALLOWED_ATTR`
with the forbid lists retained as a verified second barrier.

**L1** `slot` survives and is a latent UI-redressing primitive — the comments
sink renders markdown inside `<sl-details>`, which has a named `summary` slot.
Proven *not* exploitable at the current nesting depth and *proven exploitable*
one level shallower. One word in `FORBID_ATTR` closes it permanently.

**L2** The guard does not catch `ALLOW_UNKNOWN_PROTOCOLS: true`.

**L3** Unproxied external subresources leak viewer IP/UA and act as read
receipts. **L4** Presentational/behavioural attributes survive (`id`, `align`,
`width`, `hidden`, `popover`, `role`/`aria-*`); DOM clobbering specifically is
*not* exploitable — verified there is no id-based DOM lookup anywhere in the app.

## Two results that cut against the obvious conclusion

Both are recorded because getting them wrong would have been a false finding.

1. **Two config mutations left the suite green; only one is a gap.**
   `ADD_ATTR: ['style']` is a **security no-op** — `FORBID_ATTR` takes precedence
   over `ADD_ATTR` in DOMPurify 3.4.12, so the output is byte-identical on all
   six probes and green is the *correct* answer. Only
   `ALLOW_UNKNOWN_PROTOCOLS: true` genuinely weakens the sanitizer. Checking
   whether a mutation actually changes behaviour before calling it a gap is the
   difference between L2 and two spurious findings.

2. **The guard is better than advertised in the place that matters most.**
   9 of 9 individual forbid-list deletions were caught. Every entry in both lists
   is separately pinned. For a config where each entry is a hand-reasoned special
   case, that is the regression most likely to actually occur — more likely than
   the import re-homing five rounds were spent on. It is currently an emergent
   property rather than a stated guarantee, which is how load-bearing behaviour
   gets refactored away.

## V25 and the other four survivors: acceptance confirmed, with a caveat

The EM checked the direct dependencies for DOM prototype patchers and asked for
the transitive tree. Scanned all 154 packages with a decoy-validated scanner:
exactly two patch DOM prototypes, `jsdom` and its selector engine `nwsapi`, and
both are `dev=true` with `nwsapi` reachable only through `jsdom`. Neither ships
to the browser. `npm audit` clean. **No runtime dependency at any depth patches a
DOM prototype, so V25 requires commit access and the acceptance is correct.**

The caveat is the useful part: that conclusion rests on a property of the
dependency tree that **nothing enforces**. A future transitive dep introduced by
a routine `npm update` would make V25's effect reachable without any commit to
this repo, and the documented reason for accepting V25 would quietly stop being
true. Recommended promoting the scan into CI so the rationale becomes a tested
property.

## On the amended criterion

The amendment is legitimate, not defining the problem down. The original
criterion is unsatisfiable for a structural reason — the guard lives in a file
the postulated adversary edits in the same commit — and the excluded adversary
(a Farm Table committer) is not the one this pipeline faces (an attacker-supplied
GitHub issue body). The amendment removes exactly the out-of-scope adversary.

One correction to the claim's framing: it discharges the arbitrary-committer
adversary onto "code review, CSP and Trusted Types", but CSP and Trusted Types
**do not exist yet** — they are explicitly out of scope for this branch and there
is no CSP anywhere in the web app. The sentence is accurate about the guard while
describing a defence-in-depth posture that is one-third built. Not a blocker;
a reason to schedule the CSP work rather than leave it as a backstop in prose.

And on whether the static-scan approach should have been #204 from the start:
yes — and the docblock says so itself. Rounds 3-5 extended a technique its own
author had documented as asking the wrong question. The remedy is #204 and the
Phase 2 effect-observing harness, both already routed. Not more guard work.

## What is worth carrying forward

The three-path discriminator is the reusable artefact. "Did the payload survive?"
is the wrong question for a layered sanitizer; "which layer stopped it, and can
this harness tell the difference?" is the right one, and only the second exposes
the case where a config looks protective but the underlying library is doing all
the work. Harnesses salvaged to `salvage/audit-195-r5-*`, all with fail-closed
self-checks.
