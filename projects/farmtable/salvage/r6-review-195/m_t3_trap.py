import sys
s=sys.stdin.read()
# A perfectly legitimate production string literal that must name a banned form.
sys.stdout.write("export const SANITIZER_HELP =\n  'Never assign to el.innerHTML = userInput; call renderMarkdown first.';\n\n" + s)
