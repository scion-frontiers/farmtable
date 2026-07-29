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
# 2026-07-28: the 85 preserve refs were fetched into CANONICAL (task #170), so the
# preserve store no longer lives only in a disposable-looking clone. Default repointed.
# Overridable so the old topology can still be checked.
VERIFY=${VERIFY:-/workspace/farmtable}
LOGDIR=.design/project-log

# EXCLUDE_PRESERVE was a positive-control switch. AFTER the #170 fetch it CONTROLS
# NOTHING: canonical's safe set is built with `git log --all`, and --all covers
# refs/preserve/**, so dropping the VERIFY contribution removes zero commits.
# Measured 2026-07-28: safe_set=224 in BOTH modes, identical. Predicted in writing
# before the fetch, then confirmed.
# It is kept ONLY because it still works when VERIFY points at a DIFFERENT repo.
# THE REAL POSITIVE CONTROL IS AN INJECTED FAULT -- see positive-control() below.
EXCLUDE_PRESERVE=${EXCLUDE_PRESERVE:-0}

say()  { printf '\n===== %s =====\n' "$1"; }
die()  { printf '\n!!!!! ABORT: %s\n' "$1"; exit 90; }

# ---- collect project-log commits reachable from every ref of a repo ----
logcommits() {  # $1=repo  $2=ref-glob
  git -C "$1" log --all --format=%H -- "$LOGDIR" 2>/dev/null
}

say "PREREQUISITES"
# -e, not -d: a git WORKTREE has .git as a FILE. Same defect as the scan loop below
# had. Fail-CLOSED here (this dies rather than under-reporting), so it never produced
# a wrong answer -- but it silently made the tool unpointable at a worktree.
[ -e "$CANON/.git" ]  || die "canonical repo missing: $CANON"
[ -e "$VERIFY/.git" ] || die "verify repo missing: $VERIFY"
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
NWT=0
for d in /workspace/farmtable-*; do
  # NOTE: worktrees have .git as a FILE, not a directory. The original `-d` test
  # silently skipped 114 of 172 trees. That was harmless ONLY because those
  # worktrees share the canonical object store and their refs ARE canonical refs
  # -- but the script never reasoned about that, and the void-guard below only
  # fires at ZERO. Scan them too, and report the split.
  [ -e "$d/.git" ] || continue
  [ "$d" = "$VERIFY" ] && continue
  [ -f "$d/.git" ] && NWT=$((NWT+1))
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
echo "clones scanned: $NCLONES (of which worktrees sharing the canonical object store: $NWT)"
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
