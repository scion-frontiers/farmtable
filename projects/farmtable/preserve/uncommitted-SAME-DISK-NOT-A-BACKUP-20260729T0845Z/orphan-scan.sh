#!/bin/sh
# FAIL-CLOSED STUB — installed 2026-07-29 07:06Z by eng-manager.
#
# THIS IS NOT THE INSTRUMENT. The 3180-byte script that used to live at this path was
# STALE (2026-07-28 05:27) while the maintained one had moved on to 4626 bytes. A leg
# following the documented path ran the wrong instrument AND GOT A CLEAN-LOOKING RESULT.
# That is the false-green class this project spent the night on, so this path now refuses
# to produce a result at all rather than producing a reassuring one.
#
# THE MAINTAINED INSTRUMENT:
#   /scion-volumes/scratchpad/projects/farmtable/em-tooling/orphan-scan.sh
# The superseded copy is archived, unmodified, alongside it as
#   _ARCHIVE-orphan-scan-stale-3180.sh
#
echo "orphan-scan.sh: STALE PATH. REFUSING TO RUN." >&2
echo "Use /scion-volumes/scratchpad/projects/farmtable/em-tooling/orphan-scan.sh" >&2
exit 2
