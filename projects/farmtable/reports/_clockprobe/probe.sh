#!/bin/sh
# Cross-container clock comparison via a COMMON REFERENCE (the shared volume's fs clock).
# No toolchain, no compile, no build. Milliseconds. Does not need a queue grant.
D=/scion-volumes/scratchpad/projects/farmtable/reports/_clockprobe
LEG="$1"
date -u +%s.%N > "$D/$LEG.txt"
python3 - "$D/$LEG.txt" <<'PY'
import os,sys
p=sys.argv[1]
c=float(open(p).read().strip()); m=os.stat(p).st_mtime
print("container_date = %.6f" % c)
print("fs_mtime       = %.6f" % m)
print("SKEW (container - shared_fs) = %+.6f s" % (c-m))
PY
