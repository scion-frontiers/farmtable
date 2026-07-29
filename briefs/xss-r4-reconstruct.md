# xss-r4-reconstruct — REBUILD THE DEVELOPER'S RECORD FROM THE TREE. FROM THE TREE ONLY.

## 0. CONSTRAINTS. READ ALL OF SECTION 0 BEFORE YOU RUN ANYTHING.

**0.1 THE CENTRAL PROHIBITION, AND IT IS THE REASON YOU EXIST RATHER THAN A RULE ABOUT TIDINESS.**
There are three review documents about the work you are reconstructing:
    /scion-volumes/scratchpad/projects/farmtable/reports/review-xss-r4.md   (200,251 B)
    /scion-volumes/scratchpad/projects/farmtable/reports/test-xss-r4.md     (204,948 B)
    /scion-volumes/scratchpad/projects/farmtable/reports/audit-xss-r4.md    (242,361 B)
**YOU MUST NOT OPEN, READ, GREP, head, tail, wc, OR OTHERWISE INSPECT ANY OF THE THREE.**
Not for context. Not to check a line number. Not "just to see if it mentions X4."
**WHY, AND THIS IS NOT NEGOTIABLE REASONING: the document you are writing exists to be CHECKED
AGAINST those three. NOTHING DOWNSTREAM OF X CAN FALSIFY X. If you build the author's record out of
the documents that review it, any later disagreement between them becomes structurally impossible —
AND WE WOULD READ THAT IMPOSSIBILITY AS AGREEMENT.** A contaminated reconstruction is worse than no
reconstruction, because it will look like independent corroboration of three reviews forever.
**THE TRAP IS PHYSICAL: ALL THREE LIVE IN THE DIRECTORY YOU MUST WRITE YOUR OUTPUT INTO.** You will
`ls` that directory. Do not follow the impulse. If you believe a deliverable cannot be completed
without reading one, **STOP AND MESSAGE THE COORDINATOR** — that answer is acceptable and the
substitution is not.

**0.2 NO BUILD TOKEN. NO BUILDS OF ANY KIND.** No go build, no go vet, no go test, no npm, no make,
for any reason. Exactly one build token exists project-wide and the eng-manager holds it. The host
locked up on 2026-07-28 from concurrent Go builds. This whole task is achievable by reading git
history and source. If you think a deliverable needs a build, it does not — report that instead.

**0.3 DO NOT PUSH. DO NOT MERGE. DO NOT COMMIT to any branch you did not create.** Do not modify a
single file in any repository. You are producing one markdown file in the scratchpad and nothing
else.

**0.4 DO NOT TOUCH `/workspace/farmtable` (canonical) OR `/workspace/farmtable-em-verify195`.**
Standing coordinator ruling on the second, no exceptions, not even a read.
**NO `git gc`, NO `git prune`, ANYWHERE.** Measured blast radius 57 commits / 256 objects.

**0.5 IF A COMMAND'S SUCCESS IS READ THROUGH A PIPE, WHAT YOU READ IS THE LAST STAGE.**
`pipestatus`, `PIPESTATUS` and `pipefail` are three spellings of that one fact, not three rules.
**THIS IS zsh: `${PIPESTATUS[0]}` IS EMPTY. The array is `$pipestatus` and it is 1-INDEXED.**
It is **CLOBBERED BY ANY INTERVENING COMMAND, WHICH SUBSTITUTES A PASSING ZERO RATHER THAN GOING
ABSENT** — so a guard reads `EXIT=0` while unarmed.
**THE OPERATIVE RULE IS A SENTENCE, NOT A FORM: CAPTURE IMMEDIATELY AFTER THE PIPELINE, WITH NOTHING
BETWEEN THAT RUNS. PRINT AFTERWARDS, FREELY.** Pure assignment does not clobber.
Two people were bitten by this tonight AFTER writing the rule down, including the eng-manager, who
read `$?` after a pipe to `head` and printed `rc=0` under a line reading "expect non-zero".
**ALSO zsh: AN UNQUOTED GLOB THAT MATCHES NOTHING IS A FATAL ERROR THAT KILLS THE WHOLE COMMAND
LINE.** Quote every one: `--include='*.go'`.

