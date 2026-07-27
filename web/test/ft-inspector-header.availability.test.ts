import { describe, expect, it } from 'vitest';
import '../src/components/inspector/ft-inspector-header.js';
import { AvailabilityReason, TaskHoldReason, TaskPriority, type Task } from '../src/gen/types.js';
import {
  AVAILABILITY_REASON_LABEL,
  availabilityLabel,
  holdReasonLabel,
} from '../src/util/task-state-utils.js';
import { mount, queryAllDeep, queryDeep } from './helpers/dom.js';
import { task } from './helpers/fixtures.js';

/**
 * Rendered coverage of the task-state contract in the inspector header:
 * the hold badge and the server-availability badge (finding H-2).
 *
 * Every expected string comes from the real exported `availabilityLabel()` /
 * `holdReasonLabel()` / `AVAILABILITY_REASON_LABEL`. Nothing here re-derives
 * production wording, so the tests cannot drift from it — and where a bare
 * `toBe(availabilityLabel(t))` would move in lockstep with a mutated label
 * function, the assertion is written as a *relation between two renders*
 * instead (see the UNSPECIFIED-filter and available/unavailable pairs below).
 */

interface RenderedBadge {
  variant: string | null;
  text: string;
}

/**
 * The state badges only: direct `sl-badge` children of `div.badges`.
 *
 * Deliberately narrow. The priority badge is wrapped in
 * `button.priority-button` whenever the header is editable, so the direct-child
 * combinator excludes it — which matters because `PRIORITY_VARIANT[HIGH]` is
 * also `'warning'`, exactly the variant the hold badge claims. Anything looser
 * (`queryAllDeep(header, 'sl-badge')`) would let the priority badge answer for
 * the hold badge and a deleted hold badge would go unnoticed.
 *
 * The stage chip is a `span.stage-badge`, not an `sl-badge`, so it is out of
 * scope here by construction.
 */
