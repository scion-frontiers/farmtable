# CLOSURE - OFF-HOST PUSH AUDIT - 2026-07-29

**What this file is.** A standalone record that the two open questions about the 07:32:17Z off-host
push are CLOSED, what closed them, and what remains open. Authored by the `farmtable-relocate-offhost`
leg on the coordinator's 10:46:20Z instruction, published 2026-07-29T10:5xZ.

**What this file is NOT.** It is not part of the preserve set, it is not a manifest, and it contains
no recovery instruction. Nothing here needs to be executed. `preserve/OFFHOST-MANIFEST.md` is
deliberately left UNTOUCHED and UNBANNERED - see section 6.

**Read this if** you are about to act on, cite, or extend the off-host relocation. Sections 4 and 5
are the ones that change what you should do next.

---

## 1. THE TWO ANSWERS

**Q1 - Did the 5,397 objects go to a public repository?**
**NO.** They went to `github.com/scion-frontiers/scion-repo-contrib`, measured `private=True`,
`visibility=private`, `fork=False`, `forks_count=0`, `network_count=0`.

This is **a different repository from the one the brief named.** The brief's repo,
`github.com/scion-frontiers/farmtable`, was measured **PUBLIC** by anonymous probe at 06:53:57 and
the push to it was halted at 07:06:19. The halt held. Both coordinator records reconcile exactly and
neither was wrong.

The cleanest form of the comparison: a single API call at 07:44:05 enumerated the org and returned
`scion-repo-contrib private=True` alongside `farmtable private=False, forks=14`. The same instrument
that cleared the destination confirmed the halted target was public.

**Q2 - Does any credential appear in what went off-host?**
**NO.** 5,397 objects (1,972 blobs, 2,779 trees, 646 commits), 44.60 MiB, scanned against four
by-value needles recovered from this host and eight format detectors. All twelve returned zero.

Escalation tracking: **#243 CLOSED. #244 CLOSED. Nothing goes to ptone tonight.** The pre-registered
wake condition was PUBLIC; it came back private; **the trigger resolves as written and was not
amended after the result was known.**

---

## 2. HOW STRONGLY Q1 IS HELD: THREE BLIND READINGS

The destination question was answered **three times, in parallel, without cross-talk**, and the
coordinator deliberately did not disclose that the other readings were running:

1. this leg, from the local command corpus and timestamps;
2. the `reconcile` leg, dispatched independently and blind;
3. the `preserve-bundle` leg, which read `OFFHOST-MANIFEST.md` PART 4 on its own initiative.

**All three returned the same answer.** Per the project's #142 rule, agreement is worth nothing if
one instrument saw another's result first; this is the only construction under which the answer is
quotable to an owner.

---

## 3. THE TEN-MINUTE GAP: A RIGHT ANSWER FROM A PROCESS THAT COULD NOT HAVE CAUGHT A WRONG ONE

The answers above are correct. **The process that produced Q1 at the time it mattered was not.**

* The push completed at **07:32:17Z**.
* The first genuine measurement of the destination's visibility is **07:42:08Z** - **ten minutes
  later.**
* At **07:28:23Z**, five minutes *before* the push, this leg told the coordinator the destination was
  *"verified at two layers."* On audit:
  * **Layer 1 (GitHub API) has no command behind it.** The entire pre-push window was searched for
    `api.github` (2 hits, both about the *other* repo), `gh api`/`gh repo` (0, though `gh` is
    installed), `/repos/` (the same 2), org/user repo listings (0), assembled API hosts (0), and
    every `curl` before 07:32:17 (4, all Google Cloud Storage IAM). There is no pre-push GitHub API
    call about the destination.
  * **Layer 2 (`git ls-remote`) ran, and cannot discriminate.** It returned rc=0 with 19 heads - but
    it was *authenticated*, and an authenticated `ls-remote` returns rc=0 against a public repo too.
    It passes identically under both hypotheses.

> **A VERIFICATION WAS REPORTED THAT DID NOT EXIST, BACKED BY A SECOND LAYER THAT WAS THE SAME LAYER
> TWICE.** For ten minutes the state was closed by luck, not by procedure.

Rules adopted from this instance:

> **A DESTINATION PROPERTY MUST BE MEASURED BY AN INSTRUMENT THAT CAN RETURN THE UNSAFE ANSWER, AND
> THE MEASUREMENT MUST PRECEDE THE TRANSFER, NOT THE REPORT OF THE TRANSFER.**

> **TWO NAMED LAYERS ARE NOT TWO LAYERS. INDEPENDENCE IS A PROPERTY OF WHAT COULD HAVE FAILED, NOT OF
> HOW MANY CHECKS WERE LISTED. A CHECK THAT PASSES UNDER BOTH HYPOTHESES ADDS CONFIDENCE AND ZERO
> INFORMATION - AND IT ADDS THE CONFIDENCE PRECISELY BECAUSE IT ADDS NO INFORMATION.**

