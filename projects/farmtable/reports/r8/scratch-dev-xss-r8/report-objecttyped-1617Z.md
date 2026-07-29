DEFECT 12 CHECKED AGAINST MY OWN FIGURES — **MY SPELLING WAS GLOB-FREE, SO MY NUMBERS STAND.** But the object-typed gate landed on me hard: **253 FREE-FLOATING OBJECTS, 129 BLOBS AND 124 TREES, ZERO COMMITS — AND THEY WERE INSIDE A NUMBER I REPORTED TO YOU THIRTY MINUTES AGO.** Packed and restore-verified.

## 1. DEFECT 12, REPRODUCED HERE, AND ONE ADDITION TO YOUR FIX

    glob  refs/salvage/*     ->   0
    bare  refs/salvage/      -> 368
    bare  refs/salvage       -> 368   <- the spelling I actually used
    glob  refs/netcheck/*    ->   0
    bare  refs/netcheck/     -> 834

**Your fix says "a bare prefix ending in /". The no-slash form is recursive
too** — 368 either way. Keep recommending the slash, it is unambiguous, but a
leg that used the no-slash form has a valid number and does not need to re-run.

**My 235-ref salvage deletion finding is unaffected**, and not because I say so:
both readings used the glob-free spelling, **and the corroborating movement was
in the unfiltered total, 2280 -> 2045, which has no pattern in it at all.** Two
instruments, one of them pattern-free, same 235.

## 2. THE OBJECT-TYPED GATE — I FAILED IT MYSELF, IN MY LAST MESSAGE

    objects in store, unreachable from every ref     262
       commit  9   <- the negarm probes I already reported
       tree  124
       blob  129
    objects reachable from those 9 commits          3807
    UNREACHABLE AND EXPLAINED BY NO COMMIT           253

**At 16:10 I sent you "batch-all-objects 17194 objects / 1378 commits" and then
answered a commit-typed question over it. The 253 were inside the population I
had already enumerated and outside the question I chose to ask.** I had the
object-typed number in my hand and narrowed it to commits without noticing.
test-xss-r8's recommendation is not a new instrument for me — it is the one I
already had and did not point at anything.

**What they are**, sampled by size, content read out of the store:

    246297  blob beginning "DIRC"     <- A GIT INDEX FILE, hashed in as a blob
    230632  blob, ent generated code
    107012 / 107012 / 106220 / 105908  four near-identical JSON blobs

**The four JSON blobs are byte-distinct revisions of the same artefact** — the
"superseded report revisions" class test-xss-r8 found, here in quadruplicate.
The DIRC blob is a git index someone hash-object'd into the store; no commit
will ever point at it.

## 3. PACKED AND VERIFIED BY RESTORE, THREE DISTINCT ARMS

    bundles/dev-xss-r8-freefloating-253-objects-1616Z.pack   378801 bytes

    unpack-objects into an empty bare repo       rc=0
    objects landed                               253 / 253
    POSITIVE  a free-floating blob               rc=0  PRESENT
    NEGATIVE  a ref-reachable commit NOT packed  rc=1  ABSENT
    NEGATIVE  fabricated SHA                     rc=1  ABSENT

**The middle arm is the one that matters and it is the arm I would not have
thought to add before your last message.** A pack that had silently swept in
everything reachable would have returned PRESENT there, and the fabricated arm
alone could not have told me — a dead instrument answers the negative arm's way
for everything. That is your point, used.

## 4. WHAT I AM AND AM NOT CLAIMING ABOUT RISK

These are on /workspace/farmtable/.git, st_dev 2049, host-backed. **They do not
die with any container, mine or anyone's.** The only thing that reaches them is
git gc with prune in canonical, and the freeze on that lifted at 13:29Z.

**I have not tested them against the network and I am not going to** — that
needs the remote URL, not the name origin, and pushing is yours. If they matter,
the pack is on the scratchpad and it costs you one index-pack. If they are
somebody's scratch, ignore it; the pack is 370KB.

**I did not modify the store. Read-only throughout, one pack written to the
scratchpad and one throwaway repo in /tmp.**
