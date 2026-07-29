package github

// AUDIT PROBE — #194 round 5 security audit, leg: security.
// Written by the audit leg at ea8ac390dad3d2401d65608684e5d6623ab15ac5.
// This file asserts nothing about DESIRED behaviour; it MEASURES the B6 prefix
// parse so the round-5 report can mark its findings BY EXECUTION.
//
// It is deliberately independent of terminal_label_stages_test.go: it builds
// its own mappers, generates its own corpus, and every negative result below is
// paired with a positive control in the same table.

import (
	"fmt"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// mapperWithPrefix builds a mapper with an explicit push_prefix and label
// mapping enabled.
func mapperWithPrefix(prefix string) *LabelMapper {
	cfg := DefaultConfig().GitHub.Labels
	cfg.PushPrefix = prefix
	return NewLabelMapper(cfg)
}

// ── CHARGE 2: is the prefix requirement a sound parse? ──

// TestAuditR5_PrefixParseMatrix drives every spelling trick that could make a
// label the deployment did not write feed an authorization answer, or make one
// it DID write stop feeding one.
//
// POSITIVE CONTROL: the table contains rows that MUST map. If those stop
// mapping, every "denied" row below is a property of the probe and not of the
// code, and the test fails loudly rather than reporting a clean sweep.
func TestAuditR5_PrefixParseMatrix(t *testing.T) {
	m := mapperWithPrefix("ft:")

	cases := []struct {
		name  string
		label string
		want  bool // want authorizationStage to report a stage
		why   string
	}{
		// ---- positive controls: these MUST map ----
		{"canonical", "ft:stage/completed", true, "the label CloseTask actually writes"},
		{"upper_all", "FT:STAGE/COMPLETED", true, "GitHub label names are case-insensitive"},
		{"mixed_case", "Ft:Stage/Completed", true, "case-insensitive"},
		{"leading_space", "  ft:stage/completed", true, "TrimSpace runs before the prefix test"},
		{"trailing_space", "ft:stage/completed  ", true, "TrimSpace runs before the lookup"},
		{"prefix_no_stage_segment", "ft:completed", true,
			"stripForMatch strips the prefix then matches the bare stage name"},

		// ---- the attack rows: a label the deployment did not write ----
		{"bare_stock_duplicate", "duplicate", false,
			"GitHub ships this in every repo; any triager can apply it"},
		{"bare_completed", "completed", false, "independently created label"},
		{"bare_wont_fix", "wont_fix", false, "independently created label"},
		{"contains_prefix_not_at_start", "xft:stage/completed", false,
			"HasPrefix, not Contains"},
		{"prefix_as_infix", "team-ft:stage/completed", false, "HasPrefix, not Contains"},
		{"prefix_after_space_inside", "a ft:stage/completed", false,
			"TrimSpace is outer-only; this must not match"},
		{"double_prefix", "ft:ft:stage/completed", false,
			"one strip only, so the residue is not a stage name"},
		{"triple_prefix", "ft:ft:ft:stage/completed", false, "one strip only"},
		{"internal_space_after_prefix", "ft: stage/completed", false,
			"prefix present but residue is not a stage key"},
		{"prefix_only", "ft:", false, "no stage named"},
		{"empty", "", false, "no stage named"},
		{"whitespace_only", "   ", false, "no stage named"},

		// ---- unicode look-alikes: must fail CLOSED (deny), never open ----
		{"fullwidth_latin", "ｆｔ：stage/completed", false,
			"fullwidth f, t and colon are distinct runes"},
		{"cyrillic_es_colon", "ғt:stage/completed", false, "cyrillic ghe with stroke"},
		{"turkish_dotless", "fTİ:stage/completed", false, "U+0130 lowercases to i+combining dot"},
		{"kelvin_in_stage", "ft:stage/wont_fiK", false,
			"U+212A KELVIN SIGN lowercases to k but this is not a stage anyway"},
		// COSTLY DISCLOSURE: this row was written expecting want=false, on the
		// assumption that strings.TrimSpace handles only ASCII whitespace. It does
		// not -- TrimSpace uses unicode.IsSpace, which includes U+00A0. The probe
		// caught the audit's own wrong prediction, which is why the row is kept
		// rather than quietly corrected. See TestAuditR5_NBSPAndTrimSpaceBoundary
		// and TestAuditR5_NBSPIsNotAPrivilegeGain for why this is not exploitable.
		{"nbsp_lead", " ft:stage/completed", true,
			"TrimSpace is unicode-aware: a leading NBSP is trimmed, so the prefix matches"},
		{"zwsp_inside_prefix", "f​t:stage/completed", false, "zero-width space splits the prefix"},
		{"combining_after_prefix", "ft:stage/completed́", false, "combining acute changes the key"},
	}

	sawTrue, sawFalse := false, false
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stage, ok := m.authorizationStage(tc.label)
			if ok {
				sawTrue = true
			} else {
				sawFalse = true
			}
			if ok != tc.want {
				t.Errorf("authorizationStage(%q) = (%q, %v), want ok=%v\n  rationale: %s",
					tc.label, stage, ok, tc.want, tc.why)
			}
			t.Logf("MEASURED authorizationStage(%q) = (%q, %v)", tc.label, stage, ok)
		})
	}
	if !sawTrue || !sawFalse {
		t.Fatalf("VACUOUS PROBE: sawTrue=%v sawFalse=%v; a table that only ever "+
			"observes one outcome cannot distinguish a working gate from a dead one",
			sawTrue, sawFalse)
	}
}

