import sys
s=sys.stdin.read()
a="const FORBID_ATTR = ['style', 'class', 'formaction', 'action', 'download', 'slot'];"
b="const FORBID_ATTR = ['style', 'class', 'formaction', 'action', 'download'];"
assert s.count(a)==1, "anchor not unique"
sys.stdout.write(s.replace(a,b))
