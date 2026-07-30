import { describe, expect, it } from 'vitest';
import '../src/components/inspector/ft-inspector-code.js';
import { CIStatus, PullRequestStatus, type CodeContext } from '../src/gen/types.js';
import { mount, queryAllDeep, textDeep } from './helpers/dom.js';

/**
 * Second external-link injection site (found by dev-p2-fixes, not in the
 * original brief): `ft-inspector-code` interpolates `pr.url` straight into an
 * `href`. PR URLs arrive from platform adapters, i.e. from outside Farm Table,
 * so they get the same `safeExternalUrl()` treatment as `task.remoteUrl`.
 *
 * As with the meta panel, these tests assert on the rendered DOM only.
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

function links(element: Element): HTMLAnchorElement[] {
  return queryAllDeep<HTMLAnchorElement>(element, 'a');
}

describe('ft-inspector-code — hostile pull request urls', () => {
  it('renders no link for a javascript: pull request url', async () => {
    const code = await mountCode('javascript:alert(1)');

    expect(links(code)).toHaveLength(0);
    // The hostile string IS in the title of the fallback span (positive arm — intended)
    const fallback = code.shadowRoot!.querySelector('.pr-link-unsafe');
    expect(fallback).not.toBeNull();
    expect(fallback?.getAttribute('title')).toContain('javascript:');
    // The hostile string is NOWHERE ELSE in any attribute (general property, one admitted exception)
    for (const el of queryAllDeep(code, '*')) {
      for (const attr of el.attributes) {
        if (el === fallback && attr.name === 'title') continue; // admitted: title on fallback
        expect(attr.value).not.toContain('javascript:');
      }
    }
  });

  for (const hostile of [
    'JaVaScRiPt:alert(document.domain)',
    ' javascript:alert(1) ',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ]) {
    it(`renders no href for pull request url ${JSON.stringify(hostile)}`, async () => {
      const code = await mountCode(hostile);

      expect(links(code).map((anchor) => anchor.getAttribute('href'))).toEqual([]);
    });
  }

  it('still shows the pull request id when its url is unsafe', async () => {
    const code = await mountCode('javascript:alert(1)');

    expect(textDeep(code)).toContain('#7');
  });
});

describe('ft-inspector-code — safe pull request urls', () => {
  it('renders a link for an https: pull request url', async () => {
    const code = await mountCode('https://github.com/acme/repo/pull/7');

    expect(links(code).map((anchor) => anchor.getAttribute('href'))).toEqual([
      'https://github.com/acme/repo/pull/7',
    ]);
  });

  it('renders a link for a localhost http: pull request url', async () => {
    const code = await mountCode('http://localhost:3000/pull/7');

    expect(links(code).map((anchor) => anchor.getAttribute('href'))).toEqual([
      'http://localhost:3000/pull/7',
    ]);
  });

  it('renders a link for a remote http: pull request url (C2 ruling)', async () => {
    const code = await mountCode('http://evil.example.com/pr/7');
    expect(links(code).map((anchor) => anchor.getAttribute('href'))).toEqual([
      'http://evil.example.com/pr/7',
    ]);
  });

  it('keeps rel="noopener" and target="_blank" on the rendered pull request link', async () => {
    const code = await mountCode('https://github.com/acme/repo/pull/7');

    const anchor = links(code)[0];
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel') ?? '').toContain('noopener');
  });
});
