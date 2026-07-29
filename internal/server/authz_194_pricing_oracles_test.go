package server_test

import (
	"go/ast"
	"go/parser"
	"go/token"
	"sort"
	"strings"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// ─────────────────────────────────────────────────────────────────────────────
// #194 PRICING ORACLES — three defects in the label-write pricing path.
//
// THESE TESTS ARE ORACLES, NOT FIXES. Every one of them is RED against
// 2cbbd92 (refs/preserve/194-r11/branch) and is meant to stay red until a
// remedy lands. They deliberately do NOT assert what the price SHOULD be —
// that ruling belongs to the architect. They assert only the two properties a
// remedy of ANY price must satisfy:
//
//	D1/D2  a caller holding ONLY task:write must not be able to remove a
//	       lifecycle stage from a task. Whether the removal then costs
//	       task:accept, task:close or something new is not decided here.
//	D3     a label that is not a lifecycle statement must not be refused.
//
// Asserting "denied" rather than "denied naming task:close" is what makes
// these oracles survive the pricing ruling instead of having to be rewritten
// by it.
// ─────────────────────────────────────────────────────────────────────────────

// ── THE GATE SITES ──────────────────────────────────────────────────────────
//
// There are THREE label-write pricing sites in internal/server/server.go, not
// one. An oracle written against a single site goes red, gets fixed, and then
// stays green while the other two still carry the bypass — which is the error
// the round-9 brief made and which both review legs named as its most material
// defect.
//
// Sites are addressed by the RPC that OWNS them, never by line number, so that
// this table survives every edit above it.
//
// ROUND 12 MADE THE POPULATION HETEROGENEOUS, AND THE CENSUS IS ADDITIVE ABOUT
// IT. UpdateTask now prices through store.PriceLabelWrite; CreateTask and
// InsertTasksAfter still route through store.SameStageSet and were deliberately
// left alone, because neither can be driven with a removal (see the verdicts
// below). A census that swapped SameStageSet for PriceLabelWrite would have
// quietly dropped those two sites out of the population and reported THREE
// where it was counting ONE. The detector therefore recognises BOTH gate
// functions and additionally pins WHICH one each RPC routes through: migrating
// a site is then a row somebody has to edit, not a count that silently holds.
type pricingGateSite struct {
	// rpc is the enclosing method identifier, and is the join key against the
	// AST census in TestPricingGateSiteCensus below.
	rpc string

	// gate is the store-package function this RPC prices through. Pinned so
	// that moving a site between gate shapes is a visible decision.
	gate string

	// removalReachable records whether a caller can drive this site with a
	// label REMOVAL. Only UpdateTask accepts remove_labels; the two creating
	// RPCs build their endpoints from a task that does not exist yet, so the
	// BEFORE set cannot lose an element there.
	//
	// A false here is a VERDICT, not an exemption. TestPricingGateSiteCensus
	// asserts the site still exists, and the reachability arm below asserts the
	// RPC still refuses to take remove_labels. The day either changes, the row
	// fails and the exploit has to be re-derived for that site rather than
	// silently acquiring it.
	removalReachable bool

	// why documents the reachability verdict.
	why string
}

func pricingGateSites() []pricingGateSite {
	return []pricingGateSite{
		{
			rpc:              "CreateTask",
			gate:             "SameStageSet",
			removalReachable: false,
			why: "CreateTask prices req.GetLabels() as ADDITIONS against a synthetic " +
				"&ent.Task{Stage: stage} carrying no labels. BEFORE is therefore " +
				"always the creation stage alone and cannot lose an element. The " +
				"masking exploit needs a stage present in BEFORE and absent from " +
				"the base AFTER, so it has no purchase here.",
		},
		{
			rpc:              "InsertTasksAfter",
			gate:             "SameStageSet",
			removalReachable: false,
			why: "InsertTasksAfter creates every step in triage from a NewTaskSpec " +
				"that has no remove_labels field and no stage field. BEFORE is " +
				"[triage] by construction. This site does not price at all — it " +
				"REJECTS — which is its own defect; see D3.",
		},
		{
			rpc:              "UpdateTask",
			gate:             "PriceLabelWrite",
			removalReachable: true,
			why: "UpdateTask is the only RPC that accepts remove_labels and the only " +
				"one whose BEFORE endpoint is read from a task that already carries " +
				"labels. This is where D1 was live, and it is the ONLY site round 12 " +
				"repriced — precisely because it is the only one a removal can reach.",
		},
	}
}

// TestPricingGateSiteCensus pins the POPULATION of gate sites.
//
// The census is computed from the AST rather than from a grep so that it counts
// call sites in the file being tested and cannot be inflated by another copy of
// the repository on disk. A grep from the workspace root matches five checkouts
// under .claude/worktrees/ and quintuples every count; a parse of "server.go"
// relative to this test's own directory has a denominator of exactly one file.
//
// WHEN THIS TEST FAILS BECAUSE A FOURTH SITE APPEARED, ADD A ROW TO
// pricingGateSites AND WORK OUT ITS REACHABILITY VERDICT. Do not raise a
// number. The point of the census is that a new gate site is a decision
// somebody has to make, not a constant somebody has to bump.
//
// THE RECOGNISED SET IS ADDITIVE AND MUST STAY THAT WAY. When round 12 moved
// UpdateTask from SameStageSet to PriceLabelWrite, the tempting edit was to
// swap the name the AST walk matches. That edit would have left this test GREEN
// while counting ONE site and believing it had counted three: CreateTask and
// InsertTasksAfter would have vanished from the population, taking their
// reachability verdicts with them, and the census would have gone on reporting
// success about a question it was no longer asking. Recognise BOTH. Adding a
// gate shape is an append to pricingGateFuncs; it is never a substitution.
func pricingGateFuncs() map[string]bool {
	return map[string]bool{
		// The pre-round-12 equality gate. Still live at CreateTask and
		// InsertTasksAfter, neither of which a removal can reach.
		"SameStageSet": true,
		// The round-12 directional gate: departures and entries priced as two
		// independent set differences. Live at UpdateTask.
		"PriceLabelWrite": true,
	}
}

func TestPricingGateSiteCensus(t *testing.T) {
	const src = "server.go"

	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, src, nil, 0)
	if err != nil {
		t.Fatalf("parsing %s: %v", src, err)
	}

	gates := pricingGateFuncs()

	found := map[string]int{}
	gateOf := map[string][]string{}
	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok {
			continue
		}
		ast.Inspect(fn, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}
			sel, ok := call.Fun.(*ast.SelectorExpr)
			if !ok || !gates[sel.Sel.Name] {
				return true
			}
			pkg, ok := sel.X.(*ast.Ident)
			if !ok || pkg.Name != "store" {
				return true
			}
			found[fn.Name.Name]++
			gateOf[fn.Name.Name] = append(gateOf[fn.Name.Name], sel.Sel.Name)
			return true
		})
	}

	total := 0
	gotRPCs := make([]string, 0, len(found))
	for rpc, n := range found {
		total += n
		gotRPCs = append(gotRPCs, rpc)
	}
	sort.Strings(gotRPCs)

	wantRPCs := make([]string, 0, len(pricingGateSites()))
	wantGate := map[string]string{}
	for _, s := range pricingGateSites() {
		wantRPCs = append(wantRPCs, s.rpc)
		wantGate[s.rpc] = s.gate
	}
	sort.Strings(wantRPCs)

	if strings.Join(gotRPCs, ",") != strings.Join(wantRPCs, ",") {
		t.Fatalf("label-write pricing sites in %s are owned by %v, but the "+
			"pricingGateSites table declares %v (total call sites: %d, gate "+
			"functions recognised: %v).\n"+
			"A gate site that is not in the table is a gate nobody wrote an oracle "+
			"for. Add the row and decide its reachability verdict.\n"+
			"If instead a site DISAPPEARED, check it did not simply move to a gate "+
			"function this census does not recognise — that is the failure mode "+
			"this list is additive to prevent.",
			src, gotRPCs, wantRPCs, total, sortedKeys(gates))
	}
	if total != len(wantRPCs) {
		t.Fatalf("%d pricing calls spread over %d RPCs %v: some RPC carries the "+
			"guard more than once, so a per-RPC row no longer describes a single "+
			"gate. Split the table.", total, len(gotRPCs), gotRPCs)
	}

	// WHICH gate, not merely THAT there is one. A site silently migrating
	// between gate shapes changes its security properties — PriceLabelWrite
	// charges departures, SameStageSet does not — so the routing is pinned.
	for rpc, got := range gateOf {
		if len(got) == 1 && got[0] == wantGate[rpc] {
			continue
		}
		t.Errorf("%s prices through %v, but the table declares %q.\n"+
			"Moving an RPC between gate shapes changes what it charges: "+
			"PriceLabelWrite charges a DEPARTURE from a lifecycle stage, "+
			"SameStageSet does not charge one at all. Update the row and state "+
			"the reachability verdict that justifies the new shape.",
			rpc, got, wantGate[rpc])
	}
}

