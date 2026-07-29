import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The `write-error` -> toast seam, end to end.
 *
 * This is the join the round-2 mutation run found missing. The view tests
 * assert a `write-error` event was *dispatched*; the `ft-app` mapping tests
 * assert an error *string* becomes toast text. Nobody connected the two, so
 * deleting `ft-app.onWriteError()` outright left the whole suite green — and
 * "a refused edit is never a silent no-op", the entire point of this round,
 * was not proven anywhere.
 *
 * These tests mount a real `ft-app`, let it route to a real child view, and
 * dispatch the event from that child. That pins three things at once:
 *   1. the `@write-error=${this.onWriteError}` binding in `ft-app.render()`,
 *   2. the handler body and its `detail.message` / `detail.error` branch, and
 *   3. that the resulting `<sl-alert>` is actually shown (`open`), not merely
 *      appended to the document.
 */

const COLLECTION_ID = '00000000-0000-0000-0000-0000000000c1';

/**
 * `ft-app.connectedCallback()` builds a real gRPC-web client and starts a
 * watch stream. Mocking the factory module is the system boundary here: it
 * keeps every line of `ft-app` under test while removing the network.
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
import { TaskPriority, TaskStage, type Task } from '../src/gen/types.js';
import { PRIORITY_LABEL } from '../src/util/priority-utils.js';
import { DROP_REFUSAL, STAGE_LABEL, WRITE_FAILURE } from '../src/util/task-state-utils.js';
import { dropTaskOn, flush, mount, queryAllDeep, queryDeep, settle } from './helpers/dom.js';
import { task } from './helpers/fixtures.js';

interface StubAlert extends HTMLElement {
  open?: boolean;
  variant?: string;
}

interface AppStore {
  snapshotComplete(): void;
  upsert(task: Task): boolean;
  isLoading: boolean;
}

/** Every toast currently shown, in DOM order. */
function toasts(): StubAlert[] {
  return Array.from(document.body.querySelectorAll<StubAlert>('sl-alert'));
}

