# Brief: Blind EM Exercise — Auth Task Quality Assessment

## Purpose

This is an evaluation exercise, not an implementation task. We want to assess
how well the farmtable task system communicates a feature plan on its own —
without a companion design document.

You will work in two phases. **Complete Phase 1 fully before reading Phase 2.**

---

## Phase 1: Tasks Only

### Instructions

1. Connect to the deployed farmtable instance and read through ALL tasks in the
   **"Auth Improvements"** collection (ID: `9a16e171-59e6-4179-a79d-708b8e2adade`).

2. Use the farmtable MCP tools or the `ft` CLI to explore the collection. The
   instance is at `farmtable-qo7k5fvpda-uc.a.run.app`. See `/workspace/agents.md`
   for the dual-header IAP authentication pattern required to reach it.

3. Read every task — titles, descriptions, acceptance criteria, dependencies,
   parent/child relationships, stages, labels. Explore the full graph.

4. Based ONLY on what you find in the task system, write a report covering:

   - **Scope summary:** What is this feature? What problem does it solve?
   - **Architecture:** What's the technical approach? What patterns or technologies
     are involved?
   - **Phases/stages:** How is the work structured? What's the sequencing logic?
   - **Dependencies:** What must come before what? Are there parallel workstreams?
   - **Acceptance criteria:** How will we know each piece is done?
   - **Risks or gaps:** What's unclear, ambiguous, or missing from the tasks?
     What questions would you need answered before you could confidently assign
     this work to developers?
   - **Confidence rating:** On a scale of 1-5, how confident are you that a
     developer could execute this plan from the tasks alone, without additional
     context?

5. Save your Phase 1 report to:
   `/scion-volumes/scratchpad/projects/farmtable/exercise-blind-em-phase1.md`

6. **STOP here.** Message ptone@google.com on Discord thread `1529316156165329067`
   with a summary of your Phase 1 findings, then proceed to Phase 2.

---

## Phase 2: Tasks + Design Document (read this only after completing Phase 1)

### Instructions

1. Now read the design document at:
   `/scion-volumes/scratchpad/projects/farmtable/design-auth-improvements.md`

2. Also read the current-state findings doc at:
   `/scion-volumes/scratchpad/projects/farmtable/auth-current-state.md`

3. Write a comparison report covering:

   - **What the tasks conveyed well:** Which aspects of the design did you fully
     understand from the tasks alone?
   - **What was missing or unclear:** What did the design doc reveal that the tasks
     didn't convey? What changed in your understanding?
   - **Information gaps:** Specific things that a developer would need from the
     design doc that aren't captured in task descriptions (architectural rationale,
     alternatives considered, migration strategy, scion pattern references, etc.)
   - **Task quality assessment:** Are the tasks well-structured for execution?
     Are dependencies correct? Are acceptance criteria specific enough?
   - **Recommendations:** How could the task decomposition be improved to better
     stand on its own? What information from the design doc should be pulled into
     task descriptions?

4. Save your Phase 2 report to:
   `/scion-volumes/scratchpad/projects/farmtable/exercise-blind-em-phase2.md`

5. Message ptone@google.com on Discord thread `1529316156165329067` with your
   Phase 2 findings.

---

## Communication

- Report findings to ptone@google.com directly:
  `scion message --non-interactive ptone@google.com --channel discord --thread-id 1529316156165329067 "<message>"`
- Message the coordinator for infra/tooling issues only.

## Important

- Do NOT read the design document or any files in `/scion-volumes/scratchpad/projects/farmtable/`
  until you have fully completed Phase 1 and saved your report.
- Do NOT look at the farmtable source code to inform your Phase 1 assessment —
  the point is to evaluate the tasks as a standalone communication vehicle.
- Be honest about gaps and confusion — that's the valuable signal in this exercise.
