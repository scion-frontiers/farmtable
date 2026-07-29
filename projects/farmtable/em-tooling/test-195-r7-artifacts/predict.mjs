// Static, source-only prediction of the assertion total. Reads the test source
// with a regex counter; never reads the runner's own output.
import { readFileSync } from 'node:fs';
const s = readFileSync('/workspace/web/src/util/markdown.test.ts', 'utf8');
const names = ['assertNoElement', 'assertElement', 'assertNotContains', 'assertContains', 'assertEqual', 'assertNoEventHandlers'];
let call = 0, def = 0;
for (const n of names) {
  call += (s.match(new RegExp('\\b' + n + '\\s*\\(', 'g')) || []).length;
  def += (s.match(new RegExp('function ' + n + '\\s*\\(', 'g')) || []).length;
}
console.log('assert* textual occurrences:', call, '| definitions:', def, '=> static call sites:', call - def);
console.log('check( call sites:', (s.match(/^\s+check\(/gm) || []).length);
const lines = s.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (/^\s*for \(/.test(lines[i])) {
    let depth = 0, j = i, body = '';
    do { body += lines[j] + '\n'; depth += (lines[j].match(/{/g) || []).length - (lines[j].match(/}/g) || []).length; j++; }
    while (j < lines.length && depth > 0);
    const inner = body.slice(body.indexOf('\n'));
    const hits = names.filter((n) => new RegExp('\\b' + n + '\\s*\\(').test(inner));
    if (hits.length) console.log(`  LOOP line ${i + 1}: ${lines[i].trim()}  -> asserts: ${hits.join(',')}`);
  }
}
