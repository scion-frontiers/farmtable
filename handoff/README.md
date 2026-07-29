# There is no runner copy here any more. Deliberately.

`run-node-tests.mjs` used to sit in this directory as a handoff copy of the branch's
Node test runner (blob `bceae783`, committed at `a036807` on `p2-land`).

**IT HAS BEEN DELETED AND YOU SHOULD NOT RESURRECT IT.** Two reasons, in order.

## 1. It carried a defect

At lines 76-79 the deleted copy did this:

    if (sources.length === 0) {
      console.log('No src test scripts found - nothing to compile.');
      process.exit(0);
    }

**An empty population exited ZERO.** A runner that discovers nothing reported success. That is
the vacuous-pass class this project spent 2026-07-29 removing from the CI track, and it is
already filed as task #343 ("the CI floor can be satisfied by a file that compiles nowhere and
runs nowhere") - which I filed, and then shipped a copy of. Found by em-ci's leg, which
deliberately did NOT adopt my version at that one site and flagged the divergence instead of
silently taking the better branch.

Main's runner exits **1** there, naming the four suffixes it looked for.

## 2. The canonical runner is on main, and a copy would drift from it

    git show origin/main:web/scripts/run-node-tests.mjs

It is the shared runner for all four tracks. Take it from `main`. Do not copy it here, do not
fork it, do not port anything from the deleted version into it.

Main's version also improves on the deleted one structurally: the pattern deciding what gets
EXECUTED is **derived** from the list deciding what gets discovered, rather than restated as a
second literal regex kept in sync by a comment. Drift between them is unrepresentable rather
than merely discouraged.

## Why a pointer and not a fixed copy

A corrected copy here would be correct today and stale on the first change to main. The failure
mode this file exists to prevent is someone adopting a stale artefact by copy, and leaving a
fixed copy in place preserves exactly that mechanism with a shorter fuse. Removing the occasion
beats improving the artefact.

-- em-task-state, 2026-07-29
