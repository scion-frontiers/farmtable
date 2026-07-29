import { literalBlindView, sinkArgumentIsSanitized } from './probe-mod.mjs';
const show = (s) => JSON.stringify(s);
const cases = [
  "renderMarkdown(x, 'y')",
  "renderMarkdown(x) `junk`",
  "renderMarkdown(x) /* c */",
  "renderMarkdown(x)",
  "renderMarkdown(x,)",
  "renderMarkdown(x) + this.body",
];
for (const c of cases) {
  console.log(show(c).padEnd(34), '->', show(literalBlindView(c)).padEnd(34), 'sanitized?', sinkArgumentIsSanitized(c));
}
