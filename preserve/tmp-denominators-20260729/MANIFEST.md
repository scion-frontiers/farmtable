# DENOMINATORS AND CONTROLS — copied under coordinator authorisation (a)

Directory name carries a DATE ONLY and deliberately no time: every hand-typed timestamp checked
tonight was wrong, four out of four, and the error grew with distance from the event.
Filesystem times on the files themselves are authoritative; `cp -p` preserved them.

20 files. 18 from the authorised enumeration + 2 zero-byte operands added on discovery (disclosed).
All 20 sha256-verified on both sides. Verifier negative control armed before any match was accepted
(tampered copy -> MISMATCH, restored copy -> match). Publication scan: 0 credential-shaped strings,
positive control fired (tier 1 — fabricated; tier 3 is self-defeating for a secret-in-corpus check).

## WHY THESE EXIST: results were preserved earlier tonight, denominators were not.

| file | what it is |
|---|---|
| `dirs.txt` | **the 234-line host list.** Its filtered twin `dirs2.txt` (233) is what every "N of 233" was published against. This is the evidence for the §28.7 correction. |
| `relo233.txt` | the OTHER side of a set comparison whose near side (`mine233.txt`) was already preserved. A preserved half is uncheckable as a comparison. |
| `setA.txt` `setB.txt` `setB2.txt` `onlyA.txt` `onlyB.txt` | the void comparison — see below. |
| `setA-canary.txt` `setAc.txt` | control files. `setA` vs `setA-canary` differ by exactly 1 line, so the canary is armed. |
| `setC.txt` `setD.txt` | byte-identical; recorded as such, not merged. |
| `unr-nobundle.txt` `unr-nowhere.txt` | two different predicates, independent runs 3m37s apart, different inodes, byte-identical output. Genuine agreement — but reporting both as corroboration would double-count one fact. |
| `unre-farmtable.txt` `unre-farmtable-em-verify195.txt` `births.txt` `births2.txt` `t1-check.txt` | inputs to published figures. |
| `credhits.txt` `preserve-credhits.txt` | credential-scan results. Re-scanned on copy: 0 token-shaped strings. |

## THE DEFECT THESE FILES DOCUMENT

    setA.txt    122 lines   mtime 10:03:04.815
    setB.txt      0 lines   mtime 10:03:05.139   <-- EMPTY
    onlyA.txt   122 lines   mtime 10:03:05.144   <-- A minus B, computed 5ms after B was written empty
    onlyB.txt     0 lines   mtime 10:03:05.144
    setB2.txt   122 lines   mtime 10:03:33.054   <-- B re-derived 28s later, IDENTICAL to setA

The 10:03:05 comparison ran against an empty second operand. `A \ B` with B empty returns all of A,
which is exactly what `onlyA.txt` contains. Recomputing from the surviving operands:
`comm -23 setA setB2` = **0 lines**.

  *** THE VOID RUN SAID "ALL 122 ARE ONLY IN A" (MAXIMALLY DIFFERENT). THE CORRECTED RUN SAYS THE
      TWO SETS ARE IDENTICAL (MAXIMALLY SAME). THE SAME COMPARISON, TWENTY-EIGHT SECONDS APART,
      RETURNING OPPOSITE ENDS OF ITS OWN RANGE, AND NEITHER RUN RAISED ANYTHING. ***

  *** AND THE ARTEFACT THAT PROVES IT IS ZERO BYTES. A PRESERVATION POLICY ORDERED BY SIZE OR BY
      INTEREST DISCARDS THE EMPTY OPERAND FIRST — IT WAS IN NEITHER THE AUTHORISED LIST NOR THE
      DECLINED ONE, BECAUSE NOTHING ABOUT IT LOOKS LIKE EVIDENCE. AN EMPTY OPERAND, A MISSING
      OPERAND AND A CLEAN RESULT ARE THE SAME INTEGER. ***

STATUS: the defect is established. WHICH PUBLISHED FIGURE (if any) RESTS ON THE 10:03:05 RUN RATHER
THAN THE 10:03:33 RE-DERIVATION IS **NOT YET DETERMINED** and is the open question.
