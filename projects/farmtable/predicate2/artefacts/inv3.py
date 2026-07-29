#!/usr/bin/env python3
# RUN OF RECORD - inverted instrument v3
# Implements PREDICATE-INVERTED.md + A1..A5 + coordinator bulletin-4 re-arming:
#   SELECTOR controlled by differential enumeration (exit 8)
#   FILTER   controlled by measuring what it REJECTED (integer published, exit 8)
#   DETECTOR controlled by near-miss arms on every interval quantifier (exit 9)
# READ-ONLY: opens corpus files 'rb' only. Writes nothing outside /tmp and the output dir.
import os, re, sys, json, hashlib, subprocess, collections

ROOT_A = "/scion-volumes/scratchpad"
OUT    = "/scion-volumes/scratchpad/projects/farmtable/predicate2"

def fail(msg, code):
    print("CONTROL FAILURE [exit %d]: %s" % (code, msg), flush=True)
    sys.exit(code)

def say(*a):
    print(*a, flush=True)

# =====================================================================
# DETECTOR (A1 two-tier)
# =====================================================================
TIER1 = [r"FREEZE\s+IN\s+FORCE", r"FREEZE\s+IS\s+IN\s+FORCE", r"UNDER\s+FREEZE",
         r"SUSPENDED", r"SUSPENSION", r"MUST\s+NOT\s+BE\s+FOLLOWED",
         r"DO\s+NOT\s+FOLLOW", r"DO\s+NOT\s+RUN", r"DO\s+NOT\s+USE", r"DO\s+NOT\s+EXECUTE",
         r"DISARMED", r"RESCINDED", r"COUNTERMANDED",
         r"NO\s+LONGER\s+VALID", r"NO\s+LONGER\s+APPLIES"]
TIER2 = [r"RETRACTED", r"WITHDRAWN", r"SUPERSEDED", r"OBSOLETE", r"VOID",
         r"HALTED", r"STOP", r"ON\s+HOLD"]
M1    = re.compile(r"(?<![A-Za-z0-9_])(" + "|".join(TIER1) + r")(?![A-Za-z0-9_])")
M2    = re.compile(r"(?<![A-Za-z0-9_])(" + "|".join(TIER2) + r")(?![A-Za-z0-9_])")
GLYPH = re.compile(r"[⛔⚠\U0001f6d1]")
SELFREF = re.compile(r"(?i)\b(THIS\s+(FILE|DOCUMENT|BRIEF|REPORT|RUNBOOK|SECTION|BLOCK|TABLE|"
                     r"RECOMMENDATION|CONDITIONAL|CLAIM|FIGURE|NUMBER|RULE|PARAGRAPH|PLAN|LIST)"
                     r"|INSTRUCTIONS|BELOW|ABOVE|HEREIN|THAT\s+FOLLOWS)\b")

def is_structure(line):
    s = line.strip()
    if not s: return False
    return s.startswith(">") or s.startswith("#") or ("**" in s)

def detect_banners(text):
    out = []
    for i, line in enumerate(text.split("\n")):
        if len(line) > 4000: continue
        if not is_structure(line): continue
        if M1.search(line) or GLYPH.search(line):
            out.append((i, "HEAD" if i < 15 else "INLINE", line.strip()[:400])); continue
        if M2.search(line) and SELFREF.search(line):
            out.append((i, "HEAD" if i < 15 else "INLINE", line.strip()[:400]))
    return out

# =====================================================================
# TERM EXTRACTION
# =====================================================================
CAPS  = re.compile(r"(?<![A-Za-z0-9_])([A-Z][A-Z0-9]{3,}(?:[-/][A-Z0-9]{2,})*)(?![A-Za-z0-9_])")
TICK  = re.compile(r"`([^`\n]{3,60})`")
QUOTE = re.compile(r"[\"“]([^\"”\n]{4,60})[\"”]")
TS    = re.compile(r"[-_]?\d{4}-?\d{2}-?\d{2}T?\d{2,6}Z?")
STOPCAPS = set("""THIS THAT THE AND FOR NOT WITH FROM HAVE BEEN WILL MUST ONLY WHEN WHAT WHICH
THEM THEY THERE THESE THOSE THAN THEN INTO ANY ALL ARE WAS WERE HAS HAD BUT NOTE ALSO EVERY EACH
SOME MORE MOST LESS SAME OTHER SUCH BECAUSE WHILE AFTER BEFORE UNTIL SINCE ABOUT ABOVE BELOW OVER
UNDER AGAIN ONCE HERE VERY JUST BOTH DOES DONE YOUR MINE OURS THEIR ITSELF WOULD COULD SHOULD SHALL
MAY MIGHT CAN NONE ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN""".split())

