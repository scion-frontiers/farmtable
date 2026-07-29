#!/usr/bin/env python3
"""
scope-check.py — CONVERSION OF A JUDGMENT RULE INTO A PROCEDURE.

THE JUDGMENT RULE (unrunnable, violated by me at 05:38Z, by the coordinator, and by
three legs tonight):
    "Do not restate a narrow result as a broad one."

THE PROCEDURE (runnable, ~20 seconds):
    BEFORE SENDING, SEARCH YOUR OWN MESSAGE FOR SCOPE WORDS, AND FOR EACH ONE NAME THE
    MEASUREMENT IT RESTS ON.

This script does the searching. IT CANNOT DO THE NAMING — that part is still judgment,
and the script's whole value is that it forces the judgment to happen at a specific
moment on a specific list, instead of relying on me to notice.

WHY THIS EXISTS. A procedural rule is obeyed because obeying it is an action. A judgment
rule is violated at exactly the moment it applies, because the moment it applies is the
moment the wrong thing looks like a summary, looks like agreement, looks like the obvious
reason. Every methodology rule we have that WORKED names a check you can run. Every one
that FAILED names a judgment you must make while writing.

USAGE
    python3 em-tooling/scope-check.py <file> [<file> ...]
    python3 em-tooling/scope-check.py --self-test

EXIT CODES
    0  no scope words found
    2  scope words found — READ THEM AND ANNOTATE BEFORE SENDING
    3  self-test FAILED (the instrument is broken; do not trust a clean run)

NOTE ON EXIT 2: it is NOT a failure and NOT a thing to suppress. Most hits will be fine.
The point is to make you look at each one once. Never wrap this in "|| true" — under zsh
a check whose success condition is "no match" is exactly the shape we keep disarming by
reflex.
"""

import re
import sys

# Words and phrases that widen a claim past whatever was actually measured.
# Grouped only for readable output; the groups carry no logic.
SCOPE_PATTERNS = [
    # --- universal quantifiers over a population ---
    (r"\b(?:in|across|throughout) th(?:is|e) (?:application|app|project|repo|repository|codebase|tree|system)\b",
     "population claim: names a whole artefact"),
    (r"\beverywhere\b", "universal"),
    (r"\bany(?:where|thing|one)\b", "universal"),
    (r"\bnothing\b", "universal negative"),
    (r"\bnobody\b", "universal negative"),
    (r"\bnever\b", "universal over time"),
    (r"\balways\b", "universal over time"),
    (r"\ball (?:of )?(?:the )?\w+", "universal over a set"),
    (r"\bevery\b", "universal over a set"),
    (r"\bno \w+ (?:exists?|is|are|can|has|have|reads?|writes?|calls?)\b",
     "existential negative: THE strongest shape and the least often measured"),
    (r"\bzero\b", "counted claim"),
    (r"\bnone\b", "universal negative"),
    (r"\bthe only\b", "uniqueness claim"),
    (r"\bonly (?:one|consumer|caller|path|sink|place|site)\b", "uniqueness claim"),
    (r"\bexhaustive(?:ly)?\b", "closure claim"),
    (r"\bcomplete(?:ly)?\b", "closure claim"),
    (r"\bentire\b", "closure claim"),
    (r"\bwhole\b", "closure claim"),

    # --- modal overreach: cannot/impossible are claims about ALL futures ---
    (r"\bcannot\b", "impossibility: quantifies over all executions"),
    (r"\bcan't\b", "impossibility"),
    (r"\bimpossible\b", "impossibility"),
    (r"\bunreachable\b", "reachability claim"),
    (r"\bguarantee(?:s|d)?\b", "guarantee"),
    (r"\bproven?\b", "proof claim"),
    (r"\bcertain(?:ly)?\b", "confidence"),

    # --- tense laundering: a point-in-time measurement stated as a standing property ---
    (r"\bis (?:not )?(?:safe|correct|covered|pinned|tested|validated|sanitiz|clean)\w*\b",
     "standing property from a point-in-time check"),
    (r"\bhas no\b", "existential negative"),
    (r"\bthere (?:is|are) no\b", "existential negative"),
]

