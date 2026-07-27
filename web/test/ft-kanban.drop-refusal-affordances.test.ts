import { describe, expect, it } from 'vitest';
import '../src/components/kanban/ft-kanban-column.js';
import '../src/components/kanban/ft-kanban-view.js';
import { TaskStage } from '../src/gen/types.js';
import { ALL_DISABLED, ALL_ENABLED } from '../src/capabilities.js';
import {
  DROP_REFUSAL,
  NATIVE_STAGE_OPTIONS,
  STAGE_LABEL,
  acceptsStageDrop,
} from '../src/util/task-state-utils.js';
import { dropTaskOn, flush, mount, queryDeep, settle } from './helpers/dom.js';
import { collectFeedback } from './helpers/feedback.js';
import { RecordingClient, storeWith, task } from './helpers/fixtures.js';

/**
 * Findings M-1 and M-5: the *affordances* around a refused drop.
 *
 * The refusal toast is covered elsewhere. What was not covered is everything
 * the user sees before they let go — the `.drop-refused` styling hook, the
 * `title` tooltip and the `aria-description` — plus the no-op guard that keeps
 * a card dropped back on its own lane from being reported as a refusal.
 *
 * These are pinned against the real `DROP_REFUSAL` strings and the real
 * `acceptsStageDrop` predicate rather than literals, so the tests follow the
 * production vocabulary instead of a transcription of it.
 */

async function mountColumn(props: Record<string, unknown> = {}) {
  const store = storeWith(task({ id: 't1', name: 't1', stage: TaskStage.ACCEPTED }));
  const column = await mount<HTMLElement>('ft-kanban-column', {
    store,
    stage: TaskStage.ACCEPTED,
    label: 'Accepted',
    tasks: [store.getTask('t1')!],
    capabilities: ALL_ENABLED,
    ...props,
  });
  return column;
}

function cards(column: Element): HTMLElement {
  const element = queryDeep<HTMLElement>(column, '.cards');
  if (!element) throw new Error('the column rendered no .cards drop zone');
  return element;
}

