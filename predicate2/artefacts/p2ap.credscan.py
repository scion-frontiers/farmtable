#!/usr/bin/env python3
# APPARATUS - farmtable-predicate-2 - p2ap.credscan.py
# Matches by DIGEST over span=BARE TOKEN. Never prints a matching line.
# Binary-inclusive and declares the binary/text split (18.5 item 4).
import os,re,sys,hashlib
CANON="d72bb520918e7a28"
# assembled so this source is not itself a token-shaped hit; verified by positive arm, not by reading
A="git"; PF="hub_pat_"; GP="hp_"
SHAPES=[(A[0]+A[1]+"t"+PF, re.compile((A[0]+A[1]+"t"+PF+r"[A-Za-z0-9_]{20,}").encode())),
        (A[0]+"h"+GP,      re.compile((A[0]+"h"+GP+r"[A-Za-z0-9]{20,}").encode()))]
def dig(b): return hashlib.sha256(b).hexdigest()[:16]
def is_bin(b): return b"\x00" in b[:8192]
def scan(path):
    try:
        with open(path,"rb") as f: b=f.read(67108864)
    except Exception as e: return None
    out={"bin":is_bin(b),"bytes":len(b),"canon":0,"other":0,"digests":set()}
    for _,rx in SHAPES:
        for m in rx.finditer(b):
            d=dig(m.group(0))
            if d==CANON: out["canon"]+=1
            else: out["other"]+=1; out["digests"].add(d)
    return out
def walk(root):
    if os.path.isfile(root): yield root; return
    for dp,dn,fn in os.walk(root):
        for n in fn: yield os.path.join(dp,n)
if __name__=="__main__":
    # ---- POSITIVE ARM FIRST: a REAL INSTANCE, not a plant, not a fabrication ----
    ctl="/home/scion/.scion/scion-env"
    r=scan(ctl)
    if not r or r["canon"]<1:
        print("POSITIVE ARM FAILED on %s -> SCANNER IS DEAD, RESULTS VOID"%ctl); sys.exit(2)
    print("POSITIVE ARM (tier: REAL INSTANCE) %s fires canon=%d  -> scanner live"%(ctl,r["canon"]))
    for root in sys.argv[1:]:
        tot=nbin=ntxt=unread=hits=0; canon=0; other=0; dd=set(); hitpaths=[]
        for p in walk(root):
            if os.path.islink(p): continue
            r=scan(p)
            tot+=1
            if r is None: unread+=1; continue
            if r["bin"]: nbin+=1
            else: ntxt+=1
            if r["canon"] or r["other"]:
                hits+=1; canon+=r["canon"]; other+=r["other"]; dd|=r["digests"]
                hitpaths.append((p,r["canon"],r["other"],"BIN" if r["bin"] else "txt"))
        print("\n--- POPULATION: %s"%root)
        print("    files=%d  TEXT=%d  BINARY=%d  UNREADABLE=%d   (split declared, binaries INCLUDED)"%(tot,ntxt,nbin,unread))
        print("    files with any token-shaped match: %d   canonical occurrences: %d   non-canonical: %d"%(hits,canon,other))
        print("    non-canonical digests seen: %s"%(sorted(dd) if dd else "none"))
        for p,c,o,k in hitpaths:
            print("      [%s] canon=%-4d other=%-4d %s"%(k,c,o,p))
