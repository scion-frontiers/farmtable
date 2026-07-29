# BRIEF - relocate-offhost

## THE OUTCOME I AM BUYING, WHICH IS NOT THE SAME AS THE ACTION I AM COMMISSIONING

READ THIS SECTION TWICE. A previous leg on this problem did everything its brief asked, did it
correctly, proved it by content hash, and then told me it had not solved the problem - because
the brief specified an ACTION and the risk was an OUTCOME. It was right, and that catch is why
you exist.

  THE OUTCOME: THE AT-RISK COMMITS EXIST ON A STORAGE DEVICE THAT IS NOT THIS ONE.
  THE ACTION: publish them to the GitHub remote under a preserve namespace.

If at any point you find that the action would not buy the outcome, SAY SO AND STOP. Reporting
that the action is insufficient is a complete and successful result. Reporting that you performed
the action is not, by itself, a result at all.

## WHY THIS IS URGENT

Measured facts, not assumptions:

- 234 commits on this host exist on NO REMOTE, across 17 of 205 heads and 80 of 93 preserve refs.
- Every mount on this host resolves to a single device, /dev/root - /workspace, the scratchpad
  volume, and every agent home. There is NO second device on this machine. I measured this
  myself with findmnt; you may re-measure it and I would prefer you did.
- Four git bundles were produced as a safeguard. They are on that same single device. Replication
  is not relocation.
- A freeze is in force precisely because of this: NO gc, NO prune, NO repack, NO ref deletion,
  NO worktree deletion anywhere on this host until relocation is verified. That freeze is
  expensive and it stays until you succeed.

## COLD FIRST, THEN RECONCILE - THIS IS A HARD REQUIREMENT

There is an existing manifest and report from the previous leg. YOU MAY NOT READ THEM UNTIL YOU
HAVE FINISHED YOUR OWN MEASUREMENT AND WRITTEN IT DOWN.

Reason, and it is not a formality: an upstream artefact that is WRONG gets caught and costs an
hour. One that is RIGHT and specific makes your own search feel redundant, so you confirm it and
nobody ever learns whether you could have found it. Accuracy is not a defence against suppressive
assurance - it is the mechanism. That previous leg was careful and its numbers are probably
right, which is exactly what makes reading it first dangerous.

So:

1. Independently derive the set of commits on this host that no reachable remote contains.
   Write your figures to your report FIRST, with the commands that produced them.
2. THEN read the manifest at
   /scion-volumes/scratchpad/projects/farmtable/preserve/MANIFEST.md
   and the report at
   /scion-volumes/scratchpad/projects/farmtable/reports/preserve-bundle.md
3. Reconcile. DISAGREEMENT IS A RESULT I WANT, NOT A PROBLEM. If you disagree, report both
   numbers and the query that separates them. Do not quietly adopt the other figure.

## KNOWN DEFECTS IN THE PRIOR WORK - DO NOT INHERIT THEM

These are errors I made in the previous brief. They are listed so you do not repeat them:

- COMMITS WHERE A BLOB IS PRESENT and COMMITS THAT MODIFY A PATH are two different populations.
  I used one phrase for both and they overlapped in one of six.
- PATH CREATION and CONTENT CREATION are two different events and the word CREATED names both.
  I named the commit that created the path and believed it created the content. It did not.
- A REVISION RANGE IS NOT AN AUTHORSHIP SET. A branch accumulates other people's commits.
- Any bound on a search is part of the search's result. If you cap a depth, a count, or a
  time window, THE CAP GOES IN THE FINDING. A find with -maxdepth that misses a deeper path
  exits zero and prints nothing, and that reads identically to a clean negative.

## WHAT TO DO

### Stage 1 - measure, and do not act

Establish, with commands shown:
- The set of local refs (all repositories on this host, not just the one you opened first)
  holding commits no remote contains.
- Which remote(s) are configured and reachable, and whether remote containment can be tested
  against the SERVER rather than against local remote-tracking refs. Local refs/remotes tell
  you what we last fetched, not what the server has. Prefer git ls-remote.
- The total object count and byte size of what would be pushed.

### Stage 2 - THE THREE PRE-FLIGHT CHECKS, EACH ONE A MEASUREMENT AND NOT AN ASSUMPTION

You may not push until all three are answered in writing.

  CHECK A - WORKFLOW TRIGGERS. Read every workflow file in .github/workflows at every ref you
  intend to push, and state whether any of them would fire on a push to refs/preserve/... .
  I believe branch-filtered and tag-filtered triggers will not match a custom ref namespace.
  THAT IS MY BELIEF AND IT IS MARKED DERIVED - I have not read the files. Measure it. If any
  workflow would fire, STOP AND TELL ME; I am not willing to launch an unknown number of CI
  runs as a side effect of a backup.

  CHECK B - NOTHING IS OVERWRITTEN. Your push must create refs only. Confirm by ls-remote that
  no ref you intend to create already exists on the server.

  CHECK C - THE NAMESPACE IS INERT. Confirm that nothing in this repository's tooling treats
  refs/preserve/... as a branch, a release, or a deployment input.

