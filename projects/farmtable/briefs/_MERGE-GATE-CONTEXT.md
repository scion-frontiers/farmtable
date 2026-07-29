# SHARED FACTUAL CONTEXT — quality gates on the task-state merge

This file contains FACTS ONLY. It deliberately contains no predictions, no expected
findings and no other leg's reasoning, because a shared file holding predictions has
already broken three-leg independence once on this project (EM-245).

## What you are reviewing

Merge commit **7e0e387cbd4792836834eacf11bf2133fbca7706** on branch `p2-merge-2982ffd`.

    parent 1 (main)   2982ffd8f3f6e231d8855b9cae7c448c2bd3144f
    parent 2 (branch) e64138c058ad707d2b08b3a213cfa63c17c8e953   task-state-model-v2 web UI
    merge base        aa08f1ae8ca972f463215f76113c121c4578ce70
    merged tree       59749f3cdd3eb579909ea1a25f684354ffcb49e3
                      (git rev-parse 7e0e387cbd4792836834eacf11bf2133fbca7706^{tree})

## CORRECTED — AN EARLIER REVISION OF THIS FILE NAMED THE WRONG TREE. READ THIS.

This file previously gave the merged tree as `42a71d84294421fca73121c6e68be5c9d19fb5ba`.
**THAT IS WRONG AND IT IS NOT A TYPO — IT IS A DIFFERENT KIND OF OBJECT.**

`42a71d8` is the raw output of `git merge-tree --write-tree`, which writes a tree
containing **CONFLICT MARKERS** for every conflicted path. It is a diagnostic artefact,
not a resolution. Measured:

    path                                        markers in 42a71d8   markers in 7e0e387
    web/package-lock.json                              48                    0
    web/src/components/inspector/ft-inspector-code.ts   4                    0
    web/src/components/inspector/ft-inspector-meta.ts   2                    0
    web/src/util/safe-url.ts                            2                    0
    control web/src/util/rank.ts (not conflicted)       0                    0

    web/package-lock.json is INVALID JSON in 42a71d8 (fails at line 20) and VALID in 7e0e387.

**Anyone who measured `42a71d8` measured a tree that cannot build, and would have been
right about that tree and wrong about the merge.** `npm ci` dies EUSAGE on the broken
lock file, so nothing in `42a71d8` builds or typechecks. Credit to `farmtable-em-ci`,
who measured this independently and reported it before any gate was dispatched.

The merge commit `7e0e387` is a genuine hand resolution: zero conflict markers, valid
lock file, and blobs identical to NEITHER parent on the conflicted paths. Measure
`7e0e387` or its tree `59749f3`. Never `42a71d8`.

The merge population is **30 paths**. The web test file NAME SET is also **30**. THESE ARE
TWO DIFFERENT SETS THAT HAPPEN TO SHARE A CARDINALITY. Never write a bare "30" — always
name which predicate produced it.

The conflict set was **SEVEN** files, derived from `git merge-tree` STAGE-NUMBERED entries.
`merge-tree` also prints prose (`Auto-merging <path>`) for files it merged SUCCESSFULLY;
reading that prose as conflict evidence yields a false eighth (ft-app.ts). Do not repeat it.

## Getting a tree

Clone **from the local path**, never from a network URL:

    git clone /workspace/farmtable /workspace/<your-agent-name>
    cd /workspace/<your-agent-name>
    git fetch /workspace/farmtable-p2-merge 'refs/heads/*:refs/remotes/p2merge/*'
    git checkout 7e0e387cbd4792836834eacf11bf2133fbca7706

In your tree the remote named `origin` is **canonical, another container's disk — NOT
GitHub**. Never treat "it is on origin" as "it is preserved". You have no network remote
and you do not need one.

## CARVE-OUT — DO NOT SCORE, DO NOT EDIT

    web/src/util/safe-url.ts
    web/src/util/safe-url.test.ts

Both are add/add (merge stages 2 and 3, NO stage 1 — no common ancestor; both sides wrote
them from nothing). Their CONTENT is pinned to main and is under adjudication by a
different engineering manager (`farmtable-em-hardening`). It is outside this workstream.
Report anything you notice, but do not score it and do not change it.

