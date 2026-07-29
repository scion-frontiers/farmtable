# Salvaged refs: `refs/salvage/*` on origin

## If you are looking for lost work, read this line first

    git fetch origin 'refs/salvage/*:refs/salvage/*'
    git for-each-ref refs/salvage --format='%(refname) %(objectname:short) %(subject)'

You should not need to know that incantation. `.git/config` in the canonical
clone carries `+refs/salvage/*:refs/salvage/*` as a second fetch refspec, so a
plain `git fetch origin` brings them all back. If you are in a *fresh* clone,
that refspec is not there — clone defaults are `+refs/heads/*` only — and the
command above is how you get them.

## What these refs are

On **2026-07-29** the agent fleet held 125 clones plus 2 nested working trees
on one host, each provisioned from a local path rather than from a network
remote. A container death would have destroyed anything that existed only in
one of them.

A sweep fetched all 442 tips from every clone into the canonical tree and
applied one predicate:

> **a tip reachable from no ref on origin** — i.e. work that existed in exactly
> one copy, anywhere.

**204 tips** matched and were pushed to origin as
`refs/salvage/<clone>/<branch>` — e.g. `refs/salvage/dev-p2-rebase/p2-land`.
The clone segment carries provenance and namespaces the branch name, so the
same branch name in two clones cannot silently overwrite one copy with the
other. They
are commits from real agent work: fixes, canaries, prereg notes, project-log
entries. Some are superseded. Some are not. Nothing was rewritten, nothing was
deleted, and no working tree was touched.

## The second sweep, later the same day: 124 more

The first sweep enumerated `refs/heads/*` only. A corrected enumerator — every ref
`for-each-ref` reports, **plus detached `HEAD`, plus `reflog --all`** — was run over
133 live trees and found **222** tips reachable from no ref on origin, reducing to
**124 independent** tips. Origin salvage refs went 225 -> 352.

What the first enumerator would have caught, out of those 222:

| kind | count |
|---|---|
| `refs/heads/*` | **2** |
| detached `HEAD` | 4 |
| reflog-only | 88 |
| `refs/preserve/*` (an agent's own local salvage namespace) | 128 |

Two of two hundred and twenty-two. The `refs/preserve/*` rows are the sharp ones: an
agent had already preserved its own unreachable objects, correctly — into a namespace
the fleet sweep did not enumerate. **Diligent local preservation into a namespace
nobody sweeps is indistinguishable from no preservation at all once the container
dies.** If you write a sweep, publish its enumerator next to its count.

Detached-`HEAD` tips are named `detached/<short-sha>` and reflog-only tips
`reflog/<short-sha>` under the owning clone.

## Why `refs/salvage/*` and not `refs/heads/*`

The CI workflow triggers on `push: branches: ['**']`, which matches
`refs/heads/**` and nothing else. Pushing 204 tips as branches would have
fired 204 CI runs against 204 unreviewed commits. Pushing them outside
`refs/heads/` makes them durable and inert: GitHub stores them, nothing builds
them, and no reviewer is asked to look at them.

The cost of that choice is the one this file exists to pay: refs outside
`refs/heads/` are not fetched by default and are invisible to `git branch -r`,
the GitHub branch list, and every normal workflow.

## Before you tidy these away

They are the only copy. Deleting a `refs/salvage/*` ref destroys the commit it
points at. If you want to retire one, first prove the commit is reachable from
`origin/main` (`git merge-base --is-ancestor <sha> origin/main`), and say so in
the commit message that removes it.

## Known residual exposure

A sweep is a snapshot of a moment, not a mechanism. Clones are still
provisioned from local paths — one of them from inside another agent's clone —
so new single-copy work accumulates continuously and the next sweep has to be
run by hand. Provisioning agent clones with a real remote is the structural
fix; it is tracked in the out-of-scope backlog, not here.

Uncommitted files in a live working tree are outside the reach of any sweep.
Only the owning agent can commit those.

A ref preserved for an agent that is still working is **a handoff as of that SHA, not
a handoff.** One agent reported a preserved tip, kept committing, and its salvage ref
was three commits stale within the hour — invisible from the sweeper's side, because
the ref still resolves and the check still passes. The answer was simply old.
