import ts from '/workspace/farmtable/web/node_modules/typescript/lib/typescript.js';
import { readFileSync, writeFileSync } from 'node:fs';
for (const n of ['main.pristine','main.disarmed','branch.pristine','branch.disarmed']) {
  const src = readFileSync(`impl/${n}.ts`, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    fileName: `${n}.ts`,
  }).outputText;
  writeFileSync(`impl/${n}.mjs`, out);
  console.log(`transpiled ${n} -> ${out.split('\n').length} lines`);
}
