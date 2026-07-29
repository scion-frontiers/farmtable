#!/usr/bin/env python3
# APPARATUS - farmtable-predicate-2 - p2ap.substr.py
# Span-free: chooses no span, extracts nothing, hashes no file bytes.
# The subject value comes from THIS PROCESS'S OWN environ and is never printed,
# never an argv element, never written to disk.
import os,hashlib,sys
CANON="d72bb520918e7a28"

# --- SUBJECT SELECTION BY DIGEST, not by variable name (name could be wrong; digest cannot) ---
subj=None; subj_var=None
for k,v in os.environ.items():
    if not v: continue
    if hashlib.sha256(v.encode()).hexdigest()[:16]==CANON:
        subj=v.encode(); subj_var=k; break
if subj is None:
    print("ABORT: no environ value hashes to the canonical digest. Subject unavailable.")
    sys.exit(3)
print("SUBJECT: taken from environ variable %s   length=%d bytes   value NEVER printed"%(subj_var,len(subj)))
print("         sha256[0:16] of subject == %s  (matches canonical) \n"%CANON)

def count_in(path):
    try:
        with open(path,"rb") as f: b=f.read()
    except Exception as e:
        return None,None,type(e).__name__
    return b.count(subj), len(b), None

TARGET="/workspace/farmtable-passthrough-write-p1/test-writethrough.db"
TIER3=["/home/scion/.scion/scion-env",
       "/workspace/farmtable/.git/config"]
NEG=["/etc/hostname",
     "/tmp/p2ap.norepo/sub/visible.txt"]

print("=== TIER-3 ARM (files I did NOT plant, known carriers) — MUST be >= 1 ===")
dead=False
for p in TIER3:
    n,sz,err=count_in(p)
    print("   occurrences=%-4s bytes=%-8s %s%s"%(n,sz,p," ERR="+err if err else ""))
    if not n: dead=True
if dead:
    print("\nABORT: a tier-3 arm returned 0. INSTRUMENT DEAD. No zero is reportable from this run.")
    sys.exit(4)
print("   -> instrument LIVE\n")

print("=== NEGATIVE CONTROL (cannot carry it) — MUST be 0 ===")
for p in NEG:
    n,sz,err=count_in(p)
    print("   occurrences=%-4s bytes=%-8s %s%s"%(n,sz,p," ERR="+err if err else ""))
    if n: print("   ABORT: negative control fired."); sys.exit(5)
print("   -> controls clean\n")

print("=== POPULATION: one named file, the unsettled carrier row ===")
n,sz,err=count_in(TARGET)
print("   %s"%TARGET)
print("   bytes read=%s   OCCURRENCES OF THE SUBJECT VALUE = %s"%(sz,n))
print("\n   VERDICT: %s"%("CARRIER — inventory reads EIGHT" if n and n>0 else
                          "NOT A CARRIER — inventory reads SEVEN"))
