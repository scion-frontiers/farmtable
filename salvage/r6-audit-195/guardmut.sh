#!/usr/bin/env bash
# Charge 3: what does a bypass of the GUARD cost? Mutate a real sink file / the
# sanitizer and ask whether the suite goes red. Content-addressed, restore-checked.
set -u
DIR=/scion-volumes/scratchpad/projects/farmtable/salvage/r6-audit-195
declare -A F=(
  [desc]=/workspace/web/src/components/inspector/ft-inspector-desc.ts
  [com]=/workspace/web/src/components/inspector/ft-inspector-comments.ts
  [md]=/workspace/web/src/util/markdown.ts
)
declare -A SHA
for k in "${!F[@]}"; do cp "${F[$k]}" "$DIR/$k.pristine"; SHA[$k]=$(sha256sum "${F[$k]}"|cut -d' ' -f1); done
restore(){ for k in "${!F[@]}"; do cp "$DIR/$k.pristine" "${F[$k]}"; n=$(sha256sum "${F[$k]}"|cut -d' ' -f1); [ "$n" = "${SHA[$k]}" ] || { echo "FATAL restore $k" >&2; exit 99; }; done; }
trap restore EXIT INT TERM

run(){ # name file anchor repl
  restore
  local name="$1" f="${F[$2]}" a="$3" r="$4"
  local n; n=$(grep -F -c -- "$a" "$f")
  if [ "$n" != "1" ]; then printf '%-44s %s\n' "$name" "SKIP(anchor x$n)"; return; fi
  python3 -c "
import sys
p,a,r=sys.argv[1],sys.argv[2],sys.argv[3]
s=open(p,encoding='utf-8').read(); assert s.count(a)==1
open(p,'w',encoding='utf-8').write(s.replace(a,r))" "$f" "$a" "$r"
  ( cd /workspace/web && npm test ) >"$DIR/gm-$name.log" 2>&1
  local st=$?
  if [ $st -eq 0 ]; then printf '%-44s %s\n' "$name" "GREEN  <-- NOT CAUGHT"; else printf '%-44s %s\n' "$name" "RED    (caught)"; fi
}

printf '%-44s %s\n' "GUARD MUTATION" "SUITE"
printf '%-44s %s\n' "--------------" "-----"
run "CONTROL-noop-comment"      md   "export function renderMarkdown(md: string): string {" \
                                     "// audit no-op control
export function renderMarkdown(md: string): string {"
run "arity-add-second-param"    md   "export function renderMarkdown(md: string): string {" \
                                     "export function renderMarkdown(md: string, opts?: { inline?: boolean }): string {"
run "arity-add-defaulted-param" md   "export function renderMarkdown(md: string): string {" \
                                     "export function renderMarkdown(md: string, opts = {}): string {"
run "arity-rest-param"          md   "export function renderMarkdown(md: string): string {" \
                                     "export function renderMarkdown(md: string, ...rest: unknown[]): string {"
run "drop-wrapper-at-desc"      desc "unsafeHTML(renderMarkdown(this.description))" \
                                     "unsafeHTML(this.description ?? '')"
run "concat-past-wrapper-desc"  desc "unsafeHTML(renderMarkdown(this.description))" \
                                     "unsafeHTML(renderMarkdown(this.description) + (this.description ?? ''))"
run "value-alias-desc"          desc "import { unsafeHTML } from 'lit/directives/unsafe-html.js';" \
                                     "import { unsafeHTML } from 'lit/directives/unsafe-html.js';
const rawHtml = unsafeHTML;"
run "sanitize-returns-input"    md   "return DOMPurify.sanitize(parser.parse(md) as string, {" \
                                     "if (md.length < 1e9) return parser.parse(md) as string;
  return DOMPurify.sanitize(parser.parse(md) as string, {"
run "runtime-global-repatch"    md   "const parser = new Marked({" \
                                     "(globalThis as any).__p = DOMPurify.sanitize;
const parser = new Marked({"
echo
restore
echo "all files restored"
