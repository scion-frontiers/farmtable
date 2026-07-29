import { describe, expect, it } from 'vitest';
import { html, render } from 'lit';
import { renderDeactivatedLink } from '../src/components/inspector/deactivated-link.js';

/**
 * Reject-UX rendering contract.
 *
 * DIFFERENT AXIS FROM THE UNION TABLE, DELIBERATELY. `test/safe-url.contract.test.ts`
 * and `src/util/safe-url.test.ts` answer a CLASSIFICATION question — does this
 * URL pass. This file answers a RENDERING question — given a failure, what
 * appears. Folding the two would produce a file that satisfies membership in
 * both suites while measuring neither, and no row keyed on an input string can
 * assert "the marker is adjacent to the value" because adjacency is not a
 * function of the input.
 *
 * THE CANARY (last describe block) IS THE RED ARM AND IT IS NOT DECORATIVE. It
 * has been observed to fail: replacing the text binding in
 * `deactivated-link.ts` with `unsafeHTML(raw)` turns the canary red and leaves
 * every other assertion in this file green. See the report for the recorded
 * red run and its numstat.
 */

function mountFragment(value: string | null | undefined): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  render(html`${renderDeactivatedLink(value)}`, host);
  return host;
}

/** Every element in the rendered subtree, host included. */
function allElements(host: HTMLElement): Element[] {
  return [host, ...host.querySelectorAll('*')];
}

const REJECTED = 'javascript:alert(document.domain)';

describe('renderDeactivatedLink — the marker', () => {
  it('renders an explicit inline deactivated marker', () => {
    const host = mountFragment(REJECTED);
    const marker = host.querySelector('[data-deactivated-marker]');

    expect(marker).not.toBeNull();
    expect(marker!.textContent?.trim()).toBe('Link deactivated');
  });

  it('places the marker adjacent to the copyable value, not elsewhere', () => {
    // Constraint 3. A badge at one end of the row and the address at the other
    // is two facts the user has to join; the warning has to travel with the
    // thing being copied. "Adjacent" is asserted structurally: same parent,
    // and the marker immediately precedes the value.
    const host = mountFragment(REJECTED);
    const marker = host.querySelector('[data-deactivated-marker]')!;
    const value = host.querySelector('[data-deactivated-url]')!;

    expect(marker.parentElement).toBe(value.parentElement);
    expect(marker.nextElementSibling).toBe(value);
  });
});

describe('renderDeactivatedLink — the value stays copyable', () => {
  it('renders the original address as text', () => {
    const host = mountFragment(REJECTED);
    const value = host.querySelector('[data-deactivated-url]');

    expect(value).not.toBeNull();
    expect(value!.textContent).toBe(REJECTED);
  });

  it('carries the address in a text node, not in an attribute', () => {
    // Constraint 4. A title/aria tooltip is not selectable text and is not
    // copyable on touch. Assert the value is reachable as node text AND that
    // no element is smuggling it into an attribute instead.
    const host = mountFragment(REJECTED);
    const value = host.querySelector('[data-deactivated-url]')!;

    const textNodes = [...value.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE);
    expect(textNodes.map((n) => n.textContent).join('')).toBe(REJECTED);

    for (const element of allElements(host)) {
      expect(element.getAttribute('title')).toBeNull();
    }
  });

  it('marks the value for whole-value selection so it can be copied in one gesture', () => {
    // The copy affordance is `user-select: all` on the value. jsdom does not
    // compute styles from a Lit `css` tagged template attached to a component,
    // so this asserts the hook the stylesheet targets rather than the computed
    // value — losing the class silently would remove the affordance.
    const host = mountFragment(REJECTED);
    const value = host.querySelector('[data-deactivated-url]')!;

    expect(value.classList.contains('deactivated-url')).toBe(true);
  });

  it('renders nothing at all when there is no address to copy', () => {
    for (const empty of ['', null, undefined]) {
      const host = mountFragment(empty);
      expect(host.querySelector('[data-deactivated-link]')).toBeNull();
    }
  });
});

