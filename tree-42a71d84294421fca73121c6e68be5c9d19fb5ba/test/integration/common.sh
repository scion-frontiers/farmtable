#!/usr/bin/env bash

set -euo pipefail

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "FAIL: required environment variable $name is not set" >&2
    exit 1
  fi
}

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "FAIL: required command '$name' was not found in PATH" >&2
    exit 1
  fi
}

setup_integration_env() {
  require_env FARMTABLE_SERVER
  require_env FARMTABLE_TOKEN
  require_command ft
  require_command jq
}

test_stamp() {
  printf '%s-%s-%s' "$(date -u +%Y%m%d%H%M%S)" "$$" "$RANDOM"
}

pass() {
  echo "PASS: $*"
}

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_json_eq() {
  local json="$1"
  local filter="$2"
  local expected="$3"
  local actual

  actual="$(jq -r "$filter" <<<"$json")"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: assertion failed for jq filter: $filter" >&2
    echo "  expected: $expected" >&2
    echo "  actual:   $actual" >&2
    echo "  json:" >&2
    jq . <<<"$json" >&2
    exit 1
  fi
}

assert_json_true() {
  local json="$1"
  shift

  if ! jq -e "$@" <<<"$json" >/dev/null; then
    echo "FAIL: assertion failed for jq expression: $*" >&2
    echo "  json:" >&2
    jq . <<<"$json" >&2
    exit 1
  fi
}

create_test_collection() {
  local name="$1"
  local description="$2"
  local created

  created="$(ft collection create "$name" --description "$description" --output json)"
  assert_json_eq "$created" '.name' "$name"
  assert_json_eq "$created" '.description' "$description"
  jq -r '.id' <<<"$created"
}

list_leftover_test_collections() {
  ft collection list --output json \
    | jq -r '.items[] | select(.name | startswith("test-integration-")) | "\(.id) \(.name)"'
}
