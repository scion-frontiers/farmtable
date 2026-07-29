#!/usr/bin/env python3
"""Content-addressed mutation harness, #194 round-5 test leg.

Rules enforced (shared brief, bars 3 and 4):
  - mutations are addressed by unique CONTENT, never by line number; abort if
    the anchor does not appear exactly once
  - backups live OUTSIDE the repo
  - after restore, verify by sha256 against the out-of-repo pristine copy,
    not by `git status` alone
  - exit codes captured from the child, never through a pipe
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys

REPO = "/workspace"
SCRATCH = "/scion-volumes/scratchpad/projects/farmtable/salvage/r5-test-194"
PRISTINE = os.path.join(SCRATCH, "pristine")
BACKUP = os.path.join(SCRATCH, "backup")


def sha256(path):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def apply_mutation(mut):
    """mut = {"file": relpath, "edits": [(anchor, replacement), ...]}"""
    rel = mut["file"]
    abspath = os.path.join(REPO, rel)
    pristine_path = os.path.join(PRISTINE, rel)

    if sha256(abspath) != sha256(pristine_path):
        raise SystemExit(f"ABORT: {rel} differs from pristine BEFORE mutating")

    os.makedirs(os.path.join(BACKUP, os.path.dirname(rel)), exist_ok=True)
    shutil.copy2(abspath, os.path.join(BACKUP, rel))

    src = open(abspath).read()
    for anchor, repl in mut["edits"]:
        n = src.count(anchor)
        if n != 1:
            restore(mut)
            raise SystemExit(
                f"ABORT: anchor is not unique in {rel} (found {n}):\n{anchor[:200]}"
            )
        src = src.replace(anchor, repl)
    with open(abspath, "w") as fh:
        fh.write(src)

    if sha256(abspath) == sha256(pristine_path):
        restore(mut)
        raise SystemExit(f"ABORT: mutation of {rel} was a no-op (sha unchanged)")
    return True


def restore(mut):
    rel = mut["file"]
    abspath = os.path.join(REPO, rel)
    shutil.copy2(os.path.join(BACKUP, rel), abspath)
    if sha256(abspath) != sha256(os.path.join(PRISTINE, rel)):
        raise SystemExit(f"FATAL: restore of {rel} does NOT match pristine")


def run_tests(pkg, run_re):
    """Exit code captured from the child directly. Output to a file, not a pipe."""
    out = os.path.join(SCRATCH, "last_run.txt")
    with open(out, "w") as fh:
        rc = subprocess.call(
            ["go", "test", *pkg.split(), "-run", run_re, "-v", "-count=1"],
            cwd=REPO, stdout=fh, stderr=subprocess.STDOUT,
            env={**os.environ, "PATH": "/workspace/.farmtable/bin:" + os.environ["PATH"]},
        )
    return rc, open(out, errors="replace").read()


def failed_subtests(output, parent):
    """Return the set of immediate subtest names that FAILED under `parent`."""
    failed = set()
    for line in output.splitlines():
        s = line.strip()
        if s.startswith("--- FAIL:"):
            name = s.split("--- FAIL:")[1].strip().split(" ")[0]
            if name.startswith(parent + "/"):
                rest = name[len(parent) + 1:]
                failed.add(rest.split("/")[0])
    return failed


def parent_failed(output, parent):
    for line in output.splitlines():
        s = line.strip()
        if s.startswith("--- FAIL:") and s.split("--- FAIL:")[1].strip().split(" ")[0] == parent:
            return True
    return False


MUTATIONS = json.load(open(os.path.join(SCRATCH, "mutations.json")))


def main():
    which = sys.argv[1]
    mut = MUTATIONS[which]
    results = {}
    try:
        apply_mutation(mut)
        print(f"=== {which} APPLIED: {mut['desc']}")
        rc, out = run_tests(mut["pkg"], mut["run"])
        print(f"CHILD_EXIT={rc}")
        for parent in mut.get("parents", []):
            subs = sorted(failed_subtests(out, parent))
            results[parent] = {
                "parent_failed": parent_failed(out, parent),
                "failed_subtests": subs,
                "n_failed": len(subs),
            }
            print(f"  {parent}: parent_failed={results[parent]['parent_failed']} "
                  f"n_failed_subtests={len(subs)}")
            for s in subs:
                print(f"      FAIL {s}")
        shutil.copy2(os.path.join(SCRATCH, "last_run.txt"),
                     os.path.join(SCRATCH, f"run_{which}.txt"))
    finally:
        restore(mut)
        gs = subprocess.run(["git", "status", "--porcelain"], cwd=REPO,
                            capture_output=True, text=True).stdout.strip()
        print(f"RESTORED. git_status_porcelain_empty={gs == ''!r} sha256_matches_pristine=True")
        if gs:
            print("UNEXPECTED DIRT:\n" + gs)
    json.dump(results, open(os.path.join(SCRATCH, f"result_{which}.json"), "w"), indent=2)


if __name__ == "__main__":
    main()
