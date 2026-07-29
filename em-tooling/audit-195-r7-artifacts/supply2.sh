#!/usr/bin/env bash
set -u
SB=/tmp/audit-r7/sb2
cd "$SB" || exit 90
# restore
cp /workspace/web/package.json ./package.json
cp /workspace/web/package-lock.json ./package-lock.json
npm ci > /tmp/audit-r7/s2-ci.log 2>&1 || { echo "ABORT: npm ci failed"; exit 91; }
npm test > /tmp/audit-r7/s2-base.log 2>&1 || { echo "ABORT: baseline red"; exit 92; }
echo "prereq OK: baseline green, dompurify $(node -p "require('./node_modules/dompurify/package.json').version")"

echo "--- ROUTE 2: lockfile pinned below the declared floor ---"
node -e "
const fs=require('fs');const l=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
l.packages['node_modules/dompurify'].version='3.1.0';
delete l.packages['node_modules/dompurify'].integrity;
l.packages['node_modules/dompurify'].resolved='https://registry.npmjs.org/dompurify/-/dompurify-3.1.0.tgz';
fs.writeFileSync('package-lock.json',JSON.stringify(l,null,2));"
npm ci > /tmp/audit-r7/s2-lock.log 2>&1; lc=$?
echo "ROUTE2 npm ci exit=$lc"; grep -E "npm error (code|Invalid|.*dompurify)" /tmp/audit-r7/s2-lock.log | head -4
cp /workspace/web/package-lock.json ./package-lock.json
npm ci > /dev/null 2>&1

echo "--- ROUTE 3: node_modules patched in place (the disclosed route) ---"
# Neuter the installed sanitizer: make sanitize() a pass-through.
node -e "
const fs=require('fs');const p='node_modules/dompurify/dist/purify.cjs.js';
console.log('target exists:', fs.existsSync(p));"
ls node_modules/dompurify/dist/ 2>/dev/null
node -e "
const fs=require('fs');
const f='node_modules/dompurify/package.json';const j=JSON.parse(fs.readFileSync(f,'utf8'));
console.log('declared installed version:', j.version, 'main:', j.main, 'module:', j.module);"

echo "--- ROUTE 4: sunset clause trigger ---"
node -e "const f='./package.json';const p=require(f);p.devDependencies['typescript-eslint']='^8.0.0';require('fs').writeFileSync(f,JSON.stringify(p,null,2))"
npm test > /tmp/audit-r7/s2-sunset.log 2>&1; su=$?
echo "ROUTE4 sunset (typescript-eslint declared) exit=$su"; grep -o "sunset clause[^']*" /tmp/audit-r7/s2-sunset.log | head -1
node -e "const f='./package.json';const p=require(f);p.devDependencies={'prettier':'^3.0.0',...p.devDependencies};delete p.devDependencies['typescript-eslint'];require('fs').writeFileSync(f,JSON.stringify(p,null,2))"
npm test > /tmp/audit-r7/s2-prettier.log 2>&1; pr=$?
echo "ROUTE4-control (unrelated devDep prettier) exit=$pr"
cp /workspace/web/package.json ./package.json

echo "--- npm audit ---"
npm audit --json > /tmp/audit-r7/s2-audit.json 2>&1; echo "audit exit=$?"
node -p "const a=require('/tmp/audit-r7/s2-audit.json'); JSON.stringify(a.metadata&&a.metadata.vulnerabilities)"
