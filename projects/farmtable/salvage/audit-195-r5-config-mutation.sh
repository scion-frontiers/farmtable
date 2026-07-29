#!/usr/bin/env bash
# Does the 61-check suite PIN THE SANITIZER CONFIGURATION, or only the routing?
#
# Bar 4: tree is committed at 53296af before this runs; backup taken from the
#        working file immediately, and verified against HEAD.
# Bar 5: content-addressed mutations only. Abort if the anchor is not unique.
# Bar 6: backup lives OUTSIDE the repo; after every restore we positively assert
#        `git status --porcelain` is empty.
set -u

REPO=/workspace
TARGET="$REPO/web/src/util/markdown.ts"
BACKUP=/tmp/audit195/markdown.ts.backup
RESULTS=/tmp/audit195/config-mutation-results.txt
: > "$RESULTS"

cd "$REPO" || exit 9

# --- preflight: tree must be clean and match HEAD -------------------------
if [ -n "$(git status --porcelain)" ]; then
  echo "ABORT: tree not clean before mutation run" | tee -a "$RESULTS"; exit 9
fi
cp "$TARGET" "$BACKUP"
if ! git diff --quiet -- "$TARGET"; then
  echo "ABORT: target differs from HEAD" | tee -a "$RESULTS"; exit 9
fi
echo "preflight OK, backup at $BACKUP (outside repo)" | tee -a "$RESULTS"

restore() {
  cp "$BACKUP" "$TARGET"
  local st; st="$(git status --porcelain)"
  if [ -n "$st" ]; then
    echo "!!! RESTORE FAILED, tree dirty: $st" | tee -a "$RESULTS"; exit 9
  fi
}

# mutate <label> <anchor> <replacement>
mutate() {
  local label="$1" anchor="$2" repl="$3"
  local count
  count=$(grep -F -c -- "$anchor" "$TARGET")
  if [ "$count" -ne 1 ]; then
    echo "[$label] ABORT: anchor occurs $count times, expected exactly 1" | tee -a "$RESULTS"
    restore; return
  fi
  python3 - "$TARGET" "$anchor" "$repl" <<'PY'
import sys
p,a,r = sys.argv[1],sys.argv[2],sys.argv[3]
s=open(p).read()
assert s.count(a)==1
open(p,'w').write(s.replace(a,r))
PY
  # sanity: the file really changed
  if git diff --quiet -- "$TARGET"; then
    echo "[$label] ABORT: mutation was a no-op" | tee -a "$RESULTS"; restore; return
  fi
  ( cd "$REPO/web" && npm test >/tmp/audit195/mut.log 2>&1 )
  local ec=$?
  if [ $ec -eq 0 ]; then
    echo "[$label] SUITE GREEN  <-- config change NOT caught (exit $ec)" | tee -a "$RESULTS"
  else
    echo "[$label] suite red     (exit $ec) - caught" | tee -a "$RESULTS"
  fi
  restore
}

# --- SELF-CHECK (bar 3): prove the driver can turn the suite RED at all. ----
# If a mutation that obviously guts the sanitizer does NOT go red, the driver is
# not wired to the suite and every "GREEN" below would be a false negative.
echo "=== SELF-CHECK: gut the sanitizer entirely, suite MUST go red ===" | tee -a "$RESULTS"
mutate "SELFCHECK-return-input-unsanitized" \
  "return DOMPurify.sanitize(parser.parse(md) as string, {" \
  "return parser.parse(md) as string; return DOMPurify.sanitize(parser.parse(md) as string, {"
if ! grep -q "^\[SELFCHECK-return-input-unsanitized\] suite red" "$RESULTS"; then
  echo "ABORT: driver could not turn the suite red. Negatives untrustworthy." | tee -a "$RESULTS"
  restore; exit 2
fi
echo "driver is live." | tee -a "$RESULTS"; echo | tee -a "$RESULTS"

echo "=== CONFIG-WEAKENING MUTATIONS ===" | tee -a "$RESULTS"
mutate "drop 'style' from FORBID_TAGS"  "'dialog', 'style'," "'dialog',"
mutate "drop 'dialog' from FORBID_TAGS" "'dialog', 'style'," "'style',"
mutate "drop 'option' from FORBID_TAGS" "'textarea', 'option'," "'textarea',"
mutate "drop 'select' from FORBID_TAGS" "'select', 'textarea'," "'textarea',"
mutate "empty FORBID_TAGS entirely" \
  "'form', 'input', 'button', 'select', 'textarea', 'option', 'dialog', 'style'," ""
mutate "drop 'class' from FORBID_ATTR" \
  "const FORBID_ATTR = ['style', 'class', 'formaction', 'action', 'download'];" \
  "const FORBID_ATTR = ['style', 'formaction', 'action', 'download'];"
mutate "drop 'style' attr from FORBID_ATTR" \
  "const FORBID_ATTR = ['style', 'class', 'formaction', 'action', 'download'];" \
  "const FORBID_ATTR = ['class', 'formaction', 'action', 'download'];"
mutate "drop 'download' from FORBID_ATTR" \
  "const FORBID_ATTR = ['style', 'class', 'formaction', 'action', 'download'];" \
  "const FORBID_ATTR = ['style', 'class', 'formaction', 'action'];"
mutate "empty FORBID_ATTR entirely" \
  "const FORBID_ATTR = ['style', 'class', 'formaction', 'action', 'download'];" \
  "const FORBID_ATTR: string[] = [];"
mutate "re-enable scripts via ADD_TAGS" \
  "    FORBID_TAGS,
    FORBID_ATTR," \
  "    FORBID_TAGS,
    FORBID_ATTR,
    ADD_TAGS: ['script'],
    ADD_ATTR: ['onerror'],"

echo | tee -a "$RESULTS"
echo "=== FINAL STATE ===" | tee -a "$RESULTS"
restore
echo "git status --porcelain: '$(git status --porcelain)'" | tee -a "$RESULTS"
echo "HEAD: $(git rev-parse --short HEAD)" | tee -a "$RESULTS"
