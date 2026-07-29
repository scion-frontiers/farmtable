# Brief: Engineering Manager — Feature 58: Restore Combined Pan+Zoom Animation (Regression from PR #133)

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f58 -b fix/f58-combined-pan-zoom-animation
  origin/main` (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.
- **This is a regression from Feature 56 (PR #133)** — it claimed to combine zoom+pan into
  one animation, but ptone@google.com reports the previously-working animated PAN (from
  Feature 41, PR #113) is now gone/broken; only zoom appears to be happening, or the
  transition is no longer smooth. Read both PRs' diffs before touching anything.
- **Evidence requirement is stricter than usual because this exact gap already slipped
  through once**: Feature 56's own screenshots were before/after ENDPOINTS only (start
  state, end state), which is NOT sufficient to prove a smooth animated transition actually
  happens in between — that's exactly how this regression got merged undetected. This time,
  capture a MID-ANIMATION FRAME SEQUENCE (like Feature 41's original verification did — at
  least 4-5 screenshots at fixed intervals across the ~750ms transition window) showing the
  canvas progressively panning AND zooming together, not just jumping between two static
  states.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`. Instruct
  the reviewer specifically to check that the mid-animation frame sequence evidence is
  present and genuinely shows progressive change (not static/duplicate frames), since
  that's the exact failure mode from last time.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands, but given the history here, be
  unusually rigorous with yourself.

## Feature Spec (ptone@google.com, verbatim)

"https://github.com/scion-frontiers/farmtable/pull/133 added 2 things we wanted, but
removed the animated pan of the canvas that had been working great - we want to combine the
animation as a zoom and pan together as a single animated transition (use previous timing
and ease-in, ease-out that was introduced in https://github.com/scion-frontiers/farmtable/
pull/113)"

Concretely:
1. **Investigate exactly what broke**: PR #113 (Feature 41) introduced a 750ms ease-in-out
   animated pan-to-center using `requestAnimationFrame` interpolation of SVG viewBox
   pan (panX/panY). PR #133 (Feature 56) added zoom-to-target-size (~20% of viewport width)
   ALSO via the same selection-triggered animation path, per its own log claiming "animate
   zoom AND pan together... Focal-point centering recomputes pan each animation frame."
   Something in that implementation either (a) broke the pan interpolation while zoom still
   works, (b) reintroduced an instant/non-animated jump for one or both properties, or (c)
   changed the easing/timing away from the original 750ms ease-in-out. Find the exact
   regression — diff PR #113's original animation code against what PR #133 changed it to.
2. **Fix**: restore a single combined animated transition — pan AND zoom interpolated
   together across the SAME 750ms ease-in-out timing function from PR #113 (don't
   reinvent the easing — reuse or match it exactly), so the canvas smoothly pans to center
   the selected node WHILE zooming to the ~20% target size, arriving at both targets
   together when the animation completes.
3. Apply to both tree views (parent-child Tree view and Dependency view), consistent with
   both Features 41 and 56's scope.

## Key Locations

- Repo: base off current `main` (through Feature 57) — fresh feature branch, PR to merge.
- Frontend: `web/src/` — the animation code touched by both PR #113 (`gh pr diff 113`) and
  PR #133 (`gh pr diff 133` — note: GitHub's GraphQL API may be rate-limited, prefer `gh
  api repos/scion-frontiers/farmtable/pulls/113/files` and `.../133/files` REST endpoints
  if `gh pr diff` fails).
- Prior feature logs:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-41-tree-center-animation.md`,
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-56-zoom-and-highlight.md`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-58-combined-pan-zoom.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real evidence: a mid-animation frame sequence (4-5+ screenshots across the ~750ms
   transition) on BOTH tree views, showing progressive pan+zoom together, not just
   before/after endpoints. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-58-combined-pan-zoom/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-58-combined-pan-zoom.md`
   documenting exactly what broke in PR #133 and how you fixed it.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence per
the spec above (mid-animation frame sequence required), and message the coordinator. Then
signal task_completed.
