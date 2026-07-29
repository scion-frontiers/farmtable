#!/usr/bin/env bash
# F4 mutation matrix RE-RUN AT THE MERGED TIP 439b309, under the REAL shared runner
# (`npm test` -> web/scripts/run-node-tests.mjs), all 6 discovered files per run.
#
# Same eight arms as the frozen pre-registration. NO NEW ARMS.
# Fixed N=2 per arm, interleaved by round, no arm re-run to agreement.
#
# Three things kept SEPARATE, per EM:
#   liveness  - the mutation was PRESENT in the file at run time (not causation)
#   vacuity   - diff line count; zero diff = "control unreachable", NOT a survivor
#   result    - what the runner did
set -u
cd /tmp/tip439/web

MD=src/util/markdown.ts
DESC=src/components/inspector/ft-inspector-desc.ts
TEST=src/components/inspector/render-sink-xss.test.ts
S=/tmp/tip439-orig
mkdir -p "$S"
cp "$MD" "$S/md"; cp "$DESC" "$S/desc"; cp "$TEST" "$S/test"

restore() { cp "$S/md" "$MD"; cp "$S/desc" "$DESC"; cp "$S/test" "$TEST"; }

apply() {
  restore
  case "$1" in
    baseline) : ;;
    M-A) cat > "$MD" <<'EOF'
import { marked } from 'marked';

export function renderMarkdown(md: string): string {
  return marked.parse(md) as string;
}
EOF
      ;;
    M-B) cat > "$MD" <<'EOF'
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(marked.parse(md) as string, {
    ADD_TAGS: ['script'],
    ADD_ATTR: ['onerror', 'onload'],
  });
}
EOF
      ;;
    M-C) cat > "$MD" <<'EOF'
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function renderMarkdown(md: string): string {
  return marked.parse(DOMPurify.sanitize(md)) as string;
}
EOF
      ;;
    M-D) cat > "$MD" <<'EOF'
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function renderMarkdown(md: string): string {
  const html = marked.parse(md) as string;
  return DOMPurify.sanitize(html);
}
EOF
      ;;
    M-E) cat > "$MD" <<'EOF'
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(marked.parse(md) as string, { ALLOWED_TAGS: [] });
}
EOF
      ;;
    M-F) python3 - <<'PY'
p='src/components/inspector/ft-inspector-desc.ts'
s=open(p).read()
a='${unsafeHTML(renderMarkdown(this.description))}'
b='${unsafeHTML(this.description ?? "")}'
assert a in s, 'sink 1 anchor not found'
open(p,'w').write(s.replace(a,b))
PY
      ;;
    M-G) python3 - <<'PY'
p='src/components/inspector/render-sink-xss.test.ts'
s=open(p).read()
a='for (const name of Object.getOwnPropertyNames(dom.window)) {'
b='for (const name of ([] as string[])) {'
assert a in s, 'global-copy anchor not found'
open(p,'w').write(s.replace(a,b))
PY
      ;;
  esac
}

liveness() {
  case "$1" in
    baseline) grep -q 'DOMPurify.sanitize(marked.parse(md) as string);' "$MD" && echo pristine || echo DIRTY ;;
    M-A) grep -q 'DOMPurify' "$MD" && echo STILL-PRESENT || echo removed ;;
    M-B) grep -q 'ADD_TAGS' "$MD" && echo present || echo ABSENT ;;
    M-C) grep -q 'marked.parse(DOMPurify.sanitize' "$MD" && echo present || echo ABSENT ;;
    M-D) grep -q 'const html = marked.parse' "$MD" && echo present || echo ABSENT ;;
    M-E) grep -q 'ALLOWED_TAGS' "$MD" && echo present || echo ABSENT ;;
    M-F) grep -q 'renderMarkdown(this.description)' "$DESC" && echo STILL-PRESENT || echo removed ;;
    M-G) grep -q 'const name of (\[\] as string\[\])' "$TEST" && echo present || echo ABSENT ;;
  esac
}

for round in 1 2; do
  for arm in baseline M-A M-B M-C M-D M-E M-F M-G; do
    apply "$arm"
    lv=$(liveness "$arm")
    # VACUITY: a mutant with zero diff lines is not a mutant.
    vac=$(git -C /tmp/tip439 diff --numstat -- web/src | awk '{a+=$1;d+=$2} END{print a+d+0}')
    log=/tmp/tip439-run-$round-$arm.log
    npm test > "$log" 2>&1; rc=$?
    verdict=$([ $rc -eq 0 ] && echo GREEN || echo RED)
    enum=$(grep -oE 'Compiling [0-9]+ Node' "$log" | grep -oE '[0-9]+' | head -1)
    exec_=$(grep -oE 'Running [0-9]+ test file' "$log" | grep -oE '[0-9]+' | head -1)
    # MY file's own count, printed by my harness: "N of 7 test(s) FAILED"
    mine=$(grep -oE 'render-sink-xss: [0-9]+ of [0-9]+ test\(s\) FAILED' "$log" | grep -oE '^render-sink-xss: [0-9]+' | grep -oE '[0-9]+$')
    [ -z "${mine:-}" ] && mine=0
    # Which OTHER test files went not-ok - new information, the runner now runs 6.
    others=$(grep -E '^not ok [0-9]+ - ' "$log" | grep -v render-sink-xss | grep -oE '[^/]+\.test\.js' | sort -u | tr '\n' ' ')
    tserr=$(grep -oE 'error TS[0-9]+' "$log" | head -1)
    printf 'round=%s arm=%-8s live=%-13s vac_difflines=%-4s rc=%-3s %-5s enum=%s exec=%s mine_failed=%s/7 %s others=[%s]\n' \
      "$round" "$arm" "$lv" "$vac" "$rc" "$verdict" "${enum:-?}" "${exec_:-?}" "$mine" "${tserr:-}" "${others:-none}"
  done
done

restore
echo "--- reverted ---"
git -C /tmp/tip439 status --porcelain -uall | grep -v node_modules | grep -v '\.tmp-test' | head
echo "porcelain-clean-check-done"
