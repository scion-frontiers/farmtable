#!/bin/sh
O=/scion-volumes/scratchpad/projects/farmtable/reports/_build-r8
for T in base r8; do
  D=/workspace/farmtable-build-$T
  cd $D
  echo "=== go test ./... in $T ($(git rev-parse --short HEAD)) start $(date -u +%H:%M:%SZ) ==="
  go test ./... > $O/$T.test.out 2>&1
  echo "${T}_TEST_RC=$?"
  echo "=== end $(date -u +%H:%M:%SZ) ==="
done
echo ALLDONE
