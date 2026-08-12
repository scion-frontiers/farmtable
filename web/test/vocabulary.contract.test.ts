import { describe, expect, it } from 'vitest';
import { AvailabilityReason, TaskHoldReason, TaskStage } from '../src/gen/types.js';
import {
  ATTENTION,
  AVAILABILITY_REASON_LABEL,
  DROP_REFUSAL,
  HOLD_REASON_LABEL,
  NATIVE_STAGE_OPTIONS,
  STAGE_LABEL,
  WRITE_FAILURE,
} from '../src/util/task-state-utils.js';

/**
 * THE single anchor for user-visible task-state vocabulary.
 *
 * Everywhere else in the suite, expectations are DERIVED from these exported
 * maps rather than transcribed — that is deliberate, because a transcription
 * drifts silently (one had already: see the `terminalLaneToast` literal in
 * `ft-app.write-error-seam.test.ts`, which used a curly apostrophe and dropped
 * a whole clause, and passed anyway because it matched loosely).
 *
 * But derivation has a cost: mutate a label and expectation and actual move in
 * lockstep, so nothing fails. This file pays that cost back. It is the ONLY
 * place these strings appear as literals, so renaming user-visible vocabulary
 * fails here and nowhere else — a decision point rather than an accident.
 *
 * If you are here because a test failed: the words a user reads changed. That
 * may well be correct. Update the literal deliberately, and check the contract
 * in `.design/` agrees.
 */

describe('STAGE_LABEL — the ten native stages read as the contract says', () => {
  const expected: [TaskStage, string][] = [
    [TaskStage.TRIAGE, 'Triage'],
    [TaskStage.ACCEPTED, 'Accepted'],
    [TaskStage.WORKING, 'Working'],
    [TaskStage.IN_REVIEW, 'In Review'],
    [TaskStage.IN_QA, 'In QA'],
    [TaskStage.DEPLOYING, 'Deploying'],
    [TaskStage.COMPLETED, 'Completed'],
    // Straight apostrophe, matching production. The drifted literal that
    // prompted this file used a curly one.
    [TaskStage.WONT_FIX, "Won't Fix"],
    [TaskStage.DUPLICATE, 'Duplicate'],
    [TaskStage.CANCELLED, 'Cancelled'],
  ];

  for (const [stage, label] of expected) {
    it(`labels stage ${stage} as "${label}"`, () => {
      expect(STAGE_LABEL[stage]).toBe(label);
    });
  }

  it('labels every native stage and no more', () => {
    expect(NATIVE_STAGE_OPTIONS).toHaveLength(expected.length);
    expect([...NATIVE_STAGE_OPTIONS].sort()).toEqual(expected.map(([stage]) => stage).sort());
    for (const stage of NATIVE_STAGE_OPTIONS) {
      expect(STAGE_LABEL[stage], `stage ${stage} has no label`).toBeTruthy();
    }
  });

  /**
   * The vocabulary the task-state contract DELETED. These words must not come
   * back as labels for anything.
   */
  it('uses none of the deleted stage vocabulary', () => {
    const labels = NATIVE_STAGE_OPTIONS.map((stage) => STAGE_LABEL[stage]);

    expect(labels).toHaveLength(expected.length);
    for (const deleted of ['Ready', 'Blocked', 'Backlog', 'Scheduled']) {
      expect(labels, `"${deleted}" is deleted contract vocabulary`).not.toContain(deleted);
    }
  });
});

describe('HOLD_REASON_LABEL — hold vocabulary', () => {
  const expected: [TaskHoldReason, string][] = [
    [TaskHoldReason.WAITING_FOR_INPUT, 'Waiting for input'],
    [TaskHoldReason.DEFERRED, 'Deferred'],
  ];

  for (const [reason, label] of expected) {
    it(`labels hold reason ${reason} as "${label}"`, () => {
      expect(HOLD_REASON_LABEL[reason]).toBe(label);
    });
  }

  it('gives the UNSPECIFIED zero value no label, so it can never be shown as one', () => {
    expect(HOLD_REASON_LABEL[TaskHoldReason.UNSPECIFIED]).toBeUndefined();
    expect(Object.keys(HOLD_REASON_LABEL)).toHaveLength(expected.length);
  });
});