describe('renderDeactivatedLink — no href, anywhere', () => {
  const REJECTED_URLS = [
    'javascript:alert(document.domain)',
    'JaVaScRiPt:alert(1)',
    '  javascript:alert(1)  ',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'http://evil.example/pr/1',
  ];

  for (const rejected of REJECTED_URLS) {
    it(`renders no href for ${JSON.stringify(rejected)}`, () => {
      // Constraint 1, checked over the whole subtree rather than over anchors,
      // so a wrapper added later for styling cannot reintroduce one.
      const host = mountFragment(rejected);

      expect(host.querySelectorAll('[href]')).toHaveLength(0);
      expect(host.querySelectorAll('a')).toHaveLength(0);
      for (const element of allElements(host)) {
        expect(element.getAttribute('href')).toBeNull();
        expect(element.getAttribute('xlink:href')).toBeNull();
      }
    });
  }

  it('positive control: this harness can render an href, so the assertions above are not vacuous', () => {
    // Without this, "no href" would also be satisfied by a helper that rendered
    // nothing, by a broken import, or by a jsdom that cannot set href at all.
    const host = document.createElement('div');
    document.body.append(host);
    render(html`<a href=${'https://example.com/ok'}>ok</a>`, host);

    expect(host.querySelectorAll('[href]')).toHaveLength(1);
    expect(host.querySelector('a')!.getAttribute('href')).toBe('https://example.com/ok');
  });
});

describe('renderDeactivatedLink — XSS CANARY: the value is text, never markup', () => {
  // Every string reaching this component FAILED validation, so each of these is
  // attacker-authored by definition. The assertion is not "it is escaped" but
  // "it did not become elements" — the observable difference between a text
  // binding and an HTML one.
  const MARKUP_PAYLOADS = [
    '<script>alert(1)</script>',
    'javascript:"><script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    "javascript:'><img src=x onerror=alert(1)>",
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">click</a>',
  ];

  for (const payload of MARKUP_PAYLOADS) {
    it(`renders ${JSON.stringify(payload)} as characters, not elements`, () => {
      const host = mountFragment(payload);
      const value = host.querySelector('[data-deactivated-url]')!;

      // 1. The payload survives verbatim as text the user can read and copy.
      expect(value.textContent).toBe(payload);

      // 2. It did not become markup. These are the assertions that go red if
      //    the binding is changed to unsafeHTML.
      //
      //    NOT `childNodes.length === 1`, and not `firstChild.nodeType`. Lit
      //    brackets every child binding with `<!---->` part markers, so the
      //    child list is [Comment, Text] and the first child is the comment.
      //    Asserting a bare child count encodes Lit's internal DOM shape rather
      //    than the property under test, and it fails against the SAFE
      //    implementation — which is exactly how it was found. Filter by node
      //    type instead, as the `title` test above already does.
      expect(value.querySelectorAll('*')).toHaveLength(0);

      const children = [...value.childNodes];
      expect(children.filter((n) => n.nodeType === Node.ELEMENT_NODE)).toHaveLength(0);
      expect(
        children
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent)
          .join(''),
      ).toBe(payload);

      // 3. Nothing anywhere in the subtree was parsed into a dangerous element
      //    or a link, however the payload was shaped.
      for (const tag of ['script', 'img', 'svg', 'iframe', 'a', 'object', 'embed']) {
        expect(host.querySelectorAll(tag)).toHaveLength(0);
      }
      expect(host.querySelectorAll('[href]')).toHaveLength(0);
      expect(host.querySelectorAll('[onerror]')).toHaveLength(0);
      expect(host.querySelectorAll('[onload]')).toHaveLength(0);
    });
  }

  it('anti-vacuity: the payloads really would parse into elements if they were treated as markup', () => {
    // The canary above proves "no elements appeared". This proves the payloads
    // are capable of producing elements in this exact environment, so a green
    // canary means the binding is safe rather than that jsdom silently dropped
    // the string. Without this control the canary could pass against a payload
    // list that was inert to begin with.
    for (const payload of MARKUP_PAYLOADS) {
      const probe = document.createElement('div');
      probe.innerHTML = payload;
      expect(probe.querySelectorAll('*').length).toBeGreaterThan(0);
    }
  });
});
