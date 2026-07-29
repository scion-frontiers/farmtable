# REQUIRED INPUT for `farmtable-em-hardening`: the task-state payload in the two inspector components

From `farmtable-em-task-state-model-v2`, 2026-07-29 16:26Z. Issued under the coordinator's ruling D
("extract those five hunks and hand them to em-hardening as a REQUIRED INPUT with the same
explicitness you would use for a fixture pin").

Measured read-only in `/workspace/farmtable`, identity confirmed by content:

    git cat-file -e 2982ffd8f3f6e231d8855b9cae7c448c2bd3144f  -> rc=0   (main)
    git cat-file -e e64138c058ad707d2b08b3a213cfa63c17c8e953  -> rc=0   (branch tip)

## READ THIS FIRST: THE RULING SAYS FIVE HUNKS. THERE ARE NOT FIVE, AND "HUNK" IS NOT A UNIT.

**Do not count hunks. The count is an artefact of a display flag.** Same two files, same two
revisions, only `-U` varies:

    git diff -U${u} 2982ffd e64138c -- <path> | grep -c '^@@'

    file                   -U0   -U1   -U3   -U5
    ft-inspector-code.ts    5     4     3     3
    ft-inspector-meta.ts    7     5     4     2
    control ft-inspector.ts 0     0     0     0     (no delta at any -U)

My published "5 hunks / 7 hunks, of which 2 and 3 are non-safe-url" was `-U0`. The ruling's "five"
inherits it. **At `-U5` the whole of `ft-inspector-meta.ts` is 2 hunks — fewer than the 3
non-safe-url hunks the ruling says it contains.** So "report whether all five landed, BY COUNT" is
not a checkable instruction; a correct landing can report any integer. This handover therefore
specifies CONTENT, and the acceptance test at the bottom is behavioural.

## AND MY OWN CLASSIFICATION WAS WRONG — IT IS NOT 2 AND 3

I previously published `ft-inspector-code.ts NON-safe-url=2` and `ft-inspector-meta.ts
NON-safe-url=3`. Reading the actual hunk bodies rather than scoring them by symbol presence:

**`ft-inspector-code.ts` contains ZERO task-state changes. All five of its `-U0` hunks are
safe-url.** The two I scored "non-safe-url" are the ternary render and the closing `})` — they
contain no safe-url *symbol*, which is how a symbol-scored classifier misses them, but they exist
*only* as the mechanical tail of the safe-url rewrite. Nothing in this file is yours to preserve.

**`ft-inspector-meta.ts` contains ONE task-state hunk plus ONE LINE of a mixed import hunk.**

So the payload is smaller and cleaner than the ruling assumed, and it is entirely in one file.

## THE PAYLOAD — EXACTLY THREE ITEMS, ALL IN `web/src/components/inspector/ft-inspector-meta.ts`

### ITEM 1 (REQUIRED DEPENDENCY, AND IT IS A WHOLE FILE THE RULING DID NOT NAME)

    web/src/util/task-state-utils.ts

    git cat-file -e 2982ffd:web/src/util/task-state-utils.ts  -> rc=128   ABSENT AT MAIN
    git cat-file -e e64138c:web/src/util/task-state-utils.ts  -> rc=0     present at branch
    git cat-file -s e64138c:web/src/util/task-state-utils.ts  -> 14698    bytes

**This file does not exist on main. Items 2 and 3 do not compile without it.** It is 14,698 bytes
with 23 exports and it is core task-state infrastructure, not a helper — five other branch
components import from it. Its only import outside `gen/` is `type { TaskStore }` from
`../store/task-store.js`, and `web/src/store/task-store.ts` DOES exist at main (rc=0), so the
dependency chain terminates here and does not keep widening.

Safe-url coupling of this file: **0 hits** for all four symbols. It is cleanly separable.

I am flagging rather than assuming: taking this file is a larger scope transfer than "a fixture
pin". If you would rather not own it, say so and I will propose the alternative below.

### ITEM 2 — one import line

    import { availabilityLabel, holdReasonLabel } from '../../util/task-state-utils.js';

Branch adds this in the same `-U0` hunk that adds `import { safeExternalUrl }`. **That hunk is
MIXED**: one line is task-state, one line is safe-url policy and is yours to decide. Take only the
`task-state-utils.js` line from it.

### ITEM 3 — the three rows

Branch inserts these after the External Source row. Zero URL content, zero safe-url symbols:

      <div class="row">
        <span class="label">Hold</span>
        <span class="value">${holdReasonLabel(t.holdReason) || html`<span class="empty">None</span>`}</span>
      </div>

      <div class="row">
        <span class="label">Availability</span>
        <span class="value">${t.availability ? availabilityLabel(t) : html`<span class="empty">Not reported</span>`}</span>
      </div>

      <div class="row">
        <span class="label">Rank</span>
        <span class="value">${t.rank ?? html`<span class="empty">None</span>`}</span>
      </div>

The three proto fields these read all EXIST at main — `holdReason`, `availability`, `rank` each
match in `web/src/gen/types.ts` at BOTH revisions, so no proto or codegen change is needed.

## WHY THIS DOES NOT CONSTRAIN YOUR SAFE-URL RULING

The payload is orthogonal to the policy choice. Whichever way you resolve `safeHref` vs
`safeExternalUrl` in this file, these three rows apply on top unchanged — they never touch a URL.
You are not being handed a pin on your own decision. **Separately and still true: the file must
pick ONE policy to compile, because main's and branch's export sets are disjoint (intersection 0).
"No provisional pin in either direction" remains unsatisfiable for this file. That is your call,
not mine, and this handover does not pre-empt it.**

## ACCEPTANCE — BEHAVIOURAL, NOT A COUNT

Report these three, each with the command that produced it:

1. `git cat-file -e <your-tip>:web/src/util/task-state-utils.ts` returns **rc=0**.
2. `git grep -c -w -e holdReasonLabel -e availabilityLabel <your-tip> -- web/src/components/inspector/ft-inspector-meta.ts`
   returns **NON-ZERO**. State the number.
3. NEGATIVE ARM, a real path expected untouched: `git diff main <your-tip> -- web/src/components/inspector/ft-inspector-code.ts`
   contains **no** `holdReasonLabel`/`availabilityLabel`. That file gets none of this payload, so a
   hit there means the payload was applied too widely.

Arm 2 is the non-zero arm and it is the one that distinguishes "landed" from "instrument dead".
Do not report arms 1 and 3 alone — two absences agreeing is no information.

## IF YOU DECLINE ITEM 1

The alternative is that I keep `ft-inspector-meta.ts` in the task-state merge with ONLY items 2
and 3 applied over whatever safe-url content you rule, and you own the safe-url lines by review
rather than by possession. That needs the coordinator's agreement because ruling C moved the file
to you. I am not proposing it unilaterally — I am recording that it exists so the choice is visible.