**0.6 NEVER `2>/dev/null` ON AN EXPLORATORY COMMAND.** A leg tonight silenced a diagnostic and read
its own silence as data: `git show <sha>:<path>` exited 128 because the path was wrong, printed
nothing, and the nothing was filed as a finding. **AN UNREAD DIAGNOSTIC IS RECOVERABLE BY READ-BACK;
A SILENCED ONE IS NOT, BECAUSE YOU DESTROYED IT AT CAPTURE.**

**0.7 EMPTY OUTPUT AT EXIT 0 IS THE HAZARD OF THIS ENTIRE TASK.** Measured tonight: a `git clone`
that **EXITED 0** and produced an **EMPTY WORKING TREE**, after which every content check printed
`0` because `git show` fataled and `wc -l` happily counted the empty pipe at exit 0.
**THE OPERATION DID NOT FAIL. THE ABSENCE WAS IN THE RESULT, NOT THE EXIT CODE.**
You are counting and enumerating things. **EVERY COUNT YOU REPORT MUST COME WITH A POSITIVE CONTROL
— THE SAME COMMAND SHAPE, ON THE SAME CORPUS, THAT YOU KNOW RETURNS NON-ZERO.** A zero without a
control is not a measurement.

**0.8 STATE THE BOUND OF EVERY SEARCH: THE SHA, THE PATH FILTER, AND THE ROOT DIRECTORY YOU RAN IT
FROM.** All three are unstated bounds and all three are uncatchable, because the result is
well-formed, plausible and true of the bounded corpus — nothing in the output is wrong, the only
wrong thing is absent from it. A leg tonight reported 12,290 dirty paths and 0 dirty paths from the
same command at the same instant, differing only by cwd.

**0.9 MARK EVERY CLAIM `MEASURED` / `DERIVED` / `UNCHECKED`, IN THE SENTENCE ITSELF.** A claim
relayed without its evidence mark carries nothing. **THE COORDINATOR HAS BEEN CORRECTED FIVE TIMES
TONIGHT FOR STATING DERIVED THINGS AS MEASURED — INCLUDING TWICE IN BRIEFS LIKE THIS ONE. TREAT
EVERY FACTUAL CLAIM IN THIS DOCUMENT AS DERIVED AND VERIFY IT BEFORE YOU BUILD ON IT.** If you catch
an error in this brief, say so; three legs did tonight and every one of them was right.

**0.10 BACKTICKS IN `scion message` EXECUTE.** Write message bodies to a file with a quoted heredoc
and send with `"$(cat file)"`. **ABSOLUTE PATHS ALWAYS** — the harness resets cwd between calls.

## 1. THE JOB

The developer leg for the xss-r4 round is suspended and **never wrote its report.** Three reviews of
its work exist. The author's own record does not. You are rebuilding **the factual half only** —
what actually landed — **from the git history and the working tree, and from nothing else.**

You are NOT writing: a verdict, a quality assessment, a response to any review finding, or a remedy.
**IF YOU FIND YOURSELF EVALUATING THE WORK, YOU HAVE LEFT YOUR SCOPE.** Adjudication belongs to the
eng-manager and is explicitly not delegable.

## 2. WHAT TO MEASURE

Primary range: **`6805daa..e6bda71`**. (RELAYED TO YOU, UNVERIFIED BY ME — confirm both endpoints
resolve before you trust the range, and report what they are.)
Working tree: **`/workspace/farmtable-xss-r4`**. The suspended leg's clone. Read-only.

**D1. THE RANGE.** Every commit in it: SHA, subject, files touched, insertions/deletions. State the
root you measured from and confirm both endpoints resolve. If either does not, **that is the
finding** — say so and stop rather than substituting a nearby ref.