func sortedKeys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFECT 1 — REVIEW-194-R11-C1 (Critical)
//
// SECURITY PROPERTY: A CALLER HOLDING ONLY task:write MUST NOT BE ABLE TO
// REMOVE A LIFECYCLE STAGE FROM A TASK.
//
// The docblock on LabelDeltaLifecycleStages argues a monotonicity theorem and
// concludes "Nothing here can be cheaper than what shipped." The theorem is
// TRUE and the conclusion does not follow, because what shipped charged
// nothing here either. The theorem quantifies over the INNER cross-product
// loop; the defect is in the OUTER if.
//
//	if !store.SameStageSet(before, after) {   // <- equality short-circuit
//	    for _, from := range before { for _, to := range after { ... } }
//	}
//
// Growing AFTER grows the cross product. It does NOT preserve the guard,
// because SameStageSet is an EQUALITY test and equality is not monotone. The
// union that makes the price a superset can push AFTER back up to EXACTLY
// BEFORE — the one value that costs nothing.
//
// THE VECTOR, MEASURED, ON STOCK DEFAULTS (push_prefix "ft:", labels enabled;
// no config trickery, which is the uncomfortable part):
//
//	issue labels  [ft:stage/completed, ft:stage/wont_fix]
//	edit          remove ft:stage/wont_fix, add stage/wont_fix
//
//	BEFORE      [completed wont_fix]   read view over the raw labels
//	base AFTER  [completed]            <- the deployment REALLY loses wont_fix
//	union AFTER [completed wont_fix]   <- claim arm canonicalises the addition
//	                                      "stage/wont_fix" -> "ft:stage/wont_fix"
//	                                      and restores the element
//	price       FREE
//
// The added label is markerless, so THIS deployment does not honour it: the
// task's authoritative stage set really does lose wont_fix. The claim arm
// recognises it anyway, AFTER lands back on BEFORE, SameStageSet is true, and
// the whole gate is skipped.
// ─────────────────────────────────────────────────────────────────────────────