describe('ft-kanban-column — a refusing lane looks refusing before the drop', () => {
  it('carries no drop-refused class on a lane that accepts drops', async () => {
    const column = await mountColumn();

    // The positive counterpart: without this, every negative below would pass
    // on a component that never emits the class at all.
    expect(cards(column).classList.contains('drop-refused')).toBe(false);
  });

  const refusing: { label: string; props: Record<string, unknown>; hint: string }[] = [
    {
      label: 'the board is read-only',
      props: { readOnly: true },
      hint: DROP_REFUSAL.readOnlyBoard,
    },
    {
      // `ALL_DISABLED`, not `GITHUB_CAPABILITIES`: GitHub collections CAN
      // change stage (`canChangeStage: true`), so using them here would have
      // tested an accepting lane while claiming to test a refusing one.
      label: 'the collection cannot change stage',
      props: { capabilities: ALL_DISABLED },
      hint: DROP_REFUSAL.stageChangeUnsupported,
    },
    {
      label: 'the lane is an unsuccessful terminal stage',
      props: { stage: TaskStage.WONT_FIX, label: "Won't Fix", tasks: [] },
      hint: DROP_REFUSAL.terminalLaneHint("Won't Fix"),
    },
  ];

  for (const testCase of refusing) {
    it(`marks the drop zone refused when ${testCase.label}`, async () => {
      const column = await mountColumn(testCase.props);

      expect(cards(column).classList.contains('drop-refused')).toBe(true);
    });

    it(`explains the refusal in the accessible description when ${testCase.label}`, async () => {
      const column = await mountColumn(testCase.props);

      expect(cards(column).getAttribute('aria-description')).toContain(testCase.hint);
    });

    /**
     * FINDING M-1a, now fixed. `aria-description` was driven by `dropHint`,
     * which covers all three refusal causes, while `title` was driven by a
     * separate `dropTooltip` gated on `acceptsStageDrop(this.stage)` ALONE — so
     * a read-only board and a stage-incapable collection gave a screen-reader
     * user a reason and a pointer user nothing at all.
     *
     * Both attributes now come from `dropHint`. This runs over the SAME three
     * cases as the description test above rather than naming two of them by
     * hand, so the two channels are asserted to agree by construction and a
     * fourth refusal cause cannot be added to one channel only.
     */
    it(`explains the refusal in the pointer tooltip too when ${testCase.label}`, async () => {
      const column = await mountColumn(testCase.props);

      expect(cards(column).getAttribute('title')).toContain(testCase.hint);
    });

    it(`says exactly the same thing in both channels when ${testCase.label}`, async () => {
      const zone = cards(await mountColumn(testCase.props));

      expect(zone.getAttribute('title')).toBe(zone.getAttribute('aria-description'));
    });
  }

  /**
   * `dropHint` must be gated, not merely empty-string: Lit's `nothing` removes
   * the attribute, whereas an ungated binding leaves `title=""` and
   * `aria-description=""` on every accepting lane. An empty accessible
   * description is worse than none — it can suppress the fallback a screen
   * reader would otherwise announce.
   */
  it('omits the tooltip and accessible description entirely on an accepting lane', async () => {
    const column = await mountColumn();
    const zone = cards(column);

    expect(zone.hasAttribute('aria-description')).toBe(false);
    expect(zone.hasAttribute('title')).toBe(false);
  });

  /**
   * The refusal is deliberately advisory: a refusing lane must still accept the
   * drop *gesture*, because `ft-kanban-view` answers it with a toast. Marking
   * the lane refused by blocking the gesture would make the refusal silent —
   * exactly the bug class this round exists to close.
   */
  it('still accepts the drop gesture on a refusing lane so the refusal can be spoken', async () => {
    const column = await mountColumn({ readOnly: true });
    const zone = cards(column);

    const dragover = new Event('dragover', { bubbles: true, composed: true, cancelable: true });
    Object.defineProperty(dragover, 'dataTransfer', { value: { dropEffect: 'none' } });
    zone.dispatchEvent(dragover);

    expect(dragover.defaultPrevented, 'a refusing lane that swallows dragover looks broken').toBe(true);
  });
});

