#!/usr/bin/env python3
# STAGE 4b - AMENDMENT A6. 4a produced 7,421 edges: my own "instrument broken" signal.
# Cause: stems like 'update'/'circuit' are common English words that happen to be filenames,
# matched as bare substrings in prose. Same domain-vocabulary collision as run 1's class A.
#
# PUBLISHED SCOPE PREDICATE (both sides of every pair must satisfy it):
#   DOC = path under /scion-volumes/scratchpad/projects/farmtable/
#         AND extension in {.md, .txt}
#         AND NOT under reference/ (vendored third-party: beads, watcher)
#         AND NOT under node_modules/ , dist/ , .git/
# REFERENCE TOKEN must be DISTINCTIVE: len>=8, contains a digit or a hyphen,
#   matched at a word boundary, and resolving to <=8 paths.
import os, re, json, collections, sys

ROOT = "/scion-volumes/scratchpad"
PROJ = ROOT + "/projects/farmtable/"
banners = json.load(open("/tmp/rec.bannersA.json"))
allfiles = [l.strip() for l in open("/tmp/rm.A.files") if l.strip()]

def is_doc(p):
    if not p.startswith(PROJ): return False
    if os.path.splitext(p)[1].lower() not in (".md", ".txt"): return False
    rest = p[len(PROJ):]
    for bad in ("reference/", "node_modules/", "dist/", ".git/"):
        if rest.startswith(bad) or ("/" + bad) in ("/" + rest): return False
    return True

docs = [p for p in allfiles if is_doc(p)]
doc_banners = {p: v for p, v in banners.items() if is_doc(p)}

# --- measure what the scope REJECTED, per my own FILTER discipline ---
rejected_bannered = {p: v for p, v in banners.items() if not is_doc(p)}
print("SCOPE: documentary corpus = %d files ; bannered within scope = %d"
      % (len(docs), len(doc_banners)))
print("SCOPE REJECTED %d bannered files. Breakdown (measured, not asserted):" % len(rejected_bannered))
rc = collections.Counter()
for p in rejected_bannered:
    r = p.replace(ROOT + "/", "")
    if r.startswith("scion-reference/changelog/"): rc["scion-reference/changelog (⚠ BREAKING CHANGES house style)"] += 1
    elif r.startswith("scion-reference/"): rc["scion-reference/ other"] += 1
    elif "/reference/" in r: rc["farmtable/reference/ (vendored beads+watcher)"] += 1
    elif r.startswith("pr-reviews/"): rc["pr-reviews/"] += 1
    else: rc["other"] += 1
for k, v in rc.most_common(): print("    %-58s %d" % (k, v))
print()

stem2paths = collections.defaultdict(list)
for p in docs:
    b = os.path.basename(p)
    for s in {b, os.path.splitext(b)[0]}:
        if len(s) >= 8 and re.search(r"[\d-]", s):
            stem2paths[s].append(p)
stem2paths = {s: v for s, v in stem2paths.items() if len(v) <= 8}

ALIASES = {}
for p in docs:
    m = re.match(r"_broadcast-(\d+)\.txt$", os.path.basename(p))
    if m: ALIASES["B" + m.group(1)] = p
STEMS = sorted(stem2paths, key=len, reverse=True)
STEM_RX = re.compile(r"(?<![A-Za-z0-9])(" + "|".join(re.escape(s) for s in STEMS) + r")(?![A-Za-z0-9])")
ALIAS_RX = re.compile(r"(?<![A-Za-z0-9_])(B\d{1,2})(?![A-Za-z0-9_])")

_cache = {}
def lines_of(p):
    if p not in _cache:
        try:
            with open(p, "rb") as f: _cache[p] = f.read().decode("utf-8", errors="replace").split("\n")
        except Exception: _cache[p] = []
    return _cache[p]

def counterparts(path, ln, r=6):
    L = lines_of(path)
    w = "\n".join(L[max(0, ln - r): ln + r + 1])
    out = {}
    for m in STEM_RX.finditer(w):
        for tgt in stem2paths[m.group(1)]:
            if tgt != path: out[tgt] = m.group(1)
    for m in ALIAS_RX.finditer(w):
        tgt = ALIASES.get(m.group(1))
        if tgt and tgt != path: out[tgt] = m.group(1)
    return out

# ---------------- CONTROLS ----------------
def ctl():
    b20 = PROJ + "em-tooling/_broadcast-20.txt"
    b19 = PROJ + "em-tooling/_broadcast-19.txt"
    if b20 not in doc_banners: print("CONTROL FAIL: known-positive B20 not bannered"); sys.exit(2)
    cp = counterparts(b20, doc_banners[b20][0][0])
    if b19 not in cp:
        print("CONTROL FAIL: known-good pair B20->B19 NOT recovered after tightening"); sys.exit(2)
    if b19 in doc_banners: print("CONTROL FAIL: B19 unexpectedly bannered"); sys.exit(2)
    # negative arm: a generic English word must NOT resolve
    if STEM_RX.search("please update the circuit and install it"):
        print("CONTROL FAIL: generic prose still resolves to a filename"); sys.exit(2)
    print("CONTROL A6: known pair B20->B19 recovered; generic prose rejected -> arms DIFFER")
ctl()
print()

rows = []
for p, bl in sorted(doc_banners.items()):
    for ln, cls, txt in bl:
        for tgt, via in sorted(counterparts(p, ln).items()):
            rows.append(dict(banner_path=p, banner_line=ln, banner_text=txt,
                             counterpart=tgt, via=via, cp_bannered=tgt in doc_banners))
json.dump(rows, open("/tmp/rec.pairs2.json", "w"), indent=1)

miss = [r for r in rows if not r["cp_bannered"]]
print("EDGES resolved                      : %d" % len(rows))
print("  counterpart ALSO bannered         : %d" % (len(rows) - len(miss)))
print("  CLASS B (counterpart unbannered)  : %d" % len(miss))
pairs = sorted({(r["banner_path"], r["counterpart"]) for r in miss})
print("  distinct CLASS B pairs            : %d" % len(pairs))
print()
print("=== CLASS B, LOCATED ===")
for bp, cp in pairs:
    r = next(x for x in miss if x["banner_path"] == bp and x["counterpart"] == cp)
    print("\nBANNER      %s  L%d" % (bp.replace(PROJ, ""), r["banner_line"]))
    print("            %s" % r["banner_text"][:145])
    print("COUNTERPART %s   [via %r]  <-- NO BANNER" % (cp.replace(PROJ, ""), r["via"]))