def extract_terms(w):
    t = set()
    for m in CAPS.finditer(w):
        if m.group(1) not in STOPCAPS: t.add(m.group(1))
    for rx in (TICK, QUOTE):
        for m in rx.finditer(w):
            s = m.group(1).strip()
            if len(s) >= 4: t.add(s)
    return t

def family(path):
    d, b = os.path.split(path)
    return (d, TS.sub("<TS>", b))

# =====================================================================
# STAGE-3 CONTROL: DETECTOR, incl. NEAR-MISS ARMS (bulletin 3, exit 9)
# =====================================================================
C = {
 "BAN-POS-1": "> **FREEZE IN FORCE 2026-07-29 - NO DELETION, PRUNING OR SAFE-TO-DELETE CLASSIFICATION.**\nbody\n",
 "BAN-POS-2": "⛔ **SUSPENDED - DO NOT RUN THIS RUNBOOK**\nbody\n",
 "BAN-POS-3": "\n".join("f %d" % i for i in range(400)) + "\n> **SUSPENDED - DO NOT RUN THIS RUNBOOK**\n",
 "BAN-POS-4": "> **This section is SUPERSEDED - do not follow the instructions below.**\n",
 "BAN-NEG-1": "The coordinator suspended the leg and the freeze is in force.\nA quiet night.\n",
 "BAN-NEG-2": "**The team retracted the estimate last week and archived the transcript.**\n",
 "BAN-NEG-3": "el.stopPropagation(); const x = void 0; enum E { NO_LONGER_VALID_ENUM = 1 }\n",
 "BAN-NEG-4": "**I RETRACTED THAT FIGURE TO YOU AN HOUR AGO AND THEN DID NOT**\n",
 "BAN-NEG-5": "## fleet-wide restart risk - PRODUCTION HALTED pending host-level fix\n",
}

def control_detector():
    r = {k: detect_banners(v) for k, v in C.items()}
    for k in ("BAN-POS-1", "BAN-POS-2", "BAN-POS-4"):
        if not any(c == "HEAD" for _, c, _ in r[k]): fail("%s did not fire HEAD" % k, 2)
    if not any(c == "INLINE" for _, c, _ in r["BAN-POS-3"]): fail("BAN-POS-3 no INLINE", 2)
    if any(c == "HEAD" for _, c, _ in r["BAN-POS-3"]): fail("BAN-POS-3 wrongly HEAD", 2)
    for k in ("BAN-NEG-1","BAN-NEG-2","BAN-NEG-3","BAN-NEG-4","BAN-NEG-5"):
        if r[k]: fail("%s fired: %r" % (k, r[k]), 2)
    for a, b in [("BAN-POS-1","BAN-NEG-1"),("BAN-POS-2","BAN-NEG-2"),("BAN-POS-1","BAN-NEG-3"),
                 ("BAN-POS-4","BAN-NEG-4"),("BAN-POS-4","BAN-NEG-5")]:
        if r[a] == r[b]: fail("differential pair %s/%s collapsed" % (a,b), 5)
    if [c for _,c,_ in r["BAN-POS-1"]] == [c for _,c,_ in r["BAN-POS-3"]]:
        fail("HEAD/INLINE distinction collapsed", 5)
    t = extract_terms("> **FREEZE IN FORCE - NO SAFE-TO-DELETE CLASSIFICATION.** run `git add -A`")
    if "SAFE-TO-DELETE" not in t: fail("term: missed SAFE-TO-DELETE", 2)
    if "git add -A" not in t:     fail("term: missed backtick literal", 2)
    if t & {"THIS","THE","NOTE"}: fail("term: admitted furniture", 2)
    if t == extract_terms("nothing operational here at all"): fail("TERM pair collapsed", 5)
    say("  CONTROL detector: banner 9/9, term 3/3, differential 7/7")

