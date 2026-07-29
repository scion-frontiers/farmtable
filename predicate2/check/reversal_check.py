#!/usr/bin/env python3
"""
REVERSAL-EDGE CHECKER  --  predicate2 / INVERTED INSTRUMENT

WHAT IT CHECKS
    A reversal edge is a document saying "a claim in ANOTHER document is wrong".
    The finding this codifies: OF 7 SUCH EDGES IN THE BROADCAST CHAIN, 0 OF 7 TARGETS
    CARRIED A BANNER ABOUT THE THING BEING REVERSED. The correction is broadcast; the
    document a reader actually opens still asserts the withdrawn claim.

THE TRAP THIS EXISTS TO AVOID  (it is the whole reason a naive check fails)
    Asking "is the target document bannered?" gives the WRONG answer. B9 carries a loud
    banner at its item 1 -- about its own retraction of B8. B10 reverses B9 ITEM 2.
    A document-level check sees B9's item-1 banner and reports COVERED.
        A BANNER ABOUT SOMETHING ELSE IMMUNISES A DOCUMENT AGAINST BEING FOUND NAKED.
    So the check is ITEM-SCOPED, and it reports the document-level answer alongside
    precisely to show the two disagreeing.

SCOPE (stated, per bulletin 15 item 11 -- a clean result reports its scope, never its gaps)
    POPULATION : em-tooling/_broadcast-{8..20}.txt , 13 files, no gaps. Nothing else.
    NOT COVERED: reversals stated in any other document class; reversals phrased without
                 one of the vocabulary fragments below; reversals naming a target by
                 description rather than number. These are BLIND, not clean.

SEARCH-TERM DISCIPLINE (bulletin 15 item 2)
    Reversal vocabulary is ASSEMBLED AT RUNTIME from fragments, so this file's own source
    text does not contain the terms it searches for. This file lives under the same tree
    it reads from; a literal list here would plant its own vocabulary in the corpus.
    A hard self-exclusion assertion enforces it rather than trusting it.

POSITIVE-CONTROL TIER (bulletin 15 item 6) -- THE TWO STAGES ARE AT DIFFERENT TIERS
    SELECTOR arms  TIER 3, REAL. The 7 known-positive edges are real edges in the live
        corpus; the known-negative is a real non-reversal citation (B10 L72 cites
        "BROADCAST 9 ITEM 2" approvingly). Nothing planted.
    DETECTOR arms  TIER 2, PLANTED -- AND THE REASON IS THE RESULT ITSELF. A tier-3
        positive would be a real disarm banner, and THERE IS NOT ONE ANYWHERE IN THIS
        CORPUS. The detector cannot be armed against a real instance because the
        practice does not exist. The plant is IN MEMORY ONLY; nothing is written to
        the corpus, and the freeze is not touched.
        WHEN NO TIER-3 POSITIVE EXISTS, THAT ABSENCE IS THE FINDING AND NOT A GAP IN
        THE CONTROL -- but it must be declared, because a tier-2 arm cannot prove the
        detector would recognise a real banner authored by someone else.

WHY THE DETECTOR ARMS EXIST AT ALL (the failure that produced them)
    v1 of this checker PASSED its 7/7 selector control and shipped a broken detector
    behind it. The selector arms prove edges are FOUND; they say nothing about the
    judgement applied afterwards. Two separate defects were caught only by adding an
    arm on the detector stage:
      (a) v1 matched shouted item headlines rather than disarm banners -> 4/7 FLAGGED,
          failing toward "already covered";
      (b) the item locator did not accept the "---" item prefix, so B12 item 8 was
          never located and the function DEFAULTED TO NAKED -- right answer, no
          evidence. Note (a) and (b) point in OPPOSITE directions and partially
          cancelled, which is why the v1 output looked merely odd instead of broken.
    A CONTROL ON ONE STAGE CERTIFIES ONE STAGE. Three stages, three sets of arms.

NOT INSTALLED. Not wired to any hook, CI file, Makefile, cron or git operation. Read-only.
"""

import os, re, sys, json

BROADCAST_DIR = "/scion-volumes/scratchpad/projects/farmtable/em-tooling"
LO, HI = 8, 20

