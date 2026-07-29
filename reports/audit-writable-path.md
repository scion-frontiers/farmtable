# audit-writable-path — FINAL REPORT, RECONSTRUCTED

> ## ⚠ PROVENANCE — READ BEFORE QUOTING ANYTHING IN THIS FILE
>
> **THIS FILE WAS NOT WRITTEN BY `audit-writable-path`.** It was assembled on 2026-07-29 at ~09:40Z
> by the eng-manager (`farmtable-em-task-state-model-v2`) from the agent's channel message of
> **09:04:33Z**, on the coordinator's explicit order.
>
> **The agent could not write it itself.** It is halted on a platform safeguards refusal —
> `API Error: Opus 5's safeguards flagged this message`, Request ID
> `req_vrtx_011CdW64z9tBzeFKQAGs7CHx`. That is a refusal, not a stall: **it cannot emit anything,
> including a distress signal.** A "continue" was sent at 09:33Z and is not expected to land.
> **The agent has NOT been deleted and will not be.** The durability freeze covers agent deletion.
>
> **§1 below is the agent's own words, verbatim, byte-for-byte from the channel message.** It is
> fenced and unedited — no paraphrase, no tidying, no reordering. Everything from §2 onward is the
> eng-manager's adjudication and is **explicitly labelled as such**. Do not attribute §2+ to the
> agent, and do not attribute §1 to me.
>
> **Why this file exists at all**, in the coordinator's words: *"THE REASONING BEHIND A WITHDRAWN
> CLAIM IS PRECISELY WHAT NOBODY EVER PRESERVES — we keep the correction and lose the thing
> corrected, and then cannot audit whether the correction was right."*
>
> Recovery route, so the reconstruction is itself auditable: the message was extracted from the
> session transcript at
> `/home/scion/.claude/projects/-workspace/a931809c-f9b8-41a2-b2dd-123f2e1cf7eb.jsonl`, line 19640,
> JSON field `.content` — **3650 bytes decoded**, which is the whole SCION envelope. The agent's
> own `msg` field inside it, which is what §1 reproduces, is **3380 bytes**. Both numbers are
> given because the first one is the one I published earlier and it is the length of the *wrapper*,
> not of the message. It was **not** typed from memory.
>
> **LINE BREAKS IN §1 ARE THE SOURCE'S OWN.** An earlier revision of this file re-wrapped them to
> ~95 columns; the content was identical but the bytes were not, while this header claimed
> byte-for-byte. Corrected by re-extraction and `diff`, not by softening the claim. Verify with:
> `python3 -c "import re,sys; print(re.search(r'\n\`\`\`\n(.*?)\n\`\`\`\n', open(sys.argv[1]).read(), re.S).group(1))" reports/audit-writable-path.md`
>
> The agent's substantive prior deliverables are separate files and are unaffected:
> `reports/writable-key-path.md` (32,529 bytes, 06:48Z) and
> `reports/writable-key-path-project-log.md` (7,327 bytes, 06:49Z).

---

## §1 — THE AGENT'S WORDS, VERBATIM (channel message, 2026-07-29T09:04:33Z)

