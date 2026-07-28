package github

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store/ent"
)

// ── #194 round 8: the two executable pins for RestrictLabelWriteToSnapshot ──
//
// The contract this file pins used to be prose. store.go said "It must only
// ever narrow" and passthrough.go said the restrictor "is exactly the
// complement of applyLabelDelta ... The two must agree". Both sentences were
// FALSE at 1d4442f, and the thing that made them false — C-1, a cross-list
// authorization bypass — shipped with a fully green suite and survived a
// dedicated security audit that enumerated nineteen label spellings.
//
// WHY PROSE FAILED, AND WHY IT TAKES TWO PROPERTIES.
//
// The audit's own diagnosis is the reason this file is shaped the way it is:
// it built a verification oracle that REIMPLEMENTED applyLabelDelta by hand,
// which is the identical mistake the production code made. A per-label,
// per-list oracle is structurally incapable of seeing a defect that lives in
// the INTERACTION between the two lists, however many spellings it enumerates.
// So P1 below does not model the gate. Its oracle IS applyLabelDelta, the real
// function the real gate calls.
//
//	P1 (agreement)   applyLabelDelta(snap, Restrict(snap, add, remove))
//	                   ==  applyLabelDelta(snap, add, remove)
//	                 The write must land exactly the label set the gate priced.
//	                 Catches over-narrowing and MIS-narrowing.
//
//	P2 (minimality)  No entry the restrictor RETURNS may be a no-op against the
//	                 snapshot. Catches UNDER-narrowing.
//
// NEITHER IS SUFFICIENT ALONE, and the reason is structural rather than a
// matter of missing test inputs. P1 quantifies over outcomes AGAINST THE
// SNAPSHOT ONLY. A narrowing failure that is a no-op against the snapshot but
// not against drifted remote state is invisible to it — and that is exactly the
// A-4 class this control was written for. Measured: the pre-A-4 implementation
// (both lists passed through verbatim, i.e. Restrict = identity) satisfies P1
// on every A-4 input. No additional case closes that hole, because the
// quantifier itself is snapshot-relative. P2 is what sees it: identity returns
// a removal of a label the snapshot never carried, which is a no-op against the
// snapshot and therefore something the gate charged nothing for.
//
// Symmetrically, P2 alone would accept a restrictor that returned nothing at
// all. P1 is what forbids that.
//
// MEASURED, both properties against three implementations (see the r8 report
// for the raw output):
//
//	input                 pre-fix HEAD   identity (pre-A-4)   fixed
//	C-1 cross-list        P1 FAIL        P1 ok / P2 FAIL      ok
//	C-1 case-split        P1 FAIL        P1 ok / P2 FAIL      ok
//	C-1 pad-split         P1 FAIL        P1 ok / P2 FAIL      ok
//	A-4 remove-absent     ok             P2 FAIL              ok
//	A-4 re-add-present    ok             P2 FAIL              ok
//	legitimate edit       ok             ok                   ok
//
// DO NOT delete either property because "the other one covers it".

