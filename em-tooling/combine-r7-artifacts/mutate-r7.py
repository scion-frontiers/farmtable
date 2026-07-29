#!/usr/bin/env python3
"""
mutate-r7.py — re-measure leg B's mutations on the COMBINED round-7 tree.

Standing bars enforced (each is an ABORT, never a continue-and-print-green):
  * content-addressed anchors only; a non-unique or absent anchor is sys.exit(99)
  * baseline must be GREEN before any mutation
  * a mutation that fails to COMPILE aborts rather than being scored RED
  * revert verified by re-reading the file and comparing sha256 to a pristine
    out-of-repo copy taken before anything was touched
  * a run that parses 0 top-level test names aborts as void
  * exit codes come from subprocess.run(...).returncode, never through a pipe
"""
import hashlib, json, os, re, shutil, subprocess, sys, tempfile

REPO = "/workspace"
PKG_GH = "./internal/platform/github/"
PKG_STORE = "./internal/store/"
ART = "/scion-volumes/scratchpad/projects/farmtable/em-tooling/combine-r7-artifacts"
PRISTINE = tempfile.mkdtemp(prefix="r7-pristine-")

def die(msg, code=99):
    print(f"\n!!!!! ABORT: {msg}")
    sys.exit(code)

def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()

# ---------------------------------------------------------------- files we touch
TOUCHED = [
    "internal/platform/github/terminal_label_stages.go",
    "internal/platform/github/passthrough.go",
    "internal/platform/github/labels.go",
    "internal/store/store.go",
    "internal/store/multistore.go",
]
PRIS = {}
for rel in TOUCHED:
    src = os.path.join(REPO, rel)
    if not os.path.isfile(src):
        die(f"expected file missing: {rel}")
    dst = os.path.join(PRISTINE, rel.replace("/", "__"))
    shutil.copy2(src, dst)
    PRIS[rel] = (dst, sha(src))
print(f"pristine snapshot of {len(PRIS)} files in {PRISTINE}")
for rel, (_, h) in PRIS.items():
    print(f"  {h[:12]}  {rel}")

def restore_all():
    """Restore every touched file and VERIFY by re-reading, not by trusting the write."""
    for rel, (dst, want) in PRIS.items():
        src = os.path.join(REPO, rel)
        shutil.copy2(dst, src)
        got = sha(src)
        if got != want:
            die(f"REVERT VERIFICATION FAILED for {rel}: {got} != {want}")
    # belt and braces: git must agree the tracked tree is clean
    r = subprocess.run(["git", "-C", REPO, "status", "--porcelain"],
                       capture_output=True, text=True)
    if r.stdout.strip():
        die(f"revert left the tree dirty:\n{r.stdout}")

def apply_anchor(rel, anchor, replacement):
    """Content-addressed edit. Aborts unless the anchor occurs EXACTLY once."""
    path = os.path.join(REPO, rel)
    with open(path) as f:
        text = f.read()
    n = text.count(anchor)
    if n != 1:
        die(f"anchor in {rel} occurs {n} times, need exactly 1.\n---ANCHOR---\n{anchor}\n---")
    new = text.replace(anchor, replacement, 1)
    if new == text:
        die(f"replacement was a no-op in {rel}")
    with open(path, "w") as f:
        f.write(new)
    # verify the write landed by re-reading
    with open(path) as f:
        back = f.read()
    if back != new:
        die(f"write to {rel} did not land")
    print(f"  mutated {rel} (anchor unique, verified)")

def compiles(pkg):
    r = subprocess.run(["go", "vet", "-tests=true", pkg], cwd=REPO,
                       capture_output=True, text=True)
    # vet reports the pre-existing copylocks stuff only in internal/server; for
    # our two packages any output containing a build error means it won't compile.
    blob = r.stdout + r.stderr
    broken = ("syntax error" in blob or "undefined:" in blob or
              "cannot use" in blob or "declared and not used" in blob or
              "too many return values" in blob or "not enough return values" in blob or
              "missing return" in blob)
    return (not broken), blob

