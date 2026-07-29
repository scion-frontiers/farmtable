# ROLE BRIEF — audit-xss-r8 (SECURITY AUDIT)

Read `briefs/_r8-COMMON.md` in full first. It is apparatus and contains no targeting.
Your tree: **`/workspace/farmtable-audit-r8`**, already at `901670e`.
Your report: **`reports/audit-xss-r8.md`**. Your log: **`reports/audit-xss-r8-project-log.md`**.

## YOUR PASS

**COLD PASS FIRST, WRITTEN TO DISK, BEFORE YOU OPEN `briefs/_r8-PHASE-TWO.md` OR ANY PRIOR REPORT.**

This branch exists because of a stored-XSS class: attacker-controlled values reaching a render sink
in a Lit dashboard. Round 8 is a fix round on top of seven prior ones.

What I want, in order:

1. **Is the security property the round claims actually enforced, and by what?** Not "is there a
   guard" — **what goes RED when someone adds a new sink tomorrow?** A guard nothing runs is not a
   guard. This project has shipped that exact thing before and called it a fix.
2. **Severity with a reachability argument.** For every finding: is it LIVE, LATENT, or
   UNREACHABLE, and by what path from what untrusted input? **A CAPABILITY SINK IS NOT A RENDER
   SINK** — a value that gates a write authorization is dangerous in a way a render-sink search
   cannot find.
3. The web-side changes (`web/src/capabilities.ts`, `web/src/components/ft-app.ts`) and the
   server-side conversion changes (`convert.go`, `export_import.go`) are on the same axis. **CHECK
   THE SEAM BETWEEN THEM — it is nobody's assigned territory by construction.**
4. Anything you find that is LIVE IN PRODUCTION TODAY and not caused by this diff. Say so plainly and
   separate it from the round's scorecard; it does not get graded against this branch but I need it.

## POPULATIONS

If you enumerate a population of sinks, carriers, or consumers, **THE POPULATION IS OPEN UNTIL YOU
PROVE IT CLOSED.** A token search cannot find a reference-type alias write, and `\bRemoteData` cannot
match `SetRemoteData`. State your selector, state what it cannot see, and give the three integers:
**ENUMERATED = FLAGGED + EXCLUDED.**

## VERDICT

`APPROVE` / `APPROVE WITH CONDITIONS` / `REQUEST CHANGES`, at the top, findings numbered `F1..Fn`
with severity `CRITICAL/HIGH/MEDIUM/LOW/INFO`. **Separate your verdict from your support for it, and
pre-register what result would withdraw your own headline finding before you go looking.**
