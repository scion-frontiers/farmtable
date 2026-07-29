import sys
s=sys.stdin.read()
a="    FORBID_TAGS,\n    FORBID_ATTR,\n  });"
b="    FORBID_TAGS,\n    FORBID_ATTR,\n    ALLOW_UNKNOWN_PROTOCOLS: true,\n  });"
assert s.count(a)==1, "anchor not unique"
sys.stdout.write(s.replace(a,b))
