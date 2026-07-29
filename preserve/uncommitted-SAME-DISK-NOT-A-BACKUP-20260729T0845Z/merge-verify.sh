#!/usr/bin/env bash
# Verify MY OWN unverified claim: that the 6ced24e merge lost nothing.
# Prediction registered in /workspace/merge-completeness-prediction.txt first.
set -u
R=/workspace/farmtable-194-combined
BASE=ea8ac390dad3d2401d65608684e5d6623ab15ac5
LEGA=5db3937ffe7c8bbcaab963e25be90abaa89074c0
LEGB=089fac7dd1f37554f9af061aebf00785964995a0
MERGED=6ced24e53234da12def832c46df1c2be906fc038

say() { printf '\n===== %s =====\n' "$1"; }
die() { printf '\n!!!!! ABORT: %s\n' "$1"; exit 90; }

cd "$R" || die "cannot cd $R"

say "IDENTITY"
H=$(git rev-parse HEAD); echo "HEAD=$H"
[ "$H" = "$MERGED" ] || die "HEAD is not the tree under test"
for s in "$BASE" "$LEGA" "$LEGB"; do
  git cat-file -e "$s^{commit}" 2>/dev/null || die "object missing: $s"
done

say "P5 — every leg commit is an ancestor of the merge"
for s in "$LEGA" "$LEGB"; do
  git merge-base --is-ancestor "$s" "$MERGED" || die "leg $s is NOT an ancestor of the merge"
  echo "ancestor OK: $s"
done
NA_C=$(git rev-list --count "$BASE".."$LEGA")
NB_C=$(git rev-list --count "$BASE".."$LEGB")
NM_C=$(git rev-list --count "$BASE".."$MERGED")
echo "commits: legA=$NA_C legB=$NB_C merged(incl merge commit)=$NM_C"
[ "$NM_C" -eq $((NA_C + NB_C + 1)) ] || die "commit arithmetic off: expected $((NA_C+NB_C+1)), got $NM_C"

say "FILE SETS"
git diff --name-only "$BASE" "$LEGA"   | sort > /tmp/mv_A
git diff --name-only "$BASE" "$LEGB"   | sort > /tmp/mv_B
git diff --name-only "$BASE" "$MERGED" | sort > /tmp/mv_M
NA=$(wc -l < /tmp/mv_A); NB=$(wc -l < /tmp/mv_B); NM=$(wc -l < /tmp/mv_M)
echo "legA files=$NA  legB files=$NB  merged files=$NM"
[ "$NA" -eq 0 ] && die "leg A shows 0 changed files — comparison is void (F5)"
[ "$NB" -eq 0 ] && die "leg B shows 0 changed files — comparison is void (F5)"

say "P1 — overlap A n B (predicted 0)"
comm -12 /tmp/mv_A /tmp/mv_B > /tmp/mv_both
NBOTH=$(wc -l < /tmp/mv_both)
echo "overlap_count=$NBOTH"
[ "$NBOTH" -ne 0 ] && { echo "--- files touched by BOTH legs:"; cat /tmp/mv_both; }

say "P4 — merged set == A u B"
sort -u /tmp/mv_A /tmp/mv_B > /tmp/mv_union
NU=$(wc -l < /tmp/mv_union); echo "union_count=$NU merged_count=$NM"
echo "--- in merge but in NEITHER leg (F3):"
comm -13 /tmp/mv_union /tmp/mv_M | tee /tmp/mv_extra
echo "--- in a leg but NOT in merge (dropped file):"
comm -23 /tmp/mv_union /tmp/mv_M | tee /tmp/mv_missing
[ -s /tmp/mv_extra ]   && die "F3: merge changed a file neither leg touched"
[ -s /tmp/mv_missing ] && die "a file a leg changed is unchanged in the merge — content dropped"

say "POSITIVE CONTROL — the comparator must be able to say NO"
# take a file leg A changed, compare merged blob against the BASE blob.
# base differs from legA by construction, so this MUST report a mismatch.
PC=$(head -1 /tmp/mv_A)
PC_M=$(git rev-parse "$MERGED:$PC"); PC_BASE=$(git rev-parse "$BASE:$PC")
echo "control file: $PC"
echo "  merged blob $PC_M"
echo "  base   blob $PC_BASE"
if [ "$PC_M" = "$PC_BASE" ]; then
  die "POSITIVE CONTROL FAILED: merged blob equals BASE blob for a file leg A changed"
fi
echo "control OK: comparator distinguishes merged from base"

say "P2/P3 — blob-identity of every changed file against its owning leg"
MIS=0; CHK=0
while read -r f; do
  [ -z "$f" ] && continue
  if   grep -qxF "$f" /tmp/mv_both; then OWNER=BOTH; SRC=""
  elif grep -qxF "$f" /tmp/mv_A;    then OWNER=A;    SRC=$LEGA
  else                                   OWNER=B;    SRC=$LEGB
  fi
  MB=$(git rev-parse "$MERGED:$f" 2>/dev/null || echo MISSING)
  if [ "$OWNER" = BOTH ]; then
    AB=$(git rev-parse "$LEGA:$f" 2>/dev/null || echo MISSING)
    BB=$(git rev-parse "$LEGB:$f" 2>/dev/null || echo MISSING)
    printf 'BOTH  %-60s merged=%.8s legA=%.8s legB=%.8s\n' "$f" "$MB" "$AB" "$BB"
    CHK=$((CHK+1))
    continue
  fi
  SB=$(git rev-parse "$SRC:$f" 2>/dev/null || echo MISSING)
  CHK=$((CHK+1))
  if [ "$MB" != "$SB" ]; then
    MIS=$((MIS+1))
    printf 'MISMATCH(%s) %-55s merged=%.8s leg=%.8s\n' "$OWNER" "$f" "$MB" "$SB"
  fi
done < /tmp/mv_union
echo "files_checked=$CHK  mismatches=$MIS"
[ "$CHK" -eq 0 ] && die "F5: checked 0 files — void run"
[ "$CHK" -ne "$NU" ] && die "checked $CHK but union is $NU — loop skipped files"

say "VERDICT"
if [ "$MIS" -eq 0 ] && [ "$NBOTH" -eq 0 ]; then
  echo "MERGE VERIFIED: disjoint legs, every blob byte-identical to its owning leg."
else
  echo "MERGE NOT CLEANLY VERIFIED: overlap=$NBOTH mismatches=$MIS — inspect by hand."
fi