// TestAuditR5_NBSPAndTrimSpaceBoundary isolates the one row above whose answer
// depends on a Go stdlib detail rather than on this package's logic.
//
// strings.TrimSpace uses unicode.IsSpace, which DOES include U+00A0. So a
// leading NBSP is trimmed and the label matches. That is recorded as a
// measurement: it widens what counts as "carrying the prefix" by exactly the
// set of runes unicode.IsSpace accepts. GitHub itself trims and collapses label
// whitespace, so this is not reachable as a distinct label -- but the widening
// is a property of the parse, not of GitHub, and a future non-GitHub caller
// would inherit it.
func TestAuditR5_NBSPAndTrimSpaceBoundary(t *testing.T) {
	m := mapperWithPrefix("ft:")
	for _, r := range []struct {
		name string
		s    string
	}{
		{"nbsp", " "},
		{"ideographic_space", "　"},
		{"ogham_space", " "},
		{"tab", "\t"},
		{"vertical_tab", "\v"},
	} {
		label := r.s + "ft:stage/completed"
		stage, ok := m.authorizationStage(label)
		t.Logf("MEASURED lead=%s authorizationStage = (%q, %v) [TrimSpace-equivalent=%v]",
			r.name, stage, ok, strings.TrimSpace(label) == "ft:stage/completed")
	}
}