function toastText(): string {
  const shown = toasts();
  if (shown.length === 0) throw new Error('no <sl-alert> toast was shown');
  return shown.map((alert) => (alert.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | ');
}

/**
 * Mount `ft-app`, route it to `view`, and return the rendered child view.
 *
 * The task store never leaves its loading state without a snapshot, and the
 * mocked stream delivers none, so the board would otherwise render a spinner
 * forever and no child view would exist to dispatch from.
 */
async function mountAppShowing(view: 'kanban' | 'ready-queue', seed: Task[] = []): Promise<Element> {
  window.history.replaceState({}, '', `/?collection=${COLLECTION_ID}&view=${view}`);
  const app = await mount<HTMLElement>('ft-app');

  const tag = `ft-${view}-view`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const store = (app as unknown as { taskStore?: AppStore }).taskStore;
    for (const seeded of seed) store?.upsert(seeded);
    if (store?.isLoading) store.snapshotComplete();
    await settle(app);
    const child = queryDeep(app, tag);
    if (child) return child;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`ft-app never rendered <${tag}>`);
}

/** Dispatch the event a child view really emits: bubbling and composed. */
function dispatchWriteError(from: Element, detail: Record<string, unknown>): void {
  from.dispatchEvent(new CustomEvent('write-error', { bubbles: true, composed: true, detail }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', async () => new Response(null, { status: 404 }));
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
  // The XSS-probe payload in the "renders as text" test writes `__xss` onto
  // globalThis if it ever executes. It does not today, so this delete is a
  // no-op — but the day it stops being a no-op is the day the key would
  // otherwise persist and make every LATER test in this file read as if it
  // had been attacked too. Clean it here so that failure stays local.
  delete (globalThis as Record<string, unknown>).__xss;
});

describe('ft-app — a view refusal reaches the user as a toast', () => {
  it('turns a kanban client-side refusal into a visible toast carrying the reason text', async () => {
    const view = await mountAppShowing('kanban');

    // The real constant `ft-kanban-view` emits, not a transcription of it.
    dispatchWriteError(view, {
      message: DROP_REFUSAL.readOnlyBoard,
      reason: 'stage-change-refused',
    });

    expect(toastText()).toContain(DROP_REFUSAL.readOnlyBoard);
  });

  it('turns a queue client-side refusal into a visible toast carrying the reason text', async () => {
    const view = await mountAppShowing('ready-queue');

    // The real constant `ft-ready-queue-view` emits. It used to be a literal
    // here — a copy of vocabulary the anchor file claims to own exclusively,
    // and tautological besides: the test dispatched a string and asserted the
    // same string, so a reword in production could never turn it red.
    dispatchWriteError(view, {
      message: DROP_REFUSAL.readOnlyQueue,
      reason: 'rank-change-refused',
    });

    expect(toastText()).toContain(DROP_REFUSAL.readOnlyQueue);
  });

  it('shows the toast rather than only appending it to the document', async () => {
    const view = await mountAppShowing('kanban');

    dispatchWriteError(view, { message: 'refusal text', reason: 'stage-change-refused' });

    const [alert] = toasts();
    expect(alert, 'no <sl-alert> was appended at all').toBeDefined();
    // An <sl-alert> that was never toast()ed is invisible in real Shoelace.
    expect(alert.open, 'the alert was appended but never shown to the user').toBe(true);
    expect(alert.variant).toBe('danger');
  });

  it('maps a server write failure carried as detail.error through the error mapping', async () => {
    const view = await mountAppShowing('kanban');

    dispatchWriteError(view, {
      error: new Error('rate limit exceeded (429)'),
      reason: 'stage-change-failed',
    });

    // Not the raw string: proof the { error } branch went through showWriteError.
    expect(toastText()).toMatch(/rate limit reached/i);
  });

  it('does not toast for an unrelated event that merely bubbles past', async () => {
    const view = await mountAppShowing('kanban');

    view.dispatchEvent(new CustomEvent('task-select', { bubbles: true, composed: true, detail: {} }));

    expect(toasts()).toHaveLength(0);
  });
});

/**
 * FINDING H-2. Every test above dispatches the `write-error` event by hand.
 * That pins `ft-app`'s half of the seam, but it leaves the view's half —
 * `reportRefusal()`, the thing that decides the event's flags — asserted
 * nowhere: mutating `composed: true` to `false` inside it left the suite
 * green. A refusal has to be asserted where the user meets it, which means a
 * real gesture on a real row and a toast on the screen at the end of it.
 */
describe('ft-app — a real refused gesture reaches the user as a toast', () => {
  const AVAILABLE = { available: true, reasons: [] };

  /** The rendered row for a task, found the way a user finds it: by its name. */
  function queueRow(view: Element, name: string): Element {
    const rows = queryAllDeep(view, '.queue-row');
    const row = rows.find((candidate) => candidate.getAttribute('aria-label') === `Task: ${name}`);
    if (!row) {
      const rendered = rows.map((candidate) => candidate.getAttribute('aria-label')).join(', ');
      throw new Error(`no queue row rendered for "${name}"; rendered: ${rendered}`);
    }
    return row;
  }

  it('turns a real cross-band queue drop into a visible toast', async () => {
    const view = await mountAppShowing('ready-queue', [
      task({ id: 'urgent', name: 'Fix the leak', priority: TaskPriority.URGENT, rank: 1024, availability: AVAILABLE }),
      task({ id: 'high', name: 'Repaint', priority: TaskPriority.HIGH, rank: 1024, availability: AVAILABLE }),
    ]);

    // A genuine gesture: no `write-error` is synthesised anywhere in this test.
    dropTaskOn(queueRow(view, 'Repaint'), 'urgent');
    await flush();
    await settle(view);

    expect(toastText()).toContain(
      DROP_REFUSAL.crossBandToast('Fix the leak', PRIORITY_LABEL[TaskPriority.HIGH]),
    );
    expect(toasts()[0].open, 'the refusal was appended but never shown').toBe(true);
  });

  /**
   * The `composed` half, which the toast test above cannot reach: `ft-app`
   * binds `@write-error` on the child element itself, so the handler fires in
   * the at-target phase and a non-composed event still reaches it. `composed`
   * only becomes load-bearing at a shadow boundary the event has to cross —
   * which is exactly what a listener outside the app is. The flag is part of
   * the event's published contract (`ft-kanban-view` pins its twin), so it is
   * asserted here by observing the refusal from `document`, where anything
   * short of `composed: true` never arrives.
   */
  it('lets the refusal escape the shadow boundary to a listener outside the app', async () => {
    const view = await mountAppShowing('ready-queue', [
      task({ id: 'urgent', name: 'Fix the leak', priority: TaskPriority.URGENT, rank: 1024, availability: AVAILABLE }),
      task({ id: 'high', name: 'Repaint', priority: TaskPriority.HIGH, rank: 1024, availability: AVAILABLE }),
    ]);

    const escaped: CustomEvent[] = [];
    const onWriteError = (e: Event) => escaped.push(e as CustomEvent);
    document.addEventListener('write-error', onWriteError);

    try {
      dropTaskOn(queueRow(view, 'Repaint'), 'urgent');
      await flush();
      await settle(view);
    } finally {
      document.removeEventListener('write-error', onWriteError);
    }

    expect(escaped, 'the refusal never left the app; is it still composed?').toHaveLength(1);
    expect(escaped[0].composed).toBe(true);
    expect(escaped[0].bubbles).toBe(true);
    expect(escaped[0].detail.reason).toBe('rank-change-refused');
  });
});

describe('ft-app — the four write-error reasons are each surfaced', () => {
  /**
   * The exact detail shapes the two views produce. `ft-kanban-view` emits
   * `stage-change-*`; `ft-ready-queue-view` emits `rank-change-*`. Refusals
   * carry `message`, server failures carry `error` — except the partial
   * renumber failure, which carries both and must prefer the message.
   */
  const cases: {
    reason: string;
    view: 'kanban' | 'ready-queue';
    detail: Record<string, unknown>;
    expected: RegExp;
  }[] = [
    {
      reason: 'stage-change-refused',
      view: 'kanban',
      detail: {
        // Was a hand-copied literal that had already drifted from production:
        // a curly apostrophe where `STAGE_LABEL` uses a straight one, and the
        // trailing "rather than by dragging" clause missing entirely. It only
        // passed because `expected` is a loose substring match.
        message: DROP_REFUSAL.terminalLaneToast(STAGE_LABEL[TaskStage.WONT_FIX]),
        reason: 'stage-change-refused',
      },
      expected: /needs a reason/i,
    },
    {
      reason: 'stage-change-failed',
      view: 'kanban',
      detail: { error: new Error('fetch failed: ECONNREFUSED'), reason: 'stage-change-failed' },
      expected: /could not reach the server/i,
    },
    {
      reason: 'rank-change-refused',
      view: 'ready-queue',
      detail: {
        // Was a hand-copied literal, and already truncated: no view emits the
        // bare first sentence, so it pinned a string production never produces.
        // The same drift the `terminalLaneToast` note above describes, in the
        // queue twin of that entry.
        message: DROP_REFUSAL.crossBandToast('Fix the leak', 'High'),
        reason: 'rank-change-refused',
      },
      expected: /within one priority band/i,
    },
    {
      reason: 'rank-change-failed',
      view: 'ready-queue',
      detail: { error: new Error('boom'), reason: 'rank-change-failed' },
      expected: /boom/,
    },
  ];

  for (const testCase of cases) {
    it(`surfaces a "${testCase.reason}" write-error`, async () => {
      const view = await mountAppShowing(testCase.view);

      dispatchWriteError(view, testCase.detail);

      expect(toastText()).toMatch(testCase.expected);
      expect(toasts()[0].open, 'the toast was never shown').toBe(true);
    });
  }

  /**
   * A partial renumber failure carries BOTH a message and the underlying
   * error. `onWriteError` prefers the message, because "reload to see the
   * saved order" is the actionable half — the raw server error is not.
   */
  it('prefers the explanatory message over the raw error when a renumber fails part way', async () => {
    const view = await mountAppShowing('ready-queue');

    // The real constant `ft-ready-queue-view` emits. It used to be a literal
    // here: user-visible vocabulary outside the anchor, with a test copy free
    // to drift from the production string it was standing in for.
    dispatchWriteError(view, {
      error: new Error('server said no'),
      reason: 'rank-change-failed',
      message: WRITE_FAILURE.partialRenumber,
    });

    const text = toastText();
    expect(text).toContain(WRITE_FAILURE.partialRenumber);
    expect(text).not.toContain('server said no');
  });

  /**
   * The toast body must be TEXT, never markup.
   *
   * `showErrorToast` builds it with `document.createTextNode`, which is the
   * injection-proof construction — but nothing pinned that, and this range
   * both refactored the sink and gave it user-controlled input: the
   * `crossBandToast` refusal interpolates a raw task title
   * (`ft-ready-queue-view.ts` passes `dragged.name`) and routes it through
   * this exact path. Swapping the sink to `insertAdjacentHTML` left the whole
   * suite green, so a regression here would be stored XSS in the app origin —
   * a task title containing `<img src=x onerror=...>` executing for any user
   * who drags that row across a priority band.
   */
  it('renders a refusal message as text, never as markup', async () => {
    const view = await mountAppShowing('ready-queue');
    const hostile = '<img src=x onerror="globalThis.__xss = 1">';

    dispatchWriteError(view, { message: hostile, reason: 'rank-change-refused' });

    const alert = toasts()[0];
    expect(alert, 'no toast was shown').toBeDefined();
    // The markup must not have been parsed into a node...
    expect(alert.querySelector('img'), 'the message was parsed as HTML').toBeNull();
    // ...it must be visible to the user verbatim...
    expect(toastText()).toContain(hostile);
    // ...and nothing in it may have executed.
    //
    // NOT COVERAGE — this assertion cannot fail under jsdom, which does not
    // load subresources, so `onerror` never fires whether the sink is safe or
    // not. It is kept as a statement of the attack being defended against,
    // which the two assertions above are what actually detect (verified by
    // mutation: createTextNode -> insertAdjacentHTML kills this test via those
    // two, never via this line). Do not count it when assessing coverage, and
    // do not let it stand in for a real execution check — proving non-execution
    // needs a browser runner, not jsdom.
    expect((globalThis as Record<string, unknown>).__xss).toBeUndefined();
  });
});
