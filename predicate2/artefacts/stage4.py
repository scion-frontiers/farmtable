#!/usr/bin/env python3
# STAGE 4: for every banner, LOCATE its counterpart and report whether the counterpart is bannered.
# Reference vocabulary is the corpus's OWN FILENAMES - not a guessed phrase list.
import os, re, json, sys, collections

ROOT = "/scion-volumes/scratchpad"
banners = json.load(open("/tmp/rec.bannersA.json"))

allfiles = [l.strip() for l in open("/tmp/rm.A.files") if l.strip()]

# ---- stem -> paths  (the reference vocabulary, read OFF the corpus) ----
stem2paths = collections.defaultdict(list)
for p in allfiles:
    b = os.path.basename(p)
    for s in {b, os.path.splitext(b)[0]}:
        if len(s) >= 6:
            stem2paths[s].append(p)

# declared alias rule (corpus-specific, published, not inferred silently)
ALIASES = {}
for p in allfiles:
    m = re.match(r"_broadcast-(\d+)\.txt$", os.path.basename(p))
    if m: ALIASES["B" + m.group(1)] = p
    m = re.match(r"broadcast-(\d+)", os.path.basename(p))
    if m: ALIASES.setdefault("B" + m.group(1), p)

STEMS = sorted(stem2paths, key=len, reverse=True)
STEM_RX = re.compile("|".join(re.escape(s) for s in STEMS)) if STEMS else None
ALIAS_RX = re.compile(r"(?<![A-Za-z0-9_])(B\d{1,2})(?![A-Za-z0-9_])")

def window(path, ln, r=6):
    try:
        with open(path, "rb") as f:
            lines = f.read().decode("utf-8", errors="replace").split("\n")
    except Exception:
        return ""
    return "\n".join(lines[max(0, ln - r): ln + r + 1])

def counterparts(path, ln):
    w = window(path, ln)
    found = {}
    if STEM_RX:
        for m in STEM_RX.finditer(w):
            for tgt in stem2paths[m.group(0)]:
                if tgt != path: found[tgt] = m.group(0)
    for m in ALIAS_RX.finditer(w):
        tgt = ALIASES.get(m.group(1))
        if tgt and tgt != path: found[tgt] = m.group(1)
    return found

rows = []
for p, bl in sorted(banners.items()):
    for ln, cls, txt in bl:
        cps = counterparts(p, ln)
        for tgt, via in sorted(cps.items()):
            rows.append({
                "banner_path": p, "banner_line": ln, "banner_cls": cls, "banner_text": txt,
                "counterpart": tgt, "via": via,
                "counterpart_bannered": tgt in banners,
            })

json.dump(rows, open("/tmp/rec.pairs.json", "w"), indent=1)

tot = len(rows)
missing = [r for r in rows if not r["counterpart_bannered"]]
print("banner->counterpart edges resolved : %d" % tot)
print("  counterpart ALSO bannered        : %d" % (tot - len(missing)))
print("  counterpart NOT bannered (CLASS B): %d" % len(missing))
print()

# group class-B by (banner doc, counterpart)
seen = set()
print("=== CLASS B: BANNER WHOSE COUNTERPART CARRIES NONE ===")
for r in missing:
    k = (r["banner_path"], r["counterpart"])
    if k in seen: continue
    seen.add(k)
    print("\nBANNER  %s : L%d" % (r["banner_path"].replace(ROOT + "/", ""), r["banner_line"]))
    print("        %s" % r["banner_text"][:150])
    print("  --> COUNTERPART (no banner)  %s   [matched via %r]"
          % (r["counterpart"].replace(ROOT + "/", ""), r["via"]))
print()
print("distinct (banner,counterpart) class-B pairs: %d" % len(seen))
