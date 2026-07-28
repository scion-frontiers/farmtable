package github

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// These are the PROPERTY pins for the read/write predicate partition (#194
// round 11). They are deliberately in this package rather than in the server
// suite: the server fixtures reach the seam through the RPC gate, where a cell
// that gets cheaper is only visible if some principal happens to lack exactly
// the scope that stopped being charged. Here the price itself is the
// observable, so a cheaper cell fails directly.
//
// The import of internal/server is for TransitionScope and the scope constants
// only. Restating the transition table here would mean the pin agrees with a
// copy of the policy rather than with the policy. internal/server does not
// import this package outside its own tests, so there is no cycle.

// priceOf is the scope set the UpdateTask label arm would demand for a
// (before, after) endpoint pair. It mirrors server.go's loop rather than
// re-deciding anything: same SameStageSet guard, same all-pairs walk, same
// "task:write is not a lifecycle charge" filter.
func priceOf(before, after []task.Stage) map[string]bool {
	out := map[string]bool{}
	if store.SameStageSet(before, after) {
		return out
	}
	for _, from := range before {
		for _, to := range after {
			scope := server.TransitionScope(string(from), string(to))
			if scope == server.ScopeTaskWrite {
				continue
			}
			out[scope] = true
		}
	}
	return out
}

func priceString(p map[string]bool) string {
	if len(p) == 0 {
		return "FREE"
	}
	keys := make([]string, 0, len(p))
	for k := range p {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return strings.Join(keys, "+")
}

// TestLabelWritePrice_IsMonotoneInThePredicate is the round-11 Critical's
// regression pin, and it is a PROPERTY rather than a table of expected cells
// on purpose.
//
// The round-10 defect was not that some cell had the wrong expected value. It
// was that widening the lifecycle predicate made 29 cells CHEAPER, and every
// fixture that could have noticed starts from an empty label set — with no
// labels on the task the BEFORE endpoint cannot move, so the suite was
// structurally incapable of observing the regression no matter how many rows
// were added to it. Expected-value tables encode the answer someone already
// believed; this encodes the relation that must survive any answer.
//
// THE RELATION. Let readPrice be the price computed by asking the READ
// predicate at both endpoints over the raw delta — byte for byte what base
// 06f01d7 did, and the behaviour that shipped before any of this workstream.
// Let writePrice be what the seam charges today. Then for every cell:
//
//	writePrice ⊇ readPrice
//
// Superset, not "greater than or equal to". The governing brief asks for
// scopeRank(post) >= scopeRank(pre), which presumes the scope vocabulary is
// totally ordered. It is not: task:claim, task:accept and task:close are
// independent grants and no deployment's grant of one implies another (see
// scopes.go — there is no implication table, and RequireScope checks
// membership). A rank would therefore have to invent an ordering, and a pin
// that invents its own policy passes for reasons unrelated to the code. Set
// containment needs no ordering, is the property the fix actually has, and is
// strictly stronger: it forbids swapping task:close for task:accept as well as
// dropping a charge outright.
func TestLabelWritePrice_IsMonotoneInThePredicate(t *testing.T) {
	ctx := context.Background()

	configs := map[string]LabelConfig{
		"enabled_ft":     {Enabled: true, PushPrefix: "ft:"},
		"disabled_ft":    {Enabled: false, PushPrefix: "ft:"},
		"enabled_ft2":    {Enabled: true, PushPrefix: "ft2:"},
		"enabled_slash":  {Enabled: true, PushPrefix: "acme/"},
		"enabled_alias":  {Enabled: true, PushPrefix: "ft:", Stages: map[string]string{"shipped": "completed"}},
		"enabled_noprfx": {Enabled: true, PushPrefix: " "},
	}

	// Label sets that a task can already be carrying. The non-empty ones are
	// the point: they are the only way the BEFORE endpoint can move at all.
	labelSets := map[string][]string{
		"none":            nil,
		"inert":           {"needs-triage", "bug"},
		"stock_duplicate": {"duplicate"},
		"bare_completed":  {"completed"},
		"local_completed": {"ft:stage/completed"},
		"two_terminal":    {"ft:stage/wont_fix", "ft:stage/completed"},
		"foreign_wontfix": {"ft2:stage/wont_fix"},
		"markerless":      {"stage/completed"},
		"namespaced":      {"status:duplicate", "kanban:working"},
		"alias":           {"shipped"},
	}

	deltas := map[string]struct{ add, remove []string }{
		"noop":              {},
		"add_local_dup":     {add: []string{"ft:stage/duplicate"}},
		"add_local_done":    {add: []string{"ft:stage/completed"}},
		"add_foreign":       {add: []string{"ft2:stage/completed"}},
		"add_markerless":    {add: []string{"stage/completed"}},
		"add_bare":          {add: []string{"duplicate"}},
		"add_namespaced":    {add: []string{"release:completed"}},
		"add_notastage":     {add: []string{"notastage/completed"}},
		"add_alias":         {add: []string{"shipped"}},
		"rm_local_done":     {remove: []string{"ft:stage/completed"}},
		"rm_stock_dup":      {remove: []string{"duplicate"}},
		"rm_all":            {remove: []string{"ft:stage/completed", "ft:stage/wont_fix", "duplicate", "completed", "stage/completed"}},
		"swap_wontfix_done": {add: []string{"ft:stage/completed"}, remove: []string{"ft:stage/wont_fix"}},

		// The two shapes most likely to break monotonicity, reasoned about
		// rather than sampled: they strip the label the READ side calls
		// terminal and replace it with one only the WRITE side claims. That is
		// the only way the AFTER endpoint can move toward BEFORE while the
		// reference arm sees it move away.
		"swap_local_for_markerless": {add: []string{"stage/completed"}, remove: []string{"ft:stage/completed"}},
		"swap_local_for_foreign":    {add: []string{"ft2:stage/completed"}, remove: []string{"ft:stage/completed"}},
	}

	stages := []task.Stage{task.StageTriage, task.StageAccepted, task.StageWorking, task.StageCompleted}
	closedAt := time.Date(2026, 7, 28, 0, 0, 0, 0, time.UTC)

	cells := 0
	for cfgName, cfg := range configs {
		mapper := NewLabelMapper(cfg)
		s := &GitHubPassThroughStore{mapper: mapper}
		for setName, labels := range labelSets {
			for deltaName, d := range deltas {
				for _, stage := range stages {
					for _, closed := range []bool{false, true} {
						cells++
						name := fmt.Sprintf("%s/%s/%s/%s/closed=%v",
							cfgName, setName, deltaName, stage, closed)
						t.Run(name, func(t *testing.T) {
							tk := &ent.Task{Stage: stage, Labels: append([]string(nil), labels...)}
							if closed {
								at := closedAt
								tk.ClosedAt = &at
							}

							// The REFERENCE arm: the read predicate on both
							// endpoints over the RAW delta. This is base
							// 06f01d7's LabelDeltaLifecycleStages verbatim,
							// reached through the same unexported helper the
							// seam's BEFORE arm uses, so it cannot drift from
							// what the read side means.
							refBefore := s.currentLifecycleStages(tk, tk.Labels)
							refAfter := s.currentLifecycleStages(tk,
								applyLabelDelta(tk.Labels, d.add, d.remove))
							ref := priceOf(refBefore, refAfter)

							before, after := s.LabelDeltaLifecycleStages(ctx, tk, d.add, d.remove)
							got := priceOf(before, after)

							for scope := range ref {
								if got[scope] {
									continue
								}
								t.Errorf(
									"WRITE PRICE IS CHEAPER THAN THE READ PRICE — the round-10 "+
										"Critical, reopened.\n"+
										"  dropped scope: %s\n"+
										"  read  price %s from %v -> %v\n"+
										"  write price %s from %v -> %v\n"+
										"  config=%s labels=%v add=%v remove=%v stage=%s closed=%v\n"+
										"The write predicate is a SUPERSET of the read predicate, so "+
										"it may charge more and may never charge less. A scope that "+
										"disappears means the predicate reached the BEFORE endpoint "+
										"and collapsed it onto AFTER; see "+
										"LabelDeltaLifecycleStages for why only AFTER may widen.",
									scope, priceString(ref), refBefore, refAfter,
									priceString(got), before, after,
									cfgName, tk.Labels, d.add, d.remove, stage, closed)
							}
						})
					}
				}
			}
		}
	}

	// A property test that ran zero cells passes. Pin the count so a future
	// edit that empties a vocabulary map fails here instead of going quiet.
	if want := len(configs) * len(labelSets) * len(deltas) * len(stages) * 2; cells != want {
		t.Fatalf("walked %d cells, want %d: the vocabulary loop is not covering what it declares", cells, want)
	}
	if cells < 1000 {
		t.Fatalf("only %d cells: this pin is meant to sweep a vocabulary, not a handful of examples", cells)
	}
}

// TestLabelWritePrice_MonotonicityPinCanFail is the POSITIVE CONTROL for the
// test above. "No cell got cheaper" is a claim about a search, and a search
// that cannot recognise its own target has found nothing.
//
// It reproduces the round-10 Critical exactly — canonicalise the task's
// EXISTING labels before computing BEFORE — and asserts that the comparison
// the pin performs does report a dropped scope for it. If this stops failing,
// the pin above is decorative.
func TestLabelWritePrice_MonotonicityPinCanFail(t *testing.T) {
	s := &GitHubPassThroughStore{mapper: NewLabelMapper(LabelConfig{Enabled: true, PushPrefix: "ft:"})}
	tk := &ent.Task{Stage: task.StageAccepted, Labels: []string{"duplicate"}}
	add := []string{"ft:stage/duplicate"}

	refBefore := s.currentLifecycleStages(tk, tk.Labels)
	refAfter := s.currentLifecycleStages(tk, applyLabelDelta(tk.Labels, add, nil))
	ref := priceOf(refBefore, refAfter)
	if len(ref) == 0 {
		t.Fatalf("the read predicate charges nothing for %v + %v, so this control "+
			"cannot demonstrate a drop", tk.Labels, add)
	}

	// The round-10 shape: the write predicate applied to the task's own labels.
	view := s.mapper.writeViewMapper()
	round10Before := view.claimedStages(taskIssueState(tk), taskStateReason(tk),
		s.mapper.canonicalLifecycleLabels(tk.Labels))
	round10After := view.claimedStages(taskIssueState(tk), taskStateReason(tk),
		s.mapper.canonicalLifecycleLabels(applyLabelDelta(tk.Labels, add, nil)))
	round10 := priceOf(round10Before, round10After)

	dropped := false
	for scope := range ref {
		if !round10[scope] {
			dropped = true
		}
	}
	if !dropped {
		t.Errorf("the round-10 shape priced %v + %v at %s, and the read predicate at %s — "+
			"no scope was dropped, so TestLabelWritePrice_IsMonotoneInThePredicate has "+
			"no demonstrated ability to detect the defect it exists for.\n"+
			"  round-10 %v -> %v\n  read     %v -> %v",
			tk.Labels, add, priceString(round10), priceString(ref),
			round10Before, round10After, refBefore, refAfter)
	}
}

// TestLifecycleStageClaim_IsASupersetOfAuthorizationStage pins the invariant
// the whole partition rests on: the WRITE predicate claims every label the
// READ predicate honours, and agrees with it on the stage.
//
// This is the pin that would have caught the first draft of the round-11 fix.
// Requiring the "stage/" marker looked like a tightening of a too-wide
// predicate; measured over the grid it would have dropped 40 of the 80
// spellings authorizationStage honours under DefaultConfig, because
// stripForMatch trims "stage/", "priority/" and "priority:" SEQUENTIALLY and
// half of the accepted sequences contain no "stage/" at all. A narrower write
// predicate is fail-OPEN. The marker rule therefore lives in branch 2 only,
// and this test is what stops it migrating into branch 1.
func TestLifecycleStageClaim_IsASupersetOfAuthorizationStage(t *testing.T) {
	configs := map[string]LabelConfig{
		"enabled_ft":    {Enabled: true, PushPrefix: "ft:"},
		"disabled_ft":   {Enabled: false, PushPrefix: "ft:"},
		"enabled_ft2":   {Enabled: true, PushPrefix: "ft2:"},
		"enabled_slash": {Enabled: true, PushPrefix: "acme/"},
		"enabled_dash":  {Enabled: true, PushPrefix: "ft-"},
		"enabled_alias": {Enabled: true, PushPrefix: "ft:", Stages: map[string]string{"shipped": "completed", "icebox": "wont_fix"}},
	}

	// Every segment sequence stripForMatch will consume, in the order it
	// consumes them. Enumerated as the subset lattice so a future segment
	// added to stripForMatch shows up here as a missing sequence rather than
	// as silence.
	segments := []string{"stage/", "priority/", "priority:"}
	var sequences []string
	for mask := 0; mask < 1<<len(segments); mask++ {
		var sb strings.Builder
		for i, seg := range segments {
			if mask&(1<<i) != 0 {
				sb.WriteString(seg)
			}
		}
		sequences = append(sequences, sb.String())
	}

	honoured := 0
	for cfgName, cfg := range configs {
		m := NewLabelMapper(cfg)
		keys := make([]string, 0, len(m.labelToStage))
		for k := range m.labelToStage {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, prefix := range []string{m.pushPrefix(), strings.ToUpper(m.pushPrefix()), "", "ft2:", "acme/"} {
			for _, seq := range sequences {
				for _, key := range keys {
					raw := prefix + seq + key
					readStage, readOK := m.authorizationStage(raw)
					if !readOK {
						continue
					}
					honoured++
					claimStage, claimOK := m.lifecycleStageClaim(raw)
					if !claimOK {
						t.Errorf("FAIL-OPEN GAP: config=%s label=%q is authoritative for the "+
							"READ side (authorizationStage -> %s) but the WRITE side does not "+
							"claim it. A write predicate narrower than the read predicate lets "+
							"a caller write an already-authoritative stage label for free.",
							cfgName, raw, readStage)
						continue
					}
					if claimStage != readStage {
						t.Errorf("DISAGREEMENT: config=%s label=%q reads as %s and is claimed as "+
							"%s. The two predicates may differ in WHICH labels they answer for, "+
							"never in the answer.", cfgName, raw, readStage, claimStage)
					}
				}
			}
		}
	}

	// Positive control on the sweep itself: if authorizationStage stopped
	// honouring anything, every cell would `continue` and the test would pass
	// having asserted nothing.
	if honoured < 80 {
		t.Fatalf("the sweep found only %d authoritative cells; DefaultConfig alone "+
			"contributes 80 (10 keys x 8 segment sequences). A collapsed count means "+
			"the grid stopped reaching the read predicate, not that the gap closed.",
			honoured)
	}
}

// TestLifecycleMarker_IsWhatStageToLabelActuallyEmits pins lifecycleMarker to
// the construction it claims to describe.
//
// The governing ruling for this round named the marker only as "whatever
// internal convention actually constructs a lifecycle-stage label" and
// deliberately did not spell it. "stage/" is the MEASURED answer, not a
// remembered one, and the measurement is cheap enough to keep. If StageToLabel
// ever emits a different shape, a predicate keyed on "stage/" silently stops
// recognising the deployment's own writes — which prices them at nothing.
func TestLifecycleMarker_IsWhatStageToLabelActuallyEmits(t *testing.T) {
	prefixes := []string{"ft:", "ft2:", "", "  ", "FT:", "acme/", "ft-", "ft.", "ft_", "a:b:", "team/ft:"}

	emissions := 0
	for _, prefix := range prefixes {
		m := NewLabelMapper(LabelConfig{Enabled: true, PushPrefix: prefix})
		for _, stage := range allStages {
			label := m.StageToLabel(stage)
			if label == "" {
				t.Errorf("StageToLabel(%s) is empty under push_prefix %q", stage, prefix)
				continue
			}
			emissions++

			want := m.pushPrefix() + lifecycleMarker + stage.String()
			if label != want {
				t.Errorf("push_prefix %q: StageToLabel(%s) = %q, want %q. lifecycleMarker is "+
					"%q because that is what this codebase emits; if the emission shape "+
					"changed, the write predicate no longer recognises the deployment's own "+
					"stage labels and prices them at nothing.",
					prefix, stage, label, want, lifecycleMarker)
			}

			// The round trip that matters: what we write, we must claim.
			if _, ok := m.lifecycleStageClaim(label); !ok {
				t.Errorf("push_prefix %q: the deployment emits %q for %s and the write "+
					"predicate does not claim it", prefix, label, stage)
			}
			// And the marker must be findable in it by the same matcher the
			// prefix-blind branch uses.
			if suffix, ok := lifecycleMarkerSuffix(strings.ToLower(strings.TrimSpace(label))); !ok {
				t.Errorf("push_prefix %q: lifecycleMarkerSuffix does not recognise the "+
					"emitted label %q", prefix, label)
			} else if suffix != stage.String() {
				t.Errorf("push_prefix %q: lifecycleMarkerSuffix(%q) = %q, want %q",
					prefix, label, suffix, stage)
			}
		}
	}
	if want := len(prefixes) * len(allStages); emissions != want {
		t.Fatalf("checked %d emissions, want %d", emissions, want)
	}
}

// TestLifecycleMarkerSuffix_RequiresASegmentBoundary is the boundary that stops
// the marker rule from re-creating the bug it exists to fix.
//
// Round 10 denied ordinary work — "status:duplicate", "kanban:working" — by
// treating any namespaced label whose tail is a stage name as a lifecycle
// claim. The marker requirement is what frees those again, and a marker match
// that ignores segment boundaries would give the round-10 answer back for any
// label containing the six characters "stage/" anywhere.
func TestLifecycleMarkerSuffix_RequiresASegmentBoundary(t *testing.T) {
	rows := []struct {
		label      string
		wantSuffix string
		wantOK     bool
		why        string
	}{
		{"stage/completed", "completed", true, "position 0 is a boundary"},
		{"ft:stage/completed", "completed", true, "colon delimiter"},
		{"acme/stage/completed", "completed", true, "slash delimiter"},
		{"ft-stage/completed", "completed", true, "dash: the ruling's own worked example"},
		{"ft.stage/completed", "completed", true, "dot: from the review's spelling list"},
		{"ft_stage/completed", "completed", true, "underscore: from the review's spelling list"},
		{"a:b:stage/completed", "completed", true, "multi-segment prefix"},
		{"ft: stage/completed", "completed", true, "space is not alphanumeric"},
		{"notastage/completed", "", false, "NO boundary before the marker — this is the row that keeps legitimate work legitimate"},
		{"backstage/completed", "", false, "ditto, and a plausible real label"},
		{"7stage/completed", "", false, "digit is not a delimiter"},
		{"ft:stage/stage/completed", "completed", true, "last qualifying occurrence wins"},
		{"ft:stages/completed", "", false, "the marker includes its slash"},
		{"ft:stage/", "", true, "marker with an empty tail is recognised; the tail then matches no stage"},
		{"completed", "", false, "no marker at all"},
		{"", "", false, "empty label"},
	}

	for _, r := range rows {
		t.Run(r.label, func(t *testing.T) {
			suffix, ok := lifecycleMarkerSuffix(r.label)
			if ok != r.wantOK || suffix != r.wantSuffix {
				t.Errorf("lifecycleMarkerSuffix(%q) = (%q, %v), want (%q, %v): %s",
					r.label, suffix, ok, r.wantSuffix, r.wantOK, r.why)
			}
		})
	}
}

// TestPushPrefixDelimiterClass_MatchesWhatTheClaimRecognises is the pin that
// makes "every push_prefix a deployment can legally hold is recognised by the
// write predicate" true by construction rather than by review.
//
// Two independent pieces of code encode the same class: isLabelSegmentDelimiter
// decides where a marker segment may start, and GitHubConfig.Validate refuses a
// push_prefix that would put the marker somewhere the matcher cannot see it. If
// they drift, an operator configures a prefix the validator accepts and the
// write predicate does not recognise, and every lifecycle label that
// deployment writes is priced at nothing.
func TestPushPrefixDelimiterClass_MatchesWhatTheClaimRecognises(t *testing.T) {
	// Sweep the whole byte range the two rules disagree over most easily,
	// plus a couple of multi-byte tails.
	var candidates []string
	for b := byte(0x20); b < 0x7f; b++ {
		candidates = append(candidates, "ft"+string(b))
	}
	candidates = append(candidates, "ft:", "acme/", "ft", "x9", "ft​", "ft√")

	checked := 0
	for _, prefix := range candidates {
		var cfg GitHubConfig
		cfg.GitHub.Labels = LabelConfig{Enabled: true, PushPrefix: prefix}
		validateErr := cfg.Validate()

		m := NewLabelMapper(LabelConfig{Enabled: true, PushPrefix: prefix})
		emitted := strings.ToLower(strings.TrimSpace(m.StageToLabel(task.StageCompleted)))
		_, recognised := lifecycleMarkerSuffix(emitted)
		checked++

		switch {
		case validateErr == nil && !recognised:
			t.Errorf("push_prefix %q passes Validate but the write predicate does NOT "+
				"recognise the label the deployment emits for it (%q). Every lifecycle "+
				"label this deployment writes would be priced at nothing.",
				prefix, emitted)
		case validateErr != nil && recognised:
			t.Errorf("push_prefix %q is rejected by Validate although the write predicate "+
				"recognises %q. The validator is refusing a configuration that works, "+
				"which is a real operational cost for no safety gain.", prefix, emitted)
		}
	}
	if checked < 90 {
		t.Fatalf("only swept %d prefixes", checked)
	}
}

// TestLifecycleStageClaim_NilMapper pins the nil arm. LabelDeltaLifecycleStages
// has an explicit nil-mapper branch, but canonicalLifecycleLabels and
// writeViewMapper are reachable with a nil receiver from other call sites, and
// a nil-panic inside a scope gate is an availability defect on the write path.
func TestLifecycleStageClaim_NilMapper(t *testing.T) {
	var m *LabelMapper
	if stage, ok := m.lifecycleStageClaim("ft:stage/completed"); ok {
		t.Errorf("nil mapper claimed %q as %s", "ft:stage/completed", stage)
	}
	if got := m.canonicalLifecycleLabels([]string{"ft:stage/completed"}); len(got) != 1 || got[0] != "ft:stage/completed" {
		t.Errorf("nil mapper canonicalLifecycleLabels = %v, want the input unchanged", got)
	}
	if v := m.writeViewMapper(); v.LabelMapper != nil {
		t.Errorf("nil mapper writeViewMapper = %v, want a nil view", v)
	}
}
