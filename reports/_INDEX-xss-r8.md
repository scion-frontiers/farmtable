# INDEX - xss-r8 round reports

WHY THIS FILE EXISTS: the round's four leg reports are SPLIT across two directories. A glob such
as `reports/*xss-r8*.md` returns THREE OF FOUR, MISSES THE FIX LEG ENTIRELY, and emits no error -
it just returns a quietly short list. That silent undercount is the failure mode this file
prevents. Read this file, do not glob.

MEASURED 2026-07-29 12:50Z.

## The four leg reports

| leg           | role      | path                            |
|---------------|-----------|---------------------------------|
| dev-xss-r8    | fix       | reports/r8/dev-xss-r8.md        |
| review-xss-r8 | code      | reports/review-xss-r8.md        |
| test-xss-r8   | test      | reports/test-xss-r8.md          |
| audit-xss-r8  | security  | reports/audit-xss-r8.md         |

Project logs, all flat: review-xss-r8-project-log.md, test-xss-r8-project-log.md,
audit-xss-r8-project-log.md. dev-xss-r8's log is IN-TREE, not here (commit 7621dc8).

## Follow-on work commissioned from this round

| leg         | scope                                                              | report                    |
|-------------|--------------------------------------------------------------------|---------------------------|
| ts-diff-r8  | R-2b TypeScript differential; clean-checkout Go build; flake re-run | reports/ts-diff-r8.md     |

## Disposition of the layout conflict

_ADJUDICATION-xss-r7.md directs r8 legs to reports/r8/. The dispatches and role briefs named the
flat path. Three legs followed their dispatch; the fix leg used r8/.

RULED: FLAT STANDS FOR THIS ROUND. Nothing is moved, copied, or re-filed. A file existing in two
places is worse than a file in the less-preferred place.

THE PREMISE OF THAT RULING WAS FALSE AND IS RETRACTED. I wrote "every reference anyone has
written today points at the flat path." audit-xss-r8 measured that this is not so: the split was
already live, and reports/r8/dev-xss-r8.md was written at 12:45Z, one minute after the ruling.
The ruling is retained on the churn argument alone, which is the only leg it ever had.

THE LAYOUT QUESTION IS OPEN, NOT SETTLED, and reports/r8/_WHY-THIS-DIRECTORY-EXISTS.md has the
better of the argument on the merits: it cites two measured contamination instances, and a third
occurred today when a leg checking this very conflict necessarily learned its peers' report
filenames by listing the flat directory. Decide the layout BEFORE the next round opens, not
during it.
