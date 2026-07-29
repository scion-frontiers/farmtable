#!/usr/bin/env bash
# merge-verify-r7.sh — verify the round-7 combine lost nothing, by CONTENT.
# Adapted from em-tooling/merge-verify.sh (round 6). Changes from the original:
#   * repo path is /workspace (the round-6 script hardcodes a path that does not exist)
#   * round-7 SHAs
#   * ancestry of BASE against BOTH legs is asserted, not assumed
#   * POSITIVE CONTROL uses a MODIFIED file, not whatever sorts first.
#
#     [CORRECTED 2026-07-28 -- THE ORIGINAL RATIONALE ON THIS LINE WAS FALSE.]
#     It read: "In round 6 the first file was an ADDED file, so the control only proved
#     the comparator can say 'missing'." That is not what happened. MEASURED against
#     /workspace/farmtable-194-combined at the round-6 SHAs: the control file
#     .design/project-log/close-label-swap-r5-label-write-scope.md is status **M**,
#     `git rev-parse BASE:<it>` returns the bare SHA 1f7659b3..., and it IS `head -1` of
#     the sorted list. The round-6 control compared two real blobs and was NOT void; that
#     MERGE VERIFIED verdict stands.
#
#     THE CHANGE IS STILL CORRECT -- but for a reason that had not happened yet rather
#     than one that had. `head -1` CAN select an ADDED file, and when it does
#     `git rev-parse "$BASE:<absent>"` exits 128 *and echoes its argument back on stdout*,
#     so the operand holds "<sha>:<path>": not empty (an -z guard misses it), never equal
#     to a blob SHA, so the control reports OK while comparing a SHA against a path string
#     -- it would report OK whether or not the merge was correct. Right fix, false reason.
#     Nobody re-derived the fix's coverage from the true hazard, because the stated one
#     read as already-settled. --diff-filter=M happens to cover the real case too.
#   * a NEGATIVE-direction control: merged-vs-owning-leg for a file the OTHER leg owns
#     must still be identical (cross-leg contamination check).
set -u
R=/workspace
BASE=6ced24e53234da12def832c46df1c2be906fc038
LEGA=cc953e467baa90c953e6345dd412a1c8920ff3e2
LEGB=4df2d1e10690ffcd7899c7a1dda7521c96aa472d

say() { printf '\n===== %s =====\n' "$1"; }
die() { printf '\n!!!!! ABORT: %s\n' "$1"; exit 90; }

cd "$R" || die "cannot cd $R"
MERGED=$(git rev-parse HEAD)

say "IDENTITY"
echo "HEAD(merged)=$MERGED"
echo "branch=$(git rev-parse --abbrev-ref HEAD)"
[ "$(git rev-parse --abbrev-ref HEAD)" = "label-write-scope-r7" ] || die "not on label-write-scope-r7"
[ -z "$(git status --porcelain)" ] || die "working tree dirty -- blob comparison would be meaningless"
for s in "$BASE" "$LEGA" "$LEGB"; do
  git cat-file -e "$s^{commit}" 2>/dev/null || die "object missing: $s"
done

say "P0 -- BASE is a genuine ancestor of BOTH legs (never diff two tips blind)"
git merge-base --is-ancestor "$BASE" "$LEGA" || die "BASE is not an ancestor of leg A"
echo "ancestor OK: BASE -> legA"
git merge-base --is-ancestor "$BASE" "$LEGB" || die "BASE is not an ancestor of leg B"
echo "ancestor OK: BASE -> legB"
MB=$(git merge-base "$LEGA" "$LEGB")
echo "merge-base(legA,legB)=$MB"
[ "$MB" = "$BASE" ] || die "true merge-base is $MB, not the BASE we were told to use"

say "P5 -- every leg commit is an ancestor of the merge"
for s in "$LEGA" "$LEGB"; do
  git merge-base --is-ancestor "$s" "$MERGED" || die "leg $s is NOT an ancestor of the merge"
  echo "ancestor OK: $s"
done
NA_C=$(git rev-list --count "$BASE".."$LEGA")
NB_C=$(git rev-list --count "$BASE".."$LEGB")
NM_C=$(git rev-list --count "$BASE".."$MERGED")
echo "commits: legA=$NA_C legB=$NB_C merged(incl 2 merge commits)=$NM_C"
[ "$NM_C" -eq $((NA_C + NB_C + 2)) ] || die "commit arithmetic off: expected $((NA_C+NB_C+2)), got $NM_C"
echo "commit arithmetic OK: $NA_C + $NB_C + 2 merge commits = $NM_C"

