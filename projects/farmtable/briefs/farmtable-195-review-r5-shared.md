# #195 `markdown-sanitize` — FINAL independent review round (r5)

**SHA under review: `53296af`** on branch `markdown-sanitize`.
Your clone is already checked out there, clean. The SHA is the identifier; the
branch name is not.

Three legs are running in parallel and independently: code review, test review,
security audit. **You are one of them. Do not read the other legs' reports, and
do not coordinate.** The eng-manager reads all three. Earlier in this workstream
a coordinator relayed only one leg's findings and missed a HIGH XSS finding in a
parallel report — that is why all three run every round and why independence
matters more than agreement.

---

## What this branch is

A markdown rendering pipeline for task descriptions and comment bodies that are
**mirrored verbatim from third-party GitHub content** (`IssueToCreateParams` in
`internal/platform/github`). The rendered HTML reaches two Lit components
through `unsafeHTML`, inside a shadow root. The input is attacker-controlled.

Full production surface of the branch, `7a0f220..53296af`:

| file | what changed |
|---|---|
| `web/src/util/markdown.ts` | **the sanitizer itself** — `FORBID_TAGS`, `FORBID_ATTR`, private `Marked` instance, checkbox renderer |
| `web/package.json` + lock | dependencies |
| `web/tsconfig.test.json` | one line |
| `web/src/util/markdown.test.ts` | ~1970 lines — the sanitizer tests **and** a static guard suite |
| `.design/project-log/*` | four log files |

**Nothing else. Zero Go changes.**

## Read this before you plan your round: where the attention has gone

Rounds 3, 4 and 5 changed **no production code at all** — they were entirely
work on `markdown.test.ts`, specifically on a static guard that tries to prove
the two components still route through the sanitizer. Five rounds of adversarial
effort have gone into **the guard**.

The thing the guard protects — `markdown.ts`, 71 lines, the actual XSS boundary —
was last substantively reviewed in round 2.

I am telling you this because it is a plausible misallocation of attention and I
would rather you hear it from me than discover it. **Weight your round
accordingly.** A defect in `markdown.ts` is a live XSS on a real origin. A defect
in the guard is a future regression that might not be caught. These are not the
same severity of thing, and the volume of material in the test file should not
set your agenda.

---

## Disclosed prior art — READ FIRST, this is not optional

`/scion-volumes/scratchpad/projects/farmtable/reports/dev-195-vectors.json`

59 entries. Every mutation vector tried across four rounds, with its outcome.
Twelve are marked `expect: "green"` — six `FP*` false-positive controls, and
**five KNOWN-ACCEPTED-DOCUMENTED SURVIVORS**:

- **V25** — patching `Element.prototype.removeAttribute` and
  `Node.prototype.removeChild` at module scope in a sink file. Runtime-verified
  to defeat the sanitizer. Names nothing the static rules can match.
- **R-eval**, **R-globalThis**, **R-newFunction**, **R-bareSpecifier**.

**Do not re-report these as new findings.** They are documented in the file's
docblock with runtime output and the reason for acceptance.

**Do challenge the acceptance itself.** "Disclosed" is not "correct." If you
think one of the five is wrongly accepted, say so and say why — that is a
legitimate and welcome finding. What is not welcome is rediscovering V25,
rating it High, and presenting it as an oversight.

The harness now **asserts** those five stay green. If someone closes one, the
run goes red, forcing the disclosure to be updated rather than silently rotting.

---

## The criterion this guard is measured against

The original criterion was **mine, and it was wrong**:

> "no mutation of the two `REQUIRED_SINKS` files can leave them rendering
> unsanitized while the suite is green"

It never named an adversary. Read literally it demands a guard that holds
against someone who can land arbitrary code in the guarded file — and that
person can edit the guard too. It was unsatisfiable from the moment I wrote it.

The amended claim, now quoted verbatim in the docblock:

> This guard defends against **innocent-looking regression** at the two
> enumerated sinks: aliasing, shadowing, re-homing, rebinding, argument-shape
> drift, laundering through an unscanned file, and capture of the sanitizer's
> own configuration. It does **not** defend against a committer who can land
> arbitrary code. That adversary is answered by code review, CSP and Trusted
> Types.

**Review the guard against the amended claim — and separately, tell me whether
the amended claim is the right claim.** Both are in scope. If you think I have
now defined the problem down to fit the solution, say that plainly; it is the
obvious failure mode of amending your own exit criterion and I would rather have
it challenged than assumed safe.

Related boundary statement, also in the docblock: **rules of this kind can own a
NAME; they cannot own an EFFECT.**

---

## Already routed elsewhere — do not open these as findings

| item | destination |
|---|---|
| Observing the sanitizer's EFFECT at runtime (closes V23/V25) | Phase 2 component harness, with V23 and V25 as its acceptance vectors |
| Replacing the regex scanner with a typescript-eslint AST rule over resolved symbols | GitHub #204 |
| CSP / Trusted Types | out of scope for this branch |

Note the second one honestly: the docblock itself says the regex approach is
asking the wrong question and that type-aware lint is the right one. If your
judgement is that the whole static-scan approach should have been #204 from the
start, that is a legitimate architectural finding — file it, do not suppress it
because the follow-up exists.

---

## Standing bars on this workstream — these apply to YOUR work, not just the code

1. **Measure, do not assert.** Anything you can run, run. Label every claim BY
   EXECUTION or REASONED, and paste the output.
2. **Measure regardless of whether the first answer is the one you would want to
   be true.** A finding that makes you the lone clear-eyed observer earns the
   same skepticism as one that confirms your fear.
3. **A harness that cannot express an input cannot test it.** Tonight a leg's
   first verification attempt returned a clean pass — exit 0 — because its mock
   was stateless and the two-call attack chain was *inexpressible, not
   disproven*. It nearly filed a confident false negative against a true
   finding. **Any claim of a NEGATIVE result across more than one step must
   first prove the harness can express the state change.** Write that self-check
   so it fails closed.
4. **"Clean" is not "unchanged."** The dev lost a full set of verified edits this
   round: the mutation driver restored `markdown.test.ts` from a backup taken at
   the last commit, and the restore checker then asserted `git status
   --porcelain` empty and **passed — correctly**, because the tree genuinely did
   match HEAD. Every signal in the chain reported success and the net effect was
   a no-op commit. A tree-cleanliness assertion measures agreement with HEAD, so
   it is structurally blind to work that was never in HEAD. **Commit before you
   run any mutation driver; refresh backups immediately after every commit.**
5. **Content-addressed mutations only.** Never line-numbered — a stale line
   number produces a false negative that looks like a pass. Abort if the anchor
   does not occur exactly once.
6. **Back up outside the repo, and assert `git status --porcelain` is empty after
   every restore.** Positively assert the property you want, not merely the
   absence of a difference.
7. **Costly disclosure is the signal we trust here.** Two legs tonight disclosed
   something that made their own prior work look worse and handed a point to the
   leg they disagreed with. Both were right to. If you find that your own method
   was flawed, or that you were wrong earlier, lead with it — it raises your
   report's standing, it does not lower it.

## Rules

- **Do not push.** Ever.
- **Do not modify production code.** Your independence depends on it. Scratch
  files are fine; delete them and leave `git status --porcelain` empty.
- Preserve anything valuable to
  `/scion-volumes/scratchpad/projects/farmtable/salvage/` — that directory is
  shared and outlives your container. Your `/tmp` does not. A prose description
  of a harness is not a salvaged harness.
- You may commit a project-log entry to your own clone. Tell me the SHA if you
  do; I preserve those at merge time.