function stateBadges(header: Element): RenderedBadge[] {
  return queryAllDeep<HTMLElement>(header, 'div.badges > sl-badge').map((badge) => ({
    variant: badge.getAttribute('variant'),
    text: (badge.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

function badgeTexts(header: Element): string[] {
  return stateBadges(header).map((badge) => badge.text);
}

async function mountHeader(overrides: Partial<Task> = {}): Promise<HTMLElement> {
  return mount<HTMLElement>('ft-inspector-header', {
    // NORMAL keeps the priority badge on `variant="primary"`; the HIGH/warning
    // collision is exercised explicitly in the scoping test below.
    task: task({ id: 'hdr', name: 'Header task', priority: TaskPriority.NORMAL, ...overrides }),
  });
}

describe('ft-inspector-header — badge query scope', () => {
  /**
   * Guards the helper every other test in this file depends on. If the header
   * template ever hoists the priority badge out of `button.priority-button`,
   * `stateBadges()` silently starts including it and the badge-list assertions
   * below become nonsense. Fail here instead, loudly.
   */
  it('excludes the priority badge from the state-badge list while the header is editable', async () => {
    const header = await mountHeader({ priority: TaskPriority.HIGH });

    const priorityBadge = queryDeep<HTMLElement>(header, 'button.priority-button sl-badge');
    expect(priorityBadge, 'the priority badge is rendered inside its edit button').not.toBeNull();
    expect(priorityBadge!.getAttribute('variant')).toBe('warning');
    // ...and it is nonetheless absent from the state-badge list.
    expect(stateBadges(header)).toEqual([]);
  });
});

describe('ft-inspector-header — hold badge', () => {
  for (const reason of [TaskHoldReason.WAITING_FOR_INPUT, TaskHoldReason.DEFERRED]) {
    it(`renders a warning hold badge labelled by holdReasonLabel for ${TaskHoldReason[reason]}`, async () => {
      const expected = holdReasonLabel(reason);
      expect(expected, 'guard: the reason under test has a real label').not.toBe('');

      const header = await mountHeader({ holdReason: reason });

      expect(stateBadges(header)).toEqual([{ variant: 'warning', text: expected }]);
    });
  }

  /** The ordinary "not held" shape: `toObject({ defaults: false })` omits the field. */
  it('renders no hold badge when holdReason is absent', async () => {
    const header = await mountHeader({});

    expect(stateBadges(header)).toEqual([]);
  });

  /**
   * The *other* "not held" shape, and the reason `hasHoldReason()` exists.
   *
   * `undefined` and `UNSPECIFIED` (0) are different inputs that must render
   * identically. A naive `reason !== undefined` guard passes the test above and
   * fails this one, so both are pinned separately — dropping either leaves the
   * bug reachable from one of the two wire encodings.
   */
  it('renders no hold badge when holdReason is the explicit UNSPECIFIED zero value', async () => {
    const header = await mountHeader({ holdReason: TaskHoldReason.UNSPECIFIED });

    expect(stateBadges(header)).toEqual([]);
  });

  /**
   * Relational counterpart to the two negatives above: "not held" and "held"
   * must not render the same thing. Without this, a template that emitted no
   * hold badge under any circumstances would satisfy both negative tests.
   */
  it('distinguishes an unheld task from a held one by the presence of the badge', async () => {
    const unheld = await mountHeader({ id: 'unheld', holdReason: TaskHoldReason.UNSPECIFIED });
    const held = await mountHeader({ id: 'held', holdReason: TaskHoldReason.DEFERRED });

    expect(badgeTexts(unheld)).toEqual([]);
    expect(badgeTexts(held)).toHaveLength(1);
  });
});

describe('ft-inspector-header — availability badge', () => {
  /**
   * Availability is server-reported and optional. A task the server said
   * nothing about must show no availability badge at all — not a guessed one.
   */
  it('renders no availability badge when the server reported no availability', async () => {
    const header = await mountHeader({});

    expect(stateBadges(header)).toEqual([]);
  });

  /** Positive counterpart to the omission above. */
  it('renders a success availability badge labelled by availabilityLabel when available', async () => {
    const available = task({
      id: 'avail',
      name: 'Header task',
      availability: { available: true, reasons: [] },
    });
    const header = await mount<HTMLElement>('ft-inspector-header', { task: available });

    expect(stateBadges(header)).toEqual([{ variant: 'success', text: availabilityLabel(available) }]);
  });

  it('renders the availability badge inside div.badges, next to the other state badges', async () => {
    const header = await mountHeader({ availability: { available: true, reasons: [] } });

    const badge = queryDeep<HTMLElement>(header, 'div.badges > sl-badge');
    expect(badge).not.toBeNull();
    expect(badge!.parentElement?.classList.contains('badges')).toBe(true);
  });

  /**
   * The neutral half of the `variant=${available ? 'success' : 'neutral'}`
   * ternary. Unlike `ft-ready-queue-view` — which filters unavailable tasks out
   * before they can render (see that file's F-4 characterisation) — the
   * inspector shows whatever task is selected, so this branch is genuinely
   * reachable here and a hardcoded `'success'` is a real regression.
   */
  it('renders a neutral availability badge when the server reports the task unavailable', async () => {
    const blocked = task({
      id: 'blocked',
      name: 'Header task',
      availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
    });
    const header = await mount<HTMLElement>('ft-inspector-header', { task: blocked });

    expect(stateBadges(header)).toEqual([{ variant: 'neutral', text: availabilityLabel(blocked) }]);
    // Independent anchor on the wording: the real reason label must be visible,
    // so a label function that collapsed to a constant cannot pass.
    expect(badgeTexts(header)[0]).toContain(
      AVAILABILITY_REASON_LABEL[AvailabilityReason.BLOCKED_BY_DEPENDENCY],
    );
  });

  /**
   * Written as a relation on purpose. `toBe(availabilityLabel(t))` alone moves
   * in lockstep with the function under test, so a label function that returned
   * 'Available' unconditionally would still match. Two renders that must
   * differ — available and unavailable — cannot both be satisfied by one
   * constant.
   */
  it('does not show an available and an unavailable task the same badge text', async () => {
    const availableHeader = await mountHeader({
      id: 'a',
      availability: { available: true, reasons: [] },
    });
    const unavailableHeader = await mountHeader({
      id: 'b',
      availability: { available: false, reasons: [AvailabilityReason.HELD] },
    });

    expect(badgeTexts(availableHeader)).toHaveLength(1);
    expect(badgeTexts(unavailableHeader)).toHaveLength(1);
    expect(badgeTexts(unavailableHeader)[0]).not.toBe(badgeTexts(availableHeader)[0]);
  });

  it('joins every unavailability reason into the badge text', async () => {
    const manyReasons = task({
      id: 'many',
      name: 'Header task',
      availability: {
        available: false,
        reasons: [
          AvailabilityReason.HELD,
          AvailabilityReason.BLOCKED_BY_DEPENDENCY,
          AvailabilityReason.FUTURE_START_DATE,
        ],
      },
    });
    const header = await mount<HTMLElement>('ft-inspector-header', { task: manyReasons });

    const [text] = badgeTexts(header);
    expect(text).toBe(availabilityLabel(manyReasons));
    // Every reason reaches the user, not just the first one.
    for (const reason of manyReasons.availability!.reasons) {
      expect(text).toContain(AVAILABILITY_REASON_LABEL[reason]);
    }
  });

  /**
   * `availabilityLabel()` strips `AvailabilityReason.UNSPECIFIED` (0) from the
   * reasons list, and this pins that end-to-end through the rendered badge.
   *
   * Asserted as an equality between two renders rather than against a literal:
   * adding a padding UNSPECIFIED to the wire payload must not change one pixel
   * of what the user sees. If the filter is dropped, the padded render gains a
   * stray "0" and the two diverge.
   */
  it('renders an UNSPECIFIED reason identically to it not being sent at all', async () => {
    const padded = await mountHeader({
      id: 'padded',
      availability: {
        available: false,
        reasons: [AvailabilityReason.UNSPECIFIED, AvailabilityReason.BLOCKED_BY_DEPENDENCY],
      },
    });
    const clean = await mountHeader({
      id: 'clean',
      availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
    });

    expect(badgeTexts(clean)).toHaveLength(1);
    expect(badgeTexts(padded)).toEqual(badgeTexts(clean));
  });

  /**
   * The degenerate case of the same filter: a reasons list that contains
   * *nothing but* UNSPECIFIED must render exactly like an empty list, i.e. the
   * plain "Unavailable" fallback rather than a leaked enum number.
   */
  it('renders a reasons list of only UNSPECIFIED identically to an empty reasons list', async () => {
    const onlyUnspecified = await mountHeader({
      id: 'only-unspecified',
      availability: { available: false, reasons: [AvailabilityReason.UNSPECIFIED] },
    });
    const noReasons = await mountHeader({
      id: 'no-reasons',
      availability: { available: false, reasons: [] },
    });

    expect(badgeTexts(noReasons)).toHaveLength(1);
    expect(badgeTexts(onlyUnspecified)).toEqual(badgeTexts(noReasons));
    expect(badgeTexts(onlyUnspecified)[0]).not.toContain('0');
  });
});

describe('ft-inspector-header — hold and availability together', () => {
  /**
   * The two badges are independent conditionals in one `div.badges`. This pins
   * that a task which is both held and unavailable shows both, in template
   * order (hold first), so neither conditional can swallow the other.
   */
  it('renders both the hold badge and the availability badge for a held, unavailable task', async () => {
    const heldAndBlocked = task({
      id: 'both',
      name: 'Header task',
      holdReason: TaskHoldReason.WAITING_FOR_INPUT,
      availability: { available: false, reasons: [AvailabilityReason.HELD] },
    });
    const header = await mount<HTMLElement>('ft-inspector-header', { task: heldAndBlocked });

    expect(stateBadges(header)).toEqual([
      { variant: 'warning', text: holdReasonLabel(TaskHoldReason.WAITING_FOR_INPUT) },
      { variant: 'neutral', text: availabilityLabel(heldAndBlocked) },
    ]);
  });

  /**
   * A held task the server nonetheless reports as available: the hold badge is
   * driven by `holdReason`, not by availability, so it must survive the success
   * badge sitting beside it.
   */
  it('renders the hold badge alongside a success badge for a held but available task', async () => {
    const heldButAvailable = task({
      id: 'held-available',
      name: 'Header task',
      holdReason: TaskHoldReason.DEFERRED,
      availability: { available: true, reasons: [] },
    });
    const header = await mount<HTMLElement>('ft-inspector-header', { task: heldButAvailable });

    expect(stateBadges(header)).toEqual([
      { variant: 'warning', text: holdReasonLabel(TaskHoldReason.DEFERRED) },
      { variant: 'success', text: availabilityLabel(heldButAvailable) },
    ]);
  });
});
