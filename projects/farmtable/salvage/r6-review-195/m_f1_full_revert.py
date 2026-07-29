import sys
s=sys.stdin.read()
a="""    .replace(/\\bimport\\b[^;'"]*?\\bfrom\\b\\s*(['"])[^'"]*\\1\\s*;?/g, wipe)
    .replace(/\\bimport\\s*(['"])[^'"]*\\1\\s*;?/g, wipe);"""
b="""    .replace(/\\bimport\\b[^;]*?\\bfrom\\b\\s*['"][^'"]*['"]\\s*;/g, wipe)
    .replace(/\\bimport\\s*['"][^'"]*['"]\\s*;/g, wipe);"""
assert s.count(a)==1, "anchor not unique, found %d" % s.count(a)
sys.stdout.write(s.replace(a,b))
