#!/usr/bin/env bash
# F4 mutation matrix, re-run on the UNION branch under `node --test`.
# Fixed N=2 per arm, interleaved by round, no arm re-run to agreement.
# Liveness control per arm proves the mutation is in the file before the run.
set -u
cd /tmp/f4-union/web

MD=src/util/markdown.ts
DESC=src/components/inspector/ft-inspector-desc.ts
TEST=src/components/inspector/render-sink-xss.test.ts
S=/tmp/f4-union/.orig
mkdir -p "$S"
cp "$MD" "$S/md";  cp "$DESC" "$S/desc";  cp "$TEST" "$S/test"

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
    out=$( (rm -rf .tmp-test && npx tsc -p tsconfig.test.json && node --test .tmp-test/components/inspector/render-sink-xss.test.js) 2>&1 ); rc=$?
    verdict=$([ $rc -eq 0 ] && echo GREEN || echo RED)
    # Did node --test mark OUR file not ok? That is what proves the runner
    # surfaces the failure rather than swallowing it.
    mine=$(echo "$out" | grep -cE '^# fail 0')
    # Named tests our own harness reported as failed.
    fails=$(echo "$out" | grep -oE '(domPurify|renderMarkdown|sanitiser|ftInspector|bothSinks)[A-Za-z]+' | sort -u | tr '\n' ',')
    tserr=$(echo "$out" | grep -oE 'error TS[0-9]+' | head -1)
    printf 'round=%s arm=%-8s liveness=%-13s rc=%-3s %-5s mine_not_ok=%s %s red=%s\n' \
      "$round" "$arm" "$lv" "$rc" "$verdict" "$mine" "${tserr:-}" "${fails:-none}"
  done
done

restore
echo "--- reverted ---"
grep -n 'return DOMPurify' "$MD"
grep -c 'renderMarkdown(this.description)' "$DESC"
git -C /tmp/f4-union status --porcelain -uno
