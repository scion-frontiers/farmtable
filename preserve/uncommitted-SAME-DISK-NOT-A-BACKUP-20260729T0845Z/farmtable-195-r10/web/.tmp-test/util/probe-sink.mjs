import { stripInertText, callArguments, sinkArgumentIsSanitized } from './probe-mod.mjs';
const file = (call) => [
  "import { LitElement, html } from 'lit';",
  "import { unsafeHTML } from 'lit/directives/unsafe-html.js';",
  "import { renderMarkdown } from '../../util/markdown.js';",
  'export class C extends LitElement {',
  '  render() {',
  '    return html`',
  '      ' + call,
  '    `;',
  '  }',
  '}',
].join('\n');
for (const call of [
  '${unsafeHTML(renderMarkdown(this.body))}',
  '${unsafeHTML(renderMarkdown(this.body) /* x */)}',
  '${unsafeHTML(renderMarkdown(this.body, /* x */))}',
  '${unsafeHTML(renderMarkdown(this.body) + this.body)}',
]) {
  const src = file(call);
  for (const strings of [false, true]) {
    const code = stripInertText(src, { strings });
    const args = callArguments(code, 'unsafeHTML');
    console.log(`strings:${String(strings).padEnd(5)} ${call}`);
    console.log(`   arg   = ${JSON.stringify(args[0])}`);
    console.log(`   sane? = ${args.map(sinkArgumentIsSanitized)}`);
  }
  console.log('   DIRECT on raw arg:', sinkArgumentIsSanitized(call.replace('${unsafeHTML(', '').replace(/\)}$/, '')));
  console.log();
}