say "SHA-level commit preservation (compare SHAs, never counts)"
git rev-list "$BASE".."$MERGED" --no-merges | sort > /tmp/r7_merged_commits
git rev-list "$BASE".."$LEGA" | cat > /tmp/r7_a_commits
git rev-list "$BASE".."$LEGB" | cat > /tmp/r7_b_commits
sort -u /tmp/r7_a_commits /tmp/r7_b_commits > /tmp/r7_union_commits
echo "--- leg commits NOT present in merged history (must be empty):"
comm -23 /tmp/r7_union_commits /tmp/r7_merged_commits | tee /tmp/r7_lost_commits
echo "--- non-merge commits in merged history from NEITHER leg (must be empty):"
comm -13 /tmp/r7_union_commits /tmp/r7_merged_commits | tee /tmp/r7_extra_commits
[ -s /tmp/r7_lost_commits ]  && die "a leg commit SHA is absent from the combined history"
[ -s /tmp/r7_extra_commits ] && die "combined history contains a non-merge commit from neither leg"
echo "commit SHA sets match exactly"

say "FILE SETS"
git diff --name-only "$BASE" "$LEGA"   | sort > /tmp/r7_A
git diff --name-only "$BASE" "$LEGB"   | sort > /tmp/r7_B
git diff --name-only "$BASE" "$MERGED" | sort > /tmp/r7_M
NA=$(wc -l < /tmp/r7_A); NB=$(wc -l < /tmp/r7_B); NM=$(wc -l < /tmp/r7_M)
echo "legA files=$NA  legB files=$NB  merged files=$NM"
[ "$NA" -eq 0 ] && die "leg A shows 0 changed files -- comparison is void"
[ "$NB" -eq 0 ] && die "leg B shows 0 changed files -- comparison is void"
[ "$NM" -eq 0 ] && die "merged shows 0 changed files -- comparison is void"

say "P1 -- overlap A n B"
comm -12 /tmp/r7_A /tmp/r7_B > /tmp/r7_both
NBOTH=$(wc -l < /tmp/r7_both)
echo "overlap_count=$NBOTH"
[ "$NBOTH" -ne 0 ] && { echo "--- files touched by BOTH legs:"; cat /tmp/r7_both; }

say "P4 -- merged set == A u B"
sort -u /tmp/r7_A /tmp/r7_B > /tmp/r7_union
NU=$(wc -l < /tmp/r7_union); echo "union_count=$NU merged_count=$NM"
echo "--- in merge but in NEITHER leg:"
comm -13 /tmp/r7_union /tmp/r7_M | tee /tmp/r7_extra
echo "--- in a leg but NOT in merge (dropped content):"
comm -23 /tmp/r7_union /tmp/r7_M | tee /tmp/r7_missing
[ -s /tmp/r7_extra ]   && die "merge changed a file neither leg touched"
[ -s /tmp/r7_missing ] && die "a file a leg changed is unchanged in the merge -- content dropped"
echo "merged changed-file set is exactly the union, both directions"

say "POSITIVE CONTROL -- the comparator must be able to say NO"
# Deliberately pick a MODIFIED (not added) file so both blobs exist. Comparing against
# an added file's absent base blob only proves the comparator can say "missing".
PC=$(git diff --name-status --diff-filter=M "$BASE" "$LEGA" | awk 'NR==1{print $2}')
[ -z "$PC" ] && die "no MODIFIED file in leg A -- cannot build a two-blob positive control"
PC_M=$(git rev-parse "$MERGED:$PC"); PC_BASE=$(git rev-parse "$BASE:$PC")
echo "control file (modified by leg A): $PC"
echo "  merged blob $PC_M"
echo "  base   blob $PC_BASE"
if [ "$PC_M" = "$PC_BASE" ]; then
  die "POSITIVE CONTROL FAILED: merged blob equals BASE blob for a file leg A modified"
fi
echo "POSITIVE CONTROL PASSED: comparator reported MISMATCH on merged-vs-base"