describe('AVAILABILITY_REASON_LABEL — unavailability vocabulary', () => {
  const expected: [AvailabilityReason, string][] = [
    [AvailabilityReason.TRIAGE, 'Triage'],
    [AvailabilityReason.TERMINAL, 'Terminal'],
    [AvailabilityReason.HELD, 'Held'],
    [AvailabilityReason.BLOCKED_BY_DEPENDENCY, 'Blocked by dependency'],
    [AvailabilityReason.FUTURE_START_DATE, 'Future start date'],
  ];

  for (const [reason, label] of expected) {
    it(`labels availability reason ${reason} as "${label}"`, () => {
      expect(AVAILABILITY_REASON_LABEL[reason]).toBe(label);
    });
  }

  it('gives the UNSPECIFIED zero value no label, so it can never be shown as one', () => {
    expect(AVAILABILITY_REASON_LABEL[AvailabilityReason.UNSPECIFIED]).toBeUndefined();
    expect(Object.keys(AVAILABILITY_REASON_LABEL)).toHaveLength(expected.length);
  });
});

/**
 * The refusal wording, board and queue.
 *
 * Moved here verbatim from `ft-kanban.drop-refusal-affordances.test.ts` so this
 * file really is the *only* place a user-visible literal lives: with the queue
 * strings lifted into `DROP_REFUSAL`, two anchor sites would have been two
 * places to forget. Everything else in the suite derives its expectation from
 * `DROP_REFUSAL`, so a reword propagates silently everywhere — which is the
 * right trade for binding tests, and exactly why the copy itself has to be
 * pinned once. Change the copy and exactly one test fails.
 */
describe('DROP_REFUSAL — the refusal vocabulary itself', () => {
  it('states the read-only reason and what it means for the user', () => {
    expect(DROP_REFUSAL.readOnlyBoard).toBe(
      'This board is read-only — stage changes are not saved.',
    );
  });

  it('states the unsupported-capability reason', () => {
    expect(DROP_REFUSAL.stageChangeUnsupported).toBe(
      'This collection does not support stage changes.',
    );
  });

  // NB the apostrophe in "Won't Fix" is a STRAIGHT quote, matching
  // `STAGE_LABEL`. The drifted literal this block replaces used a curly one.
  it('names the lane and points at the API, CLI, or MCP in the hover hint', () => {
    expect(DROP_REFUSAL.terminalLaneHint(STAGE_LABEL[TaskStage.DUPLICATE])).toBe(
      '“Duplicate” is set through the API, CLI, or MCP — dragging here will not change the stage.',
    );
  });

  it('explains in the toast that the outcome needs more context, not just that it failed', () => {
    expect(DROP_REFUSAL.terminalLaneToast(STAGE_LABEL[TaskStage.DUPLICATE])).toBe(
      '“Duplicate” needs more context than a drag can provide, so it is set through the API, CLI, or MCP rather than by dragging.',
    );
  });

  // ── Queue reorder ──
  //
  // Deliberately worded as "this queue"/"the order", not reused from the board
  // entries above: a queue drag changes rank, not stage, and telling the user
  // "stage changes are not saved" after a reorder would be wrong.

  it('states the read-only reason in queue terms, not board terms', () => {
    expect(DROP_REFUSAL.readOnlyQueue).toBe(
      'This queue is read-only — the order is not saved.',
    );
  });

  it('states the unsupported-reorder reason', () => {
    expect(DROP_REFUSAL.reorderUnsupported).toBe(
      'This collection does not support drag reordering.',
    );
  });

  it('names the task and the destination band, and says how to get the same result', () => {
    expect(DROP_REFUSAL.crossBandToast('Fix the leak', 'High')).toBe(
      'Drag reordering works within one priority band. Change the priority of ' +
        '“Fix the leak” to move it into High.',
    );
  });

  it('says the order was not saved when there is no client, not merely that something failed', () => {
    expect(DROP_REFUSAL.reorderNotConnected).toBe(
      'Not connected to the server — the new order was not saved.',
    );
  });

  it('says a reorder is still being saved, and that the gesture can be retried', () => {
    expect(DROP_REFUSAL.reorderBusy).toBe(
      'Still saving the last reorder — wait for it to finish, then try again.',
    );
  });

  /**
   * The anchor is only an anchor if it covers everything. A constant added to
   * `DROP_REFUSAL` without a literal above would be user-visible vocabulary
   * that nothing pins — the drift this file exists to prevent, arriving through
   * the back door. `reorderBusy` was added in round 4 and this test is what
   * would have caught it being added silently.
   */
  it('pins every entry in DROP_REFUSAL, so a new refusal cannot slip in unpinned', () => {
    const anchored = [
      'readOnlyBoard',
      'stageChangeUnsupported',
      'terminalLaneHint',
      'terminalLaneToast',
      'readOnlyQueue',
      'reorderUnsupported',
      'crossBandToast',
      'reorderNotConnected',
      'reorderBusy',
    ];

    expect(Object.keys(DROP_REFUSAL).sort()).toEqual([...anchored].sort());
  });
});