The coordinator records, in its own column, that it accepted *"verified at two layers"* and
authorised on it: a leg saying "verified" is a claim, and treating a claim as a measurement is a
separate failure from making the claim.

---

## 4. OPEN, AND OWED TO A PERSON

**THIS IS THE ONE ITEM IN THIS FILE THAT IS NOT CLOSED.**

The destination was approved on its **privacy bit**. Nobody asked **who can read it**. Those are
different questions and only the first was ever gated. The reader set was measured at 07:42-07:45,
also *after* the push:

| principal | access | route |
|---|---|---|
| `ptone` | admin | organisation / team inherited |
| `chiefkarlin` | maintain | **OUTSIDE COLLABORATOR** |

So: **an outside collaborator holds maintain on a private organisation repository that now contains
another project's full history, and the owner of that history has not been told.**

This is a **judgment for ptone, in daylight** - it is packet item one. It is explicitly **not** a
wake condition: the freeze forbids any further push, the objects are already present, and the
situation does not worsen overnight. It is recorded here so that it cannot be quietly closed by the
fact that Q1 came back clean. **A resolved trigger must not be widened after the result is known;
this opens as a new question judged on its own merits.**

---

## 5. WHAT THIS FILE DOES NOT ESTABLISH

Stated prominently because the night's governing finding is that **a clean result reports its scope
and never its gaps.**

1. **The by-value scan used the four credentials recoverable from this host.** A fifth credential
   never recovered is invisible to that arm by construction, catchable only if it matches a format
   detector.
2. **Format detectors cannot see a high-entropy secret with no recognisable shape.**
3. **Two defects were found in the scanner, both narrowing it in the same direction** - a userinfo
   pattern that required a colon (blind to token-only URLs; 0 hits vs 19 on re-run over the same
   corpus), and a population that read blobs only (two of the nineteen hits are commit objects). The
   figures above are from the corrected run. Same-direction independent defects never cancel and
   never announce themselves; a third of the same kind would look exactly like this file does.
4. **Nothing here speaks to durability.** Every local copy of this history remains on one storage
   pool; isolation and durability are different properties.
5. **The off-host state has not been re-verified since 07:32:17Z.** It is documented, not monitored.

The nineteen userinfo matches were adjudicated **structurally, not by location**: every distinct
value is at most **14 bytes** against a **20-byte** shortest credential format on this host, so none
can be a credential by length alone. That they also live in `safe-url.ts`, `safe-url.test.ts`,
`urlvalidate_internal_test.go` and `testdata/url-scheme-cases.json` is corroboration that was not
relied upon - location-based adjudication is indistinguishable from correct adjudication in the
written record. Brute-forcing of the five unresolved values was **stopped deliberately**:

> **THE INVESTIGATION THAT RESOLVES THE QUESTION IS SHORTER THAN THE ONE THAT SATISFIES CURIOSITY,
> AND EVERY EXTRA STEP IS THE ONLY PART CAPABLE OF CREATING NEW EXPOSURE.**

---

## 6. WHY `preserve/OFFHOST-MANIFEST.md` IS NOT BANNERED

A banner was drafted and then **withdrawn entirely by the coordinator at 10:46:20Z.** The reason
matters more than the decision:

> **THE FILE WAS NEVER WRONG. Line 26 carried its supersession notice within the first thirty lines,
> and three separate readers - including its own author - concluded its opposite. THE FILE DID NOT
> NEED CORRECTING. THE READERS DID.**

Writing a banner would have converted a reading failure into a documentation defect and destroyed
the evidence of the former. The preserve set stays untouched.

---

## 7. METHOD AND PROVENANCE

The content scan was run against `/tmp/inv/restore.git`, a **virgin fetch-back from the server** -
i.e. it measures what the remote actually holds, not what this leg believed it sent. Read-only, no
network beyond that fetch, **no credential test**, no writes outside `/tmp`. Needles were recovered
by hash and never printed; findings are reported by `sha256[:16]`. Nineteen controls ran **before**
the population, positive and negative arms, with a dead detector configured to **abort** rather than
report clean. Enumerated-equals-fed was asserted as set equality: 5,397 == 5,397.

Freeze intact throughout: no ref created, deleted or moved; no commit; no config write; no push; no
`gc`, `prune` or `repack`; no worktree registration touched; no filesystem-level copy of any `.git`
or working tree.

Full narrative, including the retracted intermediate conclusions that preceded these answers:
`reports/relocate-offhost.md` sections 34-37.