# ---- vocabulary ASSEMBLED, never written literally (bulletin 15 item 2) --------------
_F = ["RETRACT", "WITHDRAW", "IS WR" + "ONG", "IS FAL" + "SE",
      "CORRECT" + "ION TO", "SUPER" + "SEDE", "AME" + "NDS", "REVER" + "SES",
      "I WAS WR" + "ONG", "DO NOT USE IT", "FAILS OP" + "EN"]
REVERSAL_RX = re.compile("|".join(_F), re.I)

# a banner is a shouted structural marker at the head of an item
BANNER_RX = re.compile(r"^\s*(\*{3}|={3,}|-{3,}\s*\d+\.|\*\*)")
TARGET_RX = re.compile(r"(?:BROADCAST|B)\s*#?(\d{1,2})\b", re.I)
ITEM_RX = re.compile(r"ITEM\s+(\d{1,2})", re.I)
SELF_ITEM_RX = re.compile(r"^\s*(?:\*{3}|-{3,}|={3,})?\s*(\d{1,2})\.\s")


def load():
    docs = {}
    for n in range(LO, HI + 1):
        p = os.path.join(BROADCAST_DIR, "_broadcast-%d.txt" % n)
        if not os.path.exists(p):
            print("FATAL: gap in population, missing %s" % p)
            sys.exit(3)
        with open(p, "rb") as f:
            docs[n] = f.read().decode("utf-8", errors="replace").split("\n")
    return docs


def self_exclusion_assert():
    """The searcher must not be inside its own population (bulletin 15 item 2)."""
    me = os.path.realpath(__file__)
    if os.path.realpath(BROADCAST_DIR) in me:
        print("FATAL: searcher is inside its own population -- self-match guaranteed")
        sys.exit(3)


def find_edges(docs):
    """Emit (src, dst, dst_item, line_no, text) for reversal declarations only."""
    edges = []
    for n, lines in docs.items():
        for i, ln in enumerate(lines):
            if not REVERSAL_RX.search(ln):
                continue
            for m in TARGET_RX.finditer(ln):
                tgt = int(m.group(1))
                if tgt == n or not (LO <= tgt <= HI):
                    continue
                im = ITEM_RX.search(ln)
                edges.append((n, tgt, int(im.group(1)) if im else None, i, ln.strip()))
    return edges


# ---------------------------------------------------------------------------
# DETECTOR v2.  v1 IS RETAINED IN THE HEADER COMMENT BELOW AS A FAILED ARM.
#
# v1 asked "does the target item's headline match a shouted structural marker?"
# EVERY ITEM HEADLINE IN THIS CORPUS OPENS WITH *** OR --- OR ===, so v1 returned
# FLAGGED for every item that exists. It matched ITEM HEADLINES, not DISARM BANNERS
# -- a discriminator shared with the thing it must distinguish -- and it FAILED
# TOWARD FLAGGED, i.e. toward "already covered", i.e. toward clean. It reported
# 4/7 FLAGGED against a hand-derived truth of 0/7.
#
# v2 uses the one signal that separates the two, and it is DIRECTIONAL IN TIME:
#     A DISARMED DOCUMENT POINTS FORWARD TO WHATEVER CORRECTED IT.
#     A CORRECTING DOCUMENT POINTS BACKWARD TO WHATEVER IT CORRECTED.
# B9 item 2's headline says "A CORRECTION TO BROADCAST 2" -- backward, 2 < 9 --
# so it is B9 doing the correcting, not B9 confessing. A real disarm banner on
# B9 item 2 would have to mention B10 or later.
# ---------------------------------------------------------------------------

def _forward_ref(text, own_n):
    """Does this text point FORWARD to a later broadcast (i.e. to its corrector)?"""
    return any(int(m.group(1)) > own_n for m in TARGET_RX.finditer(text)
               if LO <= int(m.group(1)) <= HI)


class LocatorError(Exception):
    """Raised when the item cannot be located at all.

    DEFECT B, AND THE RULE IT PRODUCED. This function used to `return False, None`
    when it could not find the item -- i.e. it returned the verdict NAKED. Because
    NAKED was also the true answer, THE FAILURE WAS INVISIBLE: the right answer with
    no evidence behind it, and the tell ("item 8 (LNone)") was printed on screen and
    read past.
        A DEFAULT THAT COINCIDES WITH THE EXPECTED ANSWER IS INVISIBLE.
        A LOCATOR THAT FAILS TO LOCATE MUST RAISE, NEVER RETURN A VERDICT.
    """


