import { describe, expect, it } from 'vitest';
import '../src/components/inspector/ft-inspector-relationships.js';
import {
  AvailabilityReason,
  RelationshipType,
  TaskStage,
  type Relationship,
  type Task,
} from '../src/gen/types.js';
import {
  attentionBlockers,
  hasAvailabilityReason,
  isUnsuccessfulTerminalStage,
  STAGE_LABEL,
} from '../src/util/task-state-utils.js';
import type { TaskStore } from '../src/store/task-store.js';
import { mount, queryAllDeep, textDeep, update } from './helpers/dom.js';
import { NATIVE_STAGES, storeWith, task } from './helpers/fixtures.js';

// ── Spec constants ─────────────────────────────────────────────────────────
//
// These are written out literally rather than derived from the component's own
// `REL_GROUP_ORDER`/`REL_GROUP_LABEL` tables: an assertion built from the same
// table the template renders from would agree with any reordering or relabel.

/** Every section heading the panel promises, in the order a user reads them. */
const SECTION_LABELS = ['Parent', 'Children', 'Blocked by', 'Blocks', 'Related', 'Duplicate of'] as const;

/** The stages `isUnsuccessfulTerminalStage()` treats as "died without shipping". */
const UNSUCCESSFUL_TERMINAL_STAGES = NATIVE_STAGES.filter(isUnsuccessfulTerminalStage);

const ATTENTION_TITLE = 'Dependency attention needed';
const PLAIN_BLOCKED_TITLE = 'Blocked by dependency';

// ── DOM helpers ────────────────────────────────────────────────────────────

function clean(node: Element | null | undefined): string {
  return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function sections(view: Element): HTMLElement[] {
  return queryAllDeep<HTMLElement>(view, '.section');
}

function sectionLabels(view: Element): string[] {
  return sections(view).map((s) => clean(s.querySelector('.section-label')));
}

/**
 * The one `.section` carrying `label`.
 *
 * Every entry assertion goes through this so a name found in the *wrong*
 * section fails: the panel's whole job is putting each relation under the
 * right heading, and a panel-wide text search cannot tell them apart.
 */
function section(view: Element, label: string): HTMLElement {
  const found = sections(view).filter((s) => clean(s.querySelector('.section-label')) === label);
  if (found.length !== 1) {
    throw new Error(`expected exactly one "${label}" section, found ${found.length} of ${sectionLabels(view).join(', ')}`);
  }
  return found[0];
}

function entryNames(scope: Element): string[] {
  return Array.from(scope.querySelectorAll('.entry-name')).map(clean);
}

function entries(scope: Element): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>('.entry'));
}

function deleteButtons(scope: Element): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>('sl-icon-button.delete-btn'));
}

function addButton(scope: Element): HTMLElement | null {
  return scope.querySelector<HTMLElement>('sl-icon-button.add-btn');
}

/** The attention callout whose title starts with `title`, if rendered. */
function callout(view: Element, title: string): HTMLElement | null {
  return (
    queryAllDeep<HTMLElement>(view, '.attention').find((block) =>
      clean(block.querySelector('.attention-title')).includes(title),
    ) ?? null
  );
}

function calloutButtons(block: Element): string[] {
  return Array.from(block.querySelectorAll('.attention-actions sl-button')).map(clean);
}

interface Captured<T> {
  events: CustomEvent<T>[];
}

/** Record a composed event as an ancestor of the host would receive it. */
function capture<T>(view: Element, type: string): Captured<T> {
  const captured: Captured<T> = { events: [] };
  // Listening on the parent (not the host) proves the event actually escaped
  // the shadow root, which is what `composed: true` buys.
  (view.parentElement ?? document.body).addEventListener(type, (e) =>
    captured.events.push(e as CustomEvent<T>),
  );
  return captured;
}

