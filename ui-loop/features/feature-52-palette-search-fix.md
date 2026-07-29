# Feature 52: Command Palette Search Fix

**Date:** 2026-07-22
**Branch:** fix/f52-palette-search
**File:** web/src/components/ft-command-palette.ts

## Problem

The command palette search (Ctrl+K) was broken in two ways:
1. It searched too many fields (description, type, stage, assignees, id) instead of only title and labels
2. Labels (`task.labels: string[]`) were completely missing from the search

A user reported that searching "my-new" showed "No matching tasks" even though a task called "my-new-task" was visible on the board.

## Root Cause

Two issues in `ft-command-palette.ts`:

### 1. Over-broad searchableText()
The `searchableText()` method (line ~402) built a search string from name, id, description, type, stage, and assignees. This meant searches like "Deploying" or "backlog" would match tasks based on their stage name, not their title.

### 2. Score filter bug (the deeper issue)
The `filteredTasks()` method used `.filter((s) => s >= 0)` to exclude no-match results from `fuzzyScore()`. However, `fuzzyScore()` returns -1 as the no-match sentinel, and valid matches can have negative scores due to word-boundary bonuses (`score -= 2`). This meant good matches at word boundaries (score = -2, -4, etc.) were incorrectly filtered out.

The old code masked this bug because the overly-broad searchableText (with description, type, stage, assignees) produced longer strings where gap penalties pushed scores back above 0. After scoping searchableText to title+labels only, the shorter strings meant boundary-heavy matches stayed negative and got filtered.

## Fix

1. **searchableText()**: Changed to only include `task.name` and `task.labels` (joined). Removed description, type, stage, assignees, and id.

2. **filteredTasks() scoring**: 
   - Score against `task.name` (title) directly
   - Score against each label individually
   - Score against the combined searchableText (name + labels)
   - Take the best score among all candidates
   - Removed `idScore` (no longer search by task ID)
   - Fixed filter from `s >= 0` to `s !== -1` to correctly preserve negative-scored valid matches

3. **fuzzyScore()**: Not modified (it was correct).

## Verification

Playwright tests confirmed all 5 criteria:
- (a) Partial title match: "ready for review" finds the correct task
- (b) Stage names don't match: "Deploying" shows "No matching tasks"  
- (b2) Task IDs don't match: ID fragment shows "No matching tasks"
- (c) Case-insensitive: "TEST TASK 2" matches "Test task 2 - in progress"
- (d) Fuzzy matching: "tsk blckd" matches "Test task 3 - blocked"
- (e) Label search: "feature" finds all tasks with the "feature" label

Screenshots saved to feature-52-palette-search-fix/ directory.