// maskedRemoval is the D1 edit: strip the authoritative spelling of a stage and
// replace it with a spelling only the WRITE view recognises.
func maskedRemoval(s task.Stage) (add, remove []string) {
	return []string{"stage/" + s.String()}, []string{stageLabel(s)}
}

func TestPricingGate_UnprivilegedCallerCannotRemoveALifecycleStage(t *testing.T) {
	for _, site := range pricingGateSites() {
		t.Run(site.rpc, func(t *testing.T) {
			if !site.removalReachable {
				t.Logf("VERDICT: removal is not reachable at %s. %s", site.rpc, site.why)
				assertRemovalUnreachable(t, site)
				return
			}

			const kept = task.StageCompleted
			const removed = task.StageWontFix

			f := openIssue(t, stageLabel(kept), stageLabel(removed))

			// PREMISE: both stages are really present before the edit. Without
			// this the test could pass for the boring reason that wont_fix was
			// never in the set, which would make it vacuous.
			if got := f.lifecycleStages(t); len(got) != 2 {
				t.Fatalf("PREMISE FAILED: labels resolve to %v, want both %v and %v. "+
					"The exploit needs a stage to remove.", got, kept, removed)
			}

			add, remove := maskedRemoval(removed)
			err := f.swapLabels(agentScopes(), add, remove)

			// IMPACT FIRST, so a denial that happens for the wrong reason cannot
			// be mistaken for the control working.
			after := f.lifecycleStages(t)
			stillThere := false
			for _, s := range after {
				if s == removed {
					stillThere = true
				}
			}

			if err == nil {
				t.Errorf("SECURITY PROPERTY VIOLATED — an unprivileged caller removed a "+
					"lifecycle stage for free.\n"+
					"  gate site:   %s\n"+
					"  scopes held: %v  (task:accept and task:close deliberately absent)\n"+
					"  edit:        remove %v, add %v\n"+
					"  stage set:   %v -> %v   (wont_fix present after? %v)\n"+
					"\n"+
					"The masked-removal vector pushed the union AFTER back onto BEFORE, "+
					"SameStageSet reported no transition, and the outer if skipped the "+
					"whole cross-product charge. The monotonicity theorem on "+
					"LabelDeltaLifecycleStages quantifies over the inner loop and does "+
					"not constrain this.\n"+
					"\n"+
					"THIS ORACLE DOES NOT SAY WHAT THE PRICE SHOULD BE. It says a bare "+
					"task:write holder must not complete this write.",
					site.rpc, agentScopes(), remove, add,
					[]task.Stage{kept, removed}, after, stillThere)

				if !stillThere {
					t.Logf("IMPACT CONFIRMED: %v is gone from the authoritative stage "+
						"set. This is a real privilege change, not a no-op that "+
						"returned success.", removed)
				}
				return
			}

			st, _ := status.FromError(err)
			if st.Code() != codes.PermissionDenied {
				t.Fatalf("the edit failed with %v (%s), which is not an authorization "+
					"answer. This oracle measures pricing; a transport or validation "+
					"failure here means the fixture is wrong, not that the gate held.",
					st.Code(), st.Message())
			}
		})
	}
}