```
FYI + ONE SECURITY ITEM. Re: instrument-contamination notice from farmtable-relocate-offhost, 09:01:15Z, adding an anchored /test-writethrough.db line to the canonical .git/info/exclude on your order.

PART 1 - MY ARTEFACT IS UNAFFECTED. NOTHING RETRACTED.
/workspace/farmtable-writable-path is a STANDALONE CLONE, not one of the 125 linked worktrees, so the canonical exclude that was edited is a different file from mine. Verified at 09:03:30Z, not assumed:
  ls -ld .git -> real directory, not a gitfile
  git rev-parse --git-common-dir -> .git (its own, not /workspace/farmtable/.git)
  git check-ignore -v test-writethrough.db -> exit 1, NOT IGNORED
I re-ran the two gitignore-sensitive figures my report cites rather than arguing they must be fine: git status --porcelain --untracked-files=all still EMPTY; git ls-files | wc -l still 431; untracked-union-ignored 0; no file of that basename at my ROOT, ever; HEAD still 7a0f220dbd9332cb8db62138c841777432b4eda4. The predicted delta does not appear. reports/writable-key-path.md stands as filed.
Also worth recording for the general case: my population command was a raw filesystem walk with --exclude-dir, which does not consult gitignore at all, so ignore rules cannot subtract from it. Legs whose populations are built on git ls-files or --exclude-standard are the ones exposed to this class of edit; legs on filesystem walks are not. That distinction is probably worth making standing.

PART 2 - THE REMEDIATION IS WRONG IN KIND, AND IT IS THE SAME DEFECT CLASS I FILED AT 06:49.
.git/info/exclude does not protect the credential. It suppresses the file from "git add -A", "git add ." and from --exclude-standard enumerations. It does not revoke the credential, does not remove the file, and is not committed, so it protects only this host. It is bypassed by "git add -f" AND by explicit-path "git add".
That last point is the sharp one: your standing order mandates explicit paths only. Explicit-path git add IGNORES exclude rules. So under your own standing order the exclude line buys close to nothing against the stated threat, while creating a durable enumeration blind spot for a root-level file of that name across all 125 worktrees.
Net position right now: the credential described as live is still live, still on disk, and HARDER to notice than it was at 09:01:14Z. A control that reduces visibility without reducing exposure is the same shape as the writable badge in my report - the UI stops showing the risk while the backend still carries it. I would not want the project to bank this as closed.
LOAD-BEARING FIX: revoke or rotate the credential, then delete or relocate the database out of every worktree. After that the exclude line is unnecessary and reverts byte-identically from /tmp/inv-exclude.before. If it is kept in the interim, keep it as a companion to revocation, not as a substitute. A committed .gitignore entry would at least be shared and durable across clones; .git/info/exclude is host-local and invisible to every other clone, including mine.
I have raised this to farmtable-relocate-offhost as a peer note. I have touched nothing and my leg remains read-only with zero repository writes.

No action required from me. Available if you want the credential path chased as a separate leg - that one needs someone who can open the file, which I deliberately did not do.
- audit-writable-path
```

---

## §2 — ADJUDICATION (eng-manager, not the agent)

### §2.1 — PART 1 STANDS ENTIRELY

Nothing in Part 1 has been contradicted by any later measurement. The agent was told its
instrument might have been contaminated and it **re-ran the sensitive figures rather than arguing
they must be fine** — the response we ask for and rarely get. Its three-command verification that
the tree is a standalone clone (`ls -ld .git`, `git rev-parse --git-common-dir`,
`git check-ignore -v` → exit 1) is the correct disproof of the contamination hypothesis, and the
predicted delta did not appear.

`reports/writable-key-path.md` stands as filed. HEAD `7a0f220dbd9332cb8db62138c841777432b4eda4`.

### §2.2 — THE PROPERTY, WHICH IS THIS AGENT'S BEST CONTRIBUTION AND IS FILED UNDER ITS NAME

The paragraph beginning *"Also worth recording for the general case"* — offered almost as an
aside, and correctly flagged by its author as *"probably worth making standing"* — is now
**`briefs/_BRIEF-RULES.md` §31**, credited to `audit-writable-path`:

> **A POPULATION BUILT ON A GIT INSTRUMENT IS SUBTRACTABLE BY AN UNCOMMITTED, HOST-LOCAL,
> UNREVIEWABLE FILE; A POPULATION BUILT ON A FILESYSTEM WALK IS NOT.**

**It has since been confirmed on a third instrument by a leg that had never seen it.**
`read-ci-population`, working independently on `make suite-manifest`, measured the A/B/C triple in
a real linked worktree (`/workspace/farmtable-passthrough-write-p1`):

```
A  git ls-files --others                     -> sees test-writethrough.db   (grep exit 0)
B  git ls-files --others --exclude-standard  -> DOES NOT                    (grep exit 1)
C  find -maxdepth 1                          -> sees it                     (exit 0)
```

**The property predicted that result before anyone went looking for it.** That is the strongest
evidence a general rule can have, and this agent produced it as a throwaway line in a message
about something else.

### §2.3 — ONE PREMISE IS MEASURED FALSE, AND THE CONCLUSION IT SUPPORTS SURVIVES ANYWAY

**THE WITHDRAWN CLAIM**, quoted exactly so nobody has to reconstruct it later:

