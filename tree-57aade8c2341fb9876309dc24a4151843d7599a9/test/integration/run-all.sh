#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

setup_integration_env

TESTS=(
  "$SCRIPT_DIR/test-task-lifecycle.sh"
  "$SCRIPT_DIR/test-collection-lifecycle.sh"
  "$SCRIPT_DIR/test-export-import.sh"
)

echo "INFO: running Farmtable CLI integration journeys against $FARMTABLE_SERVER"

for test_script in "${TESTS[@]}"; do
  echo "INFO: starting $(basename "$test_script")"
  "$test_script"
  pass "$(basename "$test_script") passed"
done

pass "all integration journeys passed"

echo "INFO: disposable test collections left behind for manual cleanup:"
leftovers="$(list_leftover_test_collections)"
if [[ -z "$leftovers" ]]; then
  echo "INFO: no test-integration-* collections found"
else
  echo "$leftovers"
fi
