import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

/**
 * Contract §10's attention view: *finding* the tasks that are blocked by an
 * unsuccessful terminal prerequisite, rather than being told so once you are
 * already looking at one.
 *
 * Why this is a feature and not polish: contract §11 says `cancelled` and
 * `wont_fix` do NOT automatically unblock dependents. These tasks are stranded
 * permanently, by design, and nothing in the system will ever raise them. The
 * card badge and the inspector callout both require you to have already found
 * the task; this is the affordance that lets you find it.
 *
 * Everything here binds to the real `attentionBlockers()`. Nothing re-derives
 * "needs attention" locally — a second definition in the tests would go on
 * agreeing with itself after production stopped agreeing with either.
 */

const COLLECTION_ID = '00000000-0000-0000-0000-0000000000c1';

/**
 * `ft-app.connectedCallback()` builds a real gRPC-web client and starts a watch
 * stream. Mocking the factory module is the system boundary: it removes the
 * network and leaves every line of `ft-app` under test.
 */
vi.mock('../src/gen/grpc-client.js', () => ({
  createGrpcFarmTableClientWithOptions: () => ({
    listCollections: async () => [],
    getCollection: async () => ({ id: COLLECTION_ID, name: 'Test', platform: 1 }),
    listTasks: async () => [],
    listUsers: async () => [],
    listComments: async () => [],
    listChanges: async () => [],
    getTask: async () => undefined,
    updateTask: async () => undefined,
    addComment: async () => undefined,
    async *watchTasks() {
      /* no events */
    },
  }),
}));

import '../src/components/ft-app.js';
import '../src/components/ft-dashboard-view.js';
// Custom elements register on module import, and `ft-app` refers to several of
// these by tag name only — `src/index.ts` is what pulls them in for the real
// build. Without these imports the toolbar and the board's columns render as
// inert unknown elements, so the filter is unreachable and every card
// assertion sees zero.
import '../src/components/ft-toolbar.js';
import '../src/components/kanban/ft-kanban-view.js';
import '../src/components/kanban/ft-kanban-column.js';
import '../src/components/kanban/ft-task-card.js';
import { AvailabilityReason, RelationshipType, TaskStage, type Task } from '../src/gen/types.js';
import { matchesTaskFilters, type TaskFilterChangeDetail } from '../src/components/task-filters.js';
import { ATTENTION, attentionBlockers } from '../src/util/task-state-utils.js';
import { mount, queryAllDeep, queryDeep, selectValue, settle } from './helpers/dom.js';
import { storeWith, task } from './helpers/fixtures.js';
import type { TaskStore } from '../src/store/task-store.js';

// ── The fixture the whole file turns on ───────────────────────────────────
//
// STRANDED  — dependency-blocked, blocker CANCELLED. The one to find.
// WAITING   — dependency-blocked, blocker still WORKING. The near miss: an
//             identical availability payload and a completely different
//             meaning. A filter that keys off BLOCKED_BY_DEPENDENCY and stops
//             returns this one too, and the user is shown work that is
//             progressing normally mixed in with work that is stranded.
// UNRELATED — plain available task, no relationships at all.

const CANCELLED_BLOCKER = task({ id: 'blocker-dead', name: 'Ship v1', stage: TaskStage.CANCELLED });
const OPEN_BLOCKER = task({ id: 'blocker-open', name: 'Ship v2', stage: TaskStage.WORKING });

const STRANDED = task({
  id: 'stranded',
  name: 'Stranded behind a cancelled prerequisite',
  availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
  relationships: [{ type: RelationshipType.BLOCKED_BY, targetTaskId: CANCELLED_BLOCKER.id }],
});

const WAITING = task({
  id: 'waiting',
  name: 'Waiting on work still in progress',
  availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
  relationships: [{ type: RelationshipType.BLOCKED_BY, targetTaskId: OPEN_BLOCKER.id }],
});

const UNRELATED = task({
  id: 'unrelated',
  name: 'Nothing to do with any of this',
  availability: { available: true, reasons: [] },
});

const FIXTURE = [CANCELLED_BLOCKER, OPEN_BLOCKER, STRANDED, WAITING, UNRELATED];

