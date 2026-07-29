#!/usr/bin/env python3
"""Content-addressed mutation driver for #195 round 7.

Standing bars this implements:
  1. A no-op control mutation that MUST come out GREEN runs first, alongside a
     RED control. If either control is wrong the batch aborts: a runner that
     cannot show both colours cannot support any claim.
  2. Mutations are content-addressed ({file, find, replace}). The driver counts
     occurrences of `find` and ABORTS unless the count is exactly 1.
  3. "Clean" is not "unchanged": after every case each touched file is restored
     from an OUT-OF-REPO pristine copy and re-verified by sha256, and
     `git status --porcelain` must be empty.
  5. Exit codes come from the child process, never through a pipe. Where a case
     sets "tsc": true, `npx tsc --noEmit` runs as a second child and its code is
     folded in.
  6. The failing check name is extracted from the suite output, so a result can
     say WHICH rule fired rather than only that the suite went red.

Usage: python3 mut.py spec.json
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

REPO = os.environ.get("MUT_REPO", "/workspace")
WEB = os.path.join(REPO, "web")
HERE = os.path.dirname(os.path.abspath(__file__))
PRISTINE = os.path.join(HERE, "pristine")


def sha256(path):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def pristine_path(rel):
    return os.path.join(PRISTINE, rel.replace("/", "__"))


def snapshot(rels):
    os.makedirs(PRISTINE, exist_ok=True)
    digests = {}
    for rel in rels:
        src = os.path.join(REPO, rel)
        shutil.copy2(src, pristine_path(rel))
        digests[rel] = sha256(src)
    return digests


def porcelain():
    return subprocess.run(
        ["git", "-C", REPO, "status", "--porcelain"], capture_output=True, text=True
    ).stdout.strip()


# "Clean" is not "unchanged", and here neither is "empty": this branch is worked
# in-place, so the baseline working tree is compared against itself rather than
# against HEAD. sha256 against the out-of-repo pristine copy is the primary
# assertion; the porcelain diff is the second one, and it must match the state
# captured before the batch, not the empty string.
BASELINE_PORCELAIN = None


def restore(rels, digests, created=()):
    for rel in created:
        dst = os.path.join(REPO, rel)
        if os.path.exists(dst):
            os.remove(dst)
    for rel in rels:
        dst = os.path.join(REPO, rel)
        shutil.copy2(pristine_path(rel), dst)
        got = sha256(dst)
        assert got == digests[rel], f"restore drift on {rel}: {got} != {digests[rel]}"
    if os.environ.get("MUT_NOGIT") != "1":
        now = porcelain()
        assert now == BASELINE_PORCELAIN, (
            f"working tree changed shape after restore:\n{now}\n--- baseline ---\n"
            f"{BASELINE_PORCELAIN}"
        )


def apply_edits(edits):
    """Applies every edit, aborting unless each anchor occurs exactly once."""
    for e in edits:
        path = os.path.join(REPO, e["file"])
        if "create" in e:
            # A whole-file edit. Still content-addressed in the sense that
            # matters: the file must NOT already exist, so a case can never
            # silently overwrite something and report on the wrong tree.
            if os.path.exists(path):
                return f"CREATE-ABORT {e['file']}: already exists"
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(e["create"])
            continue
        with open(path, "r", encoding="utf-8") as fh:
            text = fh.read()
        n = text.count(e["find"])
        if n != 1:
            return f"ANCHOR-ABORT {e['file']}: anchor matched {n} times, expected 1"
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text.replace(e["find"], e["replace"]))
    return None


# Standing bar 6: name the rule that fired. `[^:]+` was wrong — several check
# names contain a colon themselves ("tripwire: no file reaches …"), so it
# truncated them to "tripwire" and two different rules reported the same name.
# The failure line is `  - <check name>: <message>`; take the whole line and
# truncate for width instead of guessing where the name ends.
CHECK_LINE = re.compile(r"^  - (.+)$", re.M)


def run_gate(want_tsc):
    """Returns (exit_code, checks_passed_or_None, [failing check names], tail)."""
    p = subprocess.run(
        ["npm", "test"], cwd=WEB, capture_output=True, text=True
    )
    code = p.returncode
    out = p.stdout + p.stderr
    if want_tsc:
        q = subprocess.run(
            ["npx", "tsc", "--noEmit"], cwd=WEB, capture_output=True, text=True
        )
        if q.returncode != 0:
            code = code or q.returncode
            out += "\n[tsc]\n" + q.stdout + q.stderr
    m = re.search(r"markdown sanitizer: (\d+) checks passed", out)
    passed = int(m.group(1)) if m else None
    fired = [f[:110] for f in CHECK_LINE.findall(out)]
    return code, passed, fired, out[-1500:]


def main():
    global BASELINE_PORCELAIN
    BASELINE_PORCELAIN = porcelain()
    spec = json.load(open(sys.argv[1]))
    cases = spec["cases"]
    created = sorted({e["file"] for c in cases for e in c["edits"] if "create" in e})
    rels = sorted({e["file"] for c in cases for e in c["edits"] if "create" not in e})
    digests = snapshot(rels)
    print("pristine sha256:")
    for rel in rels:
        print(f"  {digests[rel]}  {rel}")

    results = []
    for case in cases:
        abort = apply_edits(case["edits"])
        if abort:
            restore(rels, digests, created)
            print(f"[{case['id']}] {abort}")
            # Carry `expect` through. Dropping it made an aborted case — one
            # that never ran at all — score as a pass in the summary, which is
            # the same "cannot falsify" defect this round is about.
            results.append(
                {
                    "id": case["id"],
                    "desc": case.get("desc", ""),
                    "result": "ANCHOR-ABORT",
                    "expect": case.get("expect"),
                }
            )
            continue
        code, passed, fired, tail = run_gate(case.get("tsc", False))
        restore(rels, digests, created)
        colour = "GREEN" if code == 0 else "RED"
        expect = case.get("expect")
        verdict = "" if expect is None else ("  <<< UNEXPECTED" if expect != colour else "  ok")
        rec = {
            "id": case["id"],
            "desc": case.get("desc", ""),
            "result": colour,
            "exit": code,
            "checks": passed,
            "fired": fired,
            "expect": expect,
            "tail": tail if colour == "RED" else "",
        }
        results.append(rec)
        print(
            f"[{case['id']}] {colour} exit={code} checks={passed} "
            f"fired={fired if fired else '-'}{verdict}"
        )
        if case.get("control") and expect and expect != colour:
            print("CONTROL FAILED — the runner cannot show both colours. Aborting.")
            json.dump(results, open(sys.argv[1] + ".results.json", "w"), indent=2)
            sys.exit(2)

    json.dump(results, open(sys.argv[1] + ".results.json", "w"), indent=2)
    bad = [r for r in results if r.get("expect") and r["expect"] != r["result"]]
    print(f"\n{len(results)} cases, {len(bad)} unexpected")
    for r in bad:
        print(f"  UNEXPECTED {r['id']}: expected {r['expect']}, got {r['result']} — {r['desc']}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