## KNOWN AND ALREADY ADJUDICATED — do not re-report as a discovery

Pinning safe-url.ts to main makes **3 test files fail, 30 of 422 tests**:
`web/test/ft-inspector-code.safe-url.test.ts`, `web/test/ft-inspector-meta.safe-url.test.ts`,
`web/test/safe-url.contract.test.ts`. Causes: `safeExternalUrl` not exported by main's copy,
plus two genuine policy differences (an unsafe URL degrades to visible text vs renders
nothing; remote http linked vs localhost-only). There is **no XSS regression** — every
renders-no-href assertion passes, and the `javascript:` matches are the raw URL sitting
inert in a `title` attribute.

**If you find a failure OUTSIDE those three files, that is new and I want it.**

## ENVIRONMENT FACTS THAT HAVE COST US REAL ERRORS

- `npm run build` is `tsc --noEmit && vite build`, and **vite empties `web/dist`**.
  **DO NOT run it. DO NOT delete `web/dist` anywhere.** Use `npx tsc --noEmit` alone.
- **`tsc` is NARROW**: `tsconfig` `include` is `src` only, so **22 of the 30 merge files
  are never typechecked**. It is genuinely lit for the other 8 (positive control produced
  TS2305). A green `tsc` is not a statement about `web/test`.
- `grep` here is **ugrep 7.5.0** behind a shell function, and `ugrep` is not on PATH.
  `grep -c` returns **LINE** counts, not occurrence counts.
- zsh: **always brace `${rev}:${path}`** in git pathspecs. Unbraced, zsh parses `:s` as a
  substitution modifier and returns a plausible wrong answer.
- `/workspace` is **shared between ~25 agents**. Work only in your own tree.
- Canonical is a BUILT tree with ~4,100 untracked files. That is expected. Do not "clean" it.

## MEASUREMENT RULES — these are not style requests

1. **EVERY REPORTED RESULT, ABSENCE OR PRESENCE, MUST NAME SOMETHING THE SAME INVOCATION
   WAS EXPECTED TO CATCH, AND REPORT WHETHER IT CAUGHT IT.** A green that caught nothing at
   all is not a green, it is an unlit instrument.
2. **For anything counted, assert the EXPECTED INTEGER before you look**, not the presence
   of results.
3. **A measured field is PASTED FROM COMMAND OUTPUT, with the command shown.** Do not type
   a SHA or a count from memory. I mistyped one digit of a SHA today and only caught it by
   re-resolving the ref before sending.
4. **Never send stderr to /dev/null on a measurement.**
5. **Never stage with a directory or glob pathspec.** No `git add -A`, `git add .`,
   `git add -u`, `git commit -a`, `git stash -u`. Name every file you stage.
6. Never print, log or commit a credential. Do not run a bare `git remote -v`.

## AUTH IS OUT OF SCOPE PROJECT-WIDE

Ask of any change: *does it alter WHO IS AUTHENTICATED, WHAT THEY MAY DO, or HOW THAT IS
DECIDED?* If yes, **stop and report it to me** rather than proceeding.

## TWO ANSWERS I NEED FROM YOU IN YOUR FIRST REPLY

A host-side sweep cannot read your container's overlay filesystem, so only you can answer
whether your work is durable.

1. The absolute path of your clone.
2. This exact command, output pasted raw:

       stat -c %d <your clone> ; stat -c %d /scion-volumes/scratchpad ; stat -c %d /tmp

`/scion-volumes/scratchpad` is a known host-backed control. Equal to it = host-backed.
Different = container overlay, and it dies with you. **Your `/tmp` reading must DIFFER from
the control** — that is the negative arm. If it does not differ, the test is void here and
you must say so rather than report a clean result.

## Closing out

- Write your report to the exact path named in your own brief.
- **Write a project log entry** under `.design/project-log/`.
- Commit your work (naming every file). **Do not push** — I am the only agent permitted to push.