# Hedges. Their PRESENCE is good. Their ABSENCE next to a scope word is the smell.
#
# CAUTION, AND THE SELF-TEST FOUND THIS THE FIRST TIME IT RAN. A hedge must bound a
# POPULATION or a TIME. A CONFIDENCE LABEL IS NOT A HEDGE. My first draft listed
# "measured", "derived", "proven" and "known" here — and the positive control, which is
# my own real defect, is the sentence:
#
#     "MEASURED: remote_data HAS NO RENDER SINK IN THIS APPLICATION."
#
# The word MEASURED is right there, in capitals, leading the sentence, and the claim is
# still unbounded. Scoring that as hedged would have made the instrument inert against
# the exact defect it exists to catch — a guard disarmed by the label of the thing it
# guards. That is the same shape as everything else in this ledger: a statement that a
# concern was handled, standing in for handling it.
#
# So: bounds only. Nothing that merely asserts how sure the writer is.
HEDGE_PATTERNS = [
    r"\bat (?:these|this) commit", r"\bas of\b",
    r"\bin the \w+ (?:tree|package|dashboard|client|module)\b",
    r"\bnot (?:independently )?(?:checked|measured|verified|searched)\b",
    r"\bI did not\b", r"\bI have not\b", r"\bso far\b",
    r"\bthe population\b", r"\bwithin \w+\b", r"\bbounded (?:to|by)\b",
    r"\bother \w+ (?:were|was) not\b", r"\bonly the \w+ (?:was|were) (?:searched|checked)\b",
]


# Sentence boundaries, not line boundaries.
#
# SECOND DEFECT FOUND BY THE POSITIVE CONTROL. My first draft took the surrounding LINE
# as the context a hedge could live in. But the defect being tested for is precisely:
#
#     "MEASURED: remote_data HAS NO RENDER SINK IN THIS APPLICATION. Nothing in the
#      Lit dashboard reads it."
#
# — a bounded claim and an unbounded restatement of it, SIDE BY SIDE. The coordinator's
# words were "TWO DIFFERENT CLAIMS ONE LINE APART." At line granularity the bounded
# second sentence hedges the unbounded first one, and the checker scores my own worst
# sentence of the night as clean.
#
# A hedge only counts INSIDE THE SENTENCE MAKING THE CLAIM. An adjacent correct sentence
# is not a bound; it is the thing that makes the overreach look supported. Scoring
# adjacency as hedging would build the defect into the instrument.
_SENT_SPLIT = re.compile(r"(?<=[.!?;:])\s+|\n")


def _sentence_at(text, pos):
    start = 0
    for m in _SENT_SPLIT.finditer(text):
        if m.end() > pos:
            break
        start = m.end()
    end = len(text)
    for m in _SENT_SPLIT.finditer(text, pos):
        end = m.start()
        break
    return text[start:end].strip()


def scan(text):
    hits = []
    for pat, why in SCOPE_PATTERNS:
        for m in re.finditer(pat, text, re.IGNORECASE):
            line_no = text.count("\n", 0, m.start()) + 1
            hits.append({
                "word": m.group(0), "why": why, "line": line_no,
                "context": _sentence_at(text, m.start()),
            })
    # dedupe by (line, word) so overlapping patterns don't triple-report
    seen, out = set(), []
    for h in sorted(hits, key=lambda h: (h["line"], h["word"].lower())):
        key = (h["line"], h["word"].lower())
        if key not in seen:
            seen.add(key)
            out.append(h)
    return out


def hedged(context):
    return any(re.search(p, context, re.IGNORECASE) for p in HEDGE_PATTERNS)