### Stage 3 - push, under these absolute constraints

- Push ONLY into refs/preserve/offhost-<timestamp>/... . NEVER to refs/heads/*, NEVER to
  refs/tags/*, NEVER to refs/pull/*.
- NO force. NO --delete. NO --mirror. NO --prune. Explicit refspecs only; never a bare push.
- Push is the ONLY write operation authorised by this brief.

### Stage 4 - VERIFY BY FETCHING BACK, NOT BY READING THE PUSH OUTPUT

A successful push message is a receipt. It is not evidence the bytes are on the server.

Clone or fetch from the server into an EMPTY throwaway repository under /tmp, check out the
preserved content, and prove by content hash that it is there:
git hash-object on the restored file on disk must equal
c8cb6993581fa202c44cf702f41680fa96442a78 at exactly 68066 bytes.
Hash the RESTORED CONTENT, not the transfer.

Do the same for at least one commit from each of the three at-risk stores.

## HARD PROHIBITIONS

- NO build, NO test, NO vet, NO lint, NO run. You have no build token. This host locked up
  earlier tonight under concurrent Go builds.
- NO gc, NO prune, NO repack, NO auto-maintenance anywhere. Set -c gc.auto=0 and
  --no-auto-maintenance on every operation, including fetches, because a fetch can trigger
  maintenance implicitly.
- NO ref created, deleted or moved in any LOCAL repository. Remote refs under the preserve
  namespace only.
- NO commit. NO local branch. NO checkout in any existing tree. Scratch work in /tmp only.
- DO NOT TOUCH /workspace/farmtable-em-verify195 in any way. Another leg holds that question.

## CREDENTIAL HANDLING - READ THIS BEFORE YOUR FIRST GIT COMMAND

A credential is embedded in the URL of the git remotes in at least three trees on this host.
This is a known, tracked exposure.

- NEVER run a bare git remote -v, git config --get remote.origin.url, or anything else that
  prints a remote URL. If you must inspect one, pipe it through
  sed -E 's#//[^@]*@#//REDACTED@#g'
- NEVER echo, cat, print, log, commit or paste any token or any string containing one.
- NEVER write a remote URL into your report, your manifest, or any file.
- Your report will be read by others. Assume anything you write is published.

## APPARATUS - THESE HAVE BITTEN LEGS TONIGHT

The shell is zsh.
- PIPESTATUS[0] is EMPTY. The array is $pipestatus and it is ONE-INDEXED.
- $pipestatus is CLOBBERED BY ANY INTERVENING COMMAND. Capture it immediately after the
  pipeline, on the very next line.
- cmd | tail reports the exit status of tail, not of cmd.
- UNQUOTED GLOBS ABORT THE ENTIRE COMMAND LINE if they fail to match, including inside a for
  list. Quote them.
- NEVER redirect stderr to /dev/null on an exploratory command. A silenced error is
  indistinguishable from a clean zero.
- Do not parse the output of ls. Use find -printf.
- The harness resets your working directory to /workspace between tool calls. Use absolute
  paths or cd every time.

## HOW TO REPORT A NEGATIVE

If you cannot do something, that is acceptable and it is information. State WHAT YOU COULD NOT
DO, WHY, and THE SPECIFIC OBSERVATION THAT WOULD SETTLE IT. A negative with no bound is worth
less than no negative at all.

Your report must contain a NOT REACHED section naming every bound you did not measure, each
with the observation that would settle it.

## ON EXCEEDING THIS BRIEF

This brief specifies apparatus and prohibitions tightly. It does NOT constrain what you may
look at. IF YOU FIND SOMETHING OUTSIDE THE QUESTION I ASKED, REPORTING IT IS COMPLIANCE, NOT
DEVIATION. The single most valuable finding on this project tonight came from a leg exceeding
its brief.

## DELIVERABLES

1. /scion-volumes/scratchpad/projects/farmtable/reports/relocate-offhost.md
   - your COLD measurement first, with commands
   - the reconciliation against the prior manifest, with disagreements named
   - the three pre-flight checks, answered
   - the push refspecs actually used
   - the fetch-back restore proof, by content hash on restored files
   - NOT REACHED
2. /scion-volumes/scratchpad/projects/farmtable/preserve/OFFHOST-MANIFEST.md
   - by name: which repositories and which refs are now off-host, and WHICH ARE NOT.
   A manifest that silently covers half the population is the exact artefact this task exists
   to prevent.

## DIRECT CONTACT

Questions you cannot resolve yourself go to the coordinator, farmtable-coordinator, via
scion message. Do not guess on anything in the CREDENTIAL HANDLING or HARD PROHIBITIONS
sections - ask.

## TERMINATION

You MUST produce both deliverables above, including a NOT REACHED section, and then mark the
task complete.
