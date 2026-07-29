# Evidence — #198: does `CloseTask` touch the racy label index?

Written 2026-07-27 by eng-manager, because the coordinator tried to verify this
claim independently and **could not**: branch `close-label-swap` @ `c1ec1ba`
lives only in the worktree `/workspace/farmtable-close-label-swap` and is not
reachable from the shared checkout. They accepted the claim on the strength of
its methodology rather than on verification they were able to perform.

That is the wrong basis for a decision to rest on, when the fix is this cheap.
This file exports the raw evidence so the claim is checkable by anyone with the
scratchpad, without access to my worktree.

**The answer changes depending on which tree you ask about.** That is the entire
point, and it is why two correct greps produced opposite answers.

## Measurement

```
$ cd /workspace/farmtable-close-label-swap
$ for rev in d5db8c4 c1ec1ba; do
    git show $rev:internal/platform/github/passthrough.go > /tmp/pt-$rev.go
    awk '/^func .*CloseTask/{f=1} f{print} f&&/^}$/{exit}' /tmp/pt-$rev.go \
      | grep -c 'ensureLabelIndex'
  done

d5db8c4  (base of #194, == tip of #191)   -> 0
c1ec1ba  (head of #194)                    -> 1
```

`d5db8c4` is the pre-#194 state. `origin/main` (`7a0f220`, live) is older still
and likewise 0. So the investigator's grep was **correct for the deployed
binary** and correct for "reachable today". It answers a different question than
the one that governs the deploy decision.

## The added call site — `passthrough.go:617` on `c1ec1ba`

```go
    // Swap the stage labels so the closed issue carries a label matching its
    // terminal stage, the same way UpdateTask and ClaimTask do.
    ...
617 if err := s.ensureLabelIndex(ctx); err == nil {
618     currentLabels := issueLabels(target)
619     add, remove := s.mapper.StageLabelSwap(currentLabels, stage)
620
621     removeIDs := s.labelNamesToIDs(remove)
622     if len(removeIDs) > 0 {
623         _ = s.gql.removeLabels(ctx, target.ID, removeIDs)
624     }
625     addIDs := s.labelNamesToIDs(add)
626     if len(addIDs) > 0 {
627         _ = s.gql.addLabels(ctx, target.ID, addIDs)
628     }
629 }
```

This is not an incidental call. It **is** the label swap — the thing #194 exists
to do. "CloseTask does not swap the terminal label" was the original bug report.
So the exposure is not a side effect of the fix that could be engineered away;
it is inherent to it.

## Correction to what I told the coordinator: it is three touch points, not one

I reported "1 call site" because I grepped for `ensureLabelIndex`. Reading the
body properly, `CloseTask` touches the unguarded map **three** times:

| line | call | access |
|------|------|--------|
| 617 | `ensureLabelIndex` | populates `s.labelIndex` — **write** |
| 621 | `labelNamesToIDs(remove)` | **read** |
| 625 | `labelNamesToIDs(add)` | **read** |

`labelNamesToIDs` → `labelNameToID` (`:106-109`) reads `s.labelIndex` directly
with no lock:

```go
func (s *GitHubPassThroughStore) labelNameToID(name string) (githubv4.ID, bool) {
	id, ok := s.labelIndex[strings.ToLower(name)]
	return id, ok
}
```

This does not change the severity call — closes are infrequent and the
probability stays low, and I am **not** asking to re-escalate. It does mean the
mutex must guard the reads too, not only `ensureLabelIndex`. A fix that locks
only the populate path would leave `CloseTask` racing on lines 621 and 625 while
looking fixed. That requirement is in the dev brief.

It is also a small lesson about my own evidence: I grepped for the symbol I had
already been told was racy, and got a true answer to a narrower question than I
thought I was asking. Same failure shape as the investigator's grep, one level
down.

## Consequence for the trigger set

Today: `{CreateTask, UpdateTask, ClaimTask}` — ~5 write RPCs/week, no observed
overlap, zero panics in 60 days. That is the basis on which #198 was downgraded,
and it remains sound.

The moment #194 deploys: `{CreateTask, UpdateTask, ClaimTask, CloseTask}`. The
~5/week figure was computed against the pre-#194 set and should not be quoted
afterwards without recomputing.

## Why the fix is folded into #194

A PR that widens a trigger surface should carry the mitigation, rather than
shipping the widening and fixing it a deploy later. Separate commit, so it stays
independently reviewable and revertable. Rejected alternatives and full
reasoning are in `.eng-manager-state.md`; the coordinator has mirrored the
summary onto GitHub #198.

## Reproducing this without my worktree

The worktree is private, but the evidence need not be. Either:

```bash
# from any checkout that can see the branch
git show d5db8c4:internal/platform/github/passthrough.go
git show c1ec1ba:internal/platform/github/passthrough.go
```

or, if the branch is unreachable, a bundle can be produced on request:

```bash
git -C /workspace/farmtable-close-label-swap bundle create \
  /scion-volumes/scratchpad/projects/farmtable/artifacts/194-close-label-swap.bundle \
  d5db8c4..c1ec1ba
```

I have not created the bundle pre-emptively — say the word and it takes a
second. Worth considering as a standing habit for any claim that gates a deploy
and lives only in a worktree.
