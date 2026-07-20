#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

setup_integration_env

STAMP="$(test_stamp)"
SOURCE_COLLECTION_NAME="test-integration-${STAMP}-export"
SOURCE_COLLECTION_DESCRIPTION="Disposable CLI integration export source ${STAMP}"
IMPORTED_COLLECTION_NAME="test-integration-${STAMP}-reimported"
EXPORT_FILE="/tmp/test-export-${STAMP}.json"
TASK_ONE_NAME="test export import alpha ${STAMP}"
TASK_TWO_NAME="test export import beta ${STAMP}"
TASK_ONE_DESCRIPTION="Alpha task exported and reimported ${STAMP}"
TASK_TWO_DESCRIPTION="Beta task exported and reimported ${STAMP}"

# Known limitation: the API has no DeleteCollection RPC, so both disposable
# collections created here remain on the target server for manual cleanup.
echo "INFO: creating disposable source collection $SOURCE_COLLECTION_NAME"
SOURCE_COLLECTION_ID="$(create_test_collection "$SOURCE_COLLECTION_NAME" "$SOURCE_COLLECTION_DESCRIPTION")"
pass "source collection created: $SOURCE_COLLECTION_ID $SOURCE_COLLECTION_NAME"

TASK_ONE_JSON="$(ft task create "$TASK_ONE_NAME" \
  --collection "$SOURCE_COLLECTION_ID" \
  --description "$TASK_ONE_DESCRIPTION" \
  --priority HIGH \
  --type task \
  --label cli-integration \
  --label export-import \
  --output json)"
TASK_ONE_ID="$(jq -r '.id' <<<"$TASK_ONE_JSON")"
pass "source task created: $TASK_ONE_ID"

TASK_TWO_JSON="$(ft task create "$TASK_TWO_NAME" \
  --collection "$SOURCE_COLLECTION_ID" \
  --description "$TASK_TWO_DESCRIPTION" \
  --priority LOW \
  --type task \
  --label cli-integration \
  --label export-import \
  --output json)"
TASK_TWO_ID="$(jq -r '.id' <<<"$TASK_TWO_JSON")"
pass "second source task created: $TASK_TWO_ID"

SOURCE_LIST_JSON="$(ft task list --collection "$SOURCE_COLLECTION_ID" --full --output json)"
SOURCE_TASK_COUNT="$(jq -r '.total_count' <<<"$SOURCE_LIST_JSON")"
[[ "$SOURCE_TASK_COUNT" == "2" ]] || fail "expected 2 source tasks, got $SOURCE_TASK_COUNT"
pass "source collection has expected task count"

ft collection export "$SOURCE_COLLECTION_NAME" --out "$EXPORT_FILE"
[[ -s "$EXPORT_FILE" ]] || fail "expected non-empty export file at $EXPORT_FILE"
jq . "$EXPORT_FILE" >/dev/null || fail "export file is not valid JSON: $EXPORT_FILE"
EXPORT_JSON="$(<"$EXPORT_FILE")"
assert_json_eq "$EXPORT_JSON" '.collection.name' "$SOURCE_COLLECTION_NAME"
assert_json_eq "$EXPORT_JSON" '.tasks | length | tostring' "$SOURCE_TASK_COUNT"
assert_json_true "$EXPORT_JSON" '.comments | type == "array"'
assert_json_true "$EXPORT_JSON" '.relationships | type == "array"'
pass "collection exported to valid JSON: $EXPORT_FILE"

IMPORT_JSON="$(ft collection import "$EXPORT_FILE" --name "$IMPORTED_COLLECTION_NAME" --output json)"
IMPORTED_COLLECTION_ID="$(jq -r '.collection_id' <<<"$IMPORT_JSON")"
assert_json_true "$IMPORT_JSON" '.collection_id != null and .collection_id != ""'
assert_json_eq "$IMPORT_JSON" '.stats.tasks | tostring' "$SOURCE_TASK_COUNT"
pass "collection imported as new collection: $IMPORTED_COLLECTION_ID $IMPORTED_COLLECTION_NAME"

COLLECTIONS_JSON="$(ft collection list --output json)"
assert_json_true "$COLLECTIONS_JSON" --arg id "$IMPORTED_COLLECTION_ID" --arg name "$IMPORTED_COLLECTION_NAME" '.items[] | select(.id == $id and .name == $name)'
pass "imported collection appears in collection list"

IMPORTED_LIST_JSON="$(ft task list --collection "$IMPORTED_COLLECTION_ID" --full --output json)"
IMPORTED_TASK_COUNT="$(jq -r '.total_count' <<<"$IMPORTED_LIST_JSON")"
[[ "$IMPORTED_TASK_COUNT" == "$SOURCE_TASK_COUNT" ]] || fail "expected $SOURCE_TASK_COUNT imported tasks, got $IMPORTED_TASK_COUNT"
pass "imported task count matches source"

SOURCE_SPOT="$(jq --arg name "$TASK_ONE_NAME" '.items[] | select(.name == $name) | {name, description, priority, type, labels}' <<<"$SOURCE_LIST_JSON")"
IMPORTED_SPOT="$(jq --arg name "$TASK_ONE_NAME" '.items[] | select(.name == $name) | {name, description, priority, type, labels}' <<<"$IMPORTED_LIST_JSON")"
if [[ "$(jq -S . <<<"$SOURCE_SPOT")" != "$(jq -S . <<<"$IMPORTED_SPOT")" ]]; then
  echo "FAIL: imported task fields did not match source task" >&2
  echo "  expected:" >&2
  jq -S . <<<"$SOURCE_SPOT" >&2
  echo "  actual:" >&2
  jq -S . <<<"$IMPORTED_SPOT" >&2
  exit 1
fi
pass "spot-checked imported task fields match source"

echo "LEFT_BEHIND: $SOURCE_COLLECTION_ID $SOURCE_COLLECTION_NAME"
echo "LEFT_BEHIND: $IMPORTED_COLLECTION_ID $IMPORTED_COLLECTION_NAME"
pass "export/import journey completed"
