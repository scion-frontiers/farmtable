#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

setup_integration_env

STAMP="$(test_stamp)"
COLLECTION_NAME="test-integration-${STAMP}-collection"
COLLECTION_DESCRIPTION="Disposable CLI integration collection lifecycle ${STAMP}"
TASK_NAME="test collection lifecycle task ${STAMP}"
TASK_DESCRIPTION="Created inside collection lifecycle test collection ${STAMP}"

# Known limitation: the CLI has no collection update command, and the API has no
# DeleteCollection RPC. This script leaves its disposable test collection behind.
echo "INFO: creating disposable collection $COLLECTION_NAME"
COLLECTION_ID="$(create_test_collection "$COLLECTION_NAME" "$COLLECTION_DESCRIPTION")"
pass "collection created: $COLLECTION_ID $COLLECTION_NAME"

LIST_JSON="$(ft collection list --output json)"
assert_json_true "$LIST_JSON" --arg id "$COLLECTION_ID" --arg name "$COLLECTION_NAME" '.items[] | select(.id == $id and .name == $name)'
pass "collection appears in collection list"

GET_JSON="$(ft collection get "$COLLECTION_ID" --output json)"
assert_json_eq "$GET_JSON" '.id' "$COLLECTION_ID"
assert_json_eq "$GET_JSON" '.name' "$COLLECTION_NAME"
assert_json_eq "$GET_JSON" '.description' "$COLLECTION_DESCRIPTION"
assert_json_eq "$GET_JSON" '.platform' "farmtable"
pass "collection get returned expected fields"

TASK_JSON="$(ft task create "$TASK_NAME" \
  --collection "$COLLECTION_ID" \
  --description "$TASK_DESCRIPTION" \
  --priority NORMAL \
  --type task \
  --label cli-integration \
  --output json)"
TASK_ID="$(jq -r '.id' <<<"$TASK_JSON")"
assert_json_eq "$TASK_JSON" '.collection_id' "$COLLECTION_ID"
assert_json_eq "$TASK_JSON" '.name' "$TASK_NAME"
pass "task created in disposable collection: $TASK_ID"

TASK_LIST_JSON="$(ft task list --collection "$COLLECTION_ID" --full --output json)"
assert_json_true "$TASK_LIST_JSON" --arg id "$TASK_ID" --arg name "$TASK_NAME" '.items[] | select(.id == $id and .name == $name)'
assert_json_eq "$TASK_LIST_JSON" '.total_count | tostring' "1"
pass "task appears when listing with collection scope"

echo "LEFT_BEHIND: $COLLECTION_ID $COLLECTION_NAME"
pass "collection lifecycle journey completed"