/** Every rendered card's title, in DOM order. */
function cardTitles(root: Element): string[] {
  return queryAllDeep<HTMLElement>(root, 'ft-task-card').map(
    (card) => (card as HTMLElement & { task: Task }).task.name,
  );
}

describe('attention filter — matchesTaskFilters', () => {
  const store = storeWith(...FIXTURE);
  const matches = (subject: Task) =>
    matchesTaskFilters(subject, null, null, null, 'attention', null, store);

  /**
   * A guard on the fixture itself. Every assertion below is only meaningful if
   * the real predicate splits these tasks one-from-two; if the fixture ever
   * stopped exercising the distinction, the filter tests would go quiet rather
   * than red.
   */
  it('is built on a fixture the real predicate splits one-from-two', () => {
    const attention = store.allTasks.filter((t) => attentionBlockers(t, store).length > 0);

    expect(attention.map((t) => t.id)).toEqual([STRANDED.id]);
    expect(attentionBlockers(WAITING, store)).toEqual([]);
  });

  it('keeps the task whose prerequisite was cancelled', () => {
    expect(matches(STRANDED)).toBe(true);
  });

  /**
   * THE case that matters. `WAITING` carries an identical availability payload
   * and differs only in its blocker's stage.
   */
  it('drops the task whose prerequisite is still open, despite the identical availability payload', () => {
    expect(WAITING.availability).toEqual(STRANDED.availability);
    expect(matches(WAITING)).toBe(false);
  });

  it('drops a task with no dependency at all', () => {
    expect(matches(UNRELATED)).toBe(false);
  });

  /**
   * The refinement has to stay a refinement: everything it returns is also
   * returned by the reason it narrows, which is what justifies putting it in
   * the Availability control rather than in a filter of its own. Both sides are
   * computed by production, so widening `isUnsuccessfulTerminalStage` cannot
   * break containment without this failing.
   */
  it('returns a strict subset of the dependency-blocked filter', () => {
    const blocked = store.allTasks.filter((t) =>
      matchesTaskFilters(t, null, null, null, AvailabilityReason.BLOCKED_BY_DEPENDENCY, null, store),
    );
    const attention = store.allTasks.filter(matches);

    expect(attention.map((t) => t.id)).toEqual([STRANDED.id]);
    expect(blocked.map((t) => t.id)).toEqual([STRANDED.id, WAITING.id]);
    for (const subject of attention) expect(blocked).toContain(subject);
  });

  /**
   * It composes with the other filters rather than overriding them. Without
   * this, an attention branch that returned early on a match would pass
   * everything above.
   */
  it('still honours the other filters alongside the attention filter', () => {
    expect(STRANDED.stage).not.toBe(TaskStage.IN_QA);
    expect(matchesTaskFilters(STRANDED, null, TaskStage.IN_QA, null, 'attention', null, store)).toBe(
      false,
    );
    expect(matchesTaskFilters(STRANDED, null, STRANDED.stage, null, 'attention', null, store)).toBe(
      true,
    );
    expect(matchesTaskFilters(STRANDED, null, null, null, 'attention', 'nobody', store)).toBe(false);
  });
});

describe('attention filter — the board shows exactly the attention set', () => {
  it('renders only the stranded task once the attention filter is applied', async () => {
    const view = await mount<HTMLElement>('ft-kanban-view', { store: storeWith(...FIXTURE) });

    // Unfiltered first, so the narrowing below is a real narrowing rather than
    // a board that renders nothing whatever the filter says.
    expect(cardTitles(view)).toHaveLength(FIXTURE.length);

    (view as HTMLElement & { availabilityFilter: string }).availabilityFilter = 'attention';
    await settle(view);

    expect(cardTitles(view)).toEqual([STRANDED.name]);
  });
});

// ── End to end, through the real shell ────────────────────────────────────

interface AppStore extends TaskStore {
  isLoading: boolean;
}

/**
 * Mount `ft-app`, route it to `view`, seed the store, return the app.
 *
 * The store never leaves its loading state without a snapshot and the mocked
 * stream delivers none, so the view would otherwise render a spinner forever.
 * Same shape as `mountAppShowing` in `ft-app.write-error-seam.test.ts`.
 */
