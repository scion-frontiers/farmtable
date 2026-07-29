#!/usr/bin/env python3
"""Apply one content-addressed mutation, run an arbitrary command, restore.

Same safety contract as mutdrv.py: content-addressed anchors with an exact-once
requirement, backups outside the repo, and a restore that positively asserts the
pristine sha256 AND an empty `git status --porcelain`. Exit codes come straight
from subprocess.run, never through a pipe.

Usage: probe-under-mutation.py <mutation.json> -- <cmd...>
"""
import hashlib, json, os, shutil, subprocess, sys

REPO = '/workspace'
WEB = '/workspace/web'
BAK = '/tmp/r5bak/probe'

def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def main():
    sep = sys.argv.index('--')
    mut = json.load(open(sys.argv[1]))
    cmd = sys.argv[sep + 1:]
    os.makedirs(BAK, exist_ok=True)
    saved = {}
    try:
        for st in mut['steps']:
            rel = st['file']
            full = os.path.join(REPO, rel)
            dst = os.path.join(BAK, rel.replace('/', '__'))
            if rel not in saved:
                shutil.copy2(full, dst)
                saved[rel] = (dst, sha(full))
            src = open(full).read()
            n = src.count(st['anchor'])
            if n != 1:
                sys.exit(f"ABORT: anchor occurs {n} times (expected 1) in {rel}")
            open(full, 'w').write(src.replace(st['anchor'], st['replace']))
        print(f"### mutation applied: {mut['id']}", flush=True)
        r = subprocess.run(cmd, cwd=WEB, capture_output=True, text=True)
        print(r.stdout + r.stderr)
        print(f"### child exit = {r.returncode}")
    finally:
        for rel, (dst, want) in saved.items():
            full = os.path.join(REPO, rel)
            shutil.copy2(dst, full)
            got = sha(full)
            if got != want:
                sys.exit(f"FATAL: restore of {rel} mismatched ({got} != {want})")
        g = subprocess.run(['git', 'status', '--porcelain'], cwd=REPO,
                           capture_output=True, text=True)
        extra = [l for l in g.stdout.splitlines() if '.r5probe' not in l]
        if extra:
            sys.exit("FATAL: dirty tree after restore:\n" + '\n'.join(extra))
        print("### restored: sha256 matches pristine for "
              + ", ".join(saved) + "; git status clean")

main()
