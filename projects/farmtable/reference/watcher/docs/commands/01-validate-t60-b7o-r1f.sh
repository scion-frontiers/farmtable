#!/usr/bin/env bash
# Run ON THE MAC HOST, from the watcher repo root:
#   bash docs/commands/01-validate-t60-b7o-r1f.sh
#
# WHY THIS IS A SCRIPT (not run directly by the agent):
# Container agents can't write bd (BEADS_DOLT_AUTO_START=false; the Mac host owns
# the single Dolt write lock). This drops the bd writes for the host to run.
# See /workspace/kb/container-living.md §2.
#
# WHAT THIS DOES:
# Applies the results of a code-validation pass over epics watcher-t60 (P0),
# watcher-b7o (P1) and watcher-r1f (P2/P3). Each issue was checked against the
# actual source. This script:
#   - appends validation findings as comments (audit trail),
#   - enhances descriptions where an implementer needs more detail,
#   - reprioritizes / deprecates issues whose premise was already mitigated.
#
# Safe to re-run: comment adds may duplicate; the priority/description updates are
# idempotent. Each line has `|| true` so one failure doesn't abort the rest.
set -u
test -d .beads || { echo "Run from the watcher repo root on the Mac."; exit 1; }

ACTOR="validation-agent"

# bd comment syntax is:  bd comment <id> "text"   (NOT `bd comment add <id>`).
# `bd comments add <id> "text"` (plural) also works; we use the singular form.

echo "==> t60 (Phase 1: Critical Security & Integrity Blockers) — CONFIRMED epic"

# ── t60.1 SEC-01 (RCE) — CONFIRMED, keep P0 ────────────────────────────────────
bd comment watcher-t60.1 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED, keep P0). planner_service.dart:92-132 executeScript writes LLM bash to .beads/temp_plan.sh and runs it via Process.run('bash', ['.beads/temp_plan.sh']) at lines 117-122. Line refs exact. Caller chain: PlannerModal._executePlan -> PlannerService.executeScript. NOTE the sibling generator startGenerateAutoFixScript (planner_service.dart:200-247) produces a SECOND bash block (bd update commands) that flows to the same executeScript sink — the fix must cover BOTH plan-create and auto-fix paths. Recommended fix stands: parse bd commands in Dart and invoke Process.run(bdExecutable, [...]) with no shell." || true

# ── t60.2 SEC-02 (AppleScript injection) — REPRIORITIZE P0 -> P2 ────────────────
# Exploit path already closed upstream by effectiveTmuxSessionName sanitizer.
bd comment watcher-t60.2 --actor "$ACTOR" \
  "VALIDATED (PARTIALLY CONFIRMED — reprioritizing P0->P2). The raw interpolation in tmux_service.dart (Ghostty:192, iTerm2:231, Terminal:242) is real, BUT every caller passes project.effectiveTmuxSessionName, which sanitizes to [a-zA-Z0-9_-] via replaceAll(RegExp(r'[^a-zA-Z0-9_-]'),'_') at project_repository.dart:21-27 (custom names sanitized identically to derived — comment there explicitly notes it closes the injection gap). All call sites verified: planner_modal.dart:47, assessment_modal.dart:39/90, app_state.dart:723. No caller passes an unsanitized name, so the P0 RCE vector is already mitigated by defense-in-depth. Still worth doing as hardening: TmuxService is a public API that trusts its caller; escape quotes/backslashes (or use osascript arg passing) so it is safe independent of the upstream sanitizer. Downgrading from P0 (not a release blocker) to P2 (defense-in-depth hardening)." || true
bd update watcher-t60.2 --priority 2 --actor "$ACTOR" || true

# ── t60.3 SEC-03 (flag + env injection in Go daemon) — CONFIRMED, keep P0 ───────
bd comment watcher-t60.3 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED, keep P0). Flag injection: handleGetComments (main.go:196 'bd comments <ID> --json') and handleAddComment (main.go:230 'bd comments add <ID> <Comment>') pass positionals with no '--' terminator. Env injection: handleAddComment formats BD_ACTOR=%s from params.Actor (main.go:232-235); Go exec env is []string so a newline in Actor injects a separate KEY=VALUE (LD_PRELOAD/PATH). ENHANCEMENTS for implementer: (1) params.Comment (main.go:230) is ALSO an unterminated positional — a comment starting with '-' is a flag-injection vector too, put '--' before ALL user positionals. (2) Lesser vector: handleAddPeer URL/Name -> AddRemote. (3) Framing: exec.Command does NOT use a shell, so this is argv/env injection, not shell-metachar RCE — but env injection (LD_PRELOAD) still yields code exec, so P0 is correct. Fix: strip \\n and \\0 from Actor; add '--' before positional IDs/comment." || true

