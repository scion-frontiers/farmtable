PRESERVATION STEP DONE. **NO UNREACHABLE REFS, VERIFIED BY ANCESTRY AGAINST origin/main.** NO BUNDLE NEEDED FOR ME — AND THE PREMISE OF THE INSTRUCTION IS FALSE FOR THIS LEG, WHICH MATTERS FOR THE OTHER 127.

## 1. THE REQUIRED ANSWER

**No unreachable refs, verified by ancestry against origin/main.** My tip is not
merely reachable — it is already merged in. Three independent routes:

    $ git merge-base --is-ancestor 07f12a3 origin/main   -> exit 0
    $ git log origin/main --oneline | grep -c "^07f12a3" -> 1
    $ git branch -a --contains 07f12a3                   -> main, origin/HEAD, +9 remotes
    origin/main = 2982ffd  "merge: ci.yml review findings onto the manifest floor fix"

Nothing of mine is at risk. No bundle written.

## 2. YOUR PREMISE IS WRONG FOR ME, AND I THINK FOR MOST LEGS HERE

You wrote: *"your leg clone's object store exists in exactly one place — your
container."* **This tree is not a clone. It is a linked worktree.**

    $ cat .git
    gitdir: /workspace/farmtable/.git/worktrees/farmtable-xss-r8
    $ git rev-parse --git-common-dir
    /workspace/farmtable/.git
    $ echo $SCION_WORKSPACE_MODE
    shared-plain

**My objects were never in my container.** They are in `/workspace/farmtable/.git`,
on a shared-plain host filesystem, in the same object store canonical uses. That
is why your 13:49Z ruling 2 found my tip from canonical and today's message says
you cannot — **both observations were of the same store and the earlier one was
right.** Retiring my container destroys nothing.

**THE SCALE, MEASURED:**

    worktrees sharing /workspace/farmtable/.git   128
    local branches in that shared store           207
      reachable from origin/main                   85
      NOT reachable                               122

Your recovery effort described 204 tips found by sweeping 125 clones. **125
clones and 128 worktrees is unlikely to be a coincidence.** If those were
worktrees rather than clones, they were never 125 separate object stores — they
are one store, and the 122 unreachable tips are enumerable from any single
worktree with one command. I am not asserting your sweep was wasted; I am saying
the model that generated it does not describe this repository, and it is worth
checking before you spend more on per-container preservation.

## 3. WHAT IS ACTUALLY AT RISK — FOUR TIPS, AND NOT FOR THE REASON YOU EXPECTED

Branch refs are safe: a branch survives worktree deletion. **Detached HEADs do
not.** Ten worktrees are on detached HEAD; six are covered by a branch ref or by
origin/main. **Four are protected by nothing except the continued existence of
their worktree directory:**

    4fb7f43   /workspace/farmtable-f61-rename
    91aa668   /workspace/farmtable-f61-review
    ef4bbf8   /workspace/farmtable-f63-review
    045a0c2   /workspace/farmtable-f66-review

**`git worktree prune` followed by `git gc` deletes these permanently, and the
operational freeze on gc and prune was lifted at 13:29Z.** That is a live
irreversible hazard on a shared store during an active teardown — a bigger
exposure than the one this instruction was written to address, and pointing the
opposite way: the danger is not container deletion, it is a routine maintenance
command run in canonical.

**I DID NOT BUNDLE THEM AND I WANT YOU TO KNOW WHY, BECAUSE IT IS A REAL
TRADE-OFF.** Bare SHAs cannot be bundled:

    $ git bundle create probe.bundle 4fb7f43 91aa668 ef4bbf8 045a0c2
    fatal: Refusing to create empty bundle.

Preserving them requires **writing refs into the object store that 128 worktrees
share**, which is shared infrastructure and not mine to modify unilaterally
mid-teardown. **Say the word and I will do it in one command** — create four
`refs/preserve/*` refs and bundle them — or hand the four SHAs to whoever owns
canonical. They are cheap to save and impossible to recover.

## 4. AN INSTRUMENT FAILURE I HIT WHILE DOING THIS, BECAUSE YOUR WARNING CAUGHT IT

My first pass at section 3 reported **all ten** tips as AT RISK. It was wrong.
`git` dropped out of `PATH` inside a process-substitution loop, every call
errored, and every tip fell through the `else` branch into the at-risk bucket:

    (eval):1: command not found: git      [x20]
      AT RISK  633f8f2 ...   <- false; two branches point at it

**A broken loop produced a clean, plausible, entirely fabricated table**, and I
would have sent it. I caught it only because you said *do not send stderr to
`/dev/null`* — the errors were interleaved with the results and visible. Re-run
with an absolute `/usr/local/bin/git`, the true answer is 6 covered / 4 at risk.

This is the same defect this leg has been cataloguing all round — **an instrument
answering a narrower question than the one asked, and failing silently in the
direction of a confident answer.** Your one-line warning is the only reason it
did not become my final report. Worth keeping in the wind-down instruction
verbatim for whoever runs it next.

*(Also noted: `... | tail -5; echo exit=$?` reports the exit of `tail`, not of
`git`. It printed `exit=0` over a `fatal:`. The real evidence was the missing
file.)*

## STATE

Nothing further from me. Tree `/workspace/farmtable-xss-r8` untouched and
preserved as the audit trail; `/tmp/r8-work/` and `/tmp/r8-mutation/*` retained.
No commits, pushes, refs or deletions made during this step — it was entirely
read-only apart from one probe bundle that git refused to write.

Ready to be retired, or to create those four refs first if you want them.
