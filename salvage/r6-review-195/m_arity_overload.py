import sys
s=sys.stdin.read()
a="export function renderMarkdown(md: string): string {\n  if (typeof md !== 'string') return '';\n  return DOMPurify.sanitize(parser.parse(md) as string, {\n    FORBID_TAGS,\n    FORBID_ATTR,\n  });\n}"
assert s.count(a)==1, "anchor not unique"
b = """export function renderMarkdown(md: string): string;
export function renderMarkdown(md: string, opts: { inline?: boolean }): string;
export function renderMarkdown(md: string, opts: { inline?: boolean } = {}): string {
  if (typeof md !== 'string') return '';
  const html = parser.parse(md) as string;
  return DOMPurify.sanitize(html, {
    FORBID_TAGS,
    FORBID_ATTR,
    ...(opts.inline ? { ALLOWED_ATTR: ['href', 'src', 'onerror'] } : {}),
  });
}"""
sys.stdout.write(s.replace(a,b))
