#!/usr/bin/env bash
# Content-addressed mutation runner for the #195 r6 code-review leg.
# Usage: mutate.sh <label> <file> <python-mutator-file>
# The mutator is a python3 script reading the file on stdin, writing to stdout.
# Aborts if the mutation is a no-op. Restores from a pristine copy afterwards.
# Exit code is the CHILD's, captured directly, never through a pipe.
set -u
LABEL="$1"; TARGET="$2"; MUT="$3"
PRISTINE="/scion-volumes/scratchpad/projects/farmtable/salvage/r6-review-195/pristine_$(basename "$TARGET")"
[ -f "$PRISTINE" ] || { echo "NO PRISTINE $PRISTINE"; exit 99; }
if ! cmp -s "$PRISTINE" "$TARGET"; then echo "TREE DIRTY before $LABEL"; exit 98; fi

python3 "$MUT" < "$PRISTINE" > /tmp/mutated.$$ || { echo "MUTATOR FAILED"; exit 97; }
if cmp -s "$PRISTINE" /tmp/mutated.$$; then echo "NO-OP MUTATION: $LABEL"; rm -f /tmp/mutated.$$; exit 96; fi
cp /tmp/mutated.$$ "$TARGET"; rm -f /tmp/mutated.$$

cd /workspace/web
npm test > /tmp/out.$$ 2>&1
RC=$?
cp "$PRISTINE" "$TARGET"

if [ $RC -eq 0 ]; then
  echo "### $LABEL => GREEN (rc=0)  <-- SURVIVED"
else
  echo "### $LABEL => RED (rc=$RC)"
fi
grep -E "markdown sanitizer|checks failed|  - |error TS" /tmp/out.$$ | head -12
rm -f /tmp/out.$$
exit $RC
