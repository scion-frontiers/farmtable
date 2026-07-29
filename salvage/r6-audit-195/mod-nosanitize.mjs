// POSITIVE CONTROL MODULE. Identical marked config to production, DOMPurify
// REMOVED entirely. If the probe cannot report ALLOWED against this module then
// the probe cannot observe an ALLOW at all and every DENIED it prints is void.
import { Marked } from '/workspace/web/node_modules/marked/lib/marked.esm.js';
const parser = new Marked({
  renderer: {
    checkbox: ({ checked }) => checked
      ? '<span role="img" aria-label="Completed">☑︎</span>'
      : '<span role="img" aria-label="Not completed">☐︎</span>',
  },
});
export function renderMarkdown(md) {
  if (typeof md !== 'string') return '';
  return parser.parse(md);
}