// restrictProperties reports which of P1 and P2 the restrictor violates for one
// (snapshot, add, remove) triple. It returns a human-readable reason per
// violated property, or "" when the property holds.
//
// The oracle for P1 is applyLabelDelta ITSELF, never a reimplementation of it.
// That is the whole methodological point of this file: the contract under test
// is "agrees with applyLabelDelta", so any hand-rolled model of applyLabelDelta
// here would be free to drift in the same direction the production code drifted
// and would report agreement anyway. If applyLabelDelta is ever wrong, P1 goes
// on holding and that is correct — P1 pins the SEAM, not the pricing rule.
func restrictProperties(s *GitHubPassThroughStore, snapshot, addLabels, removeLabels []string) (p1Fail, p2Fail string) {
	tk := &ent.Task{Labels: snapshot}
	gotAdd, gotRemove := s.RestrictLabelWriteToSnapshot(context.Background(), tk, addLabels, removeLabels)

	// ── P1: agreement with the gate's own prediction function ──
	want := applyLabelDelta(snapshot, addLabels, removeLabels)
	got := applyLabelDelta(snapshot, gotAdd, gotRemove)
	if !sameLabelSet(want, got) {
		p1Fail = fmt.Sprintf(
			"P1 VIOLATED (the write does not land what the gate priced)\n"+
				"  snapshot        %v\n"+
				"  requested  add  %v  remove %v\n"+
				"  narrowed   add  %v  remove %v\n"+
				"  gate predicted  %v\n"+
				"  write produces  %v",
			snapshot, addLabels, removeLabels, gotAdd, gotRemove, want, got)
	}

	// ── P2: minimality — nothing returned may be a no-op against the snapshot ──
	present := map[string]bool{}
	for _, l := range snapshot {
		if k := labelMatchKey(l); k != "" {
			present[k] = true
		}
	}
	removeKeys := map[string]bool{}
	for _, l := range removeLabels {
		if k := labelMatchKey(l); k != "" {
			removeKeys[k] = true
		}
	}
	var bad []string
	for _, a := range gotAdd {
		k := labelMatchKey(a)
		switch {
		case k == "":
			bad = append(bad, fmt.Sprintf("add %q has an empty match key, so it names no label", a))
		case present[k]:
			bad = append(bad, fmt.Sprintf("add %q is already on the snapshot: the gate charged "+
				"nothing for it, and sending it re-applies a label another actor may have removed since", a))
		case removeKeys[k]:
			bad = append(bad, fmt.Sprintf("add %q is cancelled by the remove list: applyLabelDelta "+
				"is remove-wins, so the gate priced this as NOT applied (this is C-1)", a))
		}
	}
	for _, r := range gotRemove {
		k := labelMatchKey(r)
		switch {
		case k == "":
			bad = append(bad, fmt.Sprintf("remove %q has an empty match key, so it names no label", r))
		case !present[k]:
			bad = append(bad, fmt.Sprintf("remove %q is not on the snapshot: the gate charged "+
				"nothing for it, and sending it destroys a label the gate never saw (this is A-4)", r))
		}
	}
	if len(bad) > 0 {
		p2Fail = fmt.Sprintf(
			"P2 VIOLATED (a returned entry is a no-op against the snapshot, so it was never priced)\n"+
				"  snapshot        %v\n"+
				"  requested  add  %v  remove %v\n"+
				"  narrowed   add  %v  remove %v\n"+
				"  %s",
			snapshot, addLabels, removeLabels, gotAdd, gotRemove, strings.Join(bad, "\n  "))
	}
	return p1Fail, p2Fail
}

func sameLabelSet(a, b []string) bool {
	ka, kb := labelKeySet(a), labelKeySet(b)
	if len(ka) != len(kb) {
		return false
	}
	for i := range ka {
		if ka[i] != kb[i] {
			return false
		}
	}
	return true
}

func labelKeySet(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, l := range in {
		if k := labelMatchKey(l); k != "" && !seen[k] {
			seen[k] = true
			out = append(out, k)
		}
	}
	sort.Strings(out)
	return out
}

// propertyStore builds a pass-through store with the default label config. Only
// the mapper and the pure narrowing logic are exercised; no GraphQL call is
// made, so no transport is needed.
func propertyStore(t *testing.T) *GitHubPassThroughStore {
	t.Helper()
	return NewPassThroughStore("tok", "acme", "widgets", DefaultConfig(), nil)
}