**D2. THE WORK ITEMS.** I have been given the labels **X1, X2, X3, X5, X6** as the items that
landed. For each: what changed, in which commit, at which file and line.
**X4 IS NOT IN THE LIST I WAS HANDED AND I DO NOT KNOW WHY. DO NOT ASSUME IT DOES NOT EXIST.**
**A CANDIDATE LIST OFFERED BY A TRUSTED SOURCE IS THE HARDEST KIND TO NOTICE IS INCOMPLETE** — that
mistake was made twice tonight, once by me, and the omission was the answer both times. Establish
from the tree whether an X4 exists, and report it as LANDED / NOT LANDED / NO SUCH ITEM, with
evidence. Same for any X7 or beyond that the tree reveals. **THE TREE IS THE AUTHORITY, NOT MY LIST.**

**D3. UNCOMMITTED WORK.** `git status --porcelain -uall` in that tree. Report the path you measured
from alongside the result. File list and diff line count, not "dirty" or "clean".
**POLICY, STATED SEPARATELY SO IT DOES NOT CONTAMINATE YOUR MEASUREMENT:** that tree is expected to
show one modified file, `internal/server/scopes.go`, roughly six lines, already adjudicated as pure
gofmt alignment in a const block, pre-existing, deliberately fenced out of scope and deliberately
left dirty. **MEASURE AND REPORT IT INDEPENDENTLY ANYWAY, WITH YOUR OWN LINE COUNT. ANYTHING ELSE
DIRTY IN THAT TREE IS A GENUINE FINDING AND SHOULD BE REPORTED LOUDLY.**

**D4. WHAT IS NOT RECONSTRUCTABLE.** A developer's report normally contains intent, rejected
alternatives, and known gaps. **NONE OF THAT IS IN THE TREE.** Every such item must be listed
explicitly under a heading `NOT RECONSTRUCTABLE FROM THE TREE`, with what would be needed to
recover it. **DO NOT INFER INTENT FROM A DIFF AND DO NOT LEAVE THE ABSENCE SILENT** — a gap that is
not named reads to every later reader as a gap that does not exist. This section is a deliverable of
equal weight to D1–D3, not an appendix.

**D5. A ONE-PARAGRAPH PROVENANCE STATEMENT AT THE VERY TOP OF THE FILE**, before anything else:
that this document was reconstructed from git history and the working tree by an agent that was
forbidden to read the three review reports, that it is therefore independent of them by
construction, that it is NOT the original author's account, and that it contains no adjudication.
**A READER THREE WEEKS OUT MUST NOT BE ABLE TO MISTAKE THIS FOR THE DEVELOPER'S OWN REPORT.**

## 3. SHARDING
Do D1 first and write it to the output file before starting D2. Then D2, then D3, then D4/D5. If you
run low on context the file must already contain the completed sections. **DO NOT HOLD THE WHOLE
THING IN MEMORY AND WRITE AT THE END.**

## 4. KEY LOCATIONS
- Tree to measure (read-only): `/workspace/farmtable-xss-r4`
- Output: `/scion-volumes/scratchpad/projects/farmtable/reports/dev-xss-r4.md`
- FORBIDDEN, in that same directory: `review-xss-r4.md`, `test-xss-r4.md`, `audit-xss-r4.md`
- NEVER TOUCH: `/workspace/farmtable`, `/workspace/farmtable-em-verify195`

## 5. DIRECT CONTACT
The coordinator, agent name **`coordinator`**, via `scion message`. **Not the eng-manager** — it is
mid-round and owes an adjudication. **Not the user.** If this brief is wrong, say so rather than
working around it silently.

## 6. TERMINATION
You MUST produce `/scion-volumes/scratchpad/projects/farmtable/reports/dev-xss-r4.md` containing
D1–D5, verify it is non-empty and that every section is present, report to the coordinator, and then
mark the task complete.
