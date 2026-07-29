import re, os
ROOT="/workspace/farmtable-xss-r8"
FILES=["internal/server/convert.go","internal/server/export_import.go",
       "web/src/capabilities.ts","internal/webguard/doc.go"]
pat=re.compile(r'(?:[A-Za-z0-9_./-]+)?:\d{1,4}\b(?:-\d{1,4})?')
total=0
for f in FILES:
    lines=open(os.path.join(ROOT,f),encoding="utf-8").read().splitlines()
    print("##### "+f)
    for i,l in enumerate(lines,1):
        for m in pat.finditer(l):
            tok=m.group(0)
            if re.fullmatch(r':\d{1,2}',tok) and 'http' in l: continue
            total+=1
            print("  L%-5d %-46s | %s" % (i,tok,l.strip()[:70]))
print("\nTOTAL CITATION INSTANCES = %d" % total)