/**
 * The failure wording, which is NOT refusal wording.
 *
 * A sibling of `DROP_REFUSAL` rather than a member of it. A refusal is this UI
 * declining a gesture before anything leaves the browser; a failure is the
 * server having been asked and something having gone wrong. Round 4 restored
 * `DROP_REFUSAL`'s precision after it had drifted, and absorbing a failure
 * message into it would spend that back immediately.
 *
 * This string was built inline in `ft-ready-queue-view`'s partial-renumber
 * path, with a hand-copied twin in `ft-app.write-error-seam.test.ts` — the same
 * defect the rest of this file exists to prevent, one seam over.
 */
describe('WRITE_FAILURE — the write-failure vocabulary', () => {
  it('says the reorder half-saved and tells the user how to see the truth', () => {
    expect(WRITE_FAILURE.partialRenumber).toBe(
      'Reordering the queue failed part way through — reload to see the saved order.',
    );
  });

  it('pins every entry in WRITE_FAILURE, so a new failure message cannot slip in unpinned', () => {
    expect(Object.keys(WRITE_FAILURE).sort()).toEqual(['partialRenumber']);
  });
});

/**
 * The attention vocabulary — contract §10's "attention view".
 *
 * One phrase reaches the user in four places (card badge, Availability filter
 * option, active-filter chip, dashboard tile) and they must all read the same,
 * because the affordance only works if a user who saw the badge recognises the
 * filter. Anchoring the words here is what keeps those four from drifting into
 * three synonyms.
 */
describe('ATTENTION — the needs-attention vocabulary', () => {
  it('names the state in the two words the card badge has always used', () => {
    expect(ATTENTION.label).toBe('Needs attention');
  });

  /**
   * The label cannot say why, and the why is the entire justification for the
   * feature: contract §11 makes these tasks permanently stranded, so the copy
   * has to say that nothing will clear them rather than implying a wait.
   */
  it('explains that the block is permanent, not merely current', () => {
    expect(ATTENTION.explanation).toBe(
      'Blocked by a prerequisite that was cancelled, dropped as a duplicate, or ' +
        "won't be fixed. Closing a prerequisite that way does not unblock its " +
        'dependents, so nothing will clear these on its own.',
    );
  });

  it('says what activating the dashboard tile will do', () => {
    expect(ATTENTION.tileAction).toBe('click to list them on the board');
  });

  it('pins every entry in ATTENTION, so new attention copy cannot slip in unpinned', () => {
    expect(Object.keys(ATTENTION).sort()).toEqual(['explanation', 'label', 'tileAction']);
  });
});
