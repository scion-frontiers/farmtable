import { describe, expect, it } from 'vitest';
import '../src/components/inspector/ft-inspector-meta.js';
import { mount, queryAllDeep, textDeep } from './helpers/dom.js';
import { RecordingClient, task } from './helpers/fixtures.js';

/**
 * Rendered evidence that external-source links are sanitized.
 *
 * These tests deliberately import nothing from `src/util/safe-url.ts`: they
 * assert on the rendered DOM only, so they hold whichever way dev-p2-fixes
 * implements the sanitization. The helper's own unit-level contract lives in
 * `test/safe-url.contract.test.ts`.
 */
async function mountMeta(remoteUrl: string | undefined) {
  return mount<HTMLElement>('ft-inspector-meta', {
    task: task({ id: 'meta', name: 'Meta', remoteUrl }),
    client: new RecordingClient(),
    readOnly: true,
  });
}

function links(element: Element): HTMLAnchorElement[] {
  return queryAllDeep<HTMLAnchorElement>(element, 'a');
}

const HOSTILE_URLS = [
  'javascript:alert(document.domain)',
  'JaVaScRiPt:alert(1)',
  '  javascript:alert(1)  ',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
];

describe('ft-inspector-meta — hostile remoteUrl values', () => {
  it('renders no link for javascript: remoteUrl', async () => {
    const meta = await mountMeta('javascript:alert(document.domain)');

    expect(links(meta)).toHaveLength(0);
    expect(meta.shadowRoot?.innerHTML ?? '').not.toContain('javascript:');
  });

  it('renders no link for data: remoteUrl', async () => {
    const meta = await mountMeta('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==');

    expect(links(meta)).toHaveLength(0);
    expect(meta.shadowRoot?.innerHTML ?? '').not.toContain('data:text/html');
  });

  for (const hostile of HOSTILE_URLS) {
    it(`renders no href for remoteUrl ${JSON.stringify(hostile)}`, async () => {
      const meta = await mountMeta(hostile);

      const hrefs = links(meta).map((anchor) => anchor.getAttribute('href') ?? '');
      expect(hrefs).toEqual([]);
    });
  }

  it('renders no External Source row at all when the URL is unsafe', async () => {
    const meta = await mountMeta('javascript:alert(1)');

    expect(textDeep(meta)).not.toContain('Open External Source');
  });
});

describe('ft-inspector-meta — safe remoteUrl values', () => {
  it('renders a link for an https: remoteUrl', async () => {
    const meta = await mountMeta('https://github.com/acme/repo/issues/7');

    const hrefs = links(meta).map((anchor) => anchor.getAttribute('href'));
    expect(hrefs).toEqual(['https://github.com/acme/repo/issues/7']);
    expect(textDeep(meta)).toContain('Open External Source');
  });

  it('keeps rel="noopener" and target="_blank" on the rendered link', async () => {
    const meta = await mountMeta('https://example.com/task/1');

    const anchor = links(meta)[0];
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel') ?? '').toContain('noopener');
  });

  it('renders a link for a localhost http: remoteUrl', async () => {
    const meta = await mountMeta('http://localhost:8080/tasks/1');

    const hrefs = links(meta).map((anchor) => anchor.getAttribute('href'));
    expect(hrefs).toEqual(['http://localhost:8080/tasks/1']);
  });

  it('renders no link for a remote http: remoteUrl', async () => {
    const meta = await mountMeta('http://evil.example.com/task/1');

    expect(links(meta)).toHaveLength(0);
  });

  it('renders no External Source row when remoteUrl is absent', async () => {
    const meta = await mountMeta(undefined);

    expect(links(meta)).toHaveLength(0);
    expect(textDeep(meta)).not.toContain('External Source');
  });
});
