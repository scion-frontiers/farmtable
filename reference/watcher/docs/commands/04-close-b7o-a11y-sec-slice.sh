#!/usr/bin/env bash
# Run ON THE MAC HOST, from the watcher repo root:
#   bash docs/commands/04-close-b7o-a11y-sec-slice.sh
#
# WHY THIS IS A SCRIPT (not run by the container agent):
# Container agents can't write bd (BEADS_DOLT_AUTO_START=false; the Mac host owns
# the single Dolt write lock). See /workspace/kb/container-living.md §2.
#
# WHAT THIS DOES:
# Records the second Phase 2 (watcher-b7o) slice — b7o.5 (SEC-04), b7o.3
# (A11Y-01), b7o.4 (A11Y-02) — creates a host verify/land task, and (after
# verification) closes the three issues. Code is already on disk under /workspace.
#
# VERIFY BEFORE RUNNING (this script closes issues):
#   flutter analyze     # container has NO Dart toolchain — host-only
#   flutter test
# (No Go changed in this slice.)
#
# Safe to re-run: comments may duplicate; bd close on a closed issue and bd
# create with a fixed --id error harmlessly. Every line is guarded.
set -u
test -d .beads || { echo "Run from the watcher repo root on the Mac."; exit 1; }

ACTOR="implementation-agent"

echo "==> Creating host verify/land task for the b7o a11y+sec slice"
bd create "Verify & land b7o a11y+sec slice (SEC-04, A11Y-01, A11Y-02)" \
  --id watcher-b7o-verify-a11y \
  --type task --priority 1 \
  --deps discovered-from:watcher-b7o \
  --description "A container agent implemented b7o.5 (SEC-04), b7o.3 (A11Y-01), b7o.4 (A11Y-02). Files: lib/services/planner_service.dart; lib/widgets/{issue_inspector,tree_node,command_palette,create_issue_modal,planner_modal,settings_modal}.dart; lib/screens/project_dashboard.dart; lib/utils/dialog_utils.dart (added ModalFocusTrap). Container sanity: brace/paren/bracket balance OK on all 9 files; imports verified. Dart was NOT analyzable on the container (Flutter is host-only).
