# onhold-toolbar — §0 result: IT RENDERS, BUT THE PREMISE IS WRONG

**Agent:** dev-onhold-toolbar
**Date:** 2026-07-29
**Tree:** /tmp/onhold/work — clone of /workspace/farmtable, branch `onhold-toolbar` from cc92735
**web/dist present in measurement tree:** NO (0 files). Canonical has 4108; I did not touch it.
**node_modules present in measurement tree:** NO (not cloned — untracked). Canonical has 110 entries.

**STATUS: STOPPED BEFORE CHANGING BEHAVIOUR.** Two stop conditions, §0 and §4. No fix made,
no commit, nothing staged.

---

## 1. Tree announcement (§1), made at creation, before any measurement

```
$ git -C /tmp/onhold/work remote -v
origin	/workspace/farmtable (fetch)
origin	/workspace/farmtable (push)

$ grep -c -E 'github_pat_|ghp_' /tmp/onhold/work/.git/config || true
0
```

[MEASURED, in this leg's tree /tmp/onhold/work] Credential count 0. Remote is the local path
only; there is no GitHub push target from this clone. Clone was made with `git clone` **from the
local path on this host, never from a network remote**; no `cp -a`/`rsync`/`tar`/`mv` was used.

**Scope of that zero.** It is a property of *this clone's config only*. It is not a statement
about the host. The credential's status on this host is **accepted risk by owner instruction,
not resolved** — not handled, not addressed, not mitigated, not closed. This leg ran one check
on its own new config as clone hygiene and performed no enumeration of carriers, spans, digests
or exposure, and will not.

---

## 2. The §0 question, answered

### 2a. Your PHASE_OPTIONS figure, re-measured by me (not inherited)

[MEASURED] `git log -1 --format=%H` → `cc927355e5a23c45bfd983cd331eb540b0a61ad5`

```
$ grep -n -A 20 'PHASE_OPTIONS' web/src/components/ft-toolbar.ts
34:const PHASE_OPTIONS = [
35-  { value: TaskPhase.OPEN, label: 'Open' },
36-  { value: TaskPhase.IN_PROGRESS, label: 'In Progress' },
37-  { value: TaskPhase.ON_HOLD, label: 'On Hold' },
38-  { value: TaskPhase.CLOSED, label: 'Closed' },
39-] as const;
```

[MEASURED] Four entries, ON_HOLD present at line 37. Your figure reproduces at cc92735.

### 2b. Does it render?

[DERIVED — from an unconditional template with no guard, NOT from an executed DOM]
The option is emitted. Its sole render site is lines 303–307:

```
303:          ${PHASE_OPTIONS.map(
304-            (option) => html`
305-              <sl-option value=${String(option.value)}>${option.label}</sl-option>
306-            `,
307-          )}
```

There is no filter, no conditional, no feature flag around the `.map`. All four entries are
emitted whenever the toolbar renders.

[MEASURED] The only gating expression on the containing `<sl-select>` is
`?disabled=${filtersDisabled}`, and:
```
243:    const filtersDisabled = this.currentView === 'tree' || this.currentView === 'dashboard' || this.currentView === 'dependencies';
```
So on the kanban and list views the select is **enabled**, not disabled.

[NOT MEASURED — AND NOT MEASURABLE IN THIS PROJECT AS IT STANDS] I did not execute a live DOM
render to confirm the `<sl-option>` reaches the document. I could not: my clone has no
node_modules, and the project has no browser/DOM test harness at all (see §4). Direction of the
gap: an executed render could only *confirm* emission, since the template is unconditional —
it could not overturn it. The realistic way this claim fails is if `ft-toolbar` is never mounted,
which I did not check.

### 2c. THE FINDING THAT MATTERS: it renders into a FILTER, not a phase setter

This is the part that changes the task, and it is established by direct inspection, so I ran no
differential.

[MEASURED] PHASE_OPTIONS has exactly **2 references across 51 .ts files** — its definition
(line 34) and the one render at line 303. It reaches no other code.

[MEASURED] Line 303 sits inside `<div class="filters">`, in an `<sl-select placeholder="Phase">`
bound to `this.phaseFilter` with handler `onPhaseFilterChange`, whose entire body is:

```
651:  private onPhaseFilterChange(e: Event) {
652-    const value = this.selectValue(e);
653-    this.dispatchFilterChange({
654-      phase: value ? Number(value) as TaskPhase : null,
655-      assigneeId: this.assigneeFilter,
656-    });
657-  }
```

It dispatches a view-filter event. It writes nothing.

**Selecting "On Hold" here filters the board to on-hold tasks. It cannot put a task into
on_hold.**

### 2d. on_hold is not settable through the web interface by any path

[MEASURED] The only phase write in the entire web client is ft-kanban-view.ts line 170:
```
170:        await this.client.updateTask(taskId, { stage, phase: newPhase });
```
with `const newPhase = phaseForStage(stage);` (line 165).

[MEASURED] `phaseForStage` (web/src/gen/service.ts:155) returns only OPEN, IN_PROGRESS, CLOSED,
or — in `default:` — UNSPECIFIED. **It has no branch that returns ON_HOLD.**

[MEASURED] The `TaskStage` enum (web/src/gen/types.ts:22–37) contains no on-hold stage. There is
no stage a user could drag to that would map to on_hold.

[MEASURED] `const ON_HOLD_STAGES: ColumnDef[] = [];` (ft-kanban-view.ts:38) — empty. Zero on-hold
columns render, so no on-hold drop target exists.

Three independent structural facts, any one of which is sufficient. If the acceptance criterion
means *settable*, **it is already satisfied at main, and was before this task was written.**

---

## 3. Why I did not remove the option

[MEASURED] on_hold is a first-class phase outside the web UI — `proto/farmtable.proto:40`,
`internal/store/schema/task.go:22` (DB enum), `internal/cli/enums.go:136`,
`internal/mcp/server.go:823`. The CLI and MCP server both accept and set it.

[MEASURED] The same web UI surfaces on-hold tasks elsewhere: `ft-dashboard-view.ts:147` renders
an "On Hold" count, and `ft-filter-chips.ts:10` labels the active on-hold filter.

[DERIVED] Removing the toolbar option would delete the only way a user can filter for a state
that the backend actively creates and that the dashboard actively counts. That is a capability
regression, not a fix. I am not making it on the strength of a premise that inspection
falsified.

---

## 4. §4's regression pin CANNOT be shipped without touching shared infrastructure

[MEASURED] `web/package.json` line 9:
```
"test": "tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js"
```

[MEASURED] `web/tsconfig.test.json` include:
```
"include": ["src/utils/task-ready.test.ts"]
```

[MEASURED] Exactly **1 test file exists in the whole web tree** (`web/src/utils/task-ready.test.ts`).

There is no test discovery — both the compile set and the executed file are hardcoded, to a
single path. A new pin file would be compiled by nothing and executed by nothing. Making a pin
run requires editing **both** `package.json` and `tsconfig.test.json`. Those are the shared
build/test pipeline, and §4 says stop rather than make a drive-by change there. So I stopped.

Additionally, `node` is the runner — there is no DOM. A pin asserting that an `<sl-option>` does
not reach the document cannot execute in this project today, regardless of wiring.

### Correction to §3 of the brief

The brief states `web/tsconfig.test.json` sets `include: ['src/**/*.test.ts']`. [MEASURED] it is
`include: ["src/utils/task-ready.test.ts"]` — a single hardcoded file. Direction: **narrower than
described**, so the brief's conclusion holds a fortiori. `npm test` typechecks only the transitive
import closure of that one file; ft-toolbar.ts is not in it.

---

## 5. Sweeps, with iteration counts (§6)

**Tree for every row below:** `/tmp/onhold/work` @ cc92735 — **pristine clone, web/dist ABSENT,
node_modules ABSENT.** Stated per-table rather than only in the header, because a count taken in
a pristine tree and the same count taken in the built main copy are different measurements.

| Sweep | Result | Denominator | Tree / dist state |
|---|---|---|---|
| PHASE_OPTIONS refs | 2 hits | 51 .ts files | pristine clone, no dist |
| ON_HOLD refs in web/src | 12 hits | 51 .ts files | pristine clone, no dist |
| `setPhase\|updatePhase\|changePhase\|phaseSelect\|PHASE_SET` | **0 hits** | 51 .ts files | pristine clone, no dist |
| `phase:` write candidates | 19 hits | web/src, excl. gen/ + labels + tests | pristine clone, no dist |
| web test files | 1 file | `find web -name '*.test.ts'` | pristine clone, no dist |

These are source-text counts over tracked files, so they are **not** build/vet/package-count
figures and are not sensitive to the three tree states — a pristine clone and the built main copy
hold identical tracked sources at the same commit. I state the tree anyway rather than assert the
exemption silently. **This leg reported no build, vet, test-execution or package-count figure at
all**, because it executed no build, no vet and no test run.

The 0-hit sweep is a **negative result from my chosen search terms, not proof of absence.** I did
not rely on it. The absence of a phase-setting control was established positively instead, by
following the single write call site at ft-kanban-view.ts:170 to `phaseForStage` and reading every
branch of it.

---

## 6. What I did not run, and which way it cuts

- **No live DOM render.** No node_modules in my tree; no browser harness in the project. Would
  only confirm 2b, cannot overturn it (template is unconditional).
- **No `npx tsc --noEmit --listFiles`.** Requires node_modules, absent from my clone. Installing
  110 packages into the tree I am measuring is the same class of act as the web/dist problem in
  your bulletin, so I did not do it unannounced. Nothing to typecheck anyway — I changed no code.
- **Did not check whether `ft-toolbar` is mounted in the live app.** This is the one thing that
  could still make the option unreachable in practice. It would strengthen the "not a defect"
  conclusion, not weaken it.

Per your bulletin: this is a **pristine-clone** result, **web/dist absent**, and it is an
inspection result — it makes no claim that depends on a build.

---

## 7. Deliverables status

1. **Fix + regression pin — NOT DELIVERED, deliberately.** Stop conditions in §0 and §4.
2. **This report — delivered.**
3. **Project log entry — not written.** It would have to record a behaviour change; there is none.

## 8. What I need from you

1. **The contract wording for "prime on_hold".** [MEASURED] There is no contract file in-tree and
   **zero** occurrences of "prime" in any markdown in the repo. If it means *settable*, main
   already complies and this task closes with no code change. If it means *must not appear in the
   UI at all*, the scope is three files, not one (toolbar filter, dashboard count, filter chip),
   and it removes user-visible capability — that needs your explicit call.
2. **Authorisation, or a separate owner, for `package.json` + `tsconfig.test.json`** if you want a
   pin at all. It cannot be done from inside this leg's scope.