describe('ft-kanban-view — dropping a card back on its own lane', () => {
  /**
   * Finding M-5. `onStageChange` returns early when `task.stage === stage`.
   * That guard has to be a *silent* no-op: no write, and no refusal toast
   * either. Reporting a refusal here would tell the user their unchanged drag
   * failed, and on a read-only board it would fire the read-only toast for a
   * gesture that changed nothing.
   */
  async function mountBoard(props: Record<string, unknown> = {}) {
    const store = storeWith(task({ id: 't1', name: 't1', stage: TaskStage.ACCEPTED }));
    const client = new RecordingClient(store);
    const view = await mount<HTMLElement>('ft-kanban-view', {
      store,
      client,
      capabilities: ALL_ENABLED,
      ...props,
    });
    return { view, client, store };
  }

  function laneFor(view: Element, stage: TaskStage): Element {
    const column = Array.from(view.shadowRoot?.querySelectorAll('ft-kanban-column') ?? []).find(
      (candidate) => (candidate as unknown as { stage: TaskStage }).stage === stage,
    );
    if (!column) throw new Error(`no column rendered for stage ${stage}`);
    const zone = queryDeep(column, '.cards');
    if (!zone) throw new Error(`column for stage ${stage} rendered no drop zone`);
    return zone;
  }

  it('writes nothing and says nothing when the card lands on the lane it came from', async () => {
    const { view, client } = await mountBoard();
    const feedback = collectFeedback(view);

    dropTaskOn(laneFor(view, TaskStage.ACCEPTED), 't1');
    await flush();
    await settle(view);

    expect(client.updateTaskCalls).toHaveLength(0);
    expect(feedback.sawFeedback(), feedback.describe()).toBe(false);
  });

  it('stays silent on a same-lane drop even when the board is read-only', async () => {
    const { view, client } = await mountBoard({ readOnly: true });
    const feedback = collectFeedback(view);

    dropTaskOn(laneFor(view, TaskStage.ACCEPTED), 't1');
    await flush();

    expect(client.updateTaskCalls).toHaveLength(0);
    expect(feedback.sawFeedback(), 'a no-op drag must not trigger the read-only toast').toBe(false);
  });

  /**
   * The positive counterpart. Without it, both tests above would pass on a view
   * whose drop handling was removed entirely.
   */
  it('does write when the card lands on a different lane', async () => {
    const { view, client } = await mountBoard();

    dropTaskOn(laneFor(view, TaskStage.WORKING), 't1');
    await flush();
    await settle(view);

    expect(client.updateTaskCalls).toHaveLength(1);
    expect(client.updateTaskCalls[0].fields.stage).toBe(TaskStage.WORKING);
  });

  /**
   * A payload dragged in from another window arrives as a `taskId` matching
   * nothing. That must also be silent: answering it with "This board is
   * read-only" would be a claim about a task that does not exist.
   */
  it('stays silent for a drop carrying an id that belongs to no task', async () => {
    const { view, client } = await mountBoard({ readOnly: true });
    const feedback = collectFeedback(view);

    dropTaskOn(laneFor(view, TaskStage.WORKING), 'not-a-task-id');
    await flush();

    expect(client.updateTaskCalls).toHaveLength(0);
    expect(feedback.sawFeedback(), feedback.describe()).toBe(false);
  });

  /**
   * And the terminal lanes, which `acceptsStageDrop` refuses, must NOT be
   * silent — they are the case the no-op guard must not swallow. Driven off
   * the real predicate so the list cannot drift from production.
   */
  //
  // DERIVED, not transcribed. An earlier version hardcoded the three terminal
  // stages and checked only that each listed stage refuses drops — which is
  // one-directional: a newly-refusing lane would be silently uncovered, making
  // the suite quieter rather than redder. Filtering the real stage list by the
  // real predicate covers both directions by construction.
  const terminal = NATIVE_STAGE_OPTIONS.filter((stage) => !acceptsStageDrop(stage));

  it('derives its refusing-lane list from the real predicate, and that list is not empty', () => {
    expect(terminal.length, 'no lane refuses drops, so the loop below tests nothing')
      .toBeGreaterThan(0);
    expect(acceptsStageDrop(TaskStage.COMPLETED), 'the positive counterpart').toBe(true);
  });

  for (const stage of terminal) {
    it(`refuses out loud when a card is dropped on the ${STAGE_LABEL[stage]} lane`, async () => {
      const { view, client } = await mountBoard();
      const feedback = collectFeedback(view);

      dropTaskOn(laneFor(view, stage), 't1');
      await flush();

      expect(client.updateTaskCalls).toHaveLength(0);
      expect(feedback.reasons()).toContain('stage-change-refused');
    });

    /**
     * Exact equality against the real exported constant, deliberately not a
     * substring match. The seam test in `ft-app.write-error-seam.test.ts` used
     * a hand-copied literal of this sentence that had drifted from production
     * — wrong apostrophe, missing trailing clause — and survived only because
     * it matched loosely. This binds the emitted text to `terminalLaneToast`
     * so the two can never diverge again.
     *
     * What this test CANNOT catch, stated so nobody mistakes it for more than
     * it is: reword `terminalLaneToast` itself and both sides of the assertion
     * move together, so it stays green. That is correct — this is a *binding*
     * test (the view must use the constant, and must pass the right label),
     * not a vocabulary anchor. The wording is anchored exactly once, in the
     * "vocabulary" block at the bottom of this file.
     */
    it(`emits exactly the terminalLaneToast text for the ${STAGE_LABEL[stage]} lane`, async () => {
      const { view } = await mountBoard();
      const feedback = collectFeedback(view);

      dropTaskOn(laneFor(view, stage), 't1');
      await flush();

      const [event] = feedback.writeErrors;
      expect(event, 'no write-error was emitted at all').toBeDefined();
      expect(event.detail.message).toBe(DROP_REFUSAL.terminalLaneToast(STAGE_LABEL[stage]));
    });
  }
});