def control_nearmiss():
    """Bulletin 3: degradation is BIDIRECTIONAL. Each interval gets an under-match arm
       (just-inside must MATCH) and an over-match arm (just-outside must NOT match).
       A dropped interval leaves a bare atom -> the over-match arm catches it.
       A literalised interval -> the under-match arm catches it."""
    # --- CAPS  [A-Z][A-Z0-9]{3,}  (total >= 4)
    if not CAPS.search("ABCD"):  fail("CAPS under-match: 4-char CAPS token missed ({3,} literalised?)", 9)
    if CAPS.search("ABC"):       fail("CAPS OVER-match: 3-char token matched ({3,} dropped -> bare atom)", 9)
    # --- CAPS suffix (?:[-/][A-Z0-9]{2,})*
    m = CAPS.search("SAFE-TO-DELETE")
    if not m or m.group(1) != "SAFE-TO-DELETE": fail("CAPS suffix under-match: %r" % (m and m.group(1),), 9)
    m = CAPS.search("SAFE-T-DELETE")
    if m and m.group(1) != "SAFE": fail("CAPS suffix OVER-match: consumed 1-char segment -> %r" % m.group(1), 9)
    # --- TICK {3,60}
    if not TICK.search("`abc`"):                 fail("TICK under-match: 3-char body missed", 9)
    if TICK.search("`ab`"):                      fail("TICK OVER-match: 2-char body matched (lower bound dropped)", 9)
    if TICK.search("`" + "x"*61 + "`"):          fail("TICK OVER-match: 61-char body matched (upper bound dropped)", 9)
    if not TICK.search("`" + "x"*60 + "`"):      fail("TICK under-match: 60-char body missed at boundary", 9)
    # --- QUOTE {4,60}
    if not QUOTE.search('"abcd"'):               fail("QUOTE under-match: 4-char body missed", 9)
    if QUOTE.search('"abc"'):                    fail("QUOTE OVER-match: 3-char body matched (lower bound dropped)", 9)
    if QUOTE.search('"' + "x"*61 + '"'):         fail("QUOTE OVER-match: 61-char body matched (upper bound dropped)", 9)
    if not QUOTE.search('"' + "x"*60 + '"'):     fail("QUOTE under-match: 60-char body missed at boundary", 9)
    # A4 real-phrase arm
    t = extract_terms('He said "harvest the transcript before deleting" and left.')
    if "harvest the transcript before deleting" not in t: fail("QUOTE-POS inert", 9)
    if t == extract_terms("He said harvest the transcript before deleting and left."):
        fail("QUOTE pair collapsed", 5)
    # --- TS {2,6}
    if TS.sub("<TS>", "x-2026-07-29T0300Z.md") != "x<TS>.md":
        fail("TS under-match: %r" % TS.sub("<TS>", "x-2026-07-29T0300Z.md"), 9)
    if TS.sub("<TS>", "x-2026-07-29.md") == "x<TS>.md":
        fail("TS OVER-match: consumed with zero trailing digits ({2,6} dropped)", 9)
    a = family("/x/coordinator-state-2026-07-29T0300Z.md")
    b = family("/x/coordinator-state-2026-07-29T0415Z.md")
    c = family("/x/em-state-2026-07-29T0300Z.md")
    if a != b: fail("FAMILY-POS: snapshots did not collapse: %r vs %r" % (a,b), 9)
    if a == c: fail("FAMILY-NEG: distinct families collapsed", 5)
    say("  CONTROL near-miss: CAPS 4/4, TICK 4/4, QUOTE 6/6, TS 4/4 (all 4 intervals, both directions)")

