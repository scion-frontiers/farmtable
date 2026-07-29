#!/usr/bin/env python3
"""r6-test-195 mutation harness. Content-addressed only. Exit codes taken from
the child process directly (subprocess.run().returncode), never through a pipe.

Usage: mut.py <spec.json>
spec.json = [{"label":..., "edits":[{"file": <repo-rel>, "find": ..., "replace": ...}, ...]}, ...]

Every `find` must occur EXACTLY ONCE in the target file or the mutation aborts.
After each run every touched file is restored from an out-of-repo pristine copy
and re-verified by sha256; `git status --porcelain` must also be empty.
"""
import hashlib, json, os, shutil, subprocess, sys, tempfile

REPO = os.environ.get("MUT_REPO", "/workspace")
WEB = os.path.join(REPO, "web")
NOGIT = os.environ.get("MUT_NOGIT") == "1"
SALV = "/scion-volumes/scratchpad/projects/farmtable/salvage/r6-test-195"


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def run_suite():
    """Returns (exitcode, combined output). Exit code comes from the child."""
    p = subprocess.run(["npm", "test"], cwd=WEB, capture_output=True, text=True)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def git_clean():
    if NOGIT: return ""
    p = subprocess.run(["git", "status", "--porcelain"], cwd=REPO,
                       capture_output=True, text=True)
    return p.stdout.strip()


def main():
    spec = json.load(open(sys.argv[1]))
    snapdir = tempfile.mkdtemp(prefix="r6test-snap-", dir=SALV)
    results = []
    for m in spec:
        label = m["label"]
        edits = m["edits"]
        touched = []
        aborted = None
        # snapshot every file this mutation touches, out of repo
        for e in edits:
            src = os.path.join(REPO, e["file"])
            dst = os.path.join(snapdir, e["file"].replace("/", "__"))
            if not os.path.exists(dst):
                shutil.copy2(src, dst)
            touched.append((src, dst))
        try:
            for e in edits:
                src = os.path.join(REPO, e["file"])
                text = open(src, encoding="utf8").read()
                n = text.count(e["find"])
                if n != 1:
                    aborted = f"ANCHOR NOT UNIQUE in {e['file']}: {n} occurrences"
                    break
                open(src, "w", encoding="utf8").write(
                    text.replace(e["find"], e["replace"], 1))
            if aborted:
                rc, out = None, aborted
            else:
                rc, out = run_suite()
                if m.get("tsc"):
                    p2 = subprocess.run(["npx", "tsc", "--noEmit"], cwd=WEB,
                                        capture_output=True, text=True)
                    out += f"\n[tsc --noEmit exit={p2.returncode}]\n" + (p2.stdout or "")
                    if rc == 0:
                        rc = p2.returncode
        finally:
            for src, dst in touched:
                shutil.copy2(dst, src)
            # verify restore: byte-identical to the out-of-repo snapshot
            for src, dst in touched:
                assert sha(src) == sha(dst), f"RESTORE FAILED for {src}"
            dirty = git_clean()
            assert dirty == "", f"git dirty after restore:\n{dirty}"
        verdict = "ABORT" if aborted else ("GREEN" if rc == 0 else "RED")
        tail = "\n".join([l for l in out.splitlines() if l.strip()][-14:])
        results.append({"label": label, "exit": rc, "verdict": verdict, "tail": tail})
        print(f"{verdict:6s} exit={rc}  {label}")
        sys.stdout.flush()
    json.dump(results, open(os.path.join(SALV, "logs",
              os.path.basename(sys.argv[1]) + ".results.json"), "w"), indent=1)
    shutil.rmtree(snapdir)


if __name__ == "__main__":
    main()