// TestAuditR5_StripForMatchAndAuthorizationStageCannotDisagree is the charge-2
// question stated as a differential.
//
// They share matchPrefix, so the REQUIREMENT and the LOOKUP resolve the
// configured prefix identically by construction. This asserts the consequence
// that actually matters: authorizationStage(x) is true ONLY IF the raw label
// carried the prefix, and whenever it is true it returns exactly what the
// prefix-tolerant display lookup returns. Any divergence is either a bypass
// (auth accepts what display would not have keyed) or a denial-of-work bug.
func TestAuditR5_StripForMatchAndAuthorizationStageCannotDisagree(t *testing.T) {
	prefixes := []string{"ft:", "acme:", "", "x", "c", "completed", "ft:stage/", "FT:", "a-b_c:"}

	// A corpus that mixes prefixed, bare, near-miss and adversarial spellings.
	var corpus []string
	for _, s := range allStages {
		corpus = append(corpus,
			s.String(),
			"ft:stage/"+s.String(),
			"ft:"+s.String(),
			"acme:stage/"+s.String(),
			"acme:"+s.String(),
			"x"+s.String(),
			"c"+s.String(),
			strings.ToUpper("ft:stage/"+s.String()),
			"ft:ft:stage/"+s.String(),
			"  ft:stage/"+s.String()+"  ",
			"stage/"+s.String(),
		)
	}
	corpus = append(corpus, "bug", "duplicate", "wontfix", "", "ft:", "acme:", "priority:high")

	agreements, prefixRequiredDenials := 0, 0
	for _, p := range prefixes {
		m := mapperWithPrefix(p)
		want := m.matchPrefix()
		for _, raw := range corpus {
			authStage, authOK := m.authorizationStage(raw)
			displayStage, displayOK := m.labelToStage[m.stripForMatch(raw)]
			carries := strings.HasPrefix(strings.ToLower(strings.TrimSpace(raw)), want)

			if authOK && !carries {
				t.Errorf("BYPASS prefix=%q label=%q: authorizationStage returned %q for a "+
					"label that does not carry the configured prefix %q",
					p, raw, authStage, want)
			}
			if authOK && (!displayOK || authStage != displayStage) {
				t.Errorf("DIVERGENCE prefix=%q label=%q: auth=(%q,%v) display=(%q,%v); the "+
					"requirement and the lookup have drifted",
					p, raw, authStage, authOK, displayStage, displayOK)
			}
			if !authOK && displayOK && carries {
				t.Errorf("DENIAL-OF-WORK prefix=%q label=%q: display keys it to %q but "+
					"authorization refuses a label that DOES carry the prefix",
					p, raw, displayStage)
			}
			switch {
			case authOK && displayOK:
				agreements++
			case !authOK && displayOK && !carries:
				prefixRequiredDenials++
			}
		}
	}
	// Control: the sweep must have observed both outcomes, or it proves nothing.
	if agreements == 0 || prefixRequiredDenials == 0 {
		t.Fatalf("VACUOUS SWEEP: agreements=%d prefixRequiredDenials=%d",
			agreements, prefixRequiredDenials)
	}
	t.Logf("MEASURED over %d prefixes x %d labels: %d agreeing maps, %d labels the display "+
		"path keys but B6 refuses to let feed authorization",
		len(prefixes), len(corpus), agreements, prefixRequiredDenials)
}

// TestAuditR5_ConfiguredPrefixThatIsASubstringOfAStageName probes the config
// the brief singled out: a push_prefix that is itself a prefix of a stage name.
//
// With push_prefix "c", the bare stock label "completed" DOES satisfy
// HasPrefix. The question is whether the residue then keys to a stage.
func TestAuditR5_ConfiguredPrefixThatIsASubstringOfAStageName(t *testing.T) {
	for _, p := range []string{"c", "co", "com", "w", "d", "t", "a"} {
		m := mapperWithPrefix(p)
		for _, s := range allStages {
			bare := s.String()
			stage, ok := m.authorizationStage(bare)
			if ok {
				t.Errorf("PREFIX-SUBSTRING BYPASS push_prefix=%q: the bare stock label %q "+
					"authorizes as %q -- a label any triager can apply feeds an "+
					"authorization answer", p, bare, stage)
			}
		}
		// Positive control: the label this deployment actually writes must work.
		own := m.StageToLabel(task.StageCompleted)
		if _, ok := m.authorizationStage(own); !ok {
			t.Errorf("CONTROL FAILED push_prefix=%q: the mapper's own push label %q does not "+
				"authorize; the probe cannot observe an allow at this prefix", p, own)
		}
	}
}

