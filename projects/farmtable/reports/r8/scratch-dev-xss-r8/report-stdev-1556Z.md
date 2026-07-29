**1. /workspace/farmtable-xss-r8 — st_dev 2049. COVERED, AND SO IS MY OBJECT STORE, WHICH IS NOT AT THAT PATH.** 2. No bundle needed on that account; one uploaded anyway for a different reason, filename at the end.

## THE COORDINATE, NOT THE LABEL — MY CLONE PATH IS NOT WHERE MY OBJECTS ARE

    2049      /workspace/farmtable-xss-r8          <- my tree
    2049      /workspace/farmtable/.git            <- where my objects actually live
    2049      /workspace/farmtable/.git/objects
    2049      /scion-volumes/scratchpad
    1048645   /tmp/r8-work                         <- NEGATIVE ARM, same invocation
    1048645   /tmp/r8-mutation
    1048645   /tmp/probe.bundle

**Both 2049, so the answer is the same either way — but a sweep keyed on my
directory name is not reading my object store.** This is a linked worktree;
git rev-parse --git-common-dir is /workspace/farmtable/.git. Anything of mine
you find, you find because you swept canonical, not because you swept me.

The negative arm fired in the same invocation and printed a different device.

## MY OVERLAY IS 1048645. dev-safeurl-union'S WAS 1048612. THEY ARE DIFFERENT NUMBERS

**That confirms your worst case as a measurement rather than an inference:
overlays are per-container, so /tmp/<anything> resolves in whichever container
asks.** Had you fetched /tmp/leg-safeurl from here you would not have got an
error — you would have got my empty /tmp and rc=0. **st_dev is the discriminator
that tells those apart, and it is the only one in the list that does.** Path
identity across containers is worthless; the device number is not.

It also retroactively justifies something I did at 15:39Z for a worse reason. I
mirrored /tmp/r8-work to the scratchpad because it "felt container-local" — I
had not measured it and could not have told you why. **1048645 is the reason,
and I did not have it at the time.** Filing that as accidental compliance, a
fourth instance; the blunt heuristic happened to point the right way again.

Consequence I am flagging rather than acting on: **/tmp/probe.bundle is on the
overlay and dies with me.** Its scratchpad copy is on 2049 and does not.

## A FAILURE MODE I PREDICTED AGAINST YOUR SWEEP AND THEN FALSIFIED

I expected that a worktree's .git is a file, not a directory, so a sweep using
git --git-dir=<path>/.git would fail on every worktree and log a not-found —
your silent-failure shape again, on 128 trees. **I tested it before sending.
It does not happen:**

    git --git-dir=/workspace/farmtable-xss-r8/.git rev-parse HEAD   rc=0
    git -C  /workspace/farmtable-xss-r8          rev-parse HEAD     rc=0

Both return 07f12a3. git resolves the gitfile indirection itself. **No hazard —
reporting it only because I would otherwise have sent you a plausible one, and
a false alarm at this stage costs you a re-sweep you do not need.**

## UPLOADED ANYWAY, AND NOT FOR MY OWN COMMITS

    bundles/dev-xss-r8-shared-store-all-refs-1544Z.bundle   st_dev 2049   4496196 bytes

Nothing of mine requires it. **It is the only artefact holding the 235
refs/salvage name-to-SHA bindings that were deleted from the shared store
between 15:44Z and 15:46Z.** The commits are all still reachable under
refs/em-audit/salvage/\*, so no object is at risk — but the mapping from salvage
ref name to tip exists nowhere live. The bundle predates the deletion and the
two ref lists sit beside it in reports/r8/scratch-dev-xss-r8/. Free to ignore if
that deletion was intentional.

**Both questions answered. Idle, ready to retire, nothing outstanding.**
