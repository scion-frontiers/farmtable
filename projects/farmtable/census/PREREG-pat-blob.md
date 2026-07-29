# PRE-REGISTRATION - is the PAT in a blob in canonical's object store?
# Written BEFORE the measurement. File mtime is the evidence of ordering.
# Author: farmtable-reconcile-urlbinding

## PREMISE I AM REJECTING
Constraint (b) says "search by the sha256 fingerprints you already hold". I HOLD NONE.
I have never been given the credential's value, its hash, or its containing filename.
So I CANNOT run the ordered instrument. I am substituting a FORMAT detector, which is
strictly better against constraint (b): it never materialises the value at all.

## DETECTOR
GitHub token prefixes: ghp_ gho_ ghu_ ghs_ ghr_ github_pat_
Plus URL userinfo: https://<user>:<secret>@host
grep -aoE only. NO awk regex, NO interval quantifier anywhere (mawk broadcast 09:39Z).

## POPULATION
Canonical /workspace/farmtable, ALL blob objects via cat-file --batch-all-objects.
Covers reachable AND the 255-unreachable set. To be PROVEN by comparing
all-objects blob count against reachable-only blob count, not asserted.

## PREDICTION (committed before looking)
NO token-format hit in any canonical blob. Reasoning: the credential was reported in an
UNTRACKED working-tree file, and untracked files have no object. I expect the userinfo-URL
pattern MAY hit, because remote URLs with embedded credentials could have been committed
in config/scripts at some point.

## INTERPRETATION OF EACH BRANCH - fixed now so neither of us chooses afterwards
1. ZERO token-format hits in all-objects.
   -> refs-only move is sufficient WITH RESPECT TO A TOKEN OF THESE FORMATS IN THIS STORE.
      NOTHING MORE. It does not clear other stores, other formats, or non-token secrets.
2. HIT IN A REACHABLE BLOB.
   -> refs-only is WEAKENED but may still work if every containing ref is moved. Must then
      enumerate which refs reach it.
3. HIT IN AN UNREACHABLE BLOB (in the 255).
   -> REFS-ONLY IS DEAD. No ref move can relocate an object no ref points at. This is the
      branch that kills the leading option and it must be reported instantly.
4. HIT ONLY IN THE USERINFO-URL PATTERN, NOT A TOKEN PREFIX.
   -> A DIFFERENT AND POSSIBLY OLDER CREDENTIAL. Do not conflate with the PAT. Report as
      a separate finding with its own object SHAs.
5. UNENUMERATED BRANCH, per the coordinator's instruction to expect his branch set to be
   incomplete: DETECTOR CANNOT BE VALIDATED - if the positive control does not fire, NO
   RESULT IS PUBLISHED AT ALL, clean or otherwise. An unvalidated zero is not a zero.

## OUTPUT RULE
Object SHAs and counts ONLY. NO VALUE PRINTED, ever, in any branch, including in a control.
