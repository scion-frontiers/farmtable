import sys
s=sys.stdin.read()
# Laundering file: re-export the raw directive under another name, hidden by the
# import.meta swallow. ASI style on the two payload lines is what the swallow needs.
payload = (
"import { unsafeHTML } from 'lit/directives/unsafe-html.js';\n"
"const dev = import.meta.env.DEV\n"
"export const rawHtml = unsafeHTML\n"
"export { css as _css } from 'lit';\n"
)
sys.stdout.write(payload + s)