def run_pkg(pkg, run_filter=None):
    """Run a package verbosely. Returns (exit_code, top_level_fails, top_level_total)."""
    cmd = ["go", "test", "-count=1", "-v"]
    if run_filter:
        cmd += ["-run", run_filter]
    cmd += [pkg]
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    out = r.stdout + r.stderr
    # top-level lines are unindented; subtests are indented under them
    fails = sorted(set(re.findall(r"(?m)^--- FAIL: (\S+)", out)))
    passes = sorted(set(re.findall(r"(?m)^--- PASS: (\S+)", out)))
    skips = sorted(set(re.findall(r"(?m)^--- SKIP: (\S+)", out)))
    total = sorted(set(fails + passes + skips))
    return r.returncode, fails, total, out

# ---------------------------------------------------------------- baseline
print("\n===== BASELINE (must be GREEN) =====")
restore_all()
results = {}
for pkg in (PKG_GH, PKG_STORE):
    code, fails, total, out = run_pkg(pkg)
    print(f"  {pkg}: exit={code} top_level_total={len(total)} fails={len(fails)}")
    if len(total) == 0:
        die(f"baseline for {pkg} parsed 0 top-level tests — VOID RUN")
    if code != 0 or fails:
        die(f"baseline for {pkg} is not GREEN: exit={code} fails={fails}")
    results[f"baseline::{pkg}"] = {"exit": code, "total": len(total), "fails": fails}
BASE_GH_TOTAL = results[f"baseline::{PKG_GH}"]["total"]
print(f"  baseline OK. internal/platform/github top-level tests = {BASE_GH_TOTAL}")

# ---------------------------------------------------------------- mutations
GH_TLS = "internal/platform/github/terminal_label_stages.go"
GH_PT = "internal/platform/github/passthrough.go"
GH_LB = "internal/platform/github/labels.go"
ST = "internal/store/store.go"
MS = "internal/store/multistore.go"

MUTATIONS = [
    # ---- POSITIVE CONTROL: the harness must be able to report RED at all.
    dict(name="PC (positive control)", kind="control", pkg=PKG_GH,
         probe="TestStageLabelSwap_DoesNotDeleteLabelsFarmTableDoesNotOwn",
         file=GH_LB,
         anchor="func (m *LabelMapper) StageLabelSwap(currentLabels []string, newStage task.Stage) (add []string, remove []string) {",
         replace="func (m *LabelMapper) StageLabelSwap(currentLabels []string, newStage task.Stage) (add []string, remove []string) {\n\treturn nil, nil // MUTANT-PC\n",
         expect="RED"),

    # ---- M8: the headline re-measurement
    dict(name="M8", kind="blast", pkg=PKG_GH,
         probe="TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader",
         file=GH_TLS,
         anchor="func (m *LabelMapper) authorizationStage(raw string) (task.Stage, bool) {",
         replace="func (m *LabelMapper) authorizationStage(raw string) (task.Stage, bool) {\n\treturn \"\", false // MUTANT-M8\n",
         expect="RED"),

    # ---- MS1: guard deleted from GitHubPassThroughStore.LifecycleStages
    dict(name="MS1", kind="probe", pkg=PKG_GH,
         probe="TestLifecycleStageSetStager_EmptySideIsDetectable",
         file=GH_PT,
         anchor="""func (s *GitHubPassThroughStore) LifecycleStages(ctx context.Context, t *ent.Task) []task.Stage {
	if stages := s.mapper.AllTerminalLabelStages(t.Labels); len(stages) > 0 {
		return stages
	}
	return []task.Stage{t.Stage}
}""",
         replace="""func (s *GitHubPassThroughStore) LifecycleStages(ctx context.Context, t *ent.Task) []task.Stage {
	return s.mapper.AllTerminalLabelStages(t.Labels) // MUTANT-MS1
}""",
         expect="RED"),

    # ---- MA1: AllTerminalLabelStages invents a stage instead of returning nil
    dict(name="MA1", kind="probe", pkg=PKG_GH,
         probe="TestLifecycleStageSetStager_EmptySideIsDetectable",
         file=GH_TLS,
         anchor="""	if len(present) == 0 {
		return nil
	}""",
         replace="""	if len(present) == 0 {
		return []task.Stage{task.StageCompleted} // MUTANT-MA1
	}""",
         expect="RED"),

    # ---- MCA: store.LabelDeltaLifecycleStages non-implementer arm
    dict(name="MCA", kind="probe", pkg=PKG_STORE,
         probe="TestLifecycleStageHelpers_NonImplementerIsAnsweredNotRejected",
         file=ST,
         anchor="""	stager, ok := s.(LifecycleStageSetStager)
	if !ok {
		current := []task.Stage{LifecycleStage(ctx, s, t)}
		return current, current, nil
	}""",
         replace="""	stager, ok := s.(LifecycleStageSetStager)
	if !ok {
		mutant := []task.Stage{task.StageCancelled} // MUTANT-MCA
		return mutant, mutant, nil
	}""",
         expect="RED"),

    # ---- MCB: MultiStore.LabelDeltaLifecycleStages unrouted arm
    dict(name="MCB", kind="probe", pkg=PKG_STORE,
         probe="TestMultiStore_UnroutedCollectionStillGetsTheOneElementAnswer",
         file=MS,
         anchor="""func (m *MultiStore) LabelDeltaLifecycleStages(ctx context.Context, t *ent.Task, addLabels, removeLabels []string) (before, after []task.Stage) {
	stager, ok := m.storeForCtx(ctx, t.CollectionID).(LifecycleStageSetStager)
	if !ok {
		current := []task.Stage{m.LifecycleStage(ctx, t)}
		return current, current
	}""",
         replace="""func (m *MultiStore) LabelDeltaLifecycleStages(ctx context.Context, t *ent.Task, addLabels, removeLabels []string) (before, after []task.Stage) {
	stager, ok := m.storeForCtx(ctx, t.CollectionID).(LifecycleStageSetStager)
	if !ok {
		mutant := []task.Stage{task.StageCancelled} // MUTANT-MCB
		return mutant, mutant
	}""",
         expect="RED"),
]