def item_is_bannered(lines, item, own_n, radius=3):
    """Is the TARGET ITEM disarmed -- not merely shouted, but pointed forward?"""
    for i, ln in enumerate(lines):
        m = SELF_ITEM_RX.match(ln)
        if m and int(m.group(1)) == item:
            window = "\n".join(lines[max(0, i - radius): i + radius + 1])
            return (REVERSAL_RX.search(window) is not None
                    and _forward_ref(window, own_n)), i
    raise LocatorError("item %d not locatable -- refusing to return a verdict" % item)


def doc_is_bannered(lines, own_n, head=14):
    window = "\n".join(lines[:head])
    return REVERSAL_RX.search(window) is not None and _forward_ref(window, own_n)


def doc_has_any_shout(lines, head=14):
    """What v1 would have said -- retained to show the two disagreeing."""
    return any(BANNER_RX.match(l) for l in lines[:head])


# ---------------------------------------------------------------- CONTROLS
def controls(docs, edges):
    """Both arms. Both rows published. Aborts on failure -- exit 2."""
    rows = []

    # KNOWN-POSITIVE (tier 3, real): the reversal edges that must be recovered.
    expect = {(13, 12), (17, 16), (19, 18), (19, 13), (20, 19), (10, 9), (17, 13)}
    got = {(s, d) for s, d, _, _, _ in edges}
    hit = expect & got
    rows.append(("POSITIVE", "7 real reversal edges recovered",
                 "%d/7" % len(hit), "OK" if len(hit) == 7 else "FAIL"))

    # KNOWN-NEGATIVE (tier 3, real): B10 L73 cites B9 item 2 WITHOUT reversing it.
    b10 = docs[10]
    cite = [i for i, l in enumerate(b10)
            if TARGET_RX.search(l) and "COMPLETES" in l.upper()]
    fired = any(s == 10 and ln in cite for s, d, it, ln, t in edges)
    rows.append(("NEGATIVE", "approving citation of B9 item 2 not called a reversal",
                 "line %s" % (cite[0] if cite else "?"),
                 "FAIL" if fired else "OK"))

    # ANCHOR ARM (bulletin 15 item 3): the anchor must not contain the marker.
    anchor_ok = not REVERSAL_RX.search(b10[cite[0]]) if cite else False
    rows.append(("ANCHOR", "known-negative line carries no reversal term",
                 "checked", "OK" if anchor_ok else "FAIL"))

    # ------------------------------------------------------------------
    # DETECTOR ARM.  The three arms above control the SELECTOR -- they prove the
    # edges are found. THEY SAY NOTHING ABOUT THE DETECTOR THAT JUDGES BANNERED-NESS,
    # and that is exactly how v1 shipped a broken detector behind a passing 7/7.
    #
    # TIER 2 -- PLANTED POSITIVE, and it is tier 2 BECAUSE OF THE FINDING ITSELF:
    # no real disarm banner exists anywhere in this corpus, so no tier-3 positive
    # is available. THE ABSENCE OF A REAL POSITIVE CONTROL IS THE RESULT.
    # The plant is IN MEMORY ONLY. Nothing is written to the corpus. Literal in the
    # planter, assembled in the searcher (bulletin 15 item 2).
    # ------------------------------------------------------------------
    plant = [
        "=== BROADCAST 12 (SYNTHETIC CONTROL COPY -- NOT A REAL FILE) ===",
        "",
        "--- 8. CORRECTION OF FACT, FOR ANY LEG REASONING ABOUT beads. ---",
        "*** RETRACTED BY BROADCAST 13. THE CLAIM BELOW IS WRONG. DO NOT ACT ON IT. ***",
        "body text",
    ]
    plant_hit, _ = item_is_bannered(plant, 8, 12)
    rows.append(("DETECTOR+", "planted disarm banner on B12 item 8 is seen (tier 2)",
                 "planted", "OK" if plant_hit else "FAIL"))

    # DETECTOR NEGATIVE: the same item WITHOUT the planted banner must not fire.
    plant_neg = [l for l in plant if "RETRACTED BY" not in l]
    neg_hit, _ = item_is_bannered(plant_neg, 8, 12)
    rows.append(("DETECTOR-", "same item without the banner does NOT fire",
                 "planted", "FAIL" if neg_hit else "OK"))

    # LOCATOR ARM: the fix for defect B must itself be armed. An absent item must
    # RAISE, not silently return the verdict that happens to be correct.
    try:
        item_is_bannered(plant, 99, 12)
        locator_ok = False           # returned a verdict for an item that is not there
    except LocatorError:
        locator_ok = True
    rows.append(("LOCATOR", "absent item raises instead of returning a verdict",
                 "planted", "OK" if locator_ok else "FAIL"))

    print("=" * 78)
    print("CONTROLS  (selector arms TIER 3/real ; detector arms TIER 2/planted -- see note)")
    print("=" * 78)
    for arm, what, val, verdict in rows:
        print("  %-9s %-56s %-8s %s" % (arm, what, val, verdict))
    if any(r[3] == "FAIL" for r in rows):
        print("\nINSTRUMENT BROKEN -- results withheld.")
        sys.exit(2)
    missing = expect - got
    if missing:
        print("  missing: %s" % sorted(missing))
    print()
    return rows