// TestRestrictLabelWriteToSnapshot_NamedDefectShapes runs P1 and P2 over the
// four defect shapes this control has actually exhibited, plus the legitimate
// edits that must NOT be rejected.
//
// The named table exists alongside the exhaustive sweep below because a sweep
// failure names a triple and nothing else. These rows name the vulnerability.
func TestRestrictLabelWriteToSnapshot_NamedDefectShapes(t *testing.T) {
	const completed = "ft:stage/completed"
	const wontFix = "ft:stage/wont_fix"

	rows := []struct {
		name     string
		why      string
		snapshot []string
		add      []string
		remove   []string
	}{
		{
			name: "C1_cross_list_absent_label",
			why: "THE CRITICAL. The same label in both lists, absent from the snapshot. " +
				"applyLabelDelta is remove-wins, so the gate predicts no change and charges " +
				"nothing. A restrictor that filters the two lists independently keeps the add " +
				"and drops the remove, and the free request applies a terminal label.",
			snapshot: []string{"ft:stage/accepted", "bug"},
			add:      []string{completed},
			remove:   []string{completed},
		},
		{
			name: "C1_cross_list_case_split",
			why: "The same attack with the two lists spelled differently. This is why the " +
				"cross-list test must use labelMatchKey and not ==.",
			snapshot: []string{"ft:stage/accepted", "bug"},
			add:      []string{"FT:Stage/Completed"},
			remove:   []string{"ft:stage/completed"},
		},
		{
			name:     "C1_cross_list_pad_split",
			why:      "The same attack with padding instead of case. Also bypasses ==.",
			snapshot: []string{"ft:stage/accepted", "bug"},
			add:      []string{completed},
			remove:   []string{"  " + completed + "\t"},
		},
		{
			name: "C1_cross_list_label_present",
			why: "The present-side twin: remove wins, so the gate prices a removal. The " +
				"write must remove and must not re-add.",
			snapshot: []string{completed, "bug"},
			add:      []string{completed},
			remove:   []string{completed},
		},
		{
			name: "A4_remove_a_label_the_snapshot_never_carried",
			why: "The original A-4. Free against the snapshot, destructive against drifted " +
				"remote state. Caught by P2, invisible to P1 by construction.",
			snapshot: []string{"bug"},
			add:      nil,
			remove:   []string{wontFix},
		},
		{
			name: "A4_re_add_a_label_the_snapshot_already_carries",
			why: "A-4's mirror image: re-applying a terminal label another actor removed " +
				"since the snapshot, at a price of nothing.",
			snapshot: []string{wontFix, "bug"},
			add:      []string{wontFix},
			remove:   nil,
		},
		{
			name:     "legitimate_priced_removal",
			why:      "MUST PASS. A real removal of a label the snapshot carries.",
			snapshot: []string{wontFix, "bug"},
			add:      nil,
			remove:   []string{wontFix},
		},
		{
			name:     "legitimate_priced_addition",
			why:      "MUST PASS. A real addition of a label the snapshot lacks.",
			snapshot: []string{"bug"},
			add:      []string{completed},
			remove:   nil,
		},
		{
			name:     "legitimate_priced_swap",
			why:      "MUST PASS. Different labels in each list is not a cross-list cancel.",
			snapshot: []string{wontFix},
			add:      []string{completed},
			remove:   []string{wontFix},
		},
		{
			name:     "legitimate_removal_spelled_in_a_different_case",
			why:      "MUST PASS and MUST STILL REMOVE. GitHub label names are unique case-insensitively.",
			snapshot: []string{wontFix},
			add:      nil,
			remove:   []string{strings.ToUpper(wontFix)},
		},
		{
			name:     "empty_and_whitespace_entries",
			why:      "Entries naming no label must never be forwarded to the write.",
			snapshot: []string{"bug"},
			add:      []string{"", "   "},
			remove:   []string{"", "\t"},
		},
		{
			name:     "degenerate_nil_snapshot",
			why:      "A task with no labels must fail closed on the remove side.",
			snapshot: nil,
			add:      nil,
			remove:   []string{wontFix},
		},
	}

	s := propertyStore(t)
	for _, row := range rows {
		t.Run(row.name, func(t *testing.T) {
			p1, p2 := restrictProperties(s, row.snapshot, row.add, row.remove)
			if p1 != "" {
				t.Errorf("%s\n\nwhy this row exists: %s", p1, row.why)
			}
			if p2 != "" {
				t.Errorf("%s\n\nwhy this row exists: %s", p2, row.why)
			}
		})
	}
}

// TestRestrictLabelWriteToSnapshot_PropertiesHoldExhaustively is the quantified
// half. It enumerates every (snapshot, add, remove) triple over a small
// vocabulary chosen so that the interesting collisions are reachable: one
// lifecycle label in three spellings that all share a match key, one unrelated
// label, and the empty string.
//
// The exhaustive form is deliberate. C-1 was missed by a search that enumerated
// nineteen spellings down ONE axis (single label, single list) because the
// oracle could not discriminate anything else. A cross product over both lists
// at once cannot have that blind spot: the cross-list interaction is in the
// enumeration by construction, not by anybody remembering to add a row.
func TestRestrictLabelWriteToSnapshot_PropertiesHoldExhaustively(t *testing.T) {
	const completed = "ft:stage/completed"

	// Three spellings of ONE label plus one unrelated label plus a
	// names-nothing entry. Every pair of spellings of `completed` is a
	// cross-list collision that string equality would miss.
	vocab := []string{completed, strings.ToUpper(completed), " " + completed + " ", "bug", ""}
	snapVocab := []string{completed, "bug", "ft:stage/accepted"}

	s := propertyStore(t)

	// Self-check: the vocabulary must actually contain a cross-list collision
	// that `==` cannot see, or this sweep is measuring the easy axis only.
	if labelMatchKey(vocab[0]) != labelMatchKey(vocab[1]) || vocab[0] == vocab[1] {
		t.Fatalf("SWEEP BROKEN: %q and %q must be the same label under labelMatchKey and "+
			"different under ==, or the sweep cannot distinguish a labelMatchKey cross-list "+
			"test from a == one", vocab[0], vocab[1])
	}

	cases, p1Fails, p2Fails := 0, 0, 0
	var firstP1, firstP2 string

	for snapMask := 0; snapMask < 1<<len(snapVocab); snapMask++ {
		snapshot := subsetOf(snapVocab, snapMask)
		for addMask := 0; addMask < 1<<len(vocab); addMask++ {
			add := subsetOf(vocab, addMask)
			for remMask := 0; remMask < 1<<len(vocab); remMask++ {
				remove := subsetOf(vocab, remMask)
				cases++
				p1, p2 := restrictProperties(s, snapshot, add, remove)
				if p1 != "" {
					p1Fails++
					if firstP1 == "" {
						firstP1 = p1
					}
				}
				if p2 != "" {
					p2Fails++
					if firstP2 == "" {
						firstP2 = p2
					}
				}
			}
		}
	}

	// The sweep must have run. A quantified property over zero cases is the
	// vacuous-guarantee shape this workstream keeps rediscovering.
	wantCases := (1 << len(snapVocab)) * (1 << len(vocab)) * (1 << len(vocab))
	if cases != wantCases {
		t.Fatalf("SWEEP BROKEN: executed %d triples, want %d", cases, wantCases)
	}

	if p1Fails > 0 {
		t.Errorf("P1 failed on %d of %d triples. First:\n%s", p1Fails, cases, firstP1)
	}
	if p2Fails > 0 {
		t.Errorf("P2 failed on %d of %d triples. First:\n%s", p2Fails, cases, firstP2)
	}
	t.Logf("swept %d (snapshot, add, remove) triples", cases)
}

