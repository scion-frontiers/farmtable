#!/bin/sh
O=/scion-volumes/scratchpad/projects/farmtable/reports/_build-r8
echo "=== POSITIVE CONTROL: MUST GO GREEN (single package, no embed dep) ==="
cd /workspace/farmtable-build-base
go build ./internal/webguard > $O/pc.out 2>&1
echo "PC_RC=$?"
tail -5 $O/pc.out
for T in base r8; do
  D=/workspace/farmtable-build-$T
  cd $D
  echo "=== TREE $T  ($D)  HEAD=$(git rev-parse --short HEAD) ==="
  go build ./... > $O/$T.build.out 2>&1
  echo "${T}_BUILD_RC=$?"
  go vet ./... > $O/$T.vet.out 2>&1
  echo "${T}_VET_RC=$?"
done
echo "=== BUILD OUTPUT SIZES ==="
wc -l $O/base.build.out $O/r8.build.out $O/base.vet.out $O/r8.vet.out
echo "=== BUILD DIFF base vs r8 (paths normalised) ==="
sed 's#farmtable-build-base#TREE#g' $O/base.build.out > $O/base.build.norm
sed 's#farmtable-build-r8#TREE#g'   $O/r8.build.out   > $O/r8.build.norm
diff $O/base.build.norm $O/r8.build.norm > $O/build.diff 2>&1
echo "BUILD_DIFF_RC=$?"
echo "=== VET DIFF ==="
sed 's#farmtable-build-base#TREE#g' $O/base.vet.out > $O/base.vet.norm
sed 's#farmtable-build-r8#TREE#g'   $O/r8.vet.out   > $O/r8.vet.norm
diff $O/base.vet.norm $O/r8.vet.norm > $O/vet.diff 2>&1
echo "VET_DIFF_RC=$?"
echo "=== DONE ==="