// TestAuditR5_PathologicalPrefixConfigs measures prefixes that are not
// substrings of stage names but are pathological in other ways. Each row
// records whether the deployment's OWN labels remain authoritative -- a
// configuration under which they do not is a fail-open availability bug
// (Farm Table's own closed tasks read as live and claimable), not a privilege
// escalation, and is reported as such.
func TestAuditR5_PathologicalPrefixConfigs(t *testing.T) {
	cases := []string{
		"",           // documented: means "ft:", not "no prefix required"
		"ft:",        // default
		"acme:",      // ordinary custom
		" ",          // whitespace-only
		"  ",         // whitespace-only, wider
		"\t",         // tab
		"FT:",        // uppercase spelling of the default
		"ft:stage/",  // prefix that already contains the path segment
		"stage/",     // prefix equal to the path segment
		" ",     // NBSP
		"ft",         // no colon
		"完了:",        // non-ASCII
	}
	for _, p := range cases {
		m := mapperWithPrefix(p)
		own := m.StageToLabel(task.StageCompleted)
		stage, ok := m.authorizationStage(own)
		selfConsistent := ok && stage == task.StageCompleted

		// Does any BARE stage name authorize under this config?
		bareLeak := ""
		for _, s := range allStages {
			if st, k := m.authorizationStage(s.String()); k {
				bareLeak = fmt.Sprintf("%s->%s", s.String(), st)
				break
			}
		}

		t.Logf("MEASURED push_prefix=%q matchPrefix=%q own_label=%q authorizes=%v "+
			"self_consistent=%v bare_stock_leak=%q",
			p, m.matchPrefix(), own, ok, selfConsistent, bareLeak)

		if bareLeak != "" {
			t.Errorf("BYPASS push_prefix=%q: a bare stage-named label authorizes (%s)",
				p, bareLeak)
		}
		if !selfConsistent {
			t.Logf("FAIL-CLOSED MISCONFIG push_prefix=%q: the deployment's own push label %q "+
				"does NOT feed authorization. Farm Table's own closed tasks read as "+
				"non-terminal => available and claimable. Wrong direction is 'wrongly "+
				"available', not 'wrongly privileged'.", p, own)
		}
	}
}

// TestAuditR5_CustomStageAliasesUnderB6 measures the case the round-5 log flags
// as "not covered by B6": a deployment that configures a custom terminal alias.
func TestAuditR5_CustomStageAliasesUnderB6(t *testing.T) {
	cfg := DefaultConfig().GitHub.Labels
	cfg.PushPrefix = "ft:"
	cfg.Stages = map[string]string{
		"shipped":              "completed", // bare alias
		"ft:shipped":           "completed", // alias already carrying the prefix
		"ft:stage/rolled-back": "cancelled", // alias carrying prefix AND path segment
	}
	m := NewLabelMapper(cfg)

	for _, probe := range []string{
		"shipped", "ft:shipped", "ft:stage/shipped",
		"ft:stage/rolled-back", "ft:rolled-back", "rolled-back",
		"ft:ft:shipped",
	} {
		stage, ok := m.authorizationStage(probe)
		display, dok := m.MapLabelsToStage([]string{probe})
		t.Logf("MEASURED alias probe %-24q auth=(%q,%v) display=(%q,%v)",
			probe, stage, ok, display, dok)
	}

	// The security-relevant assertion: a BARE configured alias must not
	// authorize, exactly as a bare stock label must not.
	if stage, ok := m.authorizationStage("shipped"); ok {
		t.Errorf("BYPASS: the bare configured alias \"shipped\" authorizes as %q", stage)
	}
	// And the reachability measurement the log claims: spelling it with the
	// prefix makes it authoritative again.
	if _, ok := m.authorizationStage("ft:shipped"); !ok {
		t.Logf("MEASURED: \"ft:shipped\" does NOT authorize either. An operator following "+
			"the log's instruction to \"spell them with the prefix\" gets a config whose "+
			"terminal aliases are unreachable to authorization in BOTH spellings, because "+
			"the configured KEY %q is looked up after the prefix has been stripped.",
			"ft:shipped")
	}
}

// ── CHARGE 3: can the singular and set readers disagree? ──