def control_preimage():
    """A2 6.6-bis: a KNOWN POSITIVE from the LIVE corpus. crash-cleanup-audit.md was
       bannered at 09:27:41Z. The reconstructed pre-image (lines[71:]) must be CLEAN,
       the full file must be BANNERED, and the two must DIFFER."""
    p = os.path.join(OUT, "..", "reports", "crash-cleanup-audit.md")
    p = os.path.normpath(p)
    if not os.path.exists(p):
        say("  CONTROL preimage: SKIPPED (file absent) - reported, not silently dropped"); return
    with open(p, "rb") as f:
        txt = f.read().decode("utf-8", errors="replace")
    lines = txt.split("\n")
    full = detect_banners(txt)
    pre  = detect_banners("\n".join(lines[71:]))
    if not full: fail("preimage: live bannered file shows NO banner - detector blind", 6)
    if pre:      fail("preimage: reconstructed pre-image shows a banner: %r" % pre[:2], 6)
    if full == pre: fail("preimage pair collapsed", 5)
    say("  CONTROL preimage(live): full=%d banner(s), pre-image=%d -> differ" % (len(full), len(pre)))

# =====================================================================
# STAGE-1 CONTROL: SELECTOR by DIFFERENTIAL ENUMERATION (exit 8)
# =====================================================================
def walk_py(root):
    out = []
    for dp, dns, fns in os.walk(root):          # followlinks=False
        for fn in fns:
            p = os.path.join(dp, fn)
            if os.path.islink(p): continue
            if not os.path.isfile(p): continue
            out.append(p)
    return set(out)

def walk_find(root):
    r = subprocess.run(["find", root, "-type", "f", "-not", "-type", "l"],
                       capture_output=True, text=True)
    # bulletin 7: a find with stderr discarded CANNOT REPORT AN UNREADABLE DIRECTORY.
    # stderr is captured, inspected, and fatal - never discarded, never piped.
    if r.stderr.strip():
        say("  find stderr (%d bytes):" % len(r.stderr))
        for L in r.stderr.strip().split("\n")[:20]: say("    " + L)
        fail("SELECTOR: enumerator emitted stderr - unreadable paths are a silent selector hole", 8)
    if r.returncode != 0:
        fail("SELECTOR: find rc=%d" % r.returncode, 8)
    return set(x for x in r.stdout.split("\n") if x)

def control_selector_err():
    """A CONTROL PROVES THE BRANCH IT TRAVERSES. The stderr-is-fatal branch in walk_find()
       is never exercised by a clean corpus, so it is unproven. Fixture: a real unreadable
       directory in /tmp. Not deleted afterwards - the freeze forbids deletion anywhere."""
    fx = "/tmp/selftest-selector"
    if not os.path.isdir(fx):
        fail("SELECTOR-ERR: fixture missing, stderr branch UNPROVEN", 8)
    r = subprocess.run(["find", fx, "-type", "f"], capture_output=True, text=True)
    if not r.stderr.strip():
        fail("SELECTOR-ERR: unreadable dir produced NO stderr - "
             "the enumerator cannot report selector holes and my clean result is meaningless", 8)
    clean = subprocess.run(["find", fx + "/readable", "-type", "f"], capture_output=True, text=True)
    if clean.stderr.strip():
        fail("SELECTOR-ERR negative arm: readable dir emitted stderr", 8)
    if bool(r.stderr.strip()) == bool(clean.stderr.strip()):
        fail("SELECTOR-ERR pair collapsed", 5)
    which = subprocess.run(["find", "--version"], capture_output=True, text=True)
    impl = (which.stdout + which.stderr).split("\n")[0][:60]
    say("  CONTROL selector-err: unreadable dir -> stderr FIRES, readable -> silent (differ)")
    say("    enumerator implementation: %s" % (impl or "unknown"))

def control_selector(root):
    a = walk_py(root)
    b = walk_find(root)
    only_py, only_fd = a - b, b - a
    if only_py or only_fd:
        say("  SELECTOR DISAGREEMENT py-only=%d find-only=%d" % (len(only_py), len(only_fd)))
        for x in list(only_py)[:5]: say("    py-only : %s" % x)
        for x in list(only_fd)[:5]: say("    find-only: %s" % x)
        fail("SELECTOR: os.walk and find disagree - enumeration is not trustworthy", 8)
    links = subprocess.run(["find", root, "-type", "l"], capture_output=True, text=True)
    nlinks = len([x for x in links.stdout.split("\n") if x])
    dirlinks = [x for x in links.stdout.split("\n") if x and os.path.isdir(x)]
    say("  CONTROL selector: os.walk == find, |P| = %d ; symlinks = %d (dir-links = %d, NOT descended)"
        % (len(a), nlinks, len(dirlinks)))
    for d in dirlinks: say("    dir-link (published, not traversed): %s -> %s" % (d, os.readlink(d)))
    return sorted(a), nlinks, dirlinks

