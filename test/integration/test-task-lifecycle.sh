#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

setup_integration_env

STAMP="$(test_stamp)"
COLLECTION_NAME="test-integration-${STAMP}-task"
COLLECTION_DESCRIPTION="Disposable CLI integration task lifecycle collection ${STAMP}"
TASK_A_NAME="test task lifecycle primary ${STAMP}"
TASK_B_NAME="test task lifecycle blocked ${STAMP}"
TASK_DESCRIPTION="Created by CLI integration task lifecycle test ${STAMP}"
UPDATED_DESCRIPTION="Updated by CLI integration task lifecycle test ${STAMP}"
COMMENT_BODY="Task lifecycle comment ${STAMP}"

echo "INFO: creating disposable collection $COLLECTION_NAME"
COLLECTION_ID="$(create_test_collection "$COLLECTION_NAME" "$COLLECTION_DESCRIPTION")"
pass "collection created: $COLLECTION_ID $COLLECTION_NAME"

WHOAMI_JSON="$(ft user whoami --output json)"
ASSIGNEE_ID="$(jq -r '.id' <<<"$WHOAMI_JSON")"
[[ -n "$ASSIGNEE_ID" && "$ASSIGNEE_ID" != "null" ]] || fail "could not determine authenticated user ID"
pass "authenticated user resolved for assignee: $ASSIGNEE_ID"

TASK_A_JSON="$(ft task create "$TASK_A_NAME" \
  --collection "$COLLECTION_ID" \
  --description "$TASK_DESCRIPTION" \
  --priority HIGH \
  --type task \
  --assignee "$ASSIGNEE_ID" \
  --label cli-integration \
  --label lifecycle \
  --output json)"
TASK_A_ID="$(jq -r '.id' <<<"$TASK_A_JSON")"
assert_json_eq "$TASK_A_JSON" '.name' "$TASK_A_NAME"
assert_json_eq "$TASK_A_JSON" '.description' "$TASK_DESCRIPTION"
assert_json_eq "$TASK_A_JSON" '.priority' "HIGH"
assert_json_true "$TASK_A_JSON" --arg id "$ASSIGNEE_ID" '.assignees[]? | select(.id == $id)'
assert_json_true "$TASK_A_JSON" '.labels | index("cli-integration")'
assert_json_true "$TASK_A_JSON" '.labels | index("lifecycle")'
pass "task created successfully: $TASK_A_ID"

LIST_JSON="$(ft task list --collection "$COLLECTION_ID" --full --output json)"
assert_json_true "$LIST_JSON" --arg id "$TASK_A_ID" '.items[] | select(.id == $id)'
pass "task appears in collection-scoped list"

GET_JSON="$(ft task get "$TASK_A_ID" --collection "$COLLECTION_ID" --output json)"
assert_json_eq "$GET_JSON" '.id' "$TASK_A_ID"
assert_json_eq "$GET_JSON" '.name' "$TASK_A_NAME"
assert_json_eq "$GET_JSON" '.description' "$TASK_DESCRIPTION"
assert_json_eq "$GET_JSON" '.priority' "HIGH"
assert_json_true "$GET_JSON" '.labels | index("cli-integration")'
assert_json_true "$GET_JSON" '.labels | index("lifecycle")'
pass "task get returned expected fields"

UPDATED_JSON="$(ft task update "$TASK_A_ID" \
  --priority URGENT \
  --stage working \
  --description "$UPDATED_DESCRIPTION" \
  --assignee "$ASSIGNEE_ID" \
  --add-label updated \
  --remove-label lifecycle \
  --output json)"
assert_json_eq "$UPDATED_JSON" '.priority' "URGENT"
assert_json_eq "$UPDATED_JSON" '.stage' "working"
assert_json_eq "$UPDATED_JSON" '.description' "$UPDATED_DESCRIPTION"
assert_json_true "$UPDATED_JSON" '.labels | index("updated")'
assert_json_true "$UPDATED_JSON" '.labels | index("lifecycle") | not'
assert_json_true "$UPDATED_JSON" --arg id "$ASSIGNEE_ID" '.assignees[]? | select(.id == $id)'
pass "task update changed priority, stage, labels, description, and assignee"

COMMENT_JSON="$(ft comment add "$TASK_A_ID" "$COMMENT_BODY" --output json)"
COMMENT_ID="$(jq -r '.id' <<<"$COMMENT_JSON")"
assert_json_eq "$COMMENT_JSON" '.task_id' "$TASK_A_ID"
assert_json_eq "$COMMENT_JSON" '.body' "$COMMENT_BODY"
pass "comment added successfully: $COMMENT_ID"

COMMENTS_JSON="$(ft comment list "$TASK_A_ID" --output json)"
assert_json_true "$COMMENTS_JSON" --arg id "$COMMENT_ID" --arg body "$COMMENT_BODY" '.items[] | select(.id == $id and .body == $body)'
pass "comment appears in comment list"

TASK_B_JSON="$(ft task create "$TASK_B_NAME" \
  --collection "$COLLECTION_ID" \
  --description "Task blocked by $TASK_A_ID" \
  --priority NORMAL \
  --type task \
  --label cli-integration \
  --output json)"
TASK_B_ID="$(jq -r '.id' <<<"$TASK_B_JSON")"
assert_json_eq "$TASK_B_JSON" '.name' "$TASK_B_NAME"
pass "second task created successfully: $TASK_B_ID"

REL_JSON="$(ft task update "$TASK_A_ID" --add-blocks "$TASK_B_ID" --output json)"
assert_json_true "$REL_JSON" --arg target "$TASK_B_ID" '.relationships[]? | select(.target_task_id == $target and (.type | contains("BLOCKS")))'
pass "relationship added: task A blocks task B"

TREE_JSON="$(ft task tree "$TASK_A_ID" --direction down --output json)"
assert_json_true "$TREE_JSON" --arg id "$TASK_A_ID" --arg target "$TASK_B_ID" '.id == $id and (.blocks[]? | select(.id == $target))'
pass "relationship visible in dependency tree"

CLOSED_JSON="$(ft task close "$TASK_A_ID" --stage completed --reason "CLI integration lifecycle close ${STAMP}" --output json)"
assert_json_eq "$CLOSED_JSON" '.id' "$TASK_A_ID"
assert_json_eq "$CLOSED_JSON" '.stage' "completed"
assert_json_eq "$CLOSED_JSON" '.phase' "CLOSED"
assert_json_true "$CLOSED_JSON" '.closed_at != null'
pass "task closed successfully"

echo "LEFT_BEHIND: $COLLECTION_ID $COLLECTION_NAME"
pass "task lifecycle journey completed"
