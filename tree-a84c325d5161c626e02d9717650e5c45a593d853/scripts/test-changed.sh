#!/usr/bin/env bash
#
# Run only the tests affected by the current change.
#
#   make test-changed              # compare against origin/main
#   BASE=HEAD~3 make test-changed  # compare against something else
#   LIST_ONLY=1 make test-changed  # print the plan, run nothing
#
# Works from a dirty tree: committed, staged, unstaged and untracked changes are
# all taken into account.
#
# ---------------------------------------------------------------------------
# WHAT THIS DOES NOT COVER -- READ THIS BEFORE TRUSTING A GREEN RESULT
# ---------------------------------------------------------------------------
# This is a SELECTIVE run. It is incomplete by construction, and the risk is
# that its green is mistaken for the full suite's green. Specifically:
#
#   * Go: it runs tests in the packages whose files you changed. It does NOT
#     run tests in packages that merely DEPEND on what you changed. Change a
#     function signature in package A and break package B, and this will not
#     tell you.
#   * Web: the web suite is all-or-nothing. Any change under web/ runs the whole
#     web suite; no change under web/ runs none of it.
#   * It does not run integration tests (`-tags integration`), lint, or vet.
#   * A package with no _test.go files reports "no test files" and passes.
#
# `make test` is the full suite. CI runs the full suite. This exists so that a
# developer is not forced to choose between a multi-minute run and running
# nothing -- not to replace the gate.
# ---------------------------------------------------------------------------

set -uo pipefail

cd "$(git rev-parse --show-toplevel)"

BASE="${BASE:-origin/main}"
LIST_ONLY="${LIST_ONLY:-0}"

if ! git rev-parse --verify --quiet "${BASE}^{commit}" >/dev/null; then
  echo "test-changed: base ref '${BASE}' not found; comparing working tree against HEAD only" >&2
  BASE="HEAD"
fi

changed_files() {
  git diff --name-only "${BASE}...HEAD"      # committed on this branch
  git diff --name-only                       # unstaged
  git diff --name-only --cached              # staged
  git ls-files --others --exclude-standard   # untracked
}

mapfile -t FILES < <(changed_files | grep -v '^$' | sort -u)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "test-changed: no changes relative to ${BASE}; nothing to run."
  exit 0
fi

echo "=== CHANGED FILES (vs ${BASE}, including working tree) (${#FILES[@]}) ==="
printf '  %s\n' "${FILES[@]}"
echo ""

# ------------------------------------------------------------------- select --
GO_ALL=0
WEB=0
GO_DIRS=()

for f in "${FILES[@]}"; do
  case "$f" in
    go.mod|go.sum)
      GO_ALL=1
      ;;
    web/dist/*|web/node_modules/*)
      : # build output and dependencies are not source changes
      ;;
    web/*)
      WEB=1
      ;;
    *.go)
      d="$(dirname "$f")"
      # A deleted file's directory may no longer exist.
      if [ -d "$d" ]; then
        GO_DIRS+=("./${d}/")
      fi
      ;;
  esac
done

if [ "${#GO_DIRS[@]}" -gt 0 ]; then
  mapfile -t GO_DIRS < <(printf '%s\n' "${GO_DIRS[@]}" | sort -u)
fi

# -------------------------------------------------------------------- plan ---
echo "=== SELECTED ==="
if [ "$GO_ALL" -eq 1 ]; then
  echo "  go: ALL packages (go.mod/go.sum changed)"
elif [ "${#GO_DIRS[@]}" -gt 0 ]; then
  printf '  go: %s\n' "${GO_DIRS[@]}"
else
  echo "  go: (nothing)"
fi
if [ "$WEB" -eq 1 ]; then
  echo "  web: full web suite (a file under web/ changed)"
else
  echo "  web: (nothing)"
fi
echo ""

if [ "$LIST_ONLY" != "0" ]; then
  echo "LIST_ONLY set; running nothing."
  exit 0
fi

# --------------------------------------------------------------------- run ---
# Each suite's status is captured separately and combined at the end, so a
# passing second suite can never mask a failing first one.
rc=0

if [ "$GO_ALL" -eq 1 ]; then
  echo "+ go test ./..."
  go test ./... || rc=1
elif [ "${#GO_DIRS[@]}" -gt 0 ]; then
  echo "+ go test ${GO_DIRS[*]}"
  go test "${GO_DIRS[@]}" || rc=1
fi

if [ "$WEB" -eq 1 ]; then
  if [ ! -d web/node_modules ]; then
    echo "+ (cd web && npm ci)"
    ( cd web && npm ci ) || rc=1
  fi
  echo "+ (cd web && npm test)"
  ( cd web && npm test ) || rc=1
fi

echo ""
echo "=============================================================="
echo "SELECTIVE RUN -- THIS IS NOT THE FULL SUITE."
echo "Packages that depend on your changes were not tested; neither"
echo "were integration tests, lint or vet. Run 'make test' before"
echo "you rely on a green result."
echo "=============================================================="

exit "$rc"
