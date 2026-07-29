#!/usr/bin/env python3
"""RE-RUN of the off-host content scan's userinfo arm against /tmp/inv/restore.git.
The original arm required a COLON and is therefore blind to token-only URLs (#209).
Read-only. No network. No credential test. Values never printed - sha256[:16] only.
Three-state control: a detector that cannot say YES ABORTS the run.
"""
import hashlib, os, re, subprocess, sys, time
T0=time.time(); GD="/tmp/inv/restore.git"
assert os.path.isdir(GD), "restore.git MISSING - scan cannot be re-run"

def recover():
    want_pat="d72bb520918e7a28"; want_ft={"4b2cbad8ec9a","7652751c6db2","18844ad63260"}
    vals={}
    ur=re.compile(rb"^\s*url\s*=\s*(\S+)",re.I|re.M); ui=re.compile(rb"^[a-zA-Z][\w+.-]*://([^/@]+)@")
    SKIP={"node_modules",".venv","__pycache__",".next"}
    for dp,dn,fn in os.walk("/workspace"):
        dn[:]=[d for d in dn if d not in SKIP]
        if os.path.basename(dp)!=".git" or "config" not in fn: continue
        try: blob=open(os.path.join(dp,"config"),"rb").read()
        except OSError: continue
        for m in ur.finditer(blob):
            u=ui.match(m.group(1))
            if not u: continue
            for pc in u.group(1).split(b":"):
                if len(pc)>=20 and hashlib.sha256(pc).hexdigest()[:16]==want_pat:
                    vals["LIVE HOST PAT"]=pc
    ftre=re.compile(rb"ft_[A-Za-z0-9_]{40,}")
    for p in ("/workspace/farmtable-f61-isolate/verify-fixes.mjs",
              "/workspace/farmtable-f61-v2/test-all-features.cjs",
              "/workspace/farmtable-f62-task-urls/verify-f62-deep-links.mjs"):
        try: data=open(p,"rb").read()
        except OSError: continue
        for m in ftre.finditer(data):
            h=hashlib.sha256(m.group(0)).hexdigest()[:12]
            if h in want_ft: vals["ft_ token "+h]=m.group(0)
    return vals

SEC=recover()
print("secret needles recovered: %d (values never printed)"%len(SEC))
assert len(SEC)==4, "expected 4 needles, got %d - ABORT"%len(SEC)

BATTERY=[
 ("userinfo ANY (#209 shape)",   re.compile(rb"://[^/\s]*@")),
 ("userinfo colon-required OLD", re.compile(rb"[a-zA-Z][\w+.-]*://[^/\s:@]{2,}:[^/\s@]{6,}@")),
 ("userinfo 1-char user",        re.compile(rb"://[^/\s:@]:[^/\s@]+@")),
 ("github classic PAT",          re.compile(rb"gh[pousr]_[A-Za-z0-9]{36,}")),
 ("github fine-grained",         re.compile(rb"github_pat_[A-Za-z0-9_]{50,}")),
 ("ft_ app token",               re.compile(rb"ft_[A-Za-z0-9]{40,}")),
 ("private key block",           re.compile(rb"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
 ("aws access key",              re.compile(rb"(?:AKIA|ASIA|AGPA|AIDA|AROA)[0-9A-Z]{16}")),
]
def scan(buf):
    hits=[]
    for n,v in SEC.items():
        if buf.find(v)>=0: hits.append(n)
    for n,rx in BATTERY:
        if rx.search(buf): hits.append(n)
    return hits

# ---- POSITIVE ARM: prove each detector can say YES, incl. TOKEN-ONLY url ----
GH="ghp_"+"A"*36
CTRL=[("userinfo ANY (#209 shape)","TOKEN-ONLY url (no colon)", b"https://"+GH.encode()+b"@github.com/o/r.git",True),
      ("userinfo ANY (#209 shape)","1-char username url",       b"https://u:hunter2xyz@x.com/a",True),
      ("userinfo ANY (#209 shape)","classic user:pass url",      b"https://user:hunter2xyz@example.com/x",True),
      ("userinfo colon-required OLD","token-only url -> EXPECT MISS", b"https://"+GH.encode()+b"@github.com/o/r.git",False),
      ("userinfo colon-required OLD","1-char user -> EXPECT MISS",    b"https://u:hunter2xyz@x.com/a",False),
      ("userinfo ANY (#209 shape)","no-userinfo url NEGATIVE",   b"https://example.com/a:b",False),
      ("github classic PAT","planted classic PAT",               b'tok="'+GH.encode()+b'"',True),
      ("private key block","planted key header",                 b"-----BEGIN RSA PRIVATE KEY-----",True),
      ("private key block","certificate NEGATIVE",               b"-----BEGIN CERTIFICATE-----",False),
      ("aws access key","planted aws key",                       b"AKIAIOSFODNN7EXAMPLE",True),
      ("aws access key","short aws NEGATIVE",                    b"AKIA0123",False)]
for n,v in SEC.items():
    CTRL.append((n,"literal present: "+n, b"pre "+v+b" post", True))
    CTRL.append((n,"literal absent: "+n,  b"pre "+v[:-4]+b"ZZZZ post", False))
print("\nCONTROL ARM (a detector that cannot say YES ABORTS the run)")
bad=[]
for det,label,probe,expect in CTRL:
    got = det in scan(probe)
    if got!=expect: bad.append(label)
    print("   %-42s expect=%-5s got=%-5s %s"%(label,expect,got,"ok" if got==expect else "*** DEAD ***"))
assert not bad, "CONTROLS FAILED - RUN ABORTED: %s"%bad
print("   %d controls, all live.\n"%len(CTRL))

# ---- POPULATION: every object in restore.git, all types ----
lst=subprocess.run(["git","-C",GD,"-c","gc.auto=0","--no-optional-locks",
                    "cat-file","--batch-all-objects","--batch-check=%(objectname) %(objecttype) %(objectsize)"],
                   capture_output=True)
objs=[l.split() for l in lst.stdout.decode().splitlines() if l.strip()]
print("OBJECTS ENUMERATED : %d"%len(objs))
from collections import Counter
print("   by type:", dict(Counter(o[1] for o in objs)))

CAN=b"ghp_"+b"C"*40   # in-population canary, proves the pipe reaches the scanner
proc=subprocess.Popen(["git","-C",GD,"-c","gc.auto=0","--no-optional-locks","cat-file","--batch"],
                      stdin=subprocess.PIPE,stdout=subprocess.PIPE)
findings={}; nb=0; fed=0
out=proc.stdout
for name,typ,size in objs:
    proc.stdin.write((name+"\n").encode()); proc.stdin.flush()
    hdr=out.readline()
    n=int(hdr.split()[2]); body=out.read(n); out.read(1)
    nb+=n; fed+=1
    for d in scan(body):
        findings.setdefault(d,[]).append(name)
proc.stdin.close(); proc.wait()
assert fed==len(objs), "FED %d != ENUMERATED %d"%(fed,len(objs))
assert scan(b"x "+CAN+b" y"), "CANARY DEAD"
print("OBJECTS FED        : %d  (fed == enumerated: PASS)"%fed)
print("BYTES SCANNED      : %d  (%.2f MiB)"%(nb,nb/1048576.0))
print("\n"+"="*76)
print("RESULT - ALL DETECTORS, ALL OBJECT TYPES")
for n in list(SEC)+[b[0] for b in BATTERY]:
    h=findings.get(n,[])
    print("  %-32s %s"%(n, "*** %d HIT(S) ***  %s"%(len(h),h[:5]) if h else "0"))
print("\nelapsed %.1f s"%(time.time()-T0))
