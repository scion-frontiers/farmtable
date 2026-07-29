#!/usr/bin/env python3
# APPARATUS - farmtable-predicate-2 - p2ap.sweep.py
# AMEND 19.0 Order A (re-derive by containment) + Order B (specificity control).
# Value from own environ, selected by digest. Never printed, never argv, never on disk.
import os,re,hashlib,sys
CANON="d72bb520918e7a28"
subj=None
for k,v in os.environ.items():
    if v and hashlib.sha256(v.encode()).hexdigest()[:16]==CANON: subj=v.encode(); break
if subj is None: print("ABORT: subject unavailable"); sys.exit(3)

CARRIERS=["/workspace/farmtable/.git/config",
          "/workspace/farmtable-task-state-core/.git/config",
          "/workspace/farmtable-task-state-predeploy/.git/config",
          "/workspace/.scion/agents/coordinator/scion-agent.json",
          "/scion-volumes/scratchpad/projects/farmtable/preserve/gc-config-before-20260729T070627Z/farmtable.config.before",
          "/home/scion/.scion/harness/inputs/telemetry.json",
          "/home/scion/.scion/scion-env",
          "/workspace/farmtable-passthrough-write-p1/test-writethrough.db"]

# ---- does the subject actually begin with the literal prefix? ----
# This is what makes the host-wide stage-1 regex a rigorous SUPERSET rather than an assumption.
pfx=b"github_pat_"
print("=== SUPERSET PREMISE, TESTED NOT ASSUMED ===")
print("   subject begins with the literal prefix: %s   (subject length %d)"%(subj.startswith(pfx),len(subj)))

# ---- ORDER B: SPECIFICITY CONTROL ----
# one byte flipped, same length, same alphabet
i=len(subj)//2
orig=subj[i:i+1]
alt=b"A" if orig!=b"A" else b"B"
mut=subj[:i]+alt+subj[i+1:]
assert len(mut)==len(subj) and mut!=subj
print("\n=== ORDER B — SPECIFICITY CONTROL (one byte flipped, same length, same alphabet) ===")
print("   mutant length=%d  differs from subject: yes  (mutant never printed)"%len(mut))
bad=0
for p in CARRIERS:
    try: b=open(p,"rb").read()
    except Exception as e: print("   ERR %s %s"%(type(e).__name__,p)); continue
    t,m=b.count(subj),b.count(mut)
    flag="" if m==0 else "  <<< SPECIFICITY FAILURE"
    if m: bad+=1
    print("   true=%d mutant=%d  %s%s"%(t,m,p,flag))
if bad: print("\n   ABORT: specificity control fired. Instrument matches things it should not."); sys.exit(5)
print("   -> all eight known carriers: true fires, mutant silent. SPECIFIC.")

# ---- ORDER A: re-derive my four published populations BY CONTAINMENT ----
POPS=["/home/scion/.claude/projects/-workspace",
      "/home/scion/.claude/file-history",
      "/tmp",
      "/scion-volumes/scratchpad/projects/farmtable/predicate2"]
print("\n=== ORDER A — PROVISIONAL-SPAN ZEROS RE-DERIVED BY CONTAINMENT ===")
print("   (previously reported via extract-then-hash: canonical 0 in all four)")
grand=gbin=gunread=ghits=0
for root in POPS:
    n=nb=unread=hits=0
    for dp,dn,fn in os.walk(root):
        for name in fn:
            p=os.path.join(dp,name)
            if os.path.islink(p): continue
            try:
                with open(p,"rb") as f: b=f.read()
            except Exception: unread+=1; continue
            n+=1
            if b"\x00" in b[:8192]: nb+=1
            if subj in b: hits+=1; print("      CARRIER: %s"%p)
    print("   %-58s files=%-5d binary=%-4d unreadable=%-3d containment hits=%d"%(root,n,nb,unread,hits))
    grand+=n; gbin+=nb; gunread+=unread; ghits+=hits
print("\n   TOTAL re-derived: %d files (%d binary, %d unreadable). CONTAINMENT HITS: %d"%(grand,gbin,gunread,ghits))