# =====================================================================
# STAGE-2 CONTROL: FILTER, by measuring what it REJECTED (exit 8)
# =====================================================================
def read_bytes(p):
    try:
        with open(p, "rb") as f: return f.read()
    except Exception: return None

def is_opaque(raw):
    if raw is None: return True
    if b"\x00" in raw[:8192]: return True
    try:
        raw.decode("utf-8"); return False
    except UnicodeDecodeError:
        return True

def control_dedup():
    """A5: dedup must ATTRIBUTE paths, not collapse them. Same bytes at two paths
       must be reported at BOTH."""
    blobs = {"/a/x.md": b"> **SUSPENDED - DO NOT RUN**\n", "/b/y.md": b"> **SUSPENDED - DO NOT RUN**\n"}
    idx = collections.defaultdict(list)
    for p, raw in blobs.items(): idx[hashlib.sha256(raw).hexdigest()].append(p)
    if len(idx) != 1: fail("DEDUP-CANARY: identical bytes hashed differently", 7)
    paths = sorted(next(iter(idx.values())))
    if paths != ["/a/x.md", "/b/y.md"]:
        fail("DEDUP-CANARY: dedup collapsed the path set to %r - path attribution lost" % paths, 7)
    say("  CONTROL dedup: 1 blob attributed to 2 paths (path-attributing, not path-collapsing)")

# =====================================================================
if __name__ == "__main__":
    say("=== STAGE 0: CONTROLS (all three stages armed) ===")
    control_detector()
    control_nearmiss()
    control_preimage()
    control_dedup()

    say("")
    say("=== STAGE 1: SELECTOR (differential enumeration) ===")
    control_selector_err()
    files, nlinks, dirlinks = control_selector(ROOT_A)

    say("")
    say("=== STAGE 2: FILTER (measure what it rejected) ===")
    text_files, opaque_files = [], []
    for p in files:
        raw = read_bytes(p)
        if is_opaque(raw): opaque_files.append(p)
        else: text_files.append(p)
    say("  ENUMERATED = %d   TEXT = %d   OPAQUE(rejected) = %d"
        % (len(files), len(text_files), len(opaque_files)))
    # THE CONTROL: run the real detector over the REJECTED population.
    opaque_hits = []
    for p in opaque_files:
        raw = read_bytes(p)
        if raw is None: continue
        b = detect_banners(raw.decode("utf-8", errors="replace"))
        if b: opaque_hits.append((p, b[:2]))
    say("  FILTER CONTROL: detector over the %d REJECTED files -> %d bannered"
        % (len(opaque_files), len(opaque_hits)))
    for p, b in opaque_hits[:20]: say("    REJECTED-BUT-BANNERED: %s  %r" % (p, b))
    json.dump([p for p, _ in opaque_hits], open("/tmp/rec.filterA.json", "w"))

    say("")
    say("=== STAGE 3: DETECT over included population ===")
    bannered = {}
    blob = collections.defaultdict(list)
    canary_ord = [0, len(text_files)//2, len(text_files)-1]
    for n, p in enumerate(text_files):
        raw = read_bytes(p)
        if raw is None: continue
        blob[hashlib.sha256(raw).hexdigest()].append(p)
        b = detect_banners(raw.decode("utf-8", errors="replace"))
        if b: bannered[p] = b
    say("  BANNERED FILES = %d   BANNER INSTANCES = %d"
        % (len(bannered), sum(len(v) for v in bannered.values())))
    say("  distinct blobs = %d ; multi-path blobs = %d"
        % (len(blob), sum(1 for v in blob.values() if len(v) > 1)))
    fams = collections.Counter(family(p) for p in bannered)
    say("  banner families (A3) = %d ; largest = %s"
        % (len(fams), fams.most_common(1)))
    json.dump({p: v for p, v in bannered.items()}, open("/tmp/rec.bannersA.json", "w"))
    json.dump({k: v for k, v in blob.items() if len(v) > 1}, open("/tmp/rec.blobsA.json", "w"))
    say("")
    say("STAGE 1-3 COMPLETE. artifacts in /tmp/rec.*.json")
