import { JSDOM } from 'jsdom';
const dom = new JSDOM('');
globalThis.window = dom.window; globalThis.document = dom.window.document;
const { renderMarkdown } = await import('./.tmp-test-md/util/markdown.js');
const DOMPurify = (await import('dompurify')).default;
const { marked } = await import('marked');

console.log('--- what survives (intended, but note there is NO CSP) ---');
for (const md of [
  '![p](https://evil.example/pixel.png)',
  '[click](https://evil.example/phish)',
  '<div is="evil-el">x</div>',
  '<img srcset="https://evil.example/1x.png 1x" src="https://evil.example/f.png">',
  '- [x] done',
]) console.log(JSON.stringify(md), '->', JSON.stringify(renderMarkdown(md)));

console.log('\n--- ASYMMETRY: what does capturing each dependency actually buy? ---');
// marked half: poison the SHARED singleton with a renderer that emits <script>.
marked.use({ renderer: { paragraph: () => '<script>alert(1)</script><img src=x onerror=alert(2)>' } });
console.log('poisoned marked.parse raw       :', JSON.stringify(marked.parse('hello')));
console.log('renderMarkdown (private Marked) :', JSON.stringify(renderMarkdown('hello')));
console.log('poisoned marked THROUGH DOMPurify:',
  JSON.stringify(DOMPurify.sanitize(marked.parse('hello'), {
    FORBID_TAGS: ['form','input','button','select','textarea','option','dialog','style'],
    FORBID_ATTR: ['style','class','formaction','action','download','slot'],
  })));

// DOMPurify half, for the contrast.
DOMPurify.setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] });
console.log('captured DOMPurify              :', JSON.stringify(renderMarkdown('<img src=x onerror=alert(1)><script>alert(2)</script>')));
DOMPurify.clearConfig();
