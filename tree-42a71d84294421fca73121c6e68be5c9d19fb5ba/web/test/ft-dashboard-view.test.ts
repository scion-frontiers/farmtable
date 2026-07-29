import { describe, expect, it, onTestFinished } from 'vitest';
import '../src/components/ft-dashboard-view.js';
import {
  AvailabilityReason,
  TaskHoldReason,
  TaskPriority,
  TaskStage,
  type Task,
} from '../src/gen/types.js';
import {
  ACTIVE_STAGE_OPTIONS,
  AVAILABILITY_REASON_LABEL,
  CLOSED_STAGE_OPTIONS,
} from '../src/util/task-state-utils.js';
import { PRIORITY_LABEL } from '../src/util/priority-utils.js';
import { mount, queryAllDeep, queryDeep, settle, textDeep } from './helpers/dom.js';
import { NATIVE_STAGES, storeWith, task, user } from './helpers/fixtures.js';
import { TaskStore } from '../src/store/task-store.js';

const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

async function mountDashboard(tasks: Task[]) {
  return mount<HTMLElement>('ft-dashboard-view', { store: storeWith(...tasks) });
}

/** The labels of every stat card, in the order a reader sees them. */
function statLabels(view: Element): string[] {
  return queryAllDeep<HTMLElement>(view, '.stat-card').map((card) =>
    (queryDeep<HTMLElement>(card, '.stat-label')?.textContent ?? '').trim(),
  );
}

/**
 * The one stat card carrying `label`.
 *
 * Deliberately *not* a text search over the whole view: "Available" also appears
 * in the ready card's `aria-label` and "Unavailable" in a section heading, so a
 * loose `textDeep()` assertion would stay green with the card deleted.
 */
function statCard(view: Element, label: string): HTMLElement {
  const match = queryAllDeep<HTMLElement>(view, '.stat-card').find(
    (card) => (queryDeep<HTMLElement>(card, '.stat-label')?.textContent ?? '').trim() === label,
  );
  if (!match) throw new Error(`no .stat-card labelled "${label}" (found: ${statLabels(view).join(', ')})`);
  return match;
}

/** The number rendered inside the stat card carrying `label`. */
function statCount(view: Element, label: string): number {
  const text = (queryDeep<HTMLElement>(statCard(view, label), '.stat-count')?.textContent ?? '').trim();
  return Number(text);
}

/**
 * The element following a `.section-title` with the given heading.
 *
 * Both the priority section and the unavailable-reasons section render the same
 * `.priority-badges` / `.priority-item` markup, so the heading is the only thing
 * that tells them apart. Returns `null` when the section is not rendered at all.
 */
function sectionBody(view: Element, heading: string): HTMLElement | null {
  const title = queryAllDeep<HTMLElement>(view, '.section-title').find(
    (node) => (node.textContent ?? '').trim() === heading,
  );
  return (title?.nextElementSibling as HTMLElement | null) ?? null;
}

/** `{ label, count }` for every badge under a `.priority-badges` section. */
function badgeCounts(view: Element, heading: string): { label: string; count: number }[] {
  const body = sectionBody(view, heading);
  if (!body) return [];
  return queryAllDeep<HTMLElement>(body, '.priority-item').map((item) => ({
    label: (queryDeep<HTMLElement>(item, 'sl-badge')?.textContent ?? '').trim(),
    count: Number((queryDeep<HTMLElement>(item, '.priority-count')?.textContent ?? '').trim()),
  }));
}

/**
 * Record every `view-change` that reaches `document`.
 *
 * Listening on `document` rather than on the component proves the event really
 * escapes the component: a non-bubbling or non-composed event would never be
 * seen by the app shell that actually performs the navigation.
 */
function captureViewChange(): CustomEvent[] {
  const events: CustomEvent[] = [];
  const handler = (event: Event) => events.push(event as CustomEvent);
  document.addEventListener('view-change', handler);
  onTestFinished(() => document.removeEventListener('view-change', handler));
  return events;
}

