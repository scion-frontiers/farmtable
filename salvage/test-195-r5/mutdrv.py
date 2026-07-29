#!/usr/bin/env python3
"""
Mutation / ablation driver for farmtable#195 markdown-sanitize, review round 5
(TEST leg).

Design constraints, each one traceable to a failure on this workstream:

  * CONTENT-ADDRESSED ONLY. A mutation names an `anchor` string, never a line
    number. If the anchor does not occur EXACTLY ONCE in the target file the
    vector is ABORTED, not skipped silently and not applied to the first hit.
    A stale line number produces a false negative that looks like a pass.

  * BACKUPS LIVE OUTSIDE THE REPO (BACKUP_DIR, default /tmp/r5bak), and the
    pristine content is hashed at driver start.

  * RESTORE IS POSITIVELY ASSERTED. After every vector the driver checks BOTH
      (a) `git status --porcelain` is empty, AND
      (b) the sha256 of every touched file equals its pristine sha256.
    (a) alone measures agreement with HEAD and is structurally blind to work
    that was never in HEAD. If either check fails the driver ABORTS the whole
    run rather than continuing to produce results from an unknown tree.

  * REAL EXIT CODE. The child is run with subprocess.run(capture_output=True);
    the exit status is the child's own, never a pipeline's last stage.

Vector file format (JSON list):
  { "id": str,
    "expect": "red" | "green",
    "what": str,
    "steps": [ {"file": <repo-relative>, "anchor": str, "replace": str}, ... ] }

A step with "anchor": "" and "create": true writes a NEW file (used for
new-file vectors); the driver deletes it on restore.

Usage: mutdrv.py <vectors.json> [--repo /workspace] [--web web] [--out run.txt]
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys

def sha(p):
    with open(p, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()

class Driver:
    def __init__(self, repo, web, backup):
        self.repo = repo
        self.web = os.path.join(repo, web)
        self.backup = backup
        os.makedirs(backup, exist_ok=True)
        self.pristine = {}   # relpath -> (backup_path, sha)
        self.created = []

    def stash(self, rel):
        if rel in self.pristine:
            return
        src = os.path.join(self.repo, rel)
        dst = os.path.join(self.backup, rel.replace('/', '__'))
        shutil.copy2(src, dst)
        self.pristine[rel] = (dst, sha(src))

    def apply(self, steps):
        """Returns None on success, or an abort reason string."""
        for st in steps:
            rel = st['file']
            full = os.path.join(self.repo, rel)
            if st.get('create'):
                if os.path.exists(full):
                    return f"ABORT: create target {rel} already exists"
                os.makedirs(os.path.dirname(full), exist_ok=True)
                with open(full, 'w') as f:
                    f.write(st['replace'])
                self.created.append(full)
                continue
            self.stash(rel)
            with open(full) as f:
                src = f.read()
            n = src.count(st['anchor'])
            if n != 1:
                return f"ABORT: anchor occurs {n} times (expected exactly 1) in {rel}"
            with open(full, 'w') as f:
                f.write(src.replace(st['anchor'], st['replace']))
        return None

    def restore(self):
        for full in self.created:
            if os.path.exists(full):
                os.remove(full)
        self.created = []
        for rel, (dst, want) in self.pristine.items():
            full = os.path.join(self.repo, rel)
            shutil.copy2(dst, full)
            got = sha(full)
            if got != want:
                sys.exit(f"FATAL: restore of {rel} did not reproduce pristine "
                         f"content (sha {got} != {want})")
        # (a) tree agrees with HEAD
        r = subprocess.run(['git', 'status', '--porcelain'], cwd=self.repo,
                           capture_output=True, text=True)
        if r.stdout.strip():
            sys.exit("FATAL: git status --porcelain not empty after restore:\n"
                     + r.stdout)

    def run_suite(self):
        r = subprocess.run(['npm', 'test'], cwd=self.web,
                           capture_output=True, text=True)
        return r.returncode, (r.stdout + r.stderr)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('vectors')
    ap.add_argument('--repo', default='/workspace')
    ap.add_argument('--web', default='web')
    ap.add_argument('--backup', default='/tmp/r5bak/drv')
    ap.add_argument('--out', default=None)
    a = ap.parse_args()

    vectors = json.load(open(a.vectors))
    d = Driver(a.repo, a.web, a.backup)

    # Self-check: the harness must be able to express a FAILING run before any
    # "stayed green" result from it is believed. Bar 3 on this workstream: a
    # negative result from a harness that cannot express the positive is
    # inexpressible, not disproven.
    probe = [{"file": "web/src/util/markdown.test.ts",
              "anchor": "const EXPECTED_CHECKS = 61;",
              "replace": "const EXPECTED_CHECKS = 62;"}]
    err = d.apply(probe)
    if err:
        sys.exit("FATAL: self-check could not be applied: " + err)
    code, out = d.run_suite()
    d.restore()
    if code == 0:
        sys.exit("FATAL: harness self-check FAILED CLOSED — a deliberately "
                 "broken tree still exited 0. Every 'stayed green' result from "
                 "this driver would be meaningless. Output:\n" + out)
    print(f"[self-check] deliberately-broken tree -> exit {code}  OK "
          f"(harness can express failure)")

    lines = [f"[self-check] broken tree -> exit {code} OK"]
    verdicts = []
    for v in vectors:
        err = d.apply(v['steps'])
        if err:
            d.restore()
            print(f"{v['id']:<28} {err}")
            lines.append(f"{v['id']:<28} {err}")
            verdicts.append((v['id'], 'ABORT', v.get('expect'), err))
            continue
        code, out = d.run_suite()
        d.restore()
        got = 'green' if code == 0 else 'red'
        exp = v.get('expect', 'red')
        mark = 'OK ' if got == exp else '!! MISMATCH'
        if a.out:
            os.makedirs(a.out + '.d', exist_ok=True)
            with open(os.path.join(a.out + '.d', v['id'] + '.txt'), 'w') as f:
                f.write(out)
        # Which named check(s) failed, not just the last line: the suite reports
        # every failure as "  - <check name>: <message>".
        named = [l.strip() for l in out.split('\n') if l.strip().startswith('- ')]
        tail = ' ;; '.join(named) if named else (
            [l for l in out.strip().split('\n') if l.strip()][-1] if out.strip() else '')
        print(f"{v['id']:<28} exit={code:<3} {got:<5} expect={exp:<5} {mark}  {tail[:150]}")
        lines.append(f"{v['id']:<28} exit={code:<3} {got:<5} expect={exp:<5} {mark}\n"
                     f"    what: {v.get('what','')}\n    last: {tail[:400]}")
        verdicts.append((v['id'], got, exp, tail))

    print("\n=== MISMATCHES ===")
    lines.append("\n=== MISMATCHES ===")
    bad = [x for x in verdicts if x[1] != x[2]]
    for x in bad:
        print(f"  {x[0]}: got {x[1]}, expected {x[2]}")
        lines.append(f"  {x[0]}: got {x[1]}, expected {x[2]} :: {x[3][:300]}")
    if not bad:
        print("  none")
        lines.append("  none")

    if a.out:
        with open(a.out, 'w') as f:
            f.write('\n'.join(lines) + '\n')

if __name__ == '__main__':
    main()
