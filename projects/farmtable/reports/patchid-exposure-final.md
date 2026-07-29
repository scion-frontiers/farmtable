# patchid-exposure — final

Leg: patchid-exposure (investigator). Closed 2026-07-29 on coordinator's stand-down.
Written from results already held. No measurement was run to produce this file.

Prior artefacts, unchanged and still valid:
- `reports/patchid-exposure.md` — full report, two dated addenda, superseded recommendation
  marked rather than deleted.
- `preserve/PATCHID-CLASSIFICATION.tsv` — 126 rows, one per commit.

---

## (a) WHAT I ESTABLISHED

**The question.** 126 commits on this host were reachable from no ref and survived only because
garbage collection was frozen. 41 of them were ordinary feature commits whose subjects cited
merged pull requests, so they looked like they might be pre-squash originals of work already
shipped. The question was whether they were work that would be lost, or tombstones of work
already safe.

**The answer: they are tombstones. Nothing of value would be lost.** Of the 41, 14 are
duplicates of published content, 22 are intermediate drafts whose substance is present in
published main, and 5 introduce content found nowhere in published history. Of those 5, one is
an abandoned alternative LLM backend (the feature shipped with a different backend), two are
project-log documents, one is a one-line scratch file, and one is a server test. This did not
warrant escalation.

**The commissioned method could not answer the question, and reporting that was the result.**
I was asked to compare patch-ids. Patch-id could not settle it. Only 54 of the 126 commits have
a meaningful patch-id at all — 36 are merge commits (stash envelopes) and 36 are empty relative
to their parent. Of the 54, only 9 matched. Read literally that says 45 commits of unpublished
content, which would have been an incident. It was wrong. Published main combines several
feature commits into single commits and its commit subjects are offset from the content they
carry: the commit labelled "poll-on-interval refresh (#103)" is empty, and that work actually
sits inside the commit labelled "C4 graph tests (#102)", where all six files appear at identical
content hashes. A patch-id hashes a whole commit's diff, so it cannot match a six-file commit
against a nine-file commit that contains it. Patch-id produced 26 false "unique" verdicts.

**What answered it instead** was comparing content identity file by file — for each commit, the
set of files it introduces, tested against every version of every file across all 295 commits of
published history. Then, for files that did not match, asking whether the *path* was published
in any version at all, which separates "an intermediate draft of something that shipped" from
"a file that never existed upstream".

**Comparison was against server main `cc927355e5a23c45bfd983cd331eb540b0a61ad5`**, obtained by
`ls-remote` against the GitHub origin and fetched into a throwaway clone. Every local copy on
this host had main twelve commits stale at `7a0f220`. In this instance the stale value would not
have changed any classification, because all twelve are CI scaffolding, but the comparison was
made against the server value.

**There was nothing to rescue, including the two files I had initially said were worth
recovering.** After checking exact content hashes, the server test, the stash-held test, and the
abandoned backend are all held by named refs in other clones on this host. They are unpublished
but not at risk. My earlier recommendation was correct that they were unpublished and wrong to
treat that as meaning they were endangered.

**The real loss exposure is 48 agent-scratch note files** — 33 PR review write-ups, 7 review
documents, 4 task and fix-round notes, 3 project logs, and one engineering-manager state file —
for which no ref-reachable commit containing that path was found in the clones searched. They
sit mostly inside two stash-untracked commits. Everything else at risk is one line long,
machine-generated, or regenerable. This is reasoning and methodology rather than product code:
recoverable in principle because someone could write it again, unrecoverable in practice because
nobody will.

**No credential material is in any of the 126 commits.** The complete set of file paths those
commits could introduce that do not exist in published history is 76 paths — small enough to
read in full rather than pattern-match. It contains no database, credential, key, or environment
file. The database holding the live token appears zero times across all 126 commit trees.

---

## (b) WHAT I DID NOT ESTABLISH, AND WHAT BOUNDS IT

**Negative reachability results are bounded by the clones I searched; positive ones are not.**
The 48-file exposure figure was produced by checking four clones (`farmtable`,
`farmtable-em-verify195`, `farmtable-markdown-sanitize`, `farmtable-xss-r6-fix`) out of roughly
250 on this host. If any unsearched clone holds a ref containing those paths, the true exposure
is lower. **48 is a ceiling, not a count.** By contrast, every REF-HELD verdict I reported is
sound regardless of reach, because finding an object once proves it exists. This asymmetry is
the single most important limitation on my numbers and it fails toward over-reporting exposure —
the conservative direction for a preservation decision, but a reader must not treat 48 as
measured.

**I compared against `refs/heads/main` only.** Tags, unmerged remote branches, and PR refs were
outside the published index. Content scored UNIQUE here could be published on an open branch.
This also fails toward over-reporting uniqueness.

**The 45 SUPERSEDED_DRAFT classifications are my softest claim.** I did not prove byte-exactly
that their substance reached main. The corroboration was a heuristic: extract distinctive
identifiers added by the draft and check their presence in published main, which returned 100%
for 21 of the 22 such commits among the 41. An identifier can be present upstream for reasons
unrelated to the draft. The 22nd yielded no identifiers because it was a single CSS line, and
that line is genuinely absent from published main, though the surrounding file was rewritten.

