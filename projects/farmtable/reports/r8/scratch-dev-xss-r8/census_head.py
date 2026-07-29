import os, re, subprocess
ROOT="/workspace/farmtable-xss-r8"
FILES=["internal/server/convert.go","internal/server/export_import.go",
       "internal/webguard/doc.go","internal/webguard/remotedata_consumers_test.go",
       "web/src/capabilities.ts","web/src/components/ft-app.ts"]
# path-bearing citations only: NAME.ext:NNN
pat=re.compile(r'([A-Za-z0-9_./-]+\.(?:go|ts|js|yml))\:(\d+)')
def find(name):
    base=os.path.basename(name)
    hits=[]
    for dp,dn,fn in os.walk(ROOT):
        if '/.git' in dp or '/node_modules' in dp: continue
        if base in fn: hits.append(os.path.relpath(os.path.join(dp,base),ROOT))
    return hits
rows=[]
for f in FILES:
    for i,line in enumerate(open(os.path.join(ROOT,f),encoding='utf8'),1):
        if not (line.lstrip().startswith('//') or line.lstrip().startswith('*')): continue
        for m in pat.finditer(line):
            tgt,ln=m.group(1),int(m.group(2))
            cands=find(tgt)
            if len(cands)!=1:
                rows.append((f,i,tgt,ln,"UNRESOLVED-TARGET",""))
                continue
            p=os.path.join(ROOT,cands[0])
            src=open(p,encoding='utf8').read().splitlines()
            ok = 1<=ln<=len(src)
            rows.append((f,i,tgt,ln,"INRANGE" if ok else "OUT-OF-RANGE",
                         src[ln-1].strip()[:70] if ok else ""))
print(f"PATH-BEARING LINE CITATIONS REMAINING IN THE ROUND'S SIX FILES: {len(rows)}")
byf={}
for r in rows: byf.setdefault(r[0],[]).append(r)
for f,rs in byf.items():
    print(f"\n  {f}  ({len(rs)})")
    for _,i,tgt,ln,st,txt in rs:
        print(f"    L{i:<5} -> {tgt}:{ln:<6} {st:14} {txt}")