function click(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const SUBJECT_ID = 'subject';

function blockedBy(...targetTaskIds: string[]): Relationship[] {
  return targetTaskIds.map((targetTaskId) => ({ type: RelationshipType.BLOCKED_BY, targetTaskId }));
}

/** A task the server reports as dependency-blocked. */
function dependent(relationships: Relationship[], overrides: Partial<Task> = {}): Task {
  return task({
    id: SUBJECT_ID,
    name: 'Subject task',
    stage: TaskStage.ACCEPTED,
    availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
    relationships,
    ...overrides,
  });
}

async function mountPanel(subject: Task, store: TaskStore, props: Record<string, unknown> = {}) {
  return mount<HTMLElement>('ft-inspector-relationships', { task: subject, store, ...props });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ft-inspector-relationships — mounting', () => {
  it('renders nothing at all when no task is set', async () => {
    const view = await mount<HTMLElement>('ft-inspector-relationships');

    expect(sections(view)).toHaveLength(0);
    expect(textDeep(view)).toBe('');
    // Nothing but the component's own <style>: no headings, no placeholders.
    expect(queryAllDeep(view, 'div, span, sl-icon-button, sl-button')).toHaveLength(0);
  });

  it('renders nothing when the task is cleared after having been set', async () => {
    // The inspector re-uses one panel instance across selections, so the
    // task -> undefined transition has to tear the previous render down.
    const view = await mountPanel(task({ id: SUBJECT_ID }), storeWith(task({ id: SUBJECT_ID })));
    expect(sections(view)).toHaveLength(SECTION_LABELS.length);

    await update(view, { task: undefined });

    expect(sections(view)).toHaveLength(0);
  });
});

describe('ft-inspector-relationships — section scaffold', () => {
  it('always renders the six relation sections, in reading order, even with no relations', async () => {
    const subject = task({ id: SUBJECT_ID });
    const view = await mountPanel(subject, storeWith(subject));

    expect(sectionLabels(view)).toEqual([...SECTION_LABELS]);
  });

  it('renders "None" in every section for a task with no relations', async () => {
    const subject = task({ id: SUBJECT_ID });
    const view = await mountPanel(subject, storeWith(subject));

    for (const label of SECTION_LABELS) {
      expect(clean(section(view, label).querySelector('.none')), `${label} placeholder`).toBe('None');
      expect(entries(section(view, label)), `${label} entries`).toHaveLength(0);
    }
  });

  it('keeps the six sections when the panel is read-only', async () => {
    const subject = task({ id: SUBJECT_ID });
    const view = await mountPanel(subject, storeWith(subject), { readOnly: true });

    expect(sectionLabels(view)).toEqual([...SECTION_LABELS]);
  });
});