# ── t60.4 RACE-01 (daemon init race) — CONFIRMED, keep P0 ───────────────────────
bd comment watcher-t60.4 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED, keep P0). beads_service.dart:37-45 uses a _isInitializing bool + Future.delayed(100ms) recursion (lines 40-44) instead of a shared future. Refs exact. Precise failure mode: a caller entering while _isInitializing==true returns after 100ms WITHOUT guaranteeing _daemonProcess is set, and a timeout-triggered retry can re-enter and double-spawn -> Dolt 'noms LOCK' contention. Completer<void>? _initCompleter fix is correct. Partial existing mitigation: the daemon runs 'bd dolt killall' on boot (main.go:461-467), which reduces but does not eliminate the double-spawn window. Also verify dispose() (line 383) nulls _initCompleter." || true

# ── t60.5 RACE-02 (refresh re-entrancy) — CONFIRMED, keep P0; refine the fix ─────
bd comment watcher-t60.5 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED, keep P0) — but refine the proposed fix. app_state.dart:663-688: isRefreshing exists (line 667) but is only a UI spinner flag, NOT a re-entrancy guard (no early return). Confirmed concurrent sources: file-watcher debounce (watcher_coordinator wired at app_state.dart:87), heartbeat timer, sync timer, and UI actions (app_state.dart:100,539,554,655,696,708). WARNING: the naive 'if (isRefreshing) return;' fix DROPS a refresh requested mid-flight — a file-watcher event during an in-flight refresh would be lost (stale UI). Use trailing-edge coalescing instead: if a refresh is requested while one runs, set _refreshQueued=true and re-run ONCE in the finally block. This guards re-entrancy without losing the latest change." || true

echo "==> b7o (Phase 2: High Reliability & Accessibility Polish) — CONFIRMED epic"

# ── b7o.1 REL-01 — CONFIRMED (partial): updateIssue already surfaces errors ─────
bd comment watcher-b7o.1 --actor "$ACTOR" \
  "VALIDATED (PARTIALLY CONFIRMED). All fire-and-forget sites real (line drift): home_screen.dart:196 (removeProject), issue_inspector.dart:59,66,379,417, kanban_column.dart:27, tree_node.dart:112. IMPORTANT NUANCE: AppState.updateIssue (app_state.dart:573-616) ALREADY has try/catch that writes projectErrors + notifyListeners on failure (sidebar error triangle via home_screen.dart:140), so updateIssue failures are NOT fully silent today. The genuinely unhandled path is AppState.removeProject (app_state.dart:367-389) — NO try/catch. Scope this issue to: (a) add try/catch to removeProject, (b) add per-action user feedback (await + showMacosAlertDialog) at the widget call sites, since AppState-level projectErrors is coarse." || true

# ── b7o.2 REL-02 — CONFIRMED ────────────────────────────────────────────────────
bd comment watcher-b7o.2 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED). beads_service.dart:168-176 onTimeout only removes the pending id and throws; _daemonProcess is never killed/restarted, and _ensureDaemonRunning early-returns when _daemonProcess!=null (line 39), so a deadlocked-but-alive daemon is reused forever. No consecutive-timeout tracking anywhere; only kill() is in dispose() (line 385). Implementer note: the existing exitCode.then handler (lines 120-137) already nulls _daemonProcess and errors pending requests on exit, so a force-kill after N consecutive timeouts will cleanly trigger respawn on the next call — reuse that path." || true

# ── b7o.3 A11Y-01 — CONFIRMED with corrected refs ───────────────────────────────
bd comment watcher-b7o.3 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED, refs corrected). Zero Semantics() usages exist anywhere in lib/. Real interactive targets lacking semantics: issue_inspector.dart:244 (_buildAddDependencyButton), :323 (_buildIssueLink); tree_node.dart:165 & :177 (the two selectIssue GestureDetectors — NOT :219, which is the row content); project_dashboard.dart ReadinessStatCard._buildSection:702 (used ~740/749 for Ready/Blocked — the cited :720 lands near this). CORRECTION: project_dashboard.dart:167 and :267 are NOT interactive (a count computation and a banner border) — drop those two refs. ADD un-cited target: command_palette.dart:335 (selectIssue). Fix: wrap each in Semantics(button:true,label:...)." || true

# ── b7o.4 A11Y-02 — CONFIRMED (partial framing) ─────────────────────────────────
bd comment watcher-b7o.4 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED). Zero FocusScope/FocusTraversalGroup usages in lib/. Weakest case is command_palette.dart:177-213 (showGeneralDialog + manual Focus onKeyEvent that handles arrows/enter/escape but NOT Tab). The other three (create_issue_modal, settings_modal, planner_modal) use showMacosSheet, which gives a route-level mouse barrier but still no Tab trap. Framing fix: 'custom overlay' applies only to command_palette; the sheets are framework modals lacking Tab trapping. Wrap contents in FocusTraversalGroup + FocusScope and restore focus on dismiss." || true