// TestAuditR5_SingularAndSetReaderAgreeOnTerminalness is the differential the
// brief asks for. The claim/availability path reads the SINGULAR
// TerminalLabelStage; UpdateTask reads the SET. If they can disagree about
// terminal-ness on any label set, that is the gap.
func TestAuditR5_SingularAndSetReaderAgreeOnTerminalness(t *testing.T) {
	m := mapperWithPrefix("ft:")

	// Every subset of the four terminal labels, crossed with masking labels and
	// bare stock spellings.
	terminals := []task.Stage{
		task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled,
	}
	extras := [][]string{
		nil,
		{"bug"},
		{"ft:stage/working"},
		{"duplicate"},                    // bare stock
		{"completed", "wontfix"},         // bare stock
		{"ft:stage/working", "duplicate"}, // both
	}

	sawTerminal, sawNonTerminal := false, false
	for mask := 0; mask < 1<<len(terminals); mask++ {
		var base []string
		for i, s := range terminals {
			if mask&(1<<i) != 0 {
				base = append(base, "ft:stage/"+s.String())
			}
		}
		for _, ex := range extras {
			labels := append(append([]string(nil), base...), ex...)

			single, singleOK := m.TerminalLabelStage(labels)
			set := m.AllTerminalLabelStages(labels)

			singleSaysTerminal := singleOK && store.IsTerminalStage(single)
			setSaysTerminal := len(set) > 0

			if singleSaysTerminal {
				sawTerminal = true
			} else {
				sawNonTerminal = true
			}

			if singleSaysTerminal != setSaysTerminal {
				t.Errorf("READER DISAGREEMENT labels=%v: singular=(%q,%v)->terminal=%v  "+
					"set=%v->terminal=%v", labels, single, singleOK, singleSaysTerminal,
					set, setSaysTerminal)
			}
			// The set must always CONTAIN the singular winner, or authorization
			// could be weaker than availability.
			if singleSaysTerminal {
				found := false
				for _, s := range set {
					if s == single {
						found = true
					}
				}
				if !found {
					t.Errorf("SET OMITS THE SINGULAR WINNER labels=%v: singular=%q set=%v; "+
						"authorization could then be WEAKER than the claim path",
						labels, single, set)
				}
			}
		}
	}
	if !sawTerminal || !sawNonTerminal {
		t.Fatalf("VACUOUS: sawTerminal=%v sawNonTerminal=%v", sawTerminal, sawNonTerminal)
	}
	t.Logf("MEASURED: %d label sets, singular and set readers agree on terminal-ness on "+
		"every one, and the set always contains the singular winner",
		(1<<len(terminals))*len(extras))
}

// TestAuditR5_TheReadersDivergeExactlyWhenTheTiebreakListIsIncomplete
// demonstrates the CONDITION under which charge 3's gap opens, without
// modifying production code. It reimplements the two readers' shared scan and
// varies only the tiebreak list, showing that the agreement measured above is
// contingent on terminalStagePrecedence covering store.IsTerminalStage -- i.e.
// the answer to "is the difference exploitable?" is "not today, and the reason
// is a coincidence between two hand-maintained lists".
func TestAuditR5_TheReadersDivergeExactlyWhenTheTiebreakListIsIncomplete(t *testing.T) {
	// Fact 1: today the two lists agree.
	for _, s := range allStages {
		if !store.IsTerminalStage(s) {
			continue
		}
		inList := false
		for _, p := range terminalStagePrecedence {
			if p == s {
				inList = true
			}
		}
		if !inList {
			t.Errorf("LIVE DIVERGENCE: %q is terminal per store.IsTerminalStage but absent "+
				"from terminalStagePrecedence; TerminalLabelStage drops it while "+
				"AllTerminalLabelStages reports it", s)
		}
	}

	// Fact 2: the singular reader's fail-open is real, shown by simulating the
	// drop rather than by patching the source.
	present := map[task.Stage]bool{task.StageCancelled: true}
	shortList := []task.Stage{task.StageCompleted} // cancelled deliberately absent
	got, ok := task.Stage(""), false
	for _, s := range shortList {
		if present[s] {
			got, ok = s, true
			break
		}
	}
	if ok {
		t.Fatalf("CONTROL FAILED: the simulated short list should not have resolved")
	}
	t.Logf("MEASURED (simulated): with a terminal stage absent from the tiebreak list the "+
		"singular reader resolves to (%q,%v) = fall back to t.Stage, while the set reader "+
		"would report it. Divergence direction is WRONGLY AVAILABLE, not wrongly "+
		"privileged, because the set (authorization) is the stricter of the two.", got, ok)
}
