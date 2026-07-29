#!/usr/bin/env bash
# audit-195-r6 config-mutation battery.
#
# Question: which weakenings of the sanitizer configuration does the guard suite
# actually catch? A mutation that survives GREEN and demonstrably weakens the
# sanitizer is a gap in the guard. A mutation that survives green WITHOUT
# weakening anything is not a finding (round-5's ADD_ATTR:['style'] bar).
#
# Discipline:
#   - mutations are CONTENT-ADDRESSED; we abort if the anchor is not unique.
#   - the pristine file is sha256'd before and after; any drift is fatal.
#   - the child's exit status is read directly, never through a pipe.
set -u

SRC=/workspace/web/src/util/markdown.ts
DIR=/scion-volumes/scratchpad/projects/farmtable/salvage/r6-audit-195
PRISTINE="$DIR/markdown.ts.pristine"
BEFORE=$(sha256sum "$SRC" | cut -d' ' -f1)
cp "$SRC" "$PRISTINE"

restore() {
  cp "$PRISTINE" "$SRC"
  local now
  now=$(sha256sum "$SRC" | cut -d' ' -f1)
  if [ "$now" != "$BEFORE" ]; then
    echo "FATAL: could not restore $SRC (sha $now != $BEFORE)" >&2
    exit 99
  fi
}
trap restore EXIT INT TERM

# apply <anchor> <replacement>  -- aborts unless the anchor occurs exactly once
apply() {
  local anchor="$1" repl="$2"
  local n
  n=$(grep -F -c -- "$anchor" "$SRC")
  if [ "$n" != "1" ]; then
    echo "ANCHOR-NOT-UNIQUE($n)"
    return 1
  fi
  python3 - "$SRC" "$anchor" "$repl" <<'PY'
import sys
p, a, r = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p, encoding='utf-8').read()
assert s.count(a) == 1, "anchor count changed"
open(p, 'w', encoding='utf-8').write(s.replace(a, r))
PY
  return 0
}

run_case() {
  local name="$1" anchor="$2" repl="$3"
  restore
  if ! apply "$anchor" "$repl"; then
    printf '%-46s %s\n' "$name" "SKIPPED(anchor)"
    return
  fi
  ( cd /workspace/web && npm test ) >"$DIR/mut-$name.log" 2>&1
  local status=$?
  local verdict
  if [ $status -eq 0 ]; then verdict="GREEN  <-- guard did NOT catch it"; else verdict="RED    (caught)"; fi
  # measure whether the mutation actually weakens the sanitizer
  local weak="n/a"
  if [ $status -eq 0 ]; then
    ( cd /workspace/web && npx tsc -p tsconfig.test.json ) >/dev/null 2>&1
    node "$DIR/probe.mjs" "$DIR/mod-head.mjs" >"$DIR/mut-$name.probe" 2>&1
    local a
    a=$(grep -o 'allowed=[0-9]*' "$DIR/mut-$name.probe" | head -1 | cut -d= -f2)
    weak="probe_allowed=${a:-ERR}"
  fi
  printf '%-46s %-38s %s\n' "$name" "$verdict" "$weak"
}

echo "baseline sha256: $BEFORE"
echo
printf '%-46s %-38s %s\n' "MUTATION" "SUITE" "WEAKENING"
printf '%-46s %-38s %s\n' "--------" "-----" "---------"

run_case "drop-slot-from-FORBID_ATTR" \
  "'download', 'slot']" "'download']"

run_case "empty-FORBID_ATTR" \
  "const FORBID_ATTR = ['style', 'class', 'formaction', 'action', 'download', 'slot'];" \
  "const FORBID_ATTR: string[] = [];"

run_case "empty-FORBID_TAGS" \
  "  'form', 'input', 'button', 'select', 'textarea', 'option', 'dialog', 'style'," \
  "  ...([] as string[]),"

run_case "drop-nonstring-guard" \
  "  if (typeof md !== 'string') return '';" "  "

run_case "ALLOW_UNKNOWN_PROTOCOLS" \
  "    FORBID_TAGS," "    ALLOW_UNKNOWN_PROTOCOLS: true,
    FORBID_TAGS,"

run_case "ADD_DATA_URI_TAGS-a" \
  "    FORBID_TAGS," "    ADD_DATA_URI_TAGS: ['a'],
    FORBID_TAGS,"

run_case "ALLOWED_URI_REGEXP-wide" \
  "    FORBID_TAGS," "    ALLOWED_URI_REGEXP: /.*/,
    FORBID_TAGS,"

run_case "ADD_URI_SAFE_ATTR-href" \
  "    FORBID_TAGS," "    ADD_URI_SAFE_ATTR: ['href'],
    FORBID_TAGS,"

run_case "ADD_TAGS-script" \
  "    FORBID_TAGS," "    ADD_TAGS: ['script'],
    FORBID_TAGS,"

run_case "ADD_ATTR-onerror" \
  "    FORBID_TAGS," "    ADD_ATTR: ['onerror'],
    FORBID_TAGS,"

run_case "SANITIZE_DOM-false" \
  "    FORBID_TAGS," "    SANITIZE_DOM: false,
    FORBID_TAGS,"

run_case "WHOLE_DOCUMENT-true" \
  "    FORBID_TAGS," "    WHOLE_DOCUMENT: true,
    FORBID_TAGS,"

# The shared-singleton hazard: a persistent setConfig anywhere in the module
# graph. sanitize(dirty, cfg) is per-call, but setConfig is sticky.
run_case "setConfig-sticky-ADD_TAGS-script" \
  "const parser = new Marked({" "DOMPurify.setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] });
const parser = new Marked({"

echo
restore
echo "restored sha256: $(sha256sum "$SRC" | cut -d' ' -f1)  (baseline $BEFORE)"
