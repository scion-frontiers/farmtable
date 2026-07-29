#!/usr/bin/env python3
"""job4-control.py — POSITIVE CONTROLS for the Job 4 negative claims.

Claim under test (J4-A): "killing the removal half of writeLabelSwap fails
zero tests in internal/platform/github". That is a NEGATIVE claim, so before
reporting it I must show this exact harness CAN turn tests red by editing this
exact function.

CTRL-ADD  : kill the ADD half of writeLabelSwap. Expect RED (>0 failures).
CTRL-BOTH : kill both halves.                     Expect RED (>0 failures).
J4-A rerun: kill the REMOVE half.                 Measured separately.

Also instruments the leg B target test to report whether the production code
issued ANY label mutation at all, which is the real explanation for J4-PC.
"""
import hashlib, os, re, shutil, subprocess, sys, tempfile

PKG = "./internal/platform/github/"
REPO = "/workspace"
PT = "internal/platform/github/passthrough.go"
HEAD = """func (s *GitHubPassThroughStore) writeLabelSwap(ctx context.Context, issueID githubv4.ID, add, remove []string) error {
	if removeIDs := s.labelNamesToIDs(remove); len(removeIDs) > 0 {"""

VARIANTS = {
    "CTRL-ADD  (add half dead)":    "\tadd = nil // MUTANT-CTRLADD\n",
    "CTRL-BOTH (both halves dead)": "\tadd, remove = nil, nil // MUTANT-CTRLBOTH\n",
    "J4-A      (remove half dead)": "\tremove = nil // MUTANT-J4A\n",
}

def die(m):
    print(f"\n!!!!! ABORT: {m}"); sys.exit(99)

def sha(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()

src = os.path.join(REPO, PT)
pris = tempfile.mkdtemp(prefix="j4c-")
snap = os.path.join(pris, "passthrough.go")
shutil.copy2(src, snap)
WANT = sha(src)
print(f"pristine {WANT[:12]} -> {snap}")

def restore():
    shutil.copy2(snap, src)
    if sha(src) != WANT:
        die("REVERT FAILED")

def run_pkg():
    r = subprocess.run(["go", "test", "-count=1", "-v", PKG], cwd=REPO,
                       capture_output=True, text=True)
    out = r.stdout + r.stderr
    fails = sorted(set(re.findall(r"(?m)^--- FAIL: (\S+)", out)))
    total = sorted(set(re.findall(r"(?m)^--- (?:FAIL|PASS|SKIP): (\S+)", out)))
    return r.returncode, fails, total

restore()
code, fails, total = run_pkg()
if len(total) == 0: die("baseline VOID (0 tests parsed)")
if code != 0: die(f"baseline not GREEN: {fails}")
print(f"baseline: GREEN, {len(total)} top-level tests\n")

results = {}
for label, inject in VARIANTS.items():
    restore()
    s = open(src).read()
    if s.count(HEAD) != 1:
        die(f"anchor occurs {s.count(HEAD)} times, need 1")
    lines = HEAD.split("\n")
    new_head = lines[0] + "\n" + inject + lines[1]
    open(src, "w").write(s.replace(HEAD, new_head, 1))

    b = subprocess.run(["go", "vet", "-tests=true", PKG], cwd=REPO,
                       capture_output=True, text=True)
    blob = b.stdout + b.stderr
    if "syntax error" in blob or "undefined:" in blob or "declared and not used" in blob:
        print(blob[:800]); restore(); die(f"{label} does not compile")

    code, fails, total = run_pkg()
    if len(total) == 0:
        restore(); die(f"{label} VOID run")
    print(f"{label}: exit={code} fails={len(fails)} of {len(total)}")
    for t in fails:
        print(f"      RED {t}")
    results[label] = fails
    restore()

restore()
g = subprocess.run(["grep", "-rn", "MUTANT", "--include=*.go", "."],
                   cwd=REPO, capture_output=True, text=True)
if g.stdout.strip(): die(f"MUTANT left behind:\n{g.stdout}")
print("\ntree restored, no MUTANT markers")

add_f = results["CTRL-ADD  (add half dead)"]
rem_f = results["J4-A      (remove half dead)"]
print("\n===== VERDICT =====")
if not add_f:
    print("POSITIVE CONTROL FAILED: killing the ADD half also fails nothing.")
    print("The J4-A negative result is therefore NOT trustworthy — the harness")
    print("has not been shown able to redden anything via this function.")
    sys.exit(91)
print(f"POSITIVE CONTROL PASSED: killing the ADD half reddens {len(add_f)} tests,")
print("so the harness demonstrably CAN report failure through writeLabelSwap.")
print(f"J4-A (remove half dead) reddens {len(rem_f)} tests.")
if not rem_f:
    print(">>> FINDING STANDS: the removal half of writeLabelSwap is pinned by")
    print(">>> NO test in internal/platform/github.")