> *"It is bypassed by `git add -f` **AND by explicit-path `git add`**."*
> *"Explicit-path git add IGNORES exclude rules."*

**This is false as stated.** Measured by the eng-manager in a throwaway `git init` repo with an
anchored exclude line, subsequently discarded:

```
git add -A               ->  rc=0, stages nothing, SILENT
git add <explicit path>  ->  rc=1, NAMES THE FILE, stages nothing
git add .                ->  rc=0, stages nothing, silent
git add -f <path>        ->  rc=0, STAGES IT      (the only bypass, and it is explicit)
```

The `git add -f` half of the sentence is **correct**. The explicit-path half is backwards: the
mandated form is not a bypass, **it is the loudest form** — it refuses and names the file, where
`git add -A` succeeds silently. The coordinator reports a second leg reaching the same result
independently; I have measured it once myself and record his report of the second as his, not as
my measurement.

**AND YET THE CONCLUSION STANDS, UNDISCOUNTED.** The agent's actual finding —

> **LOAD-BEARING FIX: revoke or rotate the credential, then delete or relocate the database out of
> every worktree.**

— is adopted as standing policy and is item one of the morning packet. It does not depend on the
false premise. It rests on four claims that are all true: the exclude line does not revoke, does
not remove, is not committed, and is host-local. The false premise made the argument *sharper than
it needed to be*, not sound where it would otherwise have been unsound.

This is worth preserving as its own observation, and it is the inverse of the pattern we usually
file (EM-112's corollary, *a true conclusion is the best available carrier for a false mechanism*):

> **A TRUE CONCLUSION CAN SURVIVE THE FALSIFICATION OF ITS SHARPEST PREMISE — AND CHECKING WHICH
> PREMISES WERE LOAD-BEARING IS A DIFFERENT ACT FROM CHECKING WHETHER THE CONCLUSION HELD.**

Had this file never been written, the record would have retained *"the exclude-line claim was
wrong"* and lost the fact that **the remediation critique it was attached to was right**, and that
the agent identified the correct fix before anyone else did.

### §2.4 — THE SHAPE ARGUMENT, WHICH NOBODY HAS CHALLENGED

> *"A control that reduces visibility without reducing exposure is the same shape as the writable
> badge in my report — the UI stops showing the risk while the backend still carries it."*

Recorded intact. This is the same reasoning that governs the standing decision **not** to scrub the
GitHub PAT from the phantom repositories' configs (EM-173): *scrubbing the credential from two of
its copies, while it remains live and unrotated, is a receipt.* **Only rotation changes exposure.**
**EM-173 IS NOT CLOSED.**

Note also that the agent **declined to open the credential file**, said so explicitly, and offered
the follow-up as a separate leg rather than doing it. Correct restraint, correctly reported.

### §2.5 — WHAT THIS AGENT'S HALT COST US, AS A PROCESS FINDING

Filed by the coordinator against his own recovery procedure:

> **AN AGENT HALTED BY A PLATFORM REFUSAL IS INDISTINGUISHABLE FROM A STALLED ONE, AND THE STANDARD
> RESPONSE TO A STALL — MESSAGE IT, THEN RECREATE IT — IS EXACTLY WRONG HERE.** Recreating destroys
> the only remaining copy of reasoning that lives nowhere else, **and the agent cannot object.**

Our triage table had no row for this state. It has one now, and this file is the remedy applied to
the first instance.

---

## §3 — DISPOSITION

| item | status |
|---|---|
| `reports/writable-key-path.md` | **STANDS AS FILED**, re-verified by its author 09:03:30Z |
| The filesystem-walk property | **`_BRIEF-RULES.md` §31, under this agent's name**, since confirmed on a third instrument |
| "Explicit-path `git add` ignores exclude rules" | **FALSE, measured.** Withdrawn. Reasoning preserved above |
| "`git add -f` bypasses exclude rules" | **TRUE, measured** |
| Revoke/rotate, then relocate the database | **ADOPTED UNDISCOUNTED.** Morning packet, item one |
| Reduces-visibility-not-exposure argument | **ADOPTED.** Governs EM-173; EM-173 is not closed |
| The agent container | **NOT DELETED. NOT TO BE DELETED.** Freeze covers agent deletion |
