#!/usr/bin/env bash
# Does a DOWNGRADE of the sanitizer pass the r7 dependency floor silently?
# ABORTS on failed prerequisites. Child exit codes read directly.
set -u
SB=/tmp/audit-r7/sb2
rm -rf "$SB"; mkdir -p "$SB"
cp /workspace/web/package.json /workspace/web/package-lock.json \
   /workspace/web/tsconfig.json /workspace/web/tsconfig.test.json "$SB/"
cp -r /workspace/web/src "$SB/src"; cp /workspace/web/index.html "$SB/"
cp -r /workspace/web/public "$SB/public"; cp /workspace/web/vite.config.ts "$SB/"

cd "$SB" || exit 90

# PREREQ: clean install + green suite, and the declared floor is what r7 says.
node -e "const p=require('./package.json'); if(p.dependencies.dompurify!=='^3.4.12'){console.error('ABORT: floor is not ^3.4.12');process.exit(90)}" || exit 90
npm ci > /tmp/audit-r7/s-ci.log 2>&1 || { echo "ABORT: npm ci failed"; exit 91; }
npm test > /tmp/audit-r7/s-base.log 2>&1 || { echo "ABORT: baseline red"; exit 92; }
echo "prereq OK: floor=^3.4.12, npm ci 0, suite green"
echo "installed baseline: $(node -p "require('./node_modules/dompurify/package.json').version")"

# ---- CONTROL: loosening the DECLARED range must be RED --------------------
node -e "const f='./package.json';const p=require(f);p.dependencies.dompurify='^3.0.0';require('fs').writeFileSync(f,JSON.stringify(p,null,2))"
npm test > /tmp/audit-r7/s-loose.log 2>&1; loose=$?
node -e "const f='./package.json';const p=require(f);p.dependencies.dompurify='^3.4.12';require('fs').writeFileSync(f,JSON.stringify(p,null,2))"
[ $loose -ne 0 ] && echo "CONTROL OK: declared-range loosening is RED (exit $loose)" \
                 || { echo "ABORT: declared-range control stayed GREEN"; exit 93; }

# ---- ROUTE 1: npm "overrides" forces a downgrade, range untouched ---------
node -e "const f='./package.json';const p=require(f);p.overrides={dompurify:'3.1.0'};require('fs').writeFileSync(f,JSON.stringify(p,null,2))"
npm install > /tmp/audit-r7/s-ovr-install.log 2>&1; oi=$?
ver=$(node -p "require('./node_modules/dompurify/package.json').version" 2>/dev/null)
npm test > /tmp/audit-r7/s-ovr.log 2>&1; ov=$?
decl=$(node -p "require('./package.json').dependencies.dompurify")
echo "ROUTE1 overrides: npm install exit=$oi installed=$ver declared=$decl suite_exit=$ov"
grep -oE '[0-9]+ checks passed' /tmp/audit-r7/s-ovr.log | head -1