describe('ft-inspector-relationships — entries', () => {
  it('renders the parent under Parent and nowhere else', async () => {
    const parent = task({ id: 'parent', name: 'Parent task' });
    const subject = task({ id: SUBJECT_ID, parentTaskId: parent.id });
    const view = await mountPanel(subject, storeWith(parent, subject));

    expect(entryNames(section(view, 'Parent'))).toEqual(['Parent task']);
    expect(entryNames(section(view, 'Children'))).toEqual([]);
  });

  it('renders every child under Children', async () => {
    const first = task({ id: 'kid-1', name: 'First child', parentTaskId: SUBJECT_ID });
    const second = task({ id: 'kid-2', name: 'Second child', parentTaskId: SUBJECT_ID });
    const subject = task({ id: SUBJECT_ID });
    const view = await mountPanel(subject, storeWith(subject, first, second));

    expect(entryNames(section(view, 'Children'))).toEqual(['First child', 'Second child']);
    expect(entryNames(section(view, 'Parent'))).toEqual([]);
  });

  it('files each relationship under the section matching its type', async () => {
    const targets = {
      [RelationshipType.BLOCKED_BY]: task({ id: 'r-blocked-by', name: 'Prerequisite' }),
      [RelationshipType.BLOCKS]: task({ id: 'r-blocks', name: 'Dependent' }),
      [RelationshipType.RELATED]: task({ id: 'r-related', name: 'Sibling topic' }),
      [RelationshipType.DUPLICATE]: task({ id: 'r-duplicate', name: 'Same thing' }),
    };
    const subject = task({
      id: SUBJECT_ID,
      relationships: Object.entries(targets).map(([type, target]) => ({
        type: Number(type) as RelationshipType,
        targetTaskId: target.id,
      })),
    });
    const view = await mountPanel(subject, storeWith(subject, ...Object.values(targets)));

    expect(entryNames(section(view, 'Blocked by'))).toEqual(['Prerequisite']);
    expect(entryNames(section(view, 'Blocks'))).toEqual(['Dependent']);
    expect(entryNames(section(view, 'Related'))).toEqual(['Sibling topic']);
    expect(entryNames(section(view, 'Duplicate of'))).toEqual(['Same thing']);
  });

  it('renders the target stage as a badge beside the name', async () => {
    const target = task({ id: 'target', name: 'Prerequisite', stage: TaskStage.IN_REVIEW });
    const subject = task({ id: SUBJECT_ID, relationships: blockedBy(target.id) });
    const view = await mountPanel(subject, storeWith(subject, target));

    const entry = entries(section(view, 'Blocked by'))[0];
    expect(clean(entry.querySelector('.stage-badge'))).toBe(STAGE_LABEL[TaskStage.IN_REVIEW]);
  });

  it('skips a relationship whose target is missing from the store, and shows the same relationship once loaded', async () => {
    // Paired positive/negative: the "dangling" assertion below would pass on a
    // panel that renders nothing whatsoever, so the same fixture has to be
    // shown rendering the entry once the target is in the store.
    const target = task({ id: '11111111-2222-3333-4444-555555555555', name: 'Loaded later' });
    const subject = task({ id: SUBJECT_ID, relationships: blockedBy(target.id) });

    const dangling = await mountPanel(subject, storeWith(subject));
    expect(entries(section(dangling, 'Blocked by'))).toHaveLength(0);
    expect(clean(section(dangling, 'Blocked by'))).toBe('Blocked by None');
    expect(clean(section(dangling, 'Blocked by'))).not.toContain(target.id);

    const loaded = await mountPanel(subject, storeWith(subject, target));
    expect(entryNames(section(loaded, 'Blocked by'))).toEqual(['Loaded later']);
  });
});

