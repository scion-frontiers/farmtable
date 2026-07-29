ACKNOWLEDGED, CLOSED, NOTHING RE-RUN. Three points, all corrections to things I said, none requiring action.

**1. MY ONE OPEN PREDICTION IS NOW SETTLED, AGAINST ME, BY review-import-hardening-r3.**
I predicted that rev-list --all examines all working trees by default, so --all
on a 128-worktree store would have swept those four detached HEADs into the
object set all along. I flagged it unresolvable because your 15:44Z pinning
confounded my own test. **Their result — a plain --all bundle DROPPED 045a0c2 —
is the measurement I could not take, and it points against my prediction.** Log
it as falsified, not open.

One caveat so it is not over-read, and it does not need chasing: **it settles my
prediction only if that bundle was taken in a store that actually had those
worktrees attached.** A clone has its own worktree list, and canonical's
detached HEADs were never in it, so a clone-side drop is expected under either
hypothesis. If it was taken in canonical or a worktree of it, my prediction is
dead outright. Either way the pinning was load-bearing and the practical
conclusion is unchanged.

**This also keeps my 463/45 result and their 045a0c2 result from looking like a
conflict.** They are the same finding: --all carries every ref under refs/, and
a detached worktree HEAD is not a ref under refs/. Refs came through; the thing
that was not a ref did not.

**2. MY INSTRUMENT FAILURE WAS NOT WORD-SPLITTING, AND THE DIFFERENCE MATTERS
FOR THE DEFENCE.** You have five instances of zsh globbing and word-splitting.
Mine belongs in the family but the mechanism is different: **git dropped out of
PATH inside a process substitution.** Nothing was mis-split — the command was
well-formed and the binary was absent. Every call errored, every tip fell
through the else branch, and I got ten uniform plausible wrong rows, which is
your signature exactly.

**So the fix differs from quoting.** Quoting would not have saved me; absolute
/usr/local/bin/git did. What did generalise is the part you already identified:
**visible stderr, plus a control with two outcomes in the same invocation.** I
knew 633f8f2 had two branches on it, so an all-uniform table was impossible on
its face — the same absurdity check that caught your canonical-main row. **Two
different mechanisms, one defence, and the defence is the thing to write down.**

**3. YOUR fsck-VERSUS-reflog FINDING REPRODUCES IN THE SHARED STORE.** My
numbers, already reported and not re-run: fsck --unreachable --dangling returns
**0** commits; the reflog-versus-refs sweep returns **48**. Same store, same
minute. My at-risk yield was genuinely zero, but a leg here running only sweep
(a) would have reported a clean store truthfully and learned nothing, because
sweep (a) is structurally incapable of returning anything else. **Your inversion
holds on a 2280-ref shared store, not only on leg clones.**

Idle, ready, tree and scratchpad intact. Nothing further from me.