say "POSITIVE CONTROL 2 -- same, on the leg B side"
PC2=$(git diff --name-status --diff-filter=M "$BASE" "$LEGB" | awk 'NR==1{print $2}')
[ -z "$PC2" ] && die "no MODIFIED file in leg B"
PC2_M=$(git rev-parse "$MERGED:$PC2"); PC2_BASE=$(git rev-parse "$BASE:$PC2")
echo "control file (modified by leg B): $PC2"
echo "  merged blob $PC2_M"
echo "  base   blob $PC2_BASE"
[ "$PC2_M" = "$PC2_BASE" ] && die "POSITIVE CONTROL 2 FAILED: merged == base for a file leg B modified"
echo "POSITIVE CONTROL 2 PASSED: comparator reported MISMATCH on merged-vs-base"

say "P2/P3 -- blob-identity of every changed file against its owning leg"
MIS=0; CHK=0
while read -r f; do
  [ -z "$f" ] && continue
  if   grep -qxF "$f" /tmp/r7_both; then OWNER=BOTH; SRC=""
  elif grep -qxF "$f" /tmp/r7_A;    then OWNER=A;    SRC=$LEGA
  else                                   OWNER=B;    SRC=$LEGB
  fi
  MBB=$(git rev-parse "$MERGED:$f" 2>/dev/null || echo MISSING)
  if [ "$OWNER" = BOTH ]; then
    AB=$(git rev-parse "$LEGA:$f" 2>/dev/null || echo MISSING)
    BB=$(git rev-parse "$LEGB:$f" 2>/dev/null || echo MISSING)
    printf 'BOTH  %-60s merged=%.8s legA=%.8s legB=%.8s\n' "$f" "$MBB" "$AB" "$BB"
    CHK=$((CHK+1))
    continue
  fi
  SB=$(git rev-parse "$SRC:$f" 2>/dev/null || echo MISSING)
  CHK=$((CHK+1))
  if [ "$MBB" != "$SB" ]; then
    MIS=$((MIS+1))
    printf 'MISMATCH(%s) %-55s merged=%.8s leg=%.8s\n' "$OWNER" "$f" "$MBB" "$SB"
  else
    printf 'ok(%s)   %-58s %.8s\n' "$OWNER" "$f" "$MBB"
  fi
done < /tmp/r7_union
echo "files_checked=$CHK  mismatches=$MIS"
[ "$CHK" -eq 0 ] && die "checked 0 files -- void run"
[ "$CHK" -ne "$NU" ] && die "checked $CHK but union is $NU -- loop skipped files"

say "CROSS-CHECK -- unchanged files really are unchanged"
# Everything in the merged tree that neither leg touched must be blob-identical to BASE.
UNTOUCHED_MIS=0; UNTOUCHED_CHK=0
git ls-tree -r --name-only "$BASE" | sort > /tmp/r7_basefiles
comm -23 /tmp/r7_basefiles /tmp/r7_union > /tmp/r7_untouched
NUT=$(wc -l < /tmp/r7_untouched)
[ "$NUT" -eq 0 ] && die "0 untouched files -- cross-check is void"
while read -r f; do
  [ -z "$f" ] && continue
  A1=$(git rev-parse "$BASE:$f" 2>/dev/null || echo MISSING)
  A2=$(git rev-parse "$MERGED:$f" 2>/dev/null || echo MISSING)
  UNTOUCHED_CHK=$((UNTOUCHED_CHK+1))
  [ "$A1" != "$A2" ] && { UNTOUCHED_MIS=$((UNTOUCHED_MIS+1)); echo "DRIFT $f base=$A1 merged=$A2"; }
done < /tmp/r7_untouched
echo "untouched_checked=$UNTOUCHED_CHK  drifted=$UNTOUCHED_MIS"
[ "$UNTOUCHED_CHK" -eq 0 ] && die "cross-check examined 0 files -- void"
[ "$UNTOUCHED_MIS" -ne 0 ] && die "a file NEITHER leg touched changed in the merge"

say "VERDICT"
if [ "$MIS" -eq 0 ] && [ "$NBOTH" -eq 0 ]; then
  echo "MERGE VERIFIED: disjoint legs; all $CHK changed blobs byte-identical to owning leg;"
  echo "                all $UNTOUCHED_CHK untouched blobs byte-identical to base;"
  echo "                both positive controls reported MISMATCH as required."
  exit 0
else
  echo "MERGE NOT CLEANLY VERIFIED: overlap=$NBOTH mismatches=$MIS"
  exit 91
fi