report = {"baseline_gh_total": BASE_GH_TOTAL, "mutations": []}

for mu in MUTATIONS:
    print(f"\n===== {mu['name']} =====")
    restore_all()
    apply_anchor(mu["file"], mu["anchor"], mu["replace"])

    ok, blob = compiles(mu["pkg"])
    if not ok:
        print(blob[:2000])
        restore_all()
        die(f"{mu['name']} does not COMPILE — aborting rather than scoring it RED")
    print("  compiles OK")

    # targeted probe
    pcode, pfails, ptotal, pout = run_pkg(mu["pkg"], run_filter=f"^{mu['probe']}$")
    if len(ptotal) == 0:
        restore_all()
        die(f"{mu['name']} probe matched 0 tests — VOID RUN (bad -run filter?)")
    probe_state = "RED" if pcode != 0 else "GREEN"
    print(f"  probe {mu['probe']}: {probe_state} exit={pcode}")

    entry = dict(name=mu["name"], probe=mu["probe"], probe_exit=pcode,
                 probe_state=probe_state, expect=mu["expect"])

    # whole-package blast radius
    wcode, wfails, wtotal, wout = run_pkg(mu["pkg"])
    if len(wtotal) == 0:
        restore_all()
        die(f"{mu['name']} package run parsed 0 top-level tests — VOID RUN")
    print(f"  package {mu['pkg']}: exit={wcode} top_level_fails={len(wfails)} of {len(wtotal)}")
    entry.update(pkg=mu["pkg"], pkg_exit=wcode, blast=len(wfails),
                 pkg_total=len(wtotal), failing=wfails)
    with open(f"{ART}/{mu['name'].split()[0]}.pkg.out", "w") as f:
        f.write(wout)

    report["mutations"].append(entry)
    restore_all()
    print("  reverted and verified")

# ---------------------------------------------------------------- final state
print("\n===== FINAL STATE =====")
restore_all()
for pkg in (PKG_GH, PKG_STORE):
    code, fails, total, _ = run_pkg(pkg)
    print(f"  {pkg}: exit={code} fails={len(fails)}")
    if code != 0:
        die(f"tree not restored to GREEN for {pkg}")
r = subprocess.run(["grep", "-rn", "MUTANT", "--include=*.go", "."], cwd=REPO,
                   capture_output=True, text=True)
print(f"  MUTANT markers remaining: {len(r.stdout.strip().splitlines()) if r.stdout.strip() else 0}")
if r.stdout.strip():
    die(f"MUTANT marker left in tree:\n{r.stdout}")

with open(f"{ART}/mutation-results.json", "w") as f:
    json.dump(report, f, indent=2)
print(f"\nwrote {ART}/mutation-results.json")
print("ALL MUTATIONS COMPLETE, TREE RESTORED AND GREEN")
