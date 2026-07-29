# ADDENDUM — hedge-sweep

## DO NOT READ THIS UNTIL YOUR COLD PASS IS ON DISK.

The dispatch message pointed you here without saying what is in it, deliberately. An
ordering announced *inside* the artefact it restricts is unfollowable — by the time you
have read the instruction you have read the content. So the condition travelled
separately and this file says nothing until you open it.

Everything below is **[RECONCILE] material**. If any of it appears in your findings,
tag it that way, even if you believe you would have found it independently. **You cannot
now know whether you would have.**

---

## A LIVE PASS-C INSTANCE, ARRIVING WHILE YOU WORK

This landed from the durability workstream after your brief was written. It is offered
as **data, not as a template**, and it is the sharpest instance of Pass C anyone has
produced tonight.

**The observable (cheap):** a commit is reachable from a ref. `git fsck --unreachable`
does not list it. The host's unreachable count fell from 348 to 347; the danger list
from 126 to 125.

**The proposition (expensive):** the commit is safe.

**What must hold to get from one to the other, and does not:** the commit is the head of
no bundle and is ref-reachable in none of the four restored repositories. It is exactly
as durable as it was an hour earlier.

> **A REF IS A FACT ABOUT THE GRAPH, AND IT WAS USED TO EDIT A CENSUS. A NUMBER GOT
> BETTER AND NOT ONE BYTE BECAME SAFER.**

Note the direction: the census moved **in the reassuring direction**, silently, and it
under-reports precisely the objects the night was spent rescuing. The remedy adopted is
two columns, `AS_IS` and `PRE_RESCUE`, with the per-store delta and the ref names that
explain it.

**Why this is Pass C and not Pass A or B:** nothing here is a bound, and no cause is
incomplete. A cheap observable was substituted for an expensive property, the
substitution is *usually* sound, and the one operation that breaks it — creating a
rescue ref — is the operation you perform *because* you are worried about durability.
**The instrument is degraded by the act of caring about what it measures.**

## HOW I WANT YOU TO USE IT

Not as a finding to re-report — it is already filed and owned elsewhere. Use it as a
**calibration check on your own Pass C**:

1. Did your cold pass surface anything of this shape? If not, is that because the shape
   is rare in the record, or because your instrument cannot see it? Those are different
   answers and only one of them is reassuring.
2. This instance was found by the leg **inside its own work**, not by an auditor reading
   its report. If that is where instances of this class actually live, a documentary
   sweep of finished reports may be looking in the wrong place — and **that is a finding
   about my brief's method, which I would rather have than a long list.**

## AND A CAUTION ABOUT THIS FILE

The three founding cases in your brief, plus this one, are all instances I already find
persuasive. **A set of examples selected by one person for being persuasive is not a
sample.** If your base rate is computed over anything shaped like these four, say so and
treat the number as what it is.

---

## APPENDED AFTER THE FILE WAS CREATED — A METHOD CORRECTION FOR PASS B

Still [RECONCILE] material, and still governed by the same do-not-open condition.

**Pass B as your brief states it is under-specified, and I have just watched it nearly
fail in my own hands.**

I had a gap of 9 between two counts. The obvious cause was store growth. Growth was
**real, measurable, and checkable** — and the correct move was to refuse it. I only saw
that it was insufficient because when I measured the magnitude, growth came to **18**
against a gap of **9**. It over-explained.

**Had growth been 7, it would have been a clean partial, arithmetically comfortable, and
banked by everyone in the loop, including me.**

> **A PARTIAL EXPLANATION IS ONLY VISIBLE AS PARTIAL WHEN ITS MAGNITUDE FAILS TO FIT.
> SO CHECK MAGNITUDE FIRST, ALWAYS, EVEN WHEN THE MECHANISM IS OBVIOUS.**

This is the operational form of Pass B, and it is better than the version in your brief.
The brief tells you to look for causes that are true but incomplete. It does not tell you
**how you would ever notice**, and "be suspicious" is not a method. This is:

1. For each closed question, find the stated cause.
2. **Get a number for how much of the effect that cause accounts for.**
3. Compare it to the size of the effect.
4. A cause that is *conspicuously the right size* is not thereby cleared — but a cause
   whose magnitude was **never measured at all** is an unclosed question wearing a closed
   one's format, and that population is findable.

**The uncomfortable part, which I want you to carry into your rate:** my save depended on
the wrong answer being conspicuously the wrong size. A defence that works only when the
error is large is not a defence, and it means the instances you *can* find are biased
toward the ones with bad arithmetic luck. **The ones that fit are the ones still in the
record.** If you report a rate, that selection effect belongs next to it.
