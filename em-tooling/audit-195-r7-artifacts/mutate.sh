#!/usr/bin/env bash
# Mutation battery against the r7 sink guard.
#
# ABORTS on any failed prerequisite. Exit codes are taken from the child
# process directly (`npm test`), never through a pipe.
set -u

SRC=/workspace/web
SB=/tmp/audit-r7/sb
TARGET=src/components/ft-empty-state.ts   # a NON-sink scanned component
ANCHOR="    this.setAttribute('role', 'status');"
RESULTS=/tmp/audit-r7/results.tsv

if [ ! -d "$SB/node_modules" ]; then
  echo "ABORT: sandbox has no node_modules" >&2; exit 90
fi

restore() {
  cp "$SRC/$TARGET" "$SB/$TARGET"
  cp "$SRC/src/components/ft-app.ts" "$SB/src/components/ft-app.ts"
}

# $1 = label, $2 = code to splice in after ANCHOR (may be multi-line)
run_mutation() {
  local label="$1" code="$2"
  restore
  python3 - "$SB/$TARGET" "$ANCHOR" "$code" <<'PY'
import sys
path, anchor, code = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(path).read()
if anchor not in src:
    sys.stderr.write("ABORT: anchor not found in %s\n" % path); sys.exit(91)
open(path, "w").write(src.replace(anchor, anchor + "\n" + code, 1))
PY
  if [ $? -ne 0 ]; then echo "ABORT: splice failed for $label" >&2; exit 91; fi

  ( cd "$SB" && npm test ) > "/tmp/audit-r7/out-$label.log" 2>&1
  local test_exit=$?
  ( cd "$SB" && npx tsc --noEmit ) > "/tmp/audit-r7/tsc-$label.log" 2>&1
  local tsc_exit=$?
  local checks
  checks=$(grep -oE '[0-9]+ checks passed' "/tmp/audit-r7/out-$label.log" | head -1)
  [ -z "$checks" ] && checks="(suite red)"
  local verdict="GREEN"; [ $test_exit -ne 0 ] && verdict="RED"
  local tscv="tsc-clean"; [ $tsc_exit -ne 0 ] && tscv="TSC-ERROR"
  printf '%s\t%s\t%s\t%s\n' "$label" "$verdict" "$tscv" "$checks" | tee -a "$RESULTS"
  restore
}

: > "$RESULTS"

# ---- PREREQUISITE 1: baseline must be green -------------------------------
restore
( cd "$SB" && npm test ) > /tmp/audit-r7/out-BASELINE.log 2>&1
if [ $? -ne 0 ]; then echo "ABORT: baseline suite is not green" >&2; exit 92; fi
grep -q '75 checks passed (122 assertions)' /tmp/audit-r7/out-BASELINE.log \
  || { echo "ABORT: baseline is not 75 checks / 122 assertions" >&2; exit 93; }
echo "prereq 1 OK: baseline green at 75 checks / 122 assertions"

# ---- PREREQUISITE 2: a KNOWN-detected sink must go red --------------------
run_mutation "C0-document.write" '    document.write(this.subtitle);'
grep -q '^C0-document.write	RED' "$RESULTS" \
  || { echo "ABORT: positive control did not turn the suite red — the harness cannot detect anything" >&2; exit 94; }
echo "prereq 2 OK: positive control detected"

# ---- PREREQUISITE 3: a KNOWN-detected R8 violation must go red ------------
run_mutation "C1-dompurify-import" '    void 0;'
python3 - "$SB/$TARGET" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
open(p,"w").write("import DOMPurify from 'dompurify';\n"+s)
PY
( cd "$SB" && npm test ) > /tmp/audit-r7/out-C1.log 2>&1
c1=$?
restore
if [ $c1 -eq 0 ]; then echo "ABORT: R8 positive control stayed green" >&2; exit 95; fi
echo "prereq 3 OK: R8 positive control detected (exit $c1)"

# ---- CANDIDATE ESCAPES ----------------------------------------------------
run_mutation "E1-writeln"          '    document.writeln(this.subtitle);'
run_mutation "E2-ownerDocument"    '    this.ownerDocument.write(this.subtitle);'
run_mutation "E3-optional-call"    '    document.write?.(this.subtitle);'
run_mutation "E4-computed-write"   '    (document as unknown as Record<string, (s: string) => void>)["write"](this.subtitle);'
run_mutation "E5-DOMParser"        '    const d = new DOMParser().parseFromString(this.subtitle, "text/html");
    this.append(...Array.from(d.body.childNodes));'
run_mutation "E6-srcdoc"           '    const f = document.createElement("iframe");
    f.srcdoc = this.subtitle;
    this.append(f);'
run_mutation "E7-setAttribute-on"  '    const s = document.createElement("span");
    s.setAttribute("onmouseover", this.subtitle);
    this.append(s);'
run_mutation "E8-Object.assign"    '    Object.assign(document.createElement("div"), { innerHTML: this.subtitle });'
run_mutation "E9-split-specifier"  '    void (async () => {
      const P = (await import("dompur" + "ify")).default as { setConfig: (c: unknown) => void };
      P.setConfig({ FORBID_TAGS: [], FORBID_ATTR: [] });
    })();'
run_mutation "E10-multiline-eq"    '    const el = document.createElement("div");
    el.innerHTML
      = this.subtitle;'
run_mutation "E11-parseHTMLUnsafe" '    const doc = (Document as unknown as { parseHTMLUnsafe: (s: string) => Document }).parseHTMLUnsafe(this.subtitle);
    this.append(...Array.from(doc.body.childNodes));'
run_mutation "E12-execCommand"     '    document.execCommand("insertHTML", false, this.subtitle);'

echo "=== RESULTS ==="
cat "$RESULTS"
