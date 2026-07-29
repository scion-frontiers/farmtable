// SECOND CONTROL. Production pipeline with the forbid lists deleted. Separates
// "DOMPurify defaults blocked it" from "this repo's config blocked it".
import { Marked } from '/workspace/web/node_modules/marked/lib/marked.esm.js';
import DOMPurify from '/workspace/web/node_modules/dompurify/dist/purify.es.mjs';
const parser = new Marked({
  renderer: {
    checkbox: ({ checked }) => checked
      ? '<span role="img" aria-label="Completed">☑︎</span>'
      : '<span role="img" aria-label="Not completed">☐︎</span>',
  },
});
export function renderMarkdown(md) {
  if (typeof md !== 'string') return '';
  return DOMPurify.sanitize(parser.parse(md));
}