# ── b7o.5 SEC-04 — CONFIRMED ────────────────────────────────────────────────────
bd comment watcher-b7o.5 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED). No systemTemp/createTemp/Random usage in lib/. Predictable workspace paths written with default (0644) perms: planner_service.dart:35 (ai_prompt.txt), :39 (ai_done), :40 (ai_out.md), :108 (temp_plan.sh), :172, :223. Highest risk is temp_plan.sh — a pre-planted symlink at that path is followed on write and its contents are bash-executed (interacts with SEC-01/t60.1). Implementer note: Process.run at planner_service.dart:117-122 hardcodes the RELATIVE path '.beads/temp_plan.sh', so any move to Directory.systemTemp must update the exec path too. Prefer stdin piping (removes the temp file entirely)." || true

# ── b7o.6 SEC-05 — DEPRECATE (no secrets actually stored) ────────────────────────
bd comment watcher-b7o.6 --actor "$ACTOR" \
  "VALIDATED (DEPRECATING). Premise does not hold: nothing sensitive is stored in SharedPreferences. GcpProjectId (settings_repository.dart:315) is a non-secret project IDENTIFIER. GenerativeModelConfig (settings_repository.dart:14-41) contains only id/displayName/identifier(model name)/region — NO api keys or credentials. Auth uses FirebaseAI.vertexAI (generative_ai_service.dart:40) via Firebase/ADC tokens managed by the SDK, not stored here. The only API key in the repo is the Firebase client key hardcoded in firebase_options.dart:56, which is normal/non-secret for Firebase client apps (guarded by Firebase security rules, not by secrecy) and would NOT go in Keychain. Net: there is no sensitive credential to migrate; flutter_secure_storage adds dependency + native keychain entitlement complexity for no security gain. Recommend CLOSE as won't-fix. If desired, keep a P4 note to revisit ONLY if a real user-supplied secret (e.g. a raw API key input) is ever added." || true
bd update watcher-b7o.6 --priority 4 --actor "$ACTOR" || true
bd close watcher-b7o.6 --reason "Deprecated after validation: no sensitive credentials are stored in SharedPreferences (GCP project id and model configs are non-secret identifiers; Vertex AI auth via Firebase/ADC). See validation comment." || true

echo "==> r1f (Phase 3: Architectural Optimization & Visual Harmonization) — CONFIRMED epic"

# ── r1f.1 REL-03 O(N^2) — CONFIRMED, consider bumping to P1 ──────────────────────
bd comment watcher-r1f.1 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED). issue.dart: blockers/blocking:133-158 do full all.where scans; hasOpenDescendant:226-234 and isDescendantOf:236-263 recurse with O(N) indexWhere per hop. Hot paths confirmed in build/drag: tree_view_screen.dart:154-165 (build), tree_node.dart:53-61 (build, per node recursively), tree_node.dart:102-105 (isDescendantOf inside DragTarget.onWillAcceptWithDetails — runs every drag-hover tick), tree_node.dart:249/254/346 (blockers/blocking per row). Enhancement: precompute byId + childrenById + reverse blocked/blocking maps once in _refreshData; also note tree_node uses widget.allIssues for children but appState.currentIssues for blockers — unify the source. Consider P1: the drag-hover O(N) recompute is a perceptible-jank/UX bug on large repos, arguably reliability not just optimization." || true

# ── r1f.2 RACE-03 optimistic concurrency — CONFIRMED ─────────────────────────────
bd comment watcher-r1f.2 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED). app_state.dart updateIssue:573-616 sends no version/updated_at (the optimistic block at ~584-590 is an empty comment stub). beads_service.dart updateIssue:213-236 forwards only {id,updates,actor}. daemon handleUpdateIssue (main.go:249-277) calls storage.UpdateIssue with no read-compare-swap = last-write-wins. Good news for implementer: Issue.updatedAt already exists and is deserialized (issue.dart:35), so the client already HAS the value to send. Thread expectedUpdatedAt through the 3 layers and return -32000 conflict from the daemon on mismatch. Directly related to t60.5/RACE-02 (multi-agent writes)." || true

# ── r1f.3 RACE-04 export serialization — CONFIRMED, refine framing ───────────────
bd comment watcher-r1f.3 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED, refined). exec.Command('bd','export') at main.go:175-177, 268-270, 305-307, 327-329. REFINEMENT: these use blocking cmd.Run() inside a single request, and dispatchRequest is sequential (one stdin loop), so a single daemon already serializes its OWN exports — it is NOT fire-and-forget goroutines. The real problems are (a) cross-process collision (Dart file-watcher / CLI / agents also running bd against .beads/backup/) and (b) no debounce, so N rapid UI mutations = N full sequential exports (latency/throughput). No mutex/channel/debounce exists. Fix: single debounced coalescing export worker (buffered channel + goroutine, trailing ~500ms) + sync.Mutex; consider a .beads/backup/ file lock for cross-process safety." || true

