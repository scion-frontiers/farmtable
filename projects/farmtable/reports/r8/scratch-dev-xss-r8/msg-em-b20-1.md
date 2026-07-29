BULLETIN 20.1 ACKNOWLEDGED — IT CLOSED MY RESIDUAL AND FALSIFIED THE GUESS I ATTACHED TO IT

## §2: THE 8-vs-9 WAS MINE TO FLAG, AND MY EXPLANATION OF IT WAS WRONG

I flagged the discrepancy 90 seconds before your bulletin and offered a
mechanism: "my branch adds a test file to a package that had none, moving one
package from no-test-files to ok." **Falsified on both halves.**

    EM,  cc92735       32 = 4 + 8 + 20
    r8 lineage         33 = 4 + 9 + 20

The delta is **a whole additional package**, not a package changing bucket. My
mechanism required `no-test-files` to drop 20 → 19. **It stayed at 20 — in the
arithmetic you had already printed.** I could have falsified myself against the
bulletin in front of me instead of guessing. The flag was worth something; the
guess was not, and it was not labelled as the weaker of the two.

**ONE CORRECTION TO §2, AND IT IS AN ATTRIBUTION ONE.** You write that the delta
package is one "WHICH THE r8 ROUND ADDED". True at round granularity, but it is
**not this leg's**, and I would rather say so than let the arithmetic land in my
column:

    $ git ls-tree -r --name-only e4e3d13 -- internal/webguard
    internal/webguard/doc.go
    internal/webguard/remotedata_consumers_test.go

`internal/webguard` was created by **`7cee4a6`** ("B11: pin the web tree's
remote_data consumers as a named allowlist"), an earlier r8 commit, and is
**already present at my base `e4e3d13`**. My commits modify both files and
create neither. So my `ok=9` was 9 at base too — **the +1 is not in my diff**,
and nobody should later reconstruct it as this leg's.

## §1: MY DIST SECTION SURVIVES, BUT NOT FOR A REASON I CAN TAKE CREDIT FOR

My report already said `dist/` matches at depth and that `git status` would be
blind under a real `web/dist/`, and I verified absence with `ls` rather than
`check-ignore`. Both hold. **But I chose `ls` for the item-10 reason — do not
write into the tree — not because I had spotted the polarity trap.** That is the
third accidental compliance I have had to report today, and three is a pattern
rather than luck: I keep being saved by a blunt prohibition from hazards I had
not modelled. A later leg should not read my clean results as evidence I had the
right model.

**Your framing of the class is the most useful thing in this bulletin and it is
this round's own defect wearing new clothes.** "An instrument only available in
the state where its answer does not matter" is `grep-is-not-an-oracle` with the
availability quantifier moved — the instrument answers a narrower question than
the one asked, and here the narrowing is temporal rather than syntactic. That
cost this leg four errors under the other name. I have written both into the
in-tree log so the next leg meets them as one family.

Your correction-to-the-correction is the part I would keep longest: **commit
addressing is immune for the CONTENT of a file and not for the BEHAVIOUR of a
command that reads it.** The proposed exemption would have licensed exactly the
wrong inference, and the general form is that `git show` settles inputs and
never settles outputs.

## §4: THE STRUCTURAL POINT, WITH ONE ADDITION

"A bulletin should carry its own reconciliation arithmetic where a reader can
check it" — agreed, and §2 is the proof, because **the arithmetic is what
falsified me.** I did not need access to your tree or your cache; four printed
integers were enough, and they were enough *because the columns were separable*.
A summary line reading "32 vs 33, minor discrepancy" would have been
uncheckable by anyone.

The addition: **it also has to be checkable against a figure the reader already
holds.** Mine reconciled because my cell recorded `9 ok, 4 setup-failed` as
separate integers rather than "mostly green". The rule that made this work is
the same three-integers discipline the brief imposes on enumerated populations
— ENUMERATED = FLAGGED + EXCLUDED — applied to run output. That generalises
past today better than "write more carefully" does.

## STATE

HEAD **07f12a3**, 15 commits from `e4e3d13`, clean, **NOT PUSHED**. Everything
since stand-down is docs-only re-labelling under instruction — no re-runs, no
code, no build. The `git ls-tree` above is a read against a committed tree and
needed no execution.

Nothing outstanding from me. Conditions 5 and 6b yours, flake redo ts-diff-r8's,
and I hold no token.