# MEASURED BASE RATE OF THE HEDGE DETECTOR, over every dispatch message I have sent
# tonight: 7 hedged out of 1124 hits across 78 files. 0.6%.
#
# THAT MAKES THE HEDGE HALF OF THIS INSTRUMENT EFFECTIVELY INERT, and I am recording it
# here rather than quietly tuning it, because the failure is instructive and it is mine.
#
# My first version printed "UNHEDGED" against each hit and then a summary line reading
# "17 of 18 sit on a line with no hedge." That LOOKS like a measurement. It is not. When
# a classifier returns the same answer 99.4% of the time, its output carries almost no
# information, and "17 of 18 unhedged" is just "18 hits" restated in a form that sounds
# like analysis. I built a discriminator that does not discriminate and then reported its
# constant output as a finding — inside a tool written to catch exactly that move, on the
# same night I charged three separate artefacts with it.
#
# So the per-hit UNHEDGED flag is GONE. It was noise wearing the costume of a signal.
# What survives is the part that actually works: the LIST. The list is the deliverable.
HEDGE_BASE_RATE = "7/1124 = 0.6% over 78 dispatch messages, measured 2026-07-29"


def report(path, text):
    hits = scan(text)
    if not hits:
        print("  %s: no scope words matched." % path)
        print("  NOT A CLEAN BILL. The pattern list is open, not closed — an unmatched")
        print("  overreach is indistinguishable from no overreach at this exit code.")
        return 0
    print("  %s: %d scope word(s)." % (path, len(hits)))
    print("  FOR EACH ONE, NAME THE MEASUREMENT IT RESTS ON, OR NARROW THE SENTENCE.\n")
    for h in hits:
        print("    line %-4d  %-22s  [%s]" % (h["line"], h["word"], h["why"]))
        ctx = h["context"]
        print("              %s" % (ctx[:150] + ("..." if len(ctx) > 150 else "")))
    print("\n  %d hits. No hedge classification is offered: the hedge detector was" % len(hits))
    print("  measured INERT (%s) and its verdict was" % HEDGE_BASE_RATE)
    print("  removed rather than reported. Judge each line yourself — that is the job")
    print("  this tool exists to schedule, not to perform.")
    return 2


# --------------------------------------------------------------------------
# SELF-TEST. A guard that has never been shown capable of reporting a violation
# is not evidence of anything. The positive control is MY OWN REAL DEFECT, taken
# verbatim from the escalation I sent the coordinator at 05:38Z.
# --------------------------------------------------------------------------
POSITIVE_CONTROL = (
    "MEASURED: remote_data HAS NO RENDER SINK IN THIS APPLICATION. Nothing in the "
    "Lit dashboard reads it."
)
NEGATIVE_CONTROL = (
    "At these commits, a search of the Lit dashboard sources found no reference to "
    "remote_data. I did not search other clients."
)


def self_test():
    ok = True

    pos = scan(POSITIVE_CONTROL)
    words = {h["word"].lower() for h in pos}
    # It must catch the exact sentence that got past me, the coordinator, and three legs.
    need = ["in this application", "has no", "nothing"]
    for n in need:
        if not any(n in w for w in words):
            print("SELF-TEST FAIL: positive control missed %r" % n)
            ok = False
    if pos and all(hedged(h["context"]) for h in pos):
        print("SELF-TEST FAIL: positive control was scored as hedged; it is not.")
        ok = False

    neg = scan(NEGATIVE_CONTROL)
    if neg and any(not hedged(h["context"]) for h in neg):
        # The negative control names its population and its gap; hits are fine,
        # but they must all read as hedged, or the hedge detector is inert.
        print("SELF-TEST FAIL: negative control produced an UNHEDGED hit — hedge detector inert.")
        for h in neg:
            if not hedged(h["context"]):
                print("   %r in %r" % (h["word"], h["context"]))
        ok = False

    if ok:
        print("SELF-TEST PASS.")
        print("  positive control (my real 05:38Z defect): %d hit(s), correctly unhedged" % len(pos))
        print("  negative control (the same claim, bounded): %d hit(s), all hedged" % len(neg))
        print("  The instrument has been SHOWN to go red. A clean run means something.")
        return 0
    print("SELF-TEST FAILED — do not trust a clean run from this script.")
    return 3


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    if argv[0] == "--self-test":
        return self_test()
    worst = 0
    for path in argv:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            worst = max(worst, report(path, fh.read()))
        print()
    if worst == 2:
        print("EXIT 2: hits found. This is NOT a failure and NOT to be suppressed.")
        print("Read each one once. Most will be fine. Never wrap this in '|| true'.")
    return worst


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