func subsetOf(vocab []string, mask int) []string {
	var out []string
	for i, v := range vocab {
		if mask&(1<<i) != 0 {
			out = append(out, v)
		}
	}
	return out
}

// TestRestrictLabelWriteToSnapshot_PropertiesRejectTheIdentityRestrictor is the
// capability probe for P2, and it is the reason P2 is in the tree at all.
//
// "Restrict = identity" is not a hypothetical mutant: it is literally the
// pre-A-4 production code, in which both lists were forwarded verbatim. P1
// accepts it on every input — substituting identity makes both sides of P1 the
// same expression — so a suite carrying P1 alone would have gone green on the
// exact defect #194 exists to close.
//
// If this test ever fails, P2 has stopped discriminating and the A-4 class is
// unpinned again.
func TestRestrictLabelWriteToSnapshot_PropertiesRejectTheIdentityRestrictor(t *testing.T) {
	rows := []struct {
		name     string
		snapshot []string
		add      []string
		remove   []string
	}{
		{"A4_remove_absent", []string{"bug"}, nil, []string{"ft:stage/wont_fix"}},
		{"A4_re_add_present", []string{"ft:stage/wont_fix"}, []string{"ft:stage/wont_fix"}, nil},
		{"C1_cross_list", []string{"ft:stage/accepted"}, []string{"ft:stage/completed"}, []string{"ft:stage/completed"}},
	}

	for _, row := range rows {
		t.Run(row.name, func(t *testing.T) {
			// identity: exactly what the code did before A-4.
			gotAdd, gotRemove := row.add, row.remove

			present := map[string]bool{}
			for _, l := range row.snapshot {
				if k := labelMatchKey(l); k != "" {
					present[k] = true
				}
			}
			removeKeys := map[string]bool{}
			for _, l := range row.remove {
				if k := labelMatchKey(l); k != "" {
					removeKeys[k] = true
				}
			}
			p2Holds := true
			for _, a := range gotAdd {
				if k := labelMatchKey(a); k == "" || present[k] || removeKeys[k] {
					p2Holds = false
				}
			}
			for _, r := range gotRemove {
				if k := labelMatchKey(r); k == "" || !present[k] {
					p2Holds = false
				}
			}
			if p2Holds {
				t.Fatalf("P2 ACCEPTED the identity restrictor on %s (snapshot=%v add=%v remove=%v). "+
					"Identity IS the pre-A-4 code. P2 has stopped being able to see under-narrowing, "+
					"which means P1 is now the only pin and P1 cannot see the A-4 class at all",
					row.name, row.snapshot, row.add, row.remove)
			}

			// And the other half of the argument: P1 accepts identity here, so
			// P1 alone would have shipped this. Asserted rather than asserted
			// in prose, because the temptation to drop P2 as "redundant" is
			// exactly what this pair exists to resist.
			want := applyLabelDelta(row.snapshot, row.add, row.remove)
			got := applyLabelDelta(row.snapshot, gotAdd, gotRemove)
			if !sameLabelSet(want, got) {
				t.Logf("note: P1 also rejects identity on %s; the pairing argument is "+
					"weaker than documented for this row, but P2 still fires", row.name)
			}
		})
	}
}
