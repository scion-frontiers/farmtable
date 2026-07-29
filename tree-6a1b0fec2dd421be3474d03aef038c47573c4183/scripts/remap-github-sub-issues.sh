#!/usr/bin/env bash
set -euo pipefail

OWNER="${OWNER:-ptone}"
REPO="${REPO:-farmtable}"

pairs=(
  "4:45"
  "5:12" "5:13" "5:21" "5:22" "5:29"
  "6:30" "6:31" "6:42" "6:43" "6:44"
  "7:14" "7:15" "7:23" "7:24" "7:25"
  "8:26" "8:33" "8:16" "8:17"
  "18:32"
  "27:34" "27:35" "27:36" "27:37" "27:38" "27:39" "27:40"
)

issue_node_id() {
  local number="$1"
  gh api "repos/${OWNER}/${REPO}/issues/${number}" --jq '.node_id'
}

has_sub_issue() {
  local parent="$1"
  local child="$2"

  gh api graphql \
    -F owner="$OWNER" \
    -F repo="$REPO" \
    -F number="$parent" \
    -f query='
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            subIssues(first: 100) {
              nodes { number }
            }
          }
        }
      }' \
    --jq ".data.repository.issue.subIssues.nodes[].number" | grep -qx "$child"
}

for pair in "${pairs[@]}"; do
  parent="${pair%%:*}"
  child="${pair##*:}"

  if has_sub_issue "$parent" "$child"; then
    printf 'skip #%s -> #%s (already linked)\n' "$parent" "$child"
    continue
  fi

  parent_node_id="$(issue_node_id "$parent")"
  child_node_id="$(issue_node_id "$child")"

  gh api graphql \
    -F parent="$parent_node_id" \
    -F child="$child_node_id" \
    -f query='
      mutation($parent: ID!, $child: ID!) {
        addSubIssue(input: {issueId: $parent, subIssueId: $child}) {
          issue { number title }
          subIssue { number title }
        }
      }' \
    --jq '"linked #" + (.data.addSubIssue.issue.number|tostring) + " -> #" + (.data.addSubIssue.subIssue.number|tostring)'
done