// assertRemovalUnreachable is the executable half of a "not reachable" verdict.
// It pins the structural reason, so the row fails if the reason stops holding.
func assertRemovalUnreachable(t *testing.T, site pricingGateSite) {
	t.Helper()

	switch site.rpc {
	case "CreateTask":
		// CreateTaskRequest has no remove_labels field. If one is ever added,
		// this site inherits D1 and needs a real arm.
		var req pb.CreateTaskRequest
		if hasRemoveLabels(&req) {
			t.Fatalf("CreateTaskRequest now carries remove_labels: the D1 masking "+
				"vector may be reachable at %s. Flip removalReachable and write "+
				"the arm.", site.rpc)
		}
	case "InsertTasksAfter":
		var spec pb.NewTaskSpec
		if hasRemoveLabels(&spec) {
			t.Fatalf("NewTaskSpec now carries remove_labels: the D1 masking vector "+
				"may be reachable at %s. Flip removalReachable and write the arm.",
				site.rpc)
		}
	default:
		t.Fatalf("no reachability proof for gate site %s", site.rpc)
	}
}

// hasRemoveLabels reports whether a proto message declares a remove_labels
// field, via reflection over its descriptor rather than a compile-time
// reference, so this file keeps compiling if the field never appears.
func hasRemoveLabels(m proto.Message) bool {
	fields := m.ProtoReflect().Descriptor().Fields()
	for i := 0; i < fields.Len(); i++ {
		if string(fields.Get(i).Name()) == "remove_labels" {
			return true
		}
	}
	return false
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFECT 2 — store.SameStageSet IS ORDER-SENSITIVE DESPITE ITS NAME
// (merge-blocking)
//
// A function named SameStageSet that is sensitive to ORDER is not a set
// comparison. Its docblock licenses the elementwise loop with "Both are
// produced in a deterministic order by the same function" — but on the write
// path they are NOT. BEFORE comes from AllTerminalLabelStages, which emits a
// canonical order. AFTER comes from unionStages, which preserves the order of
// its first argument and APPENDS anything only the second names.
//
// So the position of a restored element in AFTER depends on which stage was
// removed, and the caller chooses that. MEASURED, stock defaults, issue
// carrying [ft:stage/completed, ft:stage/wont_fix], BEFORE = [completed
// wont_fix] in both rows:
//
//	mask wont_fix (canonically LAST)   AFTER [completed wont_fix]  same  FREE
//	mask completed (canonically FIRST) AFTER [wont_fix completed]  differ task:close
//
// TWO WRITES OF IDENTICAL SHAPE AND IDENTICAL SET SEMANTICS, OPPOSITE
// AUTHORIZATION OUTCOMES, DECIDED PURELY BY CANONICAL STAGE POSITION.
//
// BLAST RADIUS IS THREE GATES, NOT ONE. All three sites in pricingGateSites
// consume the same SameStageSet, so any upstream reordering — the stage
// declaration order, the union's append position, a sort added to a mapper —
// is an UNDECLARED AUTHORIZATION CHANGE at every one of them.
//
// CAN A REAL CALLER CONTROL THE ORDER? YES, but only by choosing WHICH stage to
// mask, which still requires a removal. The bypass direction therefore has no
// second trigger that avoids removing a stage: a pure addition can only grow
// AFTER, and a grown AFTER is never equal to BEFORE. What the order does give
// the caller is the CHOICE of which removals are free, and it gives any
// upstream refactor the power to flip that choice silently.
// ─────────────────────────────────────────────────────────────────────────────

func TestSameStageSet_IsOrderSensitiveDespiteItsName(t *testing.T) {
	a := []task.Stage{task.StageCompleted, task.StageWontFix}
	b := []task.Stage{task.StageWontFix, task.StageCompleted}

	if !store.SameStageSet(a, b) {
		t.Errorf("store.SameStageSet(%v, %v) = false.\n"+
			"\n"+
			"These name the SAME SET. A function called SameStageSet that answers "+
			"false for a permutation is an elementwise comparison wearing a set "+
			"comparison's name, and it is consumed at %d authorization gate sites "+
			"in internal/server/server.go.\n"+
			"\n"+
			"CONSEQUENCE: any ordering change anywhere upstream is an UNDECLARED "+
			"AUTHORIZATION CHANGE. The docblock licenses the elementwise loop on "+
			"the grounds that both sides are 'produced in a deterministic order by "+
			"the same function'. On the write path they are not: BEFORE comes from "+
			"AllTerminalLabelStages and AFTER comes from unionStages, which appends.",
			a, b, len(pricingGateSites()))
	}
}

// TestPricingGate_AuthorizationDoesNotDependOnCanonicalStageOrder is the
// consequence of the above, measured through the real gate rather than argued.
//
// Both rows are the same edit: mask one of two terminal labels behind a
// markerless spelling this deployment does not honour. Both remove exactly one
// stage from the authoritative set. They must be priced alike.
func TestPricingGate_AuthorizationDoesNotDependOnCanonicalStageOrder(t *testing.T) {
	both := []string{stageLabel(task.StageCompleted), stageLabel(task.StageWontFix)}

	outcome := func(t *testing.T, masked task.Stage) error {
		t.Helper()
		f := openIssue(t, both...)
		if got := f.lifecycleStages(t); len(got) != 2 {
			t.Fatalf("PREMISE FAILED: %v resolves to %v, want two stages", both, got)
		}
		add, remove := maskedRemoval(masked)
		return f.swapLabels(agentScopes(), add, remove)
	}

	// wont_fix sorts AFTER completed in the canonical order, so the union's
	// append lands it back in the position BEFORE already had it in.
	last := outcome(t, task.StageWontFix)
	// completed sorts FIRST, so the union appends it behind wont_fix and the
	// two orderings disagree even though the sets do not.
	first := outcome(t, task.StageCompleted)

	describe := func(err error) string {
		if err == nil {
			return "ALLOWED (free)"
		}
		st, _ := status.FromError(err)
		return st.Code().String() + ": " + st.Message()
	}

	if (last == nil) != (first == nil) {
		t.Errorf("THE AUTHORIZATION OUTCOME IS DECIDED BY CANONICAL STAGE ORDER.\n"+
			"\n"+
			"  mask %-9s (canonically LAST)  -> %s\n"+
			"  mask %-9s (canonically FIRST) -> %s\n"+
			"\n"+
			"Same edit shape, same scopes, same number of stages removed, and the "+
			"only difference is where unionStages appended the restored element. "+
			"store.SameStageSet compares elementwise, so a permutation reads as a "+
			"transition and an identical order reads as a no-op.\n"+
			"\n"+
			"This flips the guard at all %d gate sites in pricingGateSites, so the "+
			"blast radius of any upstream reordering is three gates, not one.",
			task.StageWontFix, describe(last),
			task.StageCompleted, describe(first),
			len(pricingGateSites()))
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFECT 3 — LIVE OVER-DENIAL AT InsertTasksAfter (merge-blocking)
//
// The opposite sign from D1 and D2: this one refuses a LEGITIMATE operation.
//
// The InsertTasksAfter site does not price, it REJECTS, and it decides what to
// reject with LabelDeltaLifecycleStages — whose AFTER arm is the WIDE claim
// view. The claim view canonicalises the caller's additions, so a bare
// "duplicate" becomes "ft:stage/duplicate" and reads as a lifecycle statement.
//
// "duplicate", "wontfix" and "invalid" ARE SHIPPED BY GITHUB ON EVERY NEW
// REPOSITORY. They are the stock default label set. So this control refuses to
// create a step carrying one of the most ordinary labels in the ecosystem, and
// the error text tells the user to "Create the task and move it with
// UpdateTask" — advice that does not apply, because the label was never a
// lifecycle statement in this deployment to begin with.
//
// The existing pin TestInsertTasksAfter_RejectsLifecycleStageLabels has an
// "ordinary_label_reaches_the_store" arm, but its ordinary label is "bug",
// which the claim view does not recognise. One sample, and it missed the class.
//
// LIVE ON faf1c8c (main)? NO — see the report. Neither this control nor
// LabelDeltaLifecycleStages, SameStageSet, RestrictLabelWriteToSnapshot or
// assertStageWriteAllowed exists on main; label writes are entirely ungated
// there. D3 is introduced by the r11 diff and dies with it.
// ─────────────────────────────────────────────────────────────────────────────

func TestInsertTasksAfter_DoesNotOverDenyStockGitHubLabels(t *testing.T) {
	// GitHub creates these on every new repository. None of them is a
	// lifecycle statement under a deployment configured with push_prefix "ft:".
	stock := []string{"duplicate", "wontfix", "invalid", "bug", "enhancement",
		"question", "documentation", "good first issue", "help wanted"}

	for _, label := range stock {
		t.Run(label, func(t *testing.T) {
			f := openIssue(t)

			_, err := f.svc.InsertTasksAfter(scopedCtx(agentScopes()), &pb.InsertTasksAfterRequest{
				AnchorTaskId: f.taskID,
				CollectionId: f.collID.String(),
				Steps:        []*pb.NewTaskSpec{{Name: "a follow-up step", Labels: []string{label}}},
			})

			st, _ := status.FromError(err)
			if st.Code() == codes.InvalidArgument {
				t.Errorf("OVER-DENIAL — a legitimate operation was refused.\n"+
					"  label:  %q  (a GitHub stock default label)\n"+
					"  answer: InvalidArgument: %s\n"+
					"\n"+
					"This label names no lifecycle stage under push_prefix \"ft:\". The "+
					"rejection comes from LabelDeltaLifecycleStages' claim arm, which "+
					"canonicalises the caller's additions and so reads a bare "+
					"%q as \"ft:stage/%s\".\n"+
					"\n"+
					"A gate that locks out real users is not a fix. The remedy is the "+
					"architect's call; this oracle only pins that the operation is "+
					"legitimate and is currently refused.",
					label, st.Message(), label, label)
				return
			}

			// Unimplemented is the CORRECT answer today: it means the request got
			// past this control and reached the pass-through store, which does not
			// implement InsertTasksAfter. That is the differential which proves the
			// InvalidArgument rows above are a specific refusal, not a blanket one.
			if st.Code() != codes.Unimplemented {
				t.Fatalf("got %v (%s), want Unimplemented (past the control, refused by "+
					"the store). Any other code means this row is measuring something "+
					"other than the lifecycle-label control.", st.Code(), st.Message())
			}
		})
	}
}