describe('ft-inspector-relationships — task-select', () => {
  it('dispatches a composed, bubbling task-select carrying the clicked target id', async () => {
    const target = task({ id: 'target', name: 'Prerequisite' });
    const subject = task({ id: SUBJECT_ID, relationships: blockedBy(target.id) });
    const view = await mountPanel(subject, storeWith(subject, target));
    const selects = capture<{ taskId: string }>(view, 'task-select');

    click(entries(section(view, 'Blocked by'))[0]);

    expect(selects.events).toHaveLength(1);
    expect(selects.events[0].detail).toEqual({ taskId: target.id });
    expect(selects.events[0].bubbles).toBe(true);
    expect(selects.events[0].composed).toBe(true);
  });

  it('dispatches task-select for a parent entry, which carries no delete affordance', async () => {
    const parent = task({ id: 'parent', name: 'Parent task' });
    const subject = task({ id: SUBJECT_ID, parentTaskId: parent.id });
    const view = await mountPanel(subject, storeWith(parent, subject));
    const selects = capture<{ taskId: string }>(view, 'task-select');

    click(entries(section(view, 'Parent'))[0]);

    expect(selects.events.map((e) => e.detail)).toEqual([{ taskId: parent.id }]);
  });

  for (const key of ['Enter', ' ']) {
    it(`activates a keyboard-focused entry on "${key === ' ' ? 'Space' : key}" and suppresses the default scroll`, async () => {
      const target = task({ id: 'target', name: 'Prerequisite' });
      const subject = task({ id: SUBJECT_ID, relationships: blockedBy(target.id) });
      const view = await mountPanel(subject, storeWith(subject, target));
      const selects = capture<{ taskId: string }>(view, 'task-select');

      const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
      entries(section(view, 'Blocked by'))[0].dispatchEvent(event);

      expect(selects.events.map((e) => e.detail)).toEqual([{ taskId: target.id }]);
      expect(event.defaultPrevented).toBe(true);
    });
  }

  it('ignores keys other than Enter and Space', async () => {
    const target = task({ id: 'target', name: 'Prerequisite' });
    const subject = task({ id: SUBJECT_ID, relationships: blockedBy(target.id) });
    const view = await mountPanel(subject, storeWith(subject, target));
    const selects = capture<{ taskId: string }>(view, 'task-select');
    const entry = entries(section(view, 'Blocked by'))[0];

    entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true, cancelable: true }));
    expect(selects.events).toHaveLength(0);

    // Positive counterpart: the very same entry does respond to Enter.
    entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
    expect(selects.events).toHaveLength(1);
  });

  it('exposes entries as focusable buttons to assistive technology', async () => {
    const target = task({ id: 'target', name: 'Prerequisite' });
    const subject = task({ id: SUBJECT_ID, relationships: blockedBy(target.id) });
    const view = await mountPanel(subject, storeWith(subject, target));

    const entry = entries(section(view, 'Blocked by'))[0];
    expect(entry.getAttribute('role')).toBe('button');
    expect(entry.getAttribute('tabindex')).toBe('0');
  });
});

describe('ft-inspector-relationships — removing a relationship', () => {
  it('dispatches task-update removing the target id from the subject task', async () => {
    const target = task({ id: 'target', name: 'Prerequisite' });
    const subject = task({ id: SUBJECT_ID, relationships: blockedBy(target.id) });
    const view = await mountPanel(subject, storeWith(subject, target));
    const updates = capture<{ taskId: string; fields: { removeRelationships: string[] } }>(view, 'task-update');

    click(deleteButtons(section(view, 'Blocked by'))[0]);

    expect(updates.events).toHaveLength(1);
    // Exact shape: the id removed must be the *target's*, addressed to the
    // subject task. Swapping the two is a silently destructive bug.
    expect(updates.events[0].detail).toEqual({
      taskId: SUBJECT_ID,
      fields: { removeRelationships: [target.id] },
    });
    expect(updates.events[0].bubbles).toBe(true);
    expect(updates.events[0].composed).toBe(true);
  });

  it('removes the right target when several relationships share a section', async () => {
    const first = task({ id: 'first', name: 'First prerequisite' });
    const second = task({ id: 'second', name: 'Second prerequisite' });
    const subject = task({ id: SUBJECT_ID, relationships: blockedBy(first.id, second.id) });
    const view = await mountPanel(subject, storeWith(subject, first, second));
    const updates = capture<{ fields: { removeRelationships: string[] } }>(view, 'task-update');

    click(deleteButtons(section(view, 'Blocked by'))[1]);

    expect(updates.events.map((e) => e.detail.fields.removeRelationships)).toEqual([[second.id]]);
  });

  it('does not also select the target when its delete button is clicked', async () => {
    // The delete button sits inside the clickable entry; without
    // stopPropagation the inspector would navigate away mid-removal.
    const target = task({ id: 'target', name: 'Prerequisite' });
    const subject = task({ id: SUBJECT_ID, relationships: blockedBy(target.id) });
    const view = await mountPanel(subject, storeWith(subject, target));
    const selects = capture<{ taskId: string }>(view, 'task-select');
    const updates = capture<unknown>(view, 'task-update');

    click(deleteButtons(section(view, 'Blocked by'))[0]);

    expect(updates.events).toHaveLength(1);
    expect(selects.events).toHaveLength(0);
  });

  it('offers delete on relationship entries but not on hierarchy entries', async () => {
    const parent = task({ id: 'parent', name: 'Parent task' });
    const child = task({ id: 'kid', name: 'Child task', parentTaskId: SUBJECT_ID });
    const target = task({ id: 'target', name: 'Prerequisite' });
    const subject = task({ id: SUBJECT_ID, parentTaskId: parent.id, relationships: blockedBy(target.id) });
    const view = await mountPanel(subject, storeWith(subject, parent, child, target));

    expect(deleteButtons(section(view, 'Blocked by'))).toHaveLength(1);
    expect(deleteButtons(section(view, 'Parent'))).toHaveLength(0);
    expect(deleteButtons(section(view, 'Children'))).toHaveLength(0);
  });

  it('hides every delete button when the panel is read-only, while still listing the entries', async () => {
    const target = task({ id: 'target', name: 'Prerequisite' });
    const subject = task({ id: SUBJECT_ID, relationships: blockedBy(target.id) });
    const store = storeWith(subject, target);

    const editable = await mountPanel(subject, store);
    expect(deleteButtons(section(editable, 'Blocked by'))).toHaveLength(1);

    const readOnly = await mountPanel(subject, store, { readOnly: true });
    expect(deleteButtons(section(readOnly, 'Blocked by'))).toHaveLength(0);
    expect(entryNames(section(readOnly, 'Blocked by'))).toEqual(['Prerequisite']);
  });
});

