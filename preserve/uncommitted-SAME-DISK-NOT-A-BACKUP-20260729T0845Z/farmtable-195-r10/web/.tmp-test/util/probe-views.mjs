import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripInertText } from './probe-mod.mjs';
const root = '/workspace/farmtable-195-r10/web';
const files = [];
const walk = (d) => { for (const e of readdirSync(d)) { const p = join(d,e);
  if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|js)$/.test(p) && !p.endsWith('.test.ts')) files.push(p); } };
walk(join(root,'src'));
let blankTrim = 0, blankLen = 0, noRM = 0;
for (const f of files) {
  const src = readFileSync(f,'utf8');
  for (const strings of [false,true]) {
    const v = stripInertText(src, { strings });
    if (v.length === 0) { blankLen++; console.log('LEN0', relative(root,f), strings); }
    if (v.trim() === '') { blankTrim++; console.log('TRIM0', relative(root,f), strings); }
  }
}
console.log('files walked:', files.length, 'len0:', blankLen, 'trim0:', blankTrim);
const md = join(root,'src/util/markdown.ts');
for (const strings of [false,true]) {
  console.log('markdown.ts strings:'+strings, 'has renderMarkdown:',
    stripInertText(readFileSync(md,'utf8'), { strings }).includes('renderMarkdown'));
}
