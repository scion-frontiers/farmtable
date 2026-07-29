#!/bin/bash
# Content-addressed mutation driver. Aborts if anchor is not unique.
set -u
F=/workspace/web/src/util/markdown.test.ts
LABEL="$1"; FIND="$2"; REPL="$3"
N=$(python3 - "$F" "$FIND" <<'PY'
import sys
src=open(sys.argv[1],encoding='utf8').read()
print(src.count(sys.argv[2]))
PY
)
if [ "$N" != "1" ]; then echo "[$LABEL] ABORT: anchor occurs $N times, expected 1"; exit 9; fi
python3 - "$F" "$FIND" "$REPL" <<'PY'
import sys
p,f,r=sys.argv[1],sys.argv[2],sys.argv[3]
src=open(p,encoding='utf8').read()
open(p,'w',encoding='utf8').write(src.replace(f,r,1))
PY
npm test > /tmp/mut.log 2>&1
RC=$?
echo "[$LABEL] exit=$RC  :: $(grep -E 'checks passed|checks failed|error TS' /tmp/mut.log | head -3 | tr '\n' ' | ')"
cd /workspace && git checkout -- web/src/util/markdown.test.ts
S=$(git status --porcelain)
if [ -n "$S" ]; then echo "[$LABEL] RESTORE FAILED: $S"; exit 9; fi
if ! cmp -s /tmp/markdown.test.ts.bak "$F"; then echo "[$LABEL] RESTORE MISMATCH vs backup"; exit 9; fi
echo "[$LABEL] restored, tree clean, matches backup"