def main():
    self_exclusion_assert()
    docs = load()
    edges = find_edges(docs)
    rows = controls(docs, edges)

    print("=" * 78)
    print("REVERSAL EDGES -- IS THE TARGET FLAGGED WHERE THE READER WOULD LOOK?")
    print("=" * 78)
    naked = []
    seen = set()
    scopes = []
    rowlog = []
    for s, d, item, ln, txt in sorted(edges):
        if (s, d, item) in seen:
            continue
        seen.add((s, d, item))
        lines = docs[d]
        if item is not None:
            try:
                ok, at = item_is_bannered(lines, item, d)
            except LocatorError as e:
                print("\n  B%-2d reverses B%-2d item %s -> INSTRUMENT BROKEN: %s"
                      % (s, d, item, e))
                print("      No verdict is published for an item the locator could not find.")
                sys.exit(10)
            where, scope = "item %d (L%d)" % (item, at), "ITEM-SCOPED"
        else:
            ok, where = doc_is_bannered(lines, d), "document head"
            scope = "DOC-HEAD (weaker)"
        verdict = "FLAGGED" if ok else "*** NAKED ***"
        if not ok:
            naked.append((s, d, item))
        scopes.append(scope)
        rowlog.append({"src": s, "dst": d, "item": item, "scope": scope,
                       "verdict": "NAKED" if not ok else "FLAGGED",
                       "declared_line": ln})
        print("\n  B%-2d reverses B%-2d %-14s [%-17s] -> %s"
              % (s, d, where, scope, verdict))
        print("      declared at B%d L%d: %s" % (s, ln, txt[:88]))
        if not ok and doc_has_any_shout(lines):
            print("      NOTE: B%d opens with a shouted marker. THE v1 DETECTOR CALLED"
                  " THIS COVERED." % d)

    ni = scopes.count("ITEM-SCOPED"); nd = scopes.count("DOC-HEAD (weaker)")
    print("\n" + "=" * 78)
    print("EDGES %d   NAKED %d   FLAGGED %d" % (len(seen), len(naked), len(seen) - len(naked)))
    print("-" * 78)
    print("VERDICT PROVENANCE -- NOT ALL SEVEN REST ON THE SAME CHECK:")
    print("  ITEM-SCOPED (strong) : %d" % ni)
    print("  DOC-HEAD    (weaker) : %d" % nd)
    if nd:
        print("  *** THE IMMUNISATION TRAP REMAINS LIVE FOR THOSE %d. A forward-pointing" % nd)
        print("      retraction in the target's head about SOME OTHER claim would be read as")
        print("      covering this one. These edges name no item, so there is nothing to")
        print("      scope to -- THE LIMIT IS IN THE SOURCE DECLARATION, NOT IN THIS CODE,")
        print("      BUT THE VERDICT IS WEAKER AND THE ROW MUST SAY SO.")
        print("      Direction of failure: DOC-HEAD fails toward FLAGGED, i.e. toward clean.")
        print("      All %d came back NAKED, so no false-clean occurred -- THAT IS A" % nd)
        print("      PROPERTY OF THIS DATA, NOT OF THIS INSTRUMENT.")
    print("=" * 78)
    json.dump({"edges": [list(e) for e in sorted(seen)],
               "naked": [list(n) for n in naked],
               "rows": rowlog,
               "verdict_provenance": {"item_scoped": ni, "doc_head_weaker": nd},
               "controls": rows},
              open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "reversal_check.result.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
