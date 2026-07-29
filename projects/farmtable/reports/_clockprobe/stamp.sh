#!/bin/sh
# ONE CLOCK FOR ALL LEGS. Cross-leg overlap arithmetic on unsynchronised container clocks
# is folklore (review-194-r11, 00:23Z). This stamps a marker on the SHARED VOLUME, so the
# authoritative time is the shared filesystem's, identical for every container that mounts it.
#   usage: stamp.sh <leg> <grant-id> <phase>      phase = occupy|start|end|release
# Costs nothing, needs no grant. Still report your own times too — the DIFFERENCE between
# your clock and the marker's mtime is itself the skew measurement.
D=/scion-volumes/scratchpad/projects/farmtable/reports/_clockprobe/stamps
mkdir -p "$D"; F="$D/$2.$1.$3"
: > "$F"
python3 -c "import os,sys;print('%s  fs_epoch=%.6f  local_date=%s' % (sys.argv[1], os.stat(sys.argv[1]).st_mtime, __import__('subprocess').check_output(['date','-u','+%FT%T.%NZ']).decode().strip()))" "$F"