describe('ft-inspector-relationships — adding a relationship', () => {
  it('offers an add button only for the two proto-mutable relationship types', async () => {
    const subject = task({ id: SUBJECT_ID });
    const view = await mountPanel(subject, storeWith(subject));

    expect(addButton(section(view, 'Blocked by'))).not.toBeNull();
    expect(addButton(section(view, 'Blocks'))).not.toBeNull();
    expect(addButton(section(view, 'Related'))).toBeNull();
    expect(addButton(section(view, 'Duplicate of'))).toBeNull();
    expect(addButton(section(view, 'Parent'))).toBeNull();
    expect(addButton(section(view, 'Children'))).toBeNull();
  });

  for (const [label, relationshipType] of [
    ['Blocked by', RelationshipType.BLOCKED_BY],
    ['Blocks', RelationshipType.BLOCKS],
  ] as const) {
    it(`dispatches open-add-relationship for ${label} with that relationship type`, async () => {
      const subject = task({ id: SUBJECT_ID });
      const view = await mountPanel(subject, storeWith(subject));
      const opens = capture<{ taskId: string; relationshipType: RelationshipType }>(
        view,
        'open-add-relationship',
      );

      click(addButton(section(view, label))!);

      expect(opens.events).toHaveLength(1);
      expect(opens.events[0].detail).toEqual({ taskId: SUBJECT_ID, relationshipType });
      expect(opens.events[0].bubbles).toBe(true);
      expect(opens.events[0].composed).toBe(true);
    });
  }

  it('hides the add buttons when the panel is read-only', async () => {
    const subject = task({ id: SUBJECT_ID });
    const store = storeWith(subject);

    const editable = await mountPanel(subject, store);
    expect(addButton(section(editable, 'Blocks'))).not.toBeNull();

    const readOnly = await mountPanel(subject, store, { readOnly: true });
    expect(addButton(section(readOnly, 'Blocks'))).toBeNull();
  });
});