async function mountAppShowing(view: 'kanban' | 'dashboard', seed: Task[]): Promise<HTMLElement> {
  window.history.replaceState({}, '', `/?collection=${COLLECTION_ID}&view=${view}`);
  const app = await mount<HTMLElement>('ft-app');

  const tag = `ft-${view}-view`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const store = (app as unknown as { taskStore?: AppStore }).taskStore;
    for (const seeded of seed) store?.upsert(seeded);
    if (store?.isLoading) store.snapshotComplete();
    await settle(app);
    if (queryDeep(app, tag)) return app;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`ft-app never rendered <${tag}>`);
}

beforeEach(() => {
  vi.stubGlobal('fetch', async () => new Response(null, { status: 404 }));
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('attention view — reachable end to end from the toolbar', () => {
  function availabilitySelect(app: Element): HTMLElement {
    const select = queryDeep<HTMLElement>(app, 'sl-select[placeholder="Availability"]');
    if (!select) throw new Error('the Availability filter is not reachable in the toolbar');
    return select;
  }

  /**
   * The whole affordance, driven the way a user drives it: pick the option out
   * of the Availability dropdown and read the board.
   *
   * This is what the predicate tests cannot prove. Every wire has to be live —
   * the option rendered, `parseAvailabilityFilter` returning the string
   * unmangled rather than `NaN`, `filter-change` reaching `ft-app`, `ft-app`
   * forwarding both the filter AND the store to the board, and
   * `matchesTaskFilters` consulting the real predicate. Break any one and this
   * goes red.
   */
  it('lists exactly the stranded task after choosing Needs attention in the toolbar', async () => {
    const app = await mountAppShowing('kanban', FIXTURE);
    expect(cardTitles(app)).toHaveLength(FIXTURE.length);

    await selectValue(availabilitySelect(app), 'attention');
    await settle(app);

    expect(cardTitles(app)).toEqual([STRANDED.name]);
  });

  /** An applied filter has to be visible and removable like every other one. */
  it('shows the active filter as a chip a user can read', async () => {
    const app = await mountAppShowing('kanban', FIXTURE);

    await selectValue(availabilitySelect(app), 'attention');
    await settle(app);

    const chips = queryDeep<HTMLElement>(app, 'ft-filter-chips');
    expect(chips, 'no ft-filter-chips rendered').not.toBeNull();
    const labels = queryAllDeep<HTMLElement>(chips!, 'sl-tag').map((tag) =>
      (tag.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(labels).toContain(`Availability: ${ATTENTION.label}`);
    expect(chips!.hidden).toBe(false);
  });
});

describe('ft-dashboard-view — the needs-attention tile', () => {
  function statCard(view: Element, label: string): HTMLElement | undefined {
    return queryAllDeep<HTMLElement>(view, '.stat-card').find(
      (card) => (queryDeep<HTMLElement>(card, '.stat-label')?.textContent ?? '').trim() === label,
    );
  }

  function attentionTile(view: Element): HTMLElement {
    const tile = statCard(view, ATTENTION.label);
    if (!tile) throw new Error('no needs-attention tile rendered');
    return tile;
  }

  /**
   * Record both navigation events at `document`, which is on the far side of
   * the dashboard's shadow boundary — so anything short of `composed: true`
   * never arrives and these assertions cannot be satisfied by a leaky local
   * listener.
   */
  function captureNavigation(): CustomEvent[] {
    const events: CustomEvent[] = [];
    const handler = (event: Event) => events.push(event as CustomEvent);
    for (const type of ['view-change', 'filter-change']) {
      document.addEventListener(type, handler);
      onTestFinished(() => document.removeEventListener(type, handler));
    }
    return events;
  }

  const mountDashboard = (tasks: Task[]) =>
    mount<HTMLElement>('ft-dashboard-view', { store: storeWith(...tasks) });

  it('counts the attention set with the real predicate, not the blocked count', async () => {
    const view = await mountDashboard(FIXTURE);

    // 1, not 2: `WAITING` is dependency-blocked but its blocker is still open.
    const count = (
      queryDeep<HTMLElement>(attentionTile(view), '.stat-count')?.textContent ?? ''
    ).trim();
    expect(count).toBe('1');
  });

  /**
   * Hidden at zero, matching the Unavailable Reasons section below it. A
   * permanent "0" would be noise on the dashboard of every healthy collection;
   * the concept stays discoverable through the Availability dropdown, which
   * lists it unconditionally.
   */
  it('renders no tile when nothing is stranded', async () => {
    const view = await mountDashboard([OPEN_BLOCKER, WAITING, UNRELATED]);

    expect(statCard(view, ATTENTION.label)).toBeUndefined();
    // And not because the dashboard rendered nothing at all.
    expect(queryAllDeep(view, '.stat-card').length).toBeGreaterThan(0);
  });

  it('exposes the tile to the keyboard and explains itself on hover', async () => {
    const tile = attentionTile(await mountDashboard(FIXTURE));

    expect(tile.getAttribute('role')).toBe('link');
    expect(tile.getAttribute('tabindex')).toBe('0');
    expect(tile.getAttribute('aria-label')).toBe(`${ATTENTION.label}: 1 — ${ATTENTION.tileAction}`);
    // Two words cannot say "nothing will ever clear these"; the tooltip does.
    expect(tile.getAttribute('title')).toBe(ATTENTION.explanation);
  });

  /**
   * Order matters: the view must switch BEFORE the filter lands, or the shell
   * applies the new filter while still on the dashboard.
   */
  it('dispatches view-change then filter-change when clicked', async () => {
    const events = captureNavigation();
    const view = await mountDashboard(FIXTURE);

    attentionTile(view).click();

    expect(events.map((e) => e.type)).toEqual(['view-change', 'filter-change']);
    // The Available Queue would show none of these — they are blocked by
    // definition — so the destination is the board.
    expect(events[0].detail).toEqual({ view: 'kanban' });
    expect(events[1].detail).toEqual({
      group: null,
      stage: null,
      holdReason: null,
      availability: 'attention',
      assigneeId: null,
    } satisfies TaskFilterChangeDetail);
    for (const event of events) {
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    }
  });

  for (const key of ['Enter', ' ']) {
    it(`activates the tile on ${key === ' ' ? 'Space' : key} and suppresses the default`, async () => {
      const events = captureNavigation();
      const view = await mountDashboard(FIXTURE);

      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      attentionTile(view).dispatchEvent(event);

      expect(events.map((e) => e.type)).toEqual(['view-change', 'filter-change']);
      // Space would otherwise scroll the page out from under the user.
      expect(event.defaultPrevented).toBe(true);
    });
  }

  it('ignores keys other than Enter and Space', async () => {
    const events = captureNavigation();
    const view = await mountDashboard(FIXTURE);

    attentionTile(view).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );

    expect(events).toEqual([]);
  });
});

describe('attention view — the tile lands the user on the set it counted', () => {
  /**
   * The join between the two halves above, and the one test neither can
   * replace: the dashboard tests stop at the event, and the board tests start
   * from a filter someone else set. Only this one proves the number a user
   * clicks and the cards they then see are the same tasks.
   *
   * `ft-app` binding `@filter-change` on `<ft-dashboard-view>` is the specific
   * wire it pins — without it the click switches view and silently shows the
   * whole board.
   */
  it('clicking the tile navigates to the board showing exactly the counted tasks', async () => {
    const app = await mountAppShowing('dashboard', FIXTURE);

    const dashboard = queryDeep<HTMLElement>(app, 'ft-dashboard-view')!;
    const tile = queryAllDeep<HTMLElement>(dashboard, '.stat-card').find(
      (card) =>
        (queryDeep<HTMLElement>(card, '.stat-label')?.textContent ?? '').trim() === ATTENTION.label,
    );
    expect(tile, 'no needs-attention tile to click').toBeDefined();
    const counted = Number((queryDeep<HTMLElement>(tile!, '.stat-count')?.textContent ?? '').trim());
    expect(counted).toBeGreaterThan(0);

    tile!.click();
    await settle(app);

    expect(queryDeep(app, 'ft-kanban-view'), 'the tile did not navigate to the board').not.toBeNull();
    expect(cardTitles(app)).toEqual([STRANDED.name]);
    expect(cardTitles(app)).toHaveLength(counted);
  });
});