**Deletions are invisible to my containment test.** A commit that only removes files introduces
no content and was scored as having none. Rename detection was disabled on both sides, so a pure
rename appears as an unmatched path.

**My work never touched the working tree.** Everything came from committed objects. The
population of 11,605 untracked files was never in scope for this leg, and my "no credential
material" finding covers the 126 commits only — it says nothing about files on disk.

**The encoding bound applies to my identifier check, not to my identity check.** Content
identity by object hash is encoding-independent and I rely on it. But the identifier-landing
corroboration was a plain-text search, and text that is compressed, encoded, or chunked is
invisible to it.

**I inherited the 126-row population rather than re-deriving it**, as the brief permitted. Any
error in that derivation is inherited whole. I did reconstruct the 41/39/2 split independently
and it reconciled exactly, which is partial corroboration of the input but not a re-derivation.

**Declared gaps, not closed:** the compressed-object gap and the untracked-file population. I did
not start either and am not proposing to.

---

## (c) METHOD FINDINGS, AS PREDICATES

**On whole-object comparison.** A patch-id is a hash of an entire commit's diff. It cannot match
a commit against a commit that properly contains it. Against any history that squashes, coalesces,
or regroups commits, patch-id systematically under-reports duplication, and it fails toward
UNIQUE — the alarming direction. A population that is mostly merges or empty commits cannot be
settled by patch-id at all, because neither has a meaningful one.

**On control pairs.** A positive control proves a detector fires. A negative control proves it
does not fire on nothing. Neither proves the two produce *distinguishable output*. A detector
whose positive and negative results have the same shape is dead while passing every liveness test.
Every control pair must be asserted to produce different output, and both values must be
published.

**On existence gates.** `git rev-parse "<sha>:<path>"` echoes the unresolvable argument instead
of returning empty. Any existence gate keyed on its stdout being non-empty admits missing paths
into whichever branch follows. `--verify --quiet` returns empty. The general predicate: a command
that reports failure by echoing its input cannot be tested for success by testing for output.

**On parent parsing.** `git rev-list --parents -n1 <sha> | cut -d' ' -f2-` returns the commit's
own hash for a parentless commit, because there is no space to split on. The commit is then
compared against itself and yields "no content" — indistinguishable from a genuinely empty commit.
`git log -1 --format=%P` returns empty for a root commit. The general predicate: a field-splitting
parse of a variable-length list degenerates silently on the empty case, and the degenerate output
is often a valid-looking result rather than an error.

**On tab-delimited data in shell.** Tab is IFS whitespace in bash, so `while IFS=$'\t' read`
collapses runs of tabs and empty fields disappear, shifting every later column left. A TSV with
optional columns cannot be read this way. Generate and consume such files with awk.

**On regex portability.** mawk does not support interval expressions such as `{40}` by default,
so a validation pattern using them matches nothing and the validation reports every row bad — or,
inverted, every row good. A validation control needs its own control.

**On reachability granularity.** A path can sit on a ref while the specific revision you hold sits
on none. The file survives; that revision does not. A reachability check must name its object
granularity, and path-level checks fail toward SAFE.

**On predicates that look like synonyms.** "Unpublished" and "at-risk" are different predicates
and the second does not follow from the first wherever a ref exists elsewhere. So are
"path-reachable" and "blob-reachable". So are "not in any store" and "would be lost".

**On enumeration versus property.** A filter defined by the extensions of its examples is an
allow-list for everything the author did not think of. A set small enough to enumerate and read
has no blind spot; a pattern always does. Where the population can be reduced to something
readable, read it.

**On disagreeing checks.** Two checks that disagree are usually two correct answers to different
questions. Resolving the disagreement by choosing one destroys the more informative result.

**On the direction a defect fails in.** A defect that manufactures findings gets found, because
someone investigates the finding. The same defect in an absence claim renders as a clean zero and
nobody looks again. When a defect is discovered, the question worth asking is not only what it
broke but which direction it broke toward, because the silent direction is where the undiscovered
ones are.

**On resolving remotes.** `ls-remote origin` in a clone whose origin is a local filesystem path
returns a local answer that is indistinguishable in shape from a server answer. Where staleness
matters, resolve from a remote whose URL you have read.

**On trusting a run of reassuring results.** An instrument that only ever revises figures downward
has the profile of one that flatters its operator. One that revises in both directions in the same
pass is weak evidence that it tracks something. This is a property of the instrument and is
testable; suspicion about a result's comfort is not.

**Unresolved, and nobody has a control for it.** Where a failed invocation and a real measurement
produce byte-identical output on stdout, no control we built this night detects it. What caught
instances of it was a magnitude sanity check — a human noticing the number was implausible. That
is not a control and should not be recorded as one.

---

## (d) STATUS

Nothing in this file requires further measurement. Every claim is from results already held, and
where I could not settle something from what I hold I have said so rather than estimating it.

The two permanent hygiene rules are noted and were never at risk from this leg: it created no
commit, staged nothing, ran no bulk capture under either the command-name or property form of the
order, created moved or deleted no ref, and never placed any credential value in a command
argument. It was read-only throughout.

Leg closed.