YOUR JOB (host), in order:
1. Review the diff (see this script's comments for what each change does).
2. flutter analyze — MUST be clean. Watch for: (a) any 'prefer const'/formatting lints from the hand-inserted Semantics/FocusScope wrappers (run 'dart format .' — the container could not); (b) unused import warnings; (c) that ModalFocusTrap's FocusScope doesn't fight the existing focus logic in command_palette (it has its own _focusNode + _focusScopeNode now).
3. flutter test — existing suite must stay green (planner_service_test exercises parse/tokenize which are unchanged; the SEC-04 changes are in the file-IO helpers).
4. Smoke tests:
   - SEC-04: from the project's .beads/ dir, pre-plant a symlink where a scratch file would go, e.g. 'ln -s /etc/passwd .beads/ai_out.md', then run AI Planner/Assessment. Expect: the app REFUSES to read/write through the link (logs a warning, does not clobber the target, does not ingest its contents). Repeat for ai_prompt.txt and ai_done.
   - A11Y-01: with VoiceOver on, tab/navigate to the 'Add dependency' link, issue links in the Inspector, tree rows, dashboard Ready/Blocked sections, and command-palette results — each should be announced as a BUTTON with a meaningful label.
   - A11Y-02: open the Command Palette and each sheet modal (Create Issue, Settings, Planner); press Tab repeatedly — focus must CYCLE WITHIN the modal and not reach the background toolbar/sidebar; on dismiss, focus returns to the prior control.
5. ONLY IF all pass: run 'bash docs/commands/04-close-b7o-a11y-sec-slice.sh' to post comments + close b7o.3/b7o.4/b7o.5. Commit (e.g. 'fix: b7o a11y+security slice — symlink-safe AI scratch files (SEC-04), semantic buttons (A11Y-01), modal focus traps (A11Y-02)') and push. Then close THIS task.
ACCEPTANCE: analyze+test+format clean, smoke tests pass, committed & pushed, b7o.3/4/5 closed. If any step fails, DO NOT run the close section — comment the failure here and hand back." || true

echo "==> b7o.5 SEC-04 — symlink-safe AI scratch files (FIXED)"
bd comment watcher-b7o.5 --actor "$ACTOR" \
  "FIXED (re-scoped as noted in validation: SEC-01 already removed temp_plan.sh + its bash-exec vector). Remaining scratch files are an IPC channel between the app and the gemini CLI in tmux (it reads .beads/ai_prompt.txt and writes .beads/ai_out.md + .beads/ai_done by RELATIVE path), so they cannot be moved to Directory.systemTemp without rewriting the tmux pipeline and threading a token into pollForCompletion. Instead hardened against the actual risk — attacker-planted SYMLINKS at these predictable paths. Added helpers in planner_service.dart: _writeScratch (deletes any pre-existing symlink at the path via _unlinkIfSymlink, then writes a fresh regular file with flush:true), _deleteScratch (removes file OR leftover symlink), and _isSymlink (FileSystemEntity.isLinkSync). pollForCompletion now refuses to treat a symlinked ai_done as 'done' and refuses to READ ai_out.md if it is a symlink (logs a warning). Applied across all 4 sites: startGeneratePlan, startAssessGraph, startGenerateAutoFixScript, pollForCompletion. FOLLOW-UP: unit tests planting a symlink at each path and asserting no follow (write creates a regular file; read returns empty + warns)." || true
bd close watcher-b7o.5 --reason "SEC-04 fixed: AI scratch-file writes/reads are symlink-safe (_writeScratch/_deleteScratch/_isSymlink); pre-planted symlinks at predictable .beads/ paths are removed on write and refused on read. temp_plan.sh already eliminated by SEC-01." || true

echo "==> b7o.3 A11Y-01 — semantic buttons on interactive elements (FIXED)"
bd comment watcher-b7o.3 --actor "$ACTOR" \
  "FIXED. Wrapped the confirmed interactive GestureDetector/MouseRegion tap targets in Semantics(button:true, label:...): issue_inspector.dart _buildAddDependencyButton ('Add dependency') and _buildIssueLink ('Open issue <id>: <title>'); tree_node.dart the main selectIssue row ('Open issue <id>: <title>'); project_dashboard.dart ReadinessStatCard._buildSection ('<count> <label>'); command_palette.dart the result-row selectIssue target ('Open issue <id>: <title>'). Dropped the two bogus refs from the original issue (project_dashboard :167/:267 were a count computation and a banner border, not interactive). The transient tree childWhenDragging placeholder was intentionally left unlabeled (not a stable target). FOLLOW-UP: consider a lint/CI check for bare GestureDetector without Semantics." || true
bd close watcher-b7o.3 --reason "A11Y-01 fixed: all confirmed interactive text/icon tap targets wrapped in Semantics(button:true) with meaningful labels (issue_inspector x2, tree_node, project_dashboard, command_palette)." || true

echo "==> b7o.4 A11Y-02 — modal focus trapping + restoration (FIXED)"
bd comment watcher-b7o.4 --actor "$ACTOR" \
  "FIXED. command_palette.dart (showGeneralDialog, the weakest case) now wraps its content in FocusScope(node:_focusScopeNode)+FocusTraversalGroup so Tab cycles within the palette; added the node + its dispose(). For the showMacosSheet modals (create_issue_modal, planner_modal, settings_modal) added a reusable ModalFocusTrap widget in lib/utils/dialog_utils.dart — a StatefulWidget that owns a FocusScopeNode, requestFocus()es into the modal on the first frame (focus restoration to the previously-focused node is handled by the sheet route on pop), and wraps content in FocusTraversalGroup so Tab does not leak to the background toolbar/sidebar. FOLLOW-UP: widget tests that pump each modal, send repeated Tab, and assert focus stays within the modal subtree." || true
bd close watcher-b7o.4 --reason "A11Y-02 fixed: command_palette wrapped in FocusScope+FocusTraversalGroup; sheet modals wrapped in new ModalFocusTrap (FocusScope+FocusTraversalGroup, focus-in on show). Tab no longer escapes modals." || true

echo
echo "==> Phase 2 status: with this slice + the reliability slice (03), ALL b7o children"
echo "    (b7o.1-b7o.6) are addressed. After BOTH verify tasks close, close the epic:"
echo "    bd close watcher-b7o --reason 'Phase 2 complete: reliability + a11y + security polish landed.'"
echo
echo "==> Export source of truth + show for review"
bd export -o .beads/issues.jsonl
git status --short .beads/issues.jsonl
echo "Suggested: git add .beads/issues.jsonl && git commit -m 'bd: close b7o a11y+security slice (SEC-04, A11Y-01, A11Y-02)'"
