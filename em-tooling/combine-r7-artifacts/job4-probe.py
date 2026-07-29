#!/usr/bin/env python3
"""job4-probe.py — measure whether leg B's tests carry leg A's bypass shape.

Same standing bars as mutate-r7.py: unique content anchors, compile check,
verified revert, exit codes from the child process, abort on a void run.
"""
import hashlib, os, re, shutil, subprocess, sys, tempfile

ART = "/scion-volumes/scratchpad/projects/farmtable/em-tooling/combine-r7-artifacts"
PKG = "./internal/platform/github/"
TARGET = "TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel"

def die(m, c=99):
    print(f"\n!!!!! ABORT: {m}"); sys.exit(c)

def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()

def make_ctx(repo, files):
    pris = tempfile.mkdtemp(prefix="j4-")
    snap = {}
    for rel in files:
        src = os.path.join(repo, rel)
        if not os.path.isfile(src):
            die(f"missing {rel} in {repo}")
        dst = os.path.join(pris, rel.replace("/", "__"))
        shutil.copy2(src, dst)
        snap[rel] = (dst, sha(src))
    return snap

def restore(repo, snap):
    for rel, (dst, want) in snap.items():
        src = os.path.join(repo, rel)
        shutil.copy2(dst, src)
        if sha(src) != want:
            die(f"REVERT FAILED {rel}")

def apply_anchor(repo, rel, anchor, repl):
    p = os.path.join(repo, rel)
    s = open(p).read()
    n = s.count(anchor)
    if n != 1:
        die(f"anchor in {rel} occurs {n} times, need 1:\n{anchor}")
    open(p, "w").write(s.replace(anchor, repl, 1))
    if open(p).read().count(repl) != 1:
        die(f"write to {rel} did not land")

def run(repo, run_filter=None):
    cmd = ["go", "test", "-count=1", "-v"]
    if run_filter:
        cmd += ["-run", run_filter]
    cmd += [PKG]
    r = subprocess.run(cmd, cwd=repo, capture_output=True, text=True)
    out = r.stdout + r.stderr
    fails = sorted(set(re.findall(r"(?m)^--- FAIL: (\S+)", out)))
    total = sorted(set(re.findall(r"(?m)^--- (?:FAIL|PASS|SKIP): (\S+)", out)))
    return r.returncode, fails, total, out

FAKE = "internal/platform/github/close_label_swap_test.go"
PT = "internal/platform/github/passthrough.go"

# ---- J4-PC: leg A's exact defect, injected into this package's fake ----------
PC_ANCHORS = [
    (FAKE,
     '_, _ = w.Write([]byte(`{"data":{"addLabelsToLabelable":{"labelable":{"labels":{"nodes":[]}}}}}`))',
     '_, _ = w.Write([]byte(`{"data":{"addLabelsToLabelable":{"clientMutationId":null}}}`)) // MUTANT-J4PC'),
    (FAKE,
     '_, _ = w.Write([]byte(`{"data":{"removeLabelsFromLabelable":{"labelable":{"labels":{"nodes":[]}}}}}`))',
     '_, _ = w.Write([]byte(`{"data":{"removeLabelsFromLabelable":{"clientMutationId":null}}}`)) // MUTANT-J4PC'),
]

# ---- J4-A: total failure of the production removal path ---------------------
A_ANCHOR = (PT,
    """func (s *GitHubPassThroughStore) writeLabelSwap(ctx context.Context, issueID githubv4.ID, add, remove []string) error {
	if removeIDs := s.labelNamesToIDs(remove); len(removeIDs) > 0 {""",
    """func (s *GitHubPassThroughStore) writeLabelSwap(ctx context.Context, issueID githubv4.ID, add, remove []string) error {
	remove = nil // MUTANT-J4A: removal path totally dead
	if removeIDs := s.labelNamesToIDs(remove); len(removeIDs) > 0 {""")


def probe(repo, label, edits, want_desc):
    print(f"\n===== {label} in {repo} =====")
    files = sorted({rel for rel, _, _ in edits})
    snap = make_ctx(repo, files)
    restore(repo, snap)

    code0, f0, t0, _ = run(repo, f"^{TARGET}$")
    if len(t0) == 0:
        restore(repo, snap); die(f"{label}: baseline probe matched 0 tests — VOID")
    if code0 != 0:
        restore(repo, snap); die(f"{label}: baseline for {TARGET} is not GREEN")
    print(f"  baseline {TARGET}: GREEN exit=0")

    for rel, a, r in edits:
        apply_anchor(repo, rel, a, r)
    print(f"  mutated {len(edits)} anchor(s), each unique")

    b = subprocess.run(["go", "vet", "-tests=true", PKG], cwd=repo,
                       capture_output=True, text=True)
    blob = b.stdout + b.stderr
    if "syntax error" in blob or "undefined:" in blob or "cannot use" in blob:
        print(blob[:1500]); restore(repo, snap)
        die(f"{label} does not compile — aborting rather than scoring RED")
    print("  compiles OK")

    code, fails, total, out = run(repo, f"^{TARGET}$")
    if len(total) == 0:
        restore(repo, snap); die(f"{label}: probe matched 0 tests — VOID")
    state = "RED" if code != 0 else "GREEN"
    print(f"  >>> {TARGET}: {state} (exit={code})   [{want_desc}]")
    if state == "RED":
        for line in out.splitlines():
            if "UpdateTask:" in line or "_test.go:" in line:
                print(f"        {line.strip()}")
                break

    wcode, wfails, wtotal, _ = run(repo)
    if len(wtotal) == 0:
        restore(repo, snap); die(f"{label}: package run VOID")
    print(f"  package: exit={wcode} top_level_fails={len(wfails)} of {len(wtotal)}")
    for t in wfails:
        print(f"      RED {t}")

    restore(repo, snap)
    g = subprocess.run(["grep", "-rn", "MUTANT", "--include=*.go", "."],
                       cwd=repo, capture_output=True, text=True)
    if g.stdout.strip():
        die(f"MUTANT left behind:\n{g.stdout}")
    print("  reverted and verified, no MUTANT markers")
    return state, wfails


if __name__ == "__main__":
    repo = sys.argv[1] if len(sys.argv) > 1 else "/workspace"
    which = sys.argv[2] if len(sys.argv) > 2 else "both"
    if which in ("both", "pc"):
        probe(repo, "J4-PC (leg A's exact clientMutationId defect)", PC_ANCHORS,
              "predicted RED on combined, GREEN on legB-alone")
    if which in ("both", "a"):
        probe(repo, "J4-A (production removal path totally dead)", [A_ANCHOR],
              "predicted GREEN = vacuous assertion")