describe('ft-inspector-relationships — dependency attention callout', () => {
  for (const stage of UNSUCCESSFUL_TERMINAL_STAGES) {
    it(`warns that a ${STAGE_LABEL[stage]} prerequisite is still blocking the task`, async () => {
      const blocker = task({ id: 'blocker', name: 'Dead prerequisite', stage });
      const subject = dependent(blockedBy(blocker.id));
      const store = storeWith(subject, blocker);
      // Oracle: the shared helper decides what "needs attention" means.
      expect(attentionBlockers(subject, store)).toEqual([blocker]);

      const view = await mountPanel(subject, store);

      const block = callout(view, ATTENTION_TITLE);
      expect(block).not.toBeNull();
      expect(clean(block)).toContain('An unsuccessful terminal prerequisite is still blocking this task.');
      expect(calloutButtons(block!)).toEqual([`Remove ${blocker.name}`, 'Rewire prerequisite']);
    });
  }

  it('counts the blockers when more than one prerequisite needs attention', async () => {
    const dead = task({ id: 'dead', name: 'Abandoned', stage: TaskStage.WONT_FIX });
    const gone = task({ id: 'gone', name: 'Cancelled work', stage: TaskStage.CANCELLED });
    const fine = task({ id: 'fine', name: 'Shipped', stage: TaskStage.COMPLETED });
    const subject = dependent(blockedBy(dead.id, gone.id, fine.id));
    const store = storeWith(subject, dead, gone, fine);
    expect(attentionBlockers(subject, store)).toHaveLength(2);

    const view = await mountPanel(subject, store);

    const block = callout(view, ATTENTION_TITLE)!;
    expect(clean(block)).toContain('2 unsuccessful terminal prerequisites are still blocking this task.');
    // One remove action per attention blocker, plus the rewire escape hatch —
    // the healthy COMPLETED prerequisite must not be offered for removal.
    expect(calloutButtons(block)).toEqual([`Remove ${dead.name}`, `Remove ${gone.name}`, 'Rewire prerequisite']);
  });

  it('shows the plain blocked notice instead of the warning when the prerequisites are healthy', async () => {
    // Negative + positive in one fixture family: a WORKING blocker yields no
    // attention list, but the panel must still tell the user it is blocked.
    const healthy = task({ id: 'healthy', name: 'In flight', stage: TaskStage.WORKING });
    const subject = dependent(blockedBy(healthy.id));
    const store = storeWith(subject, healthy);
    expect(attentionBlockers(subject, store)).toEqual([]);
    expect(hasAvailabilityReason(subject, AvailabilityReason.BLOCKED_BY_DEPENDENCY)).toBe(true);

    const view = await mountPanel(subject, store);

    expect(callout(view, ATTENTION_TITLE)).toBeNull();
    expect(callout(view, PLAIN_BLOCKED_TITLE)).not.toBeNull();
  });

  it('shows the plain blocked notice when the blocking prerequisite is not in the store', async () => {
    const subject = dependent(blockedBy('not-loaded'));
    const store = storeWith(subject);
    expect(attentionBlockers(subject, store)).toEqual([]);

    const view = await mountPanel(subject, store);

    expect(callout(view, ATTENTION_TITLE)).toBeNull();
    expect(callout(view, PLAIN_BLOCKED_TITLE)).not.toBeNull();
  });

  it('renders neither notice without a BLOCKED_BY_DEPENDENCY availability reason', async () => {
    const blocker = task({ id: 'blocker', name: 'Abandoned', stage: TaskStage.WONT_FIX });
    const relationships = blockedBy(blocker.id);
    const unflagged = task({
      id: SUBJECT_ID,
      relationships,
      availability: { available: false, reasons: [AvailabilityReason.HELD] },
    });
    const store = storeWith(unflagged, blocker);
    expect(hasAvailabilityReason(unflagged, AvailabilityReason.BLOCKED_BY_DEPENDENCY)).toBe(false);

    const view = await mountPanel(unflagged, store);
    expect(queryAllDeep(view, '.attention')).toHaveLength(0);

    // Positive counterpart: flagging the identical fixture produces the warning.
    const flagged = dependent(relationships);
    const flaggedView = await mountPanel(flagged, storeWith(flagged, blocker));
    expect(callout(flaggedView, ATTENTION_TITLE)).not.toBeNull();
  });

  it('never renders both notices at once', async () => {
    const blocker = task({ id: 'blocker', name: 'Abandoned', stage: TaskStage.WONT_FIX });
    const subject = dependent(blockedBy(blocker.id));
    const view = await mountPanel(subject, storeWith(subject, blocker));

    expect(queryAllDeep(view, '.attention')).toHaveLength(1);
    expect(callout(view, PLAIN_BLOCKED_TITLE)).toBeNull();
  });

  it('removes the blocking relationship from the callout action', async () => {
    const blocker = task({ id: 'blocker', name: 'Abandoned', stage: TaskStage.WONT_FIX });
    const subject = dependent(blockedBy(blocker.id));
    const view = await mountPanel(subject, storeWith(subject, blocker));
    const updates = capture<{ taskId: string; fields: { removeRelationships: string[] } }>(view, 'task-update');

    click(callout(view, ATTENTION_TITLE)!.querySelectorAll('.attention-actions sl-button')[0]);

    expect(updates.events).toHaveLength(1);
    expect(updates.events[0].detail).toEqual({
      taskId: SUBJECT_ID,
      fields: { removeRelationships: [blocker.id] },
    });
  });

  it('asks to rewire the prerequisite as a BLOCKED_BY addition', async () => {
    const blocker = task({ id: 'blocker', name: 'Abandoned', stage: TaskStage.WONT_FIX });
    const subject = dependent(blockedBy(blocker.id));
    const view = await mountPanel(subject, storeWith(subject, blocker));
    const opens = capture<{ taskId: string; relationshipType: RelationshipType }>(view, 'open-add-relationship');

    const buttons = callout(view, ATTENTION_TITLE)!.querySelectorAll('.attention-actions sl-button');
    click(buttons[buttons.length - 1]);

    expect(opens.events).toHaveLength(1);
    expect(opens.events[0].detail).toEqual({
      taskId: SUBJECT_ID,
      relationshipType: RelationshipType.BLOCKED_BY,
    });
  });

  it('still explains the problem read-only, but offers no actions', async () => {
    const blocker = task({ id: 'blocker', name: 'Abandoned', stage: TaskStage.WONT_FIX });
    const subject = dependent(blockedBy(blocker.id));
    const store = storeWith(subject, blocker);

    const editable = await mountPanel(subject, store);
    expect(calloutButtons(callout(editable, ATTENTION_TITLE)!)).toHaveLength(2);

    const readOnly = await mountPanel(subject, store, { readOnly: true });
    const block = callout(readOnly, ATTENTION_TITLE);
    expect(block).not.toBeNull();
    expect(clean(block)).toContain('An unsuccessful terminal prerequisite is still blocking this task.');
    expect(calloutButtons(block!)).toEqual([]);
  });

  it('lists an attention blocker in the Blocked by section as well as the callout', async () => {
    // The callout is an addition, not a replacement: the relationship itself
    // must stay visible and navigable in its section.
    const blocker = task({ id: 'blocker', name: 'Abandoned', stage: TaskStage.WONT_FIX });
    const subject = dependent(blockedBy(blocker.id));
    const view = await mountPanel(subject, storeWith(subject, blocker));

    expect(entryNames(section(view, 'Blocked by'))).toEqual(['Abandoned']);
    expect(clean(section(view, 'Blocked by'))).toContain(STAGE_LABEL[TaskStage.WONT_FIX]);
  });
});

describe('ft-inspector-relationships — store dependency', () => {
  it('requires a store: rendering a task without one fails loudly rather than rendering a blank panel', async () => {
    // Documented behaviour, not an endorsement. `render()` guards `task` but
    // dereferences `this.store` unconditionally, so a task-without-store mount
    // throws during the update. Recorded so a future change to that contract
    // is a deliberate one.
    const element = document.createElement('ft-inspector-relationships');
    (element as HTMLElement & { task: Task }).task = task({ id: SUBJECT_ID });
    document.body.append(element);

    await expect(
      (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete,
    ).rejects.toThrow(TypeError);

    element.remove();
  });
});