function pressKey(element: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

describe('ft-dashboard-view — state stat cards', () => {
  it('renders the six state cards in a fixed order', async () => {
    const view = await mountDashboard([task({ id: 't1' })]);

    expect(statLabels(view)).toEqual([
      'Active',
      'Closed',
      'Held',
      'Unavailable',
      'Available',
      'Total',
    ]);
  });

  /**
   * Active/Closed is a partition, not an overlay: every task lands in exactly
   * one of the two. The expected split comes from the production stage lists so
   * a stage moving between them cannot leave this test asserting a stale
   * hand-copied number.
   */
  it('splits every task into exactly one of Active or Closed', async () => {
    const tasks = NATIVE_STAGES.map((stage) => task({ id: `stage-${stage}`, stage }));

    const view = await mountDashboard(tasks);

    expect(statCount(view, 'Active')).toBe(ACTIVE_STAGE_OPTIONS.length);
    expect(statCount(view, 'Closed')).toBe(CLOSED_STAGE_OPTIONS.length);
    expect(statCount(view, 'Active') + statCount(view, 'Closed')).toBe(tasks.length);
    expect(statCount(view, 'Total')).toBe(tasks.length);
  });

  /**
   * Held is an overlay on top of the Active/Closed partition, not a third
   * bucket. If someone ever turns the counting loop into an if/else chain the
   * held task would vanish from Active and the invariant above would break
   * silently for held work only — this pins the double count.
   */
  it('counts a held active task in both the Active and the Held card', async () => {
    const held = task({
      id: 'held',
      stage: TaskStage.WORKING,
      holdReason: TaskHoldReason.WAITING_FOR_INPUT,
    });

    const view = await mountDashboard([held]);

    expect(statCount(view, 'Active')).toBe(1);
    expect(statCount(view, 'Held')).toBe(1);
    expect(statCount(view, 'Closed')).toBe(0);
    expect(statCount(view, 'Total')).toBe(1);
  });

  /**
   * `UNSPECIFIED` (0) means "not held". A `holdReason !== undefined` test would
   * count this task, so the card must go through `hasHoldReason()`.
   */
  it('does not count a task whose hold reason is UNSPECIFIED as held', async () => {
    const view = await mountDashboard([
      task({ id: 'unset', holdReason: TaskHoldReason.UNSPECIFIED }),
      task({ id: 'absent' }),
    ]);

    expect(statCount(view, 'Held')).toBe(0);
  });

  /**
   * The Unavailable card is a strict `availability?.available === false` test.
   *
   * `no-payload` is a task the *local* readiness fallback would reject (triage,
   * held), yet the server never reported on it. A loose `!available` check would
   * fold it in and report 2 — this is the regression that mutation M1 injects.
   */
  it('counts only the tasks the server explicitly marked unavailable', async () => {
    const noPayload = task({
      id: 'no-payload',
      stage: TaskStage.TRIAGE,
      holdReason: TaskHoldReason.DEFERRED,
    });
    const serverSaysNo = task({
      id: 'server-no',
      availability: { available: false, reasons: [AvailabilityReason.HELD] },
    });
    const serverSaysYes = task({
      id: 'server-yes',
      availability: { available: true, reasons: [] },
    });

    const view = await mountDashboard([noPayload, serverSaysNo, serverSaysYes]);

    expect(statCount(view, 'Unavailable')).toBe(1);
    expect(statCount(view, 'Total')).toBe(3);
  });

  /**
   * The complementary half of the strictness pin: a store in which *no* task
   * carries an availability payload reports zero unavailable, however unready
   * those tasks look locally.
   */
  it('reports zero unavailable when no task carries an availability payload', async () => {
    const view = await mountDashboard([
      task({ id: 'triage', stage: TaskStage.TRIAGE }),
      task({ id: 'assigned', assignees: [user('u1')] }),
      task({ id: 'future', startDate: FUTURE }),
      task({ id: 'done', stage: TaskStage.COMPLETED }),
    ]);

    expect(statCount(view, 'Unavailable')).toBe(0);
  });

  /**
   * The Available card runs the shared `isReady()` predicate, for which the
   * server payload is authoritative. A card that re-derived readiness from stage
   * and assignees would count 1 here (the accepted task) instead of 2.
   */
  it('counts a task the server marks available even when the local fallback would reject it', async () => {
    const serverSaysYes = task({
      id: 'server-yes',
      stage: TaskStage.TRIAGE,
      assignees: [user('u1')],
      holdReason: TaskHoldReason.WAITING_FOR_INPUT,
      availability: { available: true, reasons: [] },
    });
    const fallbackReady = task({ id: 'fallback', stage: TaskStage.ACCEPTED });
    const serverSaysNo = task({
      id: 'server-no',
      stage: TaskStage.ACCEPTED,
      availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
    });

    const view = await mountDashboard([serverSaysYes, fallbackReady, serverSaysNo]);

    expect(statCount(view, 'Available')).toBe(2);
  });

  it('recounts when a task is added to the store after mount', async () => {
    const store = new TaskStore();
    store.upsert(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    store.snapshotComplete();
    const view = await mount<HTMLElement>('ft-dashboard-view', { store });
    expect(statCount(view, 'Total')).toBe(1);

    store.upsert(task({ id: 't2', stage: TaskStage.COMPLETED }));
    await settle(view);

    expect(statCount(view, 'Total')).toBe(2);
    expect(statCount(view, 'Closed')).toBe(1);
  });
});

describe('ft-dashboard-view — the Available card navigates to the Available Queue', () => {
  const readyCard = (view: Element) => statCard(view, 'Available');

  it('exposes the Available card to the keyboard as a link', async () => {
    const view = await mountDashboard([task({ id: 't1' })]);

    const card = readyCard(view);
    expect(card.getAttribute('role')).toBe('link');
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.getAttribute('aria-label')).toContain('Available Queue');
  });

  it('dispatches a bubbling composed view-change for the Available Queue when clicked', async () => {
    const events = captureViewChange();
    const view = await mountDashboard([task({ id: 't1', stage: TaskStage.ACCEPTED })]);

    readyCard(view).click();

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ view: 'ready-queue' });
    // Without both flags the event never leaves the shadow root for the shell.
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  for (const key of ['Enter', ' ']) {
    it(`dispatches view-change and suppresses the default action on "${key === ' ' ? 'Space' : key}"`, async () => {
      const events = captureViewChange();
      const view = await mountDashboard([task({ id: 't1', stage: TaskStage.ACCEPTED })]);

      const event = pressKey(readyCard(view), key);

      expect(events).toHaveLength(1);
      expect(events[0].detail).toEqual({ view: 'ready-queue' });
      // Space would otherwise scroll the page out from under the user.
      expect(event.defaultPrevented).toBe(true);
    });
  }

  it('ignores keys other than Enter and Space on the Available card', async () => {
    const events = captureViewChange();
    const view = await mountDashboard([task({ id: 't1' })]);

    const event = pressKey(readyCard(view), 'ArrowDown');

    expect(events).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  /**
   * Only the Available card is a link. The others share the `.stat-card` class,
   * so a handler attached to the wrong element (or to the container) would make
   * the whole strip navigate.
   */
  it('does not dispatch view-change when any other stat card is clicked', async () => {
    const events = captureViewChange();
    const view = await mountDashboard([task({ id: 't1' })]);

    for (const label of ['Active', 'Closed', 'Held', 'Unavailable', 'Total']) {
      statCard(view, label).click();
      pressKey(statCard(view, label), 'Enter');
    }

    expect(events).toEqual([]);
  });
});

describe('ft-dashboard-view — Unavailable Reasons breakdown', () => {
  const HEADING = 'Unavailable Reasons';

  /**
   * Labels are asserted against the production `AVAILABILITY_REASON_LABEL` map
   * rather than literals, so re-wording a reason cannot silently change what the
   * dashboard says without this test following along.
   */
  it('tallies each reason across unavailable tasks using the shared reason labels', async () => {
    const heldA = task({
      id: 'held-a',
      availability: { available: false, reasons: [AvailabilityReason.HELD] },
    });
    const heldB = task({
      id: 'held-b',
      availability: { available: false, reasons: [AvailabilityReason.HELD] },
    });
    const blocked = task({
      id: 'blocked',
      availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
    });

    const view = await mountDashboard([heldA, heldB, blocked]);

    expect(badgeCounts(view, HEADING)).toEqual([
      { label: AVAILABILITY_REASON_LABEL[AvailabilityReason.HELD], count: 2 },
      { label: AVAILABILITY_REASON_LABEL[AvailabilityReason.BLOCKED_BY_DEPENDENCY], count: 1 },
    ]);
  });

  /** One task can be unavailable for several reasons; each reason gets a tally. */
  it('counts every reason on a task that is unavailable for more than one', async () => {
    const multi = task({
      id: 'multi',
      availability: {
        available: false,
        reasons: [AvailabilityReason.TRIAGE, AvailabilityReason.BLOCKED_BY_DEPENDENCY],
      },
    });

    const view = await mountDashboard([multi]);

    expect(badgeCounts(view, HEADING)).toEqual([
      { label: AVAILABILITY_REASON_LABEL[AvailabilityReason.TRIAGE], count: 1 },
      { label: AVAILABILITY_REASON_LABEL[AvailabilityReason.BLOCKED_BY_DEPENDENCY], count: 1 },
    ]);
    expect(statCount(view, 'Unavailable')).toBe(1);
  });

  it('omits reasons that no unavailable task carries', async () => {
    const view = await mountDashboard([
      task({ id: 'held', availability: { available: false, reasons: [AvailabilityReason.HELD] } }),
    ]);

    const labels = badgeCounts(view, HEADING).map((entry) => entry.label);
    expect(labels).toEqual([AVAILABILITY_REASON_LABEL[AvailabilityReason.HELD]]);
    expect(labels).not.toContain(AVAILABILITY_REASON_LABEL[AvailabilityReason.TERMINAL]);
  });

  it('renders no Unavailable Reasons section when nothing is unavailable', async () => {
    const view = await mountDashboard([
      task({ id: 'yes', availability: { available: true, reasons: [] } }),
      task({ id: 'none' }),
    ]);

    expect(sectionBody(view, HEADING)).toBeNull();
    expect(textDeep(view)).not.toContain(HEADING);
  });

  /**
   * The tally is guarded by `available !== false`, so stale reasons attached to
   * a task the server says *is* available must not appear under a heading that
   * claims the opposite.
   */
  it('ignores reasons attached to a task the server reports as available', async () => {
    const contradictory = task({
      id: 'stale',
      availability: { available: true, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
    });

    const view = await mountDashboard([contradictory]);

    expect(sectionBody(view, HEADING)).toBeNull();
    expect(textDeep(view)).not.toContain(
      AVAILABILITY_REASON_LABEL[AvailabilityReason.BLOCKED_BY_DEPENDENCY],
    );
  });

  /**
   * CHARACTERISATION — see finding F-2. `UNSPECIFIED` (0) has no entry in the
   * counts table, so an unavailable task whose only reason is UNSPECIFIED is
   * counted on the Unavailable card but explains itself nowhere: the section
   * disappears entirely. The two numbers disagree and the user is told nothing.
   */
  it('counts an UNSPECIFIED-reason task as unavailable while showing no reason for it', async () => {
    const unexplained = task({
      id: 'unspecified',
      availability: { available: false, reasons: [AvailabilityReason.UNSPECIFIED] },
    });

    const view = await mountDashboard([unexplained]);

    expect(statCount(view, 'Unavailable')).toBe(1);
    expect(sectionBody(view, HEADING)).toBeNull();
  });
});

describe('ft-dashboard-view — priority breakdown', () => {
  const HEADING = 'Tasks by Priority';

  /**
   * Unlike the reasons section, the priority section always lists all five
   * buckets, including empty ones. Labels come from the production map.
   */
  it('lists every priority bucket, including the empty ones', async () => {
    const view = await mountDashboard([
      task({ id: 'u1', priority: TaskPriority.URGENT }),
      task({ id: 'u2', priority: TaskPriority.URGENT }),
      task({ id: 'n1', priority: TaskPriority.NORMAL }),
    ]);

    expect(badgeCounts(view, HEADING)).toEqual([
      { label: PRIORITY_LABEL[TaskPriority.URGENT], count: 2 },
      { label: PRIORITY_LABEL[TaskPriority.HIGH], count: 0 },
      { label: PRIORITY_LABEL[TaskPriority.NORMAL], count: 1 },
      { label: PRIORITY_LABEL[TaskPriority.LOW], count: 0 },
      { label: PRIORITY_LABEL[TaskPriority.UNSPECIFIED], count: 0 },
    ]);
  });

  /** A task with no priority field falls into the UNSPECIFIED bucket. */
  it('counts a task with no priority under the unspecified bucket', async () => {
    const view = await mountDashboard([task({ id: 'bare', priority: undefined })]);

    const unspecified = badgeCounts(view, HEADING).find(
      (entry) => entry.label === PRIORITY_LABEL[TaskPriority.UNSPECIFIED],
    );
    expect(unspecified).toEqual({ label: PRIORITY_LABEL[TaskPriority.UNSPECIFIED], count: 1 });
  });
});

describe('ft-dashboard-view — empty store', () => {
  /**
   * Zero tasks is not "six zeroes": the component swaps the whole dashboard for
   * an empty state. Asserting the cards are *absent* keeps this honest — a
   * dashboard showing six 0s would be a different (and arguably worse) design.
   */
  it('renders an empty state instead of zeroed stat cards when the store is empty', async () => {
    const view = await mountDashboard([]);

    const empty = queryDeep<HTMLElement>(view, 'ft-empty-state');
    expect(empty).not.toBeNull();
    expect(empty!.getAttribute('role')).toBe('status');
    expect(textDeep(empty!)).toContain('No tasks yet');
    expect(queryAllDeep(view, '.stat-card')).toHaveLength(0);
    expect(sectionBody(view, 'Tasks by State')).toBeNull();
  });

  it('renders the stat cards again once the empty store receives a task', async () => {
    const store = new TaskStore();
    store.snapshotComplete();
    const view = await mount<HTMLElement>('ft-dashboard-view', { store });
    expect(queryAllDeep(view, '.stat-card')).toHaveLength(0);

    store.upsert(task({ id: 't1' }));
    await settle(view);

    expect(statLabels(view)).toHaveLength(6);
    expect(statCount(view, 'Total')).toBe(1);
  });
});
