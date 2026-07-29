#!/bin/bash
# Run from web/. Runtime probes of renderMarkdown itself.
set -eu
P=node_modules/.probe; mkdir -p $P
npx tsc -p tsconfig.test.json
cp .tmp-test/util/markdown.js $P/markdown.js
cat > $P/s.mjs <<'EOF'
import { JSDOM } from 'jsdom';
const dom=new JSDOM(''); globalThis.window=dom.window; globalThis.document=dom.window.document;
const markedMod = await import('marked');
const MD='- [x] done\n- [ ] todo\n';
console.log('singleton BEFORE:', JSON.stringify(markedMod.marked.parse(MD)));
const { renderMarkdown } = await import('./markdown.js');
console.log('singleton AFTER :', JSON.stringify(markedMod.marked.parse(MD)));
console.log('fresh instance  :', JSON.stringify(new markedMod.Marked().parse(MD)));
markedMod.marked.use({ renderer: { checkbox: () => '<b>PWNED</b>' } });
console.log('after marked.use() on singleton, renderMarkdown:', JSON.stringify(renderMarkdown(MD)));
const host=dom.window.document.createElement('div'); host.innerHTML=renderMarkdown(MD);
for (const el of host.querySelectorAll('*'))
  console.log('el', el.tagName, [...el.attributes].map(a=>`${a.name}=${a.value}`).join(' '));
console.log('span codepoints:', [...host.querySelector('span').textContent].map(c=>'U+'+c.codePointAt(0).toString(16).toUpperCase()).join(' '));
for (const [n,c] of [['U+2611','☑'],['U+2610','☐']])
  console.log(n,'Emoji=',/\p{Emoji}/u.test(c),'Emoji_Presentation=',/\p{Emoji_Presentation}/u.test(c));
const residual = {
  'custom element':'<sl-details summary="x">hi</sl-details>', 'id':'<div id="content">x</div>',
  'slot':'<div slot="footer">x</div>', 'part':'<div part="body" exportparts="body">x</div>',
  'img srcset':'<img src="/a.png" srcset="https://evil.example/1x.png 1x">',
  'a ping':'<a href="https://x.example" ping="https://evil.example/p">x</a>',
  'a target':'<a href="https://x.example" target="_blank">x</a>',
  'video autoplay':'<video src="https://evil.example/v.mp4" autoplay></video>',
  'audio autoplay':'<audio src="https://evil.example/a.mp3" autoplay></audio>',
};
for (const [k,v] of Object.entries(residual)) console.log(k.padEnd(16), JSON.stringify(renderMarkdown(v)));
EOF
node $P/s.mjs
rm -rf $P
