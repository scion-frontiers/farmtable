#!/usr/bin/env bash
# Detect reviewer/project-log commits that exist in SOME agent clone but are
# reachable from NOTHING canonical and NOTHING preserved -- i.e. one `rm -rf`
# from gone.
#
# Found 89306d0 by chance tonight. Chance is not a control. This is the control.
#
# SAFE  = a project-log commit reachable from any ref in the canonical repo,
#         OR from any refs/preserve/** in the verify repo.
# RISK  = a project-log commit reachable from some clone's refs, not in SAFE.
# SHA sets are comparable across repos; ancestry queries are not. So: sets.
set -u

CANON=/workspace/farmtable
VERIFY=/workspace/farmtable-em-verify195
LOGDIR=.design/project-log
EXCLUDE_PRESERVE=${EXCLUDE_PRESERVE:-0}   # positive-control switch

say()  { printf '\n===== %s =====\n' "$1"; }
die()  { printf '\n!!!!! ABORT: %s\n' "$1"; exit 90; }

# ---- collect project-log commits reachable from every ref of a repo ----
logcommits() {  # $1=repo  $2=ref-glob
  git -C "$1" log --all --format=%H -- "$LOGDIR" 2>/dev/null
}

say "PREREQUISITES"
[ -d "$CANON/.git" ]  || die "canonical repo missing: $CANON"
[ -d "$VERIFY/.git" ] || die "verify repo missing: $VERIFY"
NPRES=$(git -C "$VERIFY" for-each-ref 'refs/preserve/**' | wc -l)
echo "preserve refs: $NPRES"
[ "$NPRES" -eq 0 ] && die "0 preserve refs -- wrong glob or wrong repo (void run)"

say "BUILD SAFE SET"
logcommits "$CANON" | sort -u > /tmp/os_safe_canon
NSC=$(wc -l < /tmp/os_safe_canon)
echo "canonical project-log commits: $NSC"
[ "$NSC" -eq 0 ] && die "0 project-log commits in canonical repo -- path wrong? (void run)"

: > /tmp/os_safe_pres
if [ "$EXCLUDE_PRESERVE" = "0" ]; then
  while read -r r; do
    git -C "$VERIFY" log "$r" --format=%H -- "$LOGDIR" 2>/dev/null
  done < <(git -C "$VERIFY" for-each-ref --format='%(refname)' 'refs/preserve/**') \
    | sort -u > /tmp/os_safe_pres
  echo "preserved project-log commits: $(wc -l < /tmp/os_safe_pres)"
else
  echo "preserved project-log commits: EXCLUDED (positive-control mode)"
fi

sort -u /tmp/os_safe_canon /tmp/os_safe_pres > /tmp/os_safe
echo "SAFE set size: $(wc -l < /tmp/os_safe)"

say "SCAN CLONES"
NCLONES=0; NRISK=0
: > /tmp/os_risk
for d in /workspace/farmtable-*; do
  [ -d "$d/.git" ] || continue
  [ "$d" = "$VERIFY" ] && continue
  NCLONES=$((NCLONES+1))
  logcommits "$d" | sort -u > /tmp/os_this
  # commits present here but in neither canonical nor preserved
  comm -23 /tmp/os_this /tmp/os_safe > /tmp/os_this_risk
  n=$(wc -l < /tmp/os_this_risk)
  if [ "$n" -gt 0 ]; then
    while read -r c; do
      subj=$(git -C "$d" log -1 --format='%s' "$c" 2>/dev/null)
      printf '%s\t%s\t%s\n' "${c:0:8}" "$(basename "$d")" "$subj" >> /tmp/os_risk
    done < /tmp/os_this_risk
    NRISK=$((NRISK+n))
  fi
done
echo "clones scanned: $NCLONES"
[ "$NCLONES" -eq 0 ] && die "0 clones scanned -- glob wrong (void run)"

say "AT-RISK PROJECT-LOG COMMITS (unique)"
sort -u -k1,1 /tmp/os_risk > /tmp/os_risk_u 2>/dev/null || true
UNIQ=$(wc -l < /tmp/os_risk_u)
if [ "$UNIQ" -eq 0 ]; then
  echo "(none)"
else
  printf 'SHA\tCLONE\tSUBJECT\n'
  cat /tmp/os_risk_u
fi
echo
echo "unique_at_risk=$UNIQ  clones_scanned=$NCLONES  safe_set=$(wc -l < /tmp/os_safe)"
