import sys
s=sys.stdin.read()
a="  if (typeof md !== 'string') return '';\n"
assert s.count(a)==1, "anchor not unique"
sys.stdout.write(s.replace(a,""))
