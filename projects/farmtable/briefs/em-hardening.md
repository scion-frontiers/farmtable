# EM BRIEF: HARDENING

## OPERATING MODE - READ FIRST
The owner has told us we are long-winded and unfocused. Reports are: STATUS /
BLOCKER / NEXT ACTION. No essays, no bulletins, no lesson corpora. Under 20
lines. Ship fixes.

## YOUR TRACK
You own the application-layer security defects and nothing else. You spawn your
own devs and reviewers and run the cycle yourself. Do not route through the
coordinator.

## PRIORITY CONTEXT FROM THE OWNER, VERBATIM
"iap is in front of everything. we will still want to fix app layer auth on
these endpoints. but there is not the same urgency"
So: real work, not an emergency. You run behind the CI track. If CI is red,
your fixes cannot be verified, so coordinate with the CI EM rather than racing.

## THE WORK
1. UNRECOGNISED USER TYPE. The owner's words: "any unrecognized type is a
   pretty severe bug. these can be suddenly blocked." An unrecognised type must
   be rejected, not silently allowed or silently dropped. Branch
   scopedeny-93-deny-unrecognised-type exists and is 47 commits ahead of main;
   assess whether to land it or redo it.
2. XSS via URL scheme validation. Two forked branches exist:
   url-scheme-validation-r8 (69 ahead) and a rescued r9 at
   refs/preserve/xss-r9/url-scheme-validation-r9. They diverge on exactly one
   shared file, a project-log markdown file. RULING ALREADY MADE: union the log
   content, never take a side. Land one coherent fix.
3. UNAUTHENTICATED TOKEN-WRITE ENDPOINT. Reported but NEVER VERIFIED. Verify it
   exists before fixing it. If it does not exist, say so and close it.

## KEY LOCATIONS
- repo: /workspace/farmtable  (web/dist is BUILT here and MUST NOT be deleted)
- design: .design/ in the repo

## CONSTRAINTS THAT STILL BIND
- Never stage with a directory or glob pathspec anywhere. Name every file.
  git add -A, git add ., git add -u, git commit -a and git stash -u are
  forbidden project-wide. Hard rule.
- Never print, log, commit or echo a credential value; never run a bare git
  remote listing.
- Do not delete /workspace/farmtable/web/dist; do not build a frontend
  elsewhere.
- Do not delete other agents without coordinator sign-off.
- Clone leg trees from the local path, never from the network remote.

## DELIVERABLES
1. The three items fixed, reviewed and merged, or explicitly closed with a
   reason.
2. /scion-volumes/scratchpad/projects/farmtable/status-hardening.md, under one
   page, three items, done or not done.

## DIRECT CONTACT
Owner: ptone, discord thread 1532019078519193641, only for decisions he alone
can make.

You MUST resolve all three items and write status-hardening.md, then mark the
task complete.