# ── r1f.10 REL-04 http timeout — CONFIRMED ──────────────────────────────────────
bd comment watcher-r1f.10 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED). app_state.dart:753-757 http.get(github releases/latest) has no .timeout(). Existing try/catch (752/763) logs via _log.info, so adding .timeout(const Duration(seconds:5-10)) + catching TimeoutException degrades gracefully. Trivial, low-risk." || true

# ── r1f.4 UI-01 PriorityBadge — CONFIRMED ───────────────────────────────────────
bd comment watcher-r1f.4 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED). No shared PriorityBadge exists. Divergent impls: tree_node.dart:300-341 (switch colors, bordered), ready_queue_screen.dart:247-278 (color-list+clamp, width:28), blocked_screen.dart:225-256 (near-dup of ready_queue), project_dashboard.dart:620-654 (solid fill, white text — aggregate counts), command_palette.dart:126 (5th scheme, dot-only). CONFIRMED kanban_card.dart has NO priority badge (only _buildTypeBadge:131 and _buildBlockerBadge:106). Extract PriorityBadge(priority) with one color source; add to KanbanCard header (~line 61)." || true

# ── r1f.5 UI-02 EmptyStateView — CONFIRMED ──────────────────────────────────────
bd comment watcher-r1f.5 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED). No shared EmptyStateView. Five hand-rolled empty states (icon/color/typography drift): kanban_screen.dart:137-162, tree_view_screen.dart:230-255, ready_queue_screen.dart:80-104, blocked_screen.dart:69-93, dependency_graph_screen.dart:93-114 (plus a 6th different-layout one in activity_ticker.dart:13-32). Create EmptyStateView({icon,title,subtitle?,iconColor?})." || true

# ── r1f.6 A11Y-03 — REPRIORITIZE/rescope (dashboard site not reproduced) ─────────
bd comment watcher-r1f.6 --actor "$ACTOR" \
  "VALIDATED (PARTIALLY CONFIRMED — rescope). command_palette.dart:361-371 IS a bare colored dot (width/height 8, BoxShape.circle) with no text/label/tooltip/Semantics — CONFIRMED colorblind fail. BUT project_dashboard.dart:620-654 (_buildBadge, cited :624) is NOT color-only: it renders a 'P0'/'P1'... TEXT label (lines 636-643) on the colored fill — NOT REPRODUCED. Rescope this issue to command_palette ONLY; the natural fix is to reuse the PriorityBadge from r1f.4 there (adds text + fixes colorblind), so consider making r1f.6 depend on r1f.4." || true

# ── r1f.7 A11Y-04 — CONFIRMED ───────────────────────────────────────────────────
bd comment watcher-r1f.7 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED). No MacosTextField in the app has semanticsLabel/Semantics. Verified: issue_inspector.dart:548 (comment), :618 (owner/assignee; also un-cited :723 dependency target), settings_modal.dart:111,133,291,314,370. placeholder text is not a reliable a11y label. Wrap in Semantics(textField:true,label:...) associating the sibling section headings." || true

# ── r1f.8 UI-03 — CONFIRMED ─────────────────────────────────────────────────────
bd comment watcher-r1f.8 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED). kanban_column.dart:49-52 header Text('title (n)') and issue_inspector.dart:456-459 title Text lack maxLines:1/overflow:ellipsis (inspector title is inside Expanded:445; issue-id Text:449 also unbounded). kanban header sits in a fixed 300px column (kanban_column.dart:31) and overflows horizontally without ellipsis. Add maxLines:1 + TextOverflow.ellipsis." || true

# ── r1f.9 UI-04 — CONFIRMED ─────────────────────────────────────────────────────
bd comment watcher-r1f.9 --actor "$ACTOR" \
  "VALIDATED (CONFIRMED). lib/utils/date_formatters.dart does not exist. issue_inspector.dart:629-631 _formatDate = 'YYYY-MM-DD HH:MM'; activity_ticker.dart:55-56 = 'MM/DD HH:MM' (different format), both manual padLeft. Note _formatDate is reused at issue_inspector.dart:137/142/147/153/517 — extraction removes several copies. Create DateFormatters (wrap package:intl DateFormat) with formatFull/formatShort." || true

echo
echo "==> Export source of truth + show for review"
bd export -o .beads/issues.jsonl
git status --short .beads/issues.jsonl
echo "Suggested: git add .beads/issues.jsonl && git commit -m 'bd: validate t60/b7o/r1f findings (reprioritize t60.2, deprecate b7o.6)'"
