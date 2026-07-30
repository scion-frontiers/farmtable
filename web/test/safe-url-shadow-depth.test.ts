import { describe, expect, it } from 'vitest';
import '../src/components/inspector/ft-inspector-code.js';
import { CIStatus, PullRequestStatus, type CodeContext } from '../src/gen/types.js';
import { mount, queryAllDeep } from './helpers/dom.js';

/**
 * C157 arm test — proves the DIFFERENTIAL that PR 211 claims to fix.
 *
 * The PR replaces `shadowRoot!.querySelectorAll('*')` with `queryAllDeep()`
 * inside hostile-URL attribute scans. This test manufactures a nested shadow
 * root (one that jsdom does not produce organically for this component),
 * plants a hostile `javascript:` URL inside it, and asserts:
 *
 *   (a) the shallow walk (`shadowRoot!.querySelectorAll('*')`) does NOT see
 *       the injected node — the attack is invisible to the old code; and
 *   (b) `queryAllDeep()` DOES see it — the fix catches it.
 *
 * If assertion (a) fails, the premise of PR 211 is wrong: the shallow walk
 * already crosses shadow boundaries and the three-line change is a no-op.
 */

function codeContext(url: string): CodeContext {
  return {
    repo: 'acme/repo',
    branch: 'main',
    ciStatus: CIStatus.UNSPECIFIED,
    commitShas: [],
    pullRequests: [{ id: '#7', url, status: PullRequestStatus.OPEN }],
  };
}

async function mountCode(url: string) {
  return mount<HTMLElement>('ft-inspector-code', { codeContext: codeContext(url) });
}

// A custom element that creates its own shadow root in the constructor.
// This is the "nested shadow host" the test manufactures.
class NestedShadowHost extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
}
customElements.define('test-c157-nested-host', NestedShadowHost);

describe('C157 shadow-depth differential', () => {
  it('shallow walk misses hostile attribute in nested shadow root; deep walk finds it', async () => {
    // Mount with a SAFE URL so no hostile attributes exist in the normal render.
    const code = await mountCode('https://github.com/acme/repo/pull/7');

    // ── MANUFACTURE a nested shadow host inside the component's shadow DOM ──
    const nestedHost = document.createElement('test-c157-nested-host');
    code.shadowRoot!.appendChild(nestedHost);

    // Plant a hostile URL inside the nested shadow root.
    const trap = document.createElement('a');
    trap.setAttribute('href', 'javascript:alert(1)');
    trap.textContent = 'hostile';
    nestedHost.shadowRoot!.appendChild(trap);

    // ── Assertion (a): shallow walk DOES NOT see the injected node ──────────
    const shallowElements = Array.from(code.shadowRoot!.querySelectorAll('*'));

    // Positive control: the shallow walk sees the nested host element itself
    // (it is a direct child of the shadow root), proving the walk executes.
    expect(shallowElements).toContain(nestedHost);

    // But it does NOT see the trap element inside the nested shadow root —
    // querySelectorAll does not cross shadow boundaries.
    expect(shallowElements).not.toContain(trap);

    // Therefore scanning the shallow results for hostile attributes misses
    // the injection entirely. This is the bug PR 211 fixes.
    const shallowHostile = shallowElements.some((el) =>
      Array.from(el.attributes).some((attr) => attr.value.includes('javascript:')),
    );
    expect(shallowHostile).toBe(false);

    // ── Assertion (b): deep walk DOES see the injected node ─────────────────
    const deepElements = queryAllDeep(code, '*');

    // The deep walk crosses the shadow boundary and finds the trap.
    expect(deepElements).toContain(trap);

    // Scanning deep results catches the hostile attribute.
    const deepHostile = deepElements.some((el) =>
      Array.from(el.attributes).some((attr) => attr.value.includes('javascript:')),
    );
    expect(deepHostile).toBe(true);
  });
});
