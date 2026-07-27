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
import { TaskStage } from '../src/gen/types.js';
import { DROP_REFUSAL, STAGE_LABEL } from '../src/util/task-state-utils.js';
import { mount, queryDeep, settle } from './helpers/dom.js';

interface StubAlert extends HTMLElement {
  open?: boolean;
  variant?: string;
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
async function mountAppShowing(view: 'kanban' | 'ready-queue'): Promise<Element> {
  window.history.replaceState({}, '', `/?collection=${COLLECTION_ID}&view=${view}`);
  const app = await mount<HTMLElement>('ft-app');

  const tag = `ft-${view}-view`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const store = (app as unknown as { taskStore?: { snapshotComplete(): void; isLoading: boolean } })
      .taskStore;
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

    dispatchWriteError(view, {
      error: new Error('server said no'),
      reason: 'rank-change-failed',
      message: 'Reordering the queue failed part way through — reload to see the saved order.',
    });

    const text = toastText();
    expect(text).toContain('reload to see the saved order');
    expect(text).not.toContain('server said no');
  });
});
