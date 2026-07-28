package github

import (
	"sort"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// This file MEASURES the two-labels-one-stage question that leg B raised
// against the swap path in #194 round 6, and it measures it because the
// previous answer on this seam was reasoned rather than run.
//
// THE SEAM, stated in full so nothing here reads as reassurance:
//
//	server.go charges the stronger scope only when
//	!store.SameStageSet(before, after). Both sides of that comparison are
//	SETS KEYED BY STAGE (terminal_label_stages.go:176, present map[task.Stage]bool).
//	Two DISTINCT labels that resolve to the SAME stage collapse to one element.
//	StageLabelSwap can therefore delete one of them, leave the reported set
//	byte-identical, and the gate never fires. The label is destroyed for free.
//
// My earlier "no seam" verdict walked four cases and concluded that any
// terminal label the swap removes named a stage that was in the before set and
// was therefore charged. That inference is valid. Its unstated premise —
// one label per stage — is false, and the four-case walk could not express the
// input that breaks it. Same defect class as everything else on this branch: a
// table that cannot express the cell that matters returns a clean answer.
//
// NOT FIXED HERE. The fix needs a delta over LABELS rather than resolved
// stages, which is a contract change spanning both legs' domains; it is
// sequenced to r7. What this file does is establish HOW REACHABLE the input is,
// which is the input to that sequencing decision, and pin the current behaviour
// so the r7 fix has something to turn red.

// stripForMatchSegments are the path segments stripForMatch removes AFTER the
// push prefix. They are copied from that function, and the copy is checked:
// TestStripForMatchSegments_MatchTheNormaliser fails if a segment listed here
// stops being stripped. It cannot catch a segment ADDED to stripForMatch and
// not added here — that direction would only make the corpus below smaller and
// the measured collision counts lower, so it can understate the finding but
// never invent one.
var stripForMatchSegments = []string{"", "stage/", "priority/", "priority:"}

// TestStripForMatchSegments_MatchTheNormaliser is the fidelity control for the
// corpus generator below. A generator that produced spellings the normaliser
// does not actually collapse would manufacture collisions that do not exist.
func TestStripForMatchSegments_MatchTheNormaliser(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	for _, seg := range stripForMatchSegments {
		raw := defaultPushPrefix + seg + "completed"
		if got := m.stripForMatch(raw); got != "completed" {
			t.Errorf("stripForMatch(%q) = %q, want %q: the corpus generator assumes "+
				"this segment is stripped, and it is not", raw, got, "completed")
		}
	}

	// CONTROL: a segment that is NOT stripped must survive, or the assertions
	// above are satisfied by a normaliser that reduces everything to the stage
	// name.
	if got := m.stripForMatch(defaultPushPrefix + "xstage/completed"); got == "completed" {
		t.Fatal("CONTROL BROKEN: stripForMatch collapses an unlisted segment too, so " +
			"the fidelity check above proves nothing about which segments matter")
	}
}

// authorizedSpellings returns, for one mapper, every label in the corpus that
// authorizationStage accepts, grouped by the stage it resolves to. This is the
// collision measurement: any stage with two or more entries is a stage whose
// label set can shrink without the reported stage set changing.
func authorizedSpellings(m *LabelMapper, corpus []string) map[task.Stage][]string {
	byStage := make(map[task.Stage][]string)
	for _, raw := range corpus {
		if stage, ok := m.authorizationStage(raw); ok {
			byStage[stage] = append(byStage[stage], raw)
		}
	}
	for stage := range byStage {
		sort.Strings(byStage[stage])
	}
	return byStage
}

// defaultCorpus generates the label spellings a deployment can plausibly carry
// under one prefix: every stage name, under every segment stripForMatch
// removes. It is derived from the enum and from the normaliser's own segment
// list rather than hand-picked, because a hand-picked list is how the previous
// answer on this seam went wrong.
func defaultCorpus(prefix string) []string {
	var corpus []string
	for _, s := range allStages {
		for _, seg := range stripForMatchSegments {
			corpus = append(corpus, prefix+seg+s.String())
		}
	}
	return corpus
}

// TestDefaultConfig_AdmitsTwoDistinctLabelsForOneStage answers the EM's
// question 1: does the DEFAULT config contain any two-labels-one-stage pair?
//
// MEASURED ANSWER: YES, for every one of the ten stages, with no configuration
// at all. The collision does not live in the config table — DefaultConfig ships
// an EMPTY Stages map, which the companion test below pins. It lives in
// stripForMatch, which is many-to-one by construction: it strips an optional
// path segment, so "ft:completed" and "ft:stage/completed" are two distinct
// GitHub labels that authorizationStage resolves to the identical stage.
//
// That distinction matters for severity and the two readings give opposite
// answers, so both are recorded:
//
//	configured-alias collisions in the default config: NONE (config-gated)
//	spelling collisions in the default config:         ALL TEN STAGES (out of the box)
//
// And the pair is not exotic. StageToLabel WRITES the "stage/" spelling, while
// the shorter one is what an operator hand-applies and what round 5's own
// remediation prose used. A repository can hold both without anyone doing
// anything unusual.
func TestDefaultConfig_AdmitsTwoDistinctLabelsForOneStage(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)
	byStage := authorizedSpellings(m, defaultCorpus(defaultPushPrefix))

	if len(byStage) != len(allStages) {
		t.Fatalf("CONTROL BROKEN: %d of %d stages are reachable at all under the "+
			"default config; the corpus is not exercising what it claims to",
			len(byStage), len(allStages))
	}

	collided := 0
	for _, s := range allStages {
		spellings := byStage[s]
		t.Logf("%-12s %d authorized spellings: %v", s, len(spellings), spellings)
		if len(spellings) >= 2 {
			collided++
		}
	}

	if collided == 0 {
		t.Error("no stage has two distinct authorized spellings under the default " +
			"config. If this is now true the seam is config-gated after all and the " +
			"r7 severity assessment needs revisiting.")
	}
	if collided != len(allStages) {
		t.Errorf("%d of %d stages collide; the measurement recorded for the EM was "+
			"ALL of them, so something narrowed the normaliser", collided, len(allStages))
	}

	// CONTROLS. Without these the grouping above is satisfied by an
	// authorizationStage that accepts everything, which would make every stage
	// collide for a reason that has nothing to do with stripForMatch.
	if _, ok := m.authorizationStage("completed"); ok {
		t.Error("CONTROL BROKEN: an unprefixed label authorizes, so B6 is not in " +
			"force and the collision counts above measure the wrong thing")
	}
	if _, ok := m.authorizationStage(defaultPushPrefix + "xstage/completed"); ok {
		t.Error("CONTROL BROKEN: a prefixed label with an unstripped segment " +
			"authorizes, so the corpus is not measuring segment collapse")
	}
}

// TestDefaultConfig_ShipsNoConfiguredStageAliases is the narrow half of
// question 1, kept separate from the broad half above because conflating them
// is how a severity gets miscapped in either direction.
func TestDefaultConfig_ShipsNoConfiguredStageAliases(t *testing.T) {
	cfg := DefaultConfig().GitHub.Labels

	if len(cfg.Stages) != 0 {
		t.Errorf("DefaultConfig ships %d stage aliases (%v); the record says the "+
			"default alias table is empty and the alias route to the seam is "+
			"config-gated", len(cfg.Stages), cfg.Stages)
	}
	if len(cfg.Priorities) != 0 || len(cfg.Types) != 0 {
		t.Errorf("DefaultConfig ships non-empty priority/type alias tables "+
			"(%v / %v)", cfg.Priorities, cfg.Types)
	}
}

// TestSpellingCollision_IsInvisibleToTheStageSetGate runs the seam end to end
// at the level this leg owns, on the cheapest input in the corpus above.
//
// It ASSERTS THE DEFECTIVE BEHAVIOUR ON PURPOSE. When r7 lands a label-level
// delta this test goes red, and that is the point: the pin exists so the fix
// cannot land silently and so nobody re-derives "the swap path is gated" from
// a passing suite.
func TestSpellingCollision_IsInvisibleToTheStageSetGate(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	// Two distinct GitHub labels. Both carry the prefix, so both are ours and
	// both are authoritative to the reader. They name one stage.
	labels := []string{"ft:completed", "ft:stage/completed"}

	if a, okA := m.authorizationStage(labels[0]); !okA || a != task.StageCompleted {
		t.Fatalf("setup: authorizationStage(%q) = (%q, %v), want (completed, true)", labels[0], a, okA)
	}
	if b, okB := m.authorizationStage(labels[1]); !okB || b != task.StageCompleted {
		t.Fatalf("setup: authorizationStage(%q) = (%q, %v), want (completed, true)", labels[1], b, okB)
	}

	before := m.AllTerminalLabelStages(labels)
	add, remove := m.StageLabelSwap(labels, task.StageCompleted)
	after := m.AllTerminalLabelStages(applyLabelDelta(labels, add, remove))

	if len(remove) == 0 {
		t.Fatalf("StageLabelSwap removed nothing (add=%v); without a destructive "+
			"edit there is no seam to measure here", add)
	}
	t.Logf("no-op stage update on %v: add=%v remove=%v before=%v after=%v",
		labels, add, remove, before, after)

	if !store.SameStageSet(before, after) {
		t.Errorf("before=%v after=%v are no longer the same stage set. If a fix "+
			"landed, delete this pin and say so in the log — but do not leave the "+
			"round-6 log claiming the swap path was gated, because it was not.",
			before, after)
	}

	// The harm, spelled out as an assertion rather than a comment: the label the
	// swap deleted was one the READER counts. This is not a stock third-party
	// label surviving A5; it is one of our own, destroyed under a task:write
	// charge because the gate compares stages and the edit is over labels.
	for _, gone := range remove {
		if _, ours := m.authorizationStage(gone); !ours {
			t.Errorf("removed %q, which is not authoritative; A5 should have stopped "+
				"that and this test is measuring the wrong destruction", gone)
		}
	}

	// CONTROL: the same machinery on two labels naming DIFFERENT stages. The
	// gate must see this one, or SameStageSet above is true for a trivial
	// reason and proves nothing about the collapse.
	mixed := []string{"ft:stage/completed", "ft:stage/duplicate"}
	mBefore := m.AllTerminalLabelStages(mixed)
	mAdd, mRemove := m.StageLabelSwap(mixed, task.StageDuplicate)
	mAfter := m.AllTerminalLabelStages(applyLabelDelta(mixed, mAdd, mRemove))
	if store.SameStageSet(mBefore, mAfter) {
		t.Fatalf("CONTROL BROKEN: before=%v after=%v compare equal even when the "+
			"stage set really changed, so SameStageSet is not discriminating and "+
			"the finding above is unattributable", mBefore, mAfter)
	}
}

// githubConfigWith wraps a LabelConfig so Validate can be called on it. The
// GitHub field is an anonymous struct, which is unpleasant to build inline.
func githubConfigWith(labels LabelConfig) *GitHubConfig {
	cfg := DefaultConfig()
	cfg.GitHub.Labels = labels
	return cfg
}

// TestAliasKeyNormalisation_CollapsesDistinctKeys is M2 in its sharper form,
// and it is the one that came back YES.
//
// The question is not whether an alias collides with the built-in spellings of
// its target — it always does, by design. It is whether A3's normalisation
// makes TWO CONFIG KEYS that the operator wrote as distinct become the same map
// key. They do: stripForMatch is many-to-one, so "shipped", "ft:shipped" and
// "ft:stage/shipped" are three keys before A3 and ONE key after.
//
// When the two keys name the same stage that is a harmless dedup. When they
// name DIFFERENT stages the surviving entry is chosen by Go's randomised map
// iteration in NewLabelMapper, so one unchanged config resolves one unchanged
// label to different stages in different processes — at an authorization gate.
//
// PRE-A3 THIS WAS DETERMINISTIC, which is the uncomfortable part: the keys were
// stored verbatim, so only the unprefixed one was ever reachable and it won
// every time. A3 fixes a dead alias and, in this narrow config shape, trades
// determinism for it. Recorded rather than papered over, per the EM's
// instruction, and mitigated in NewLabelMapper by iterating in sorted key
// order — see the comment there. Mitigation, not a fix: a deterministic
// arbitrary winner is still a winner the operator did not choose, which is why
// Validate now rejects the config outright.
func TestAliasKeyNormalisation_CollapsesDistinctKeys(t *testing.T) {
	t.Run("same_target_is_a_harmless_dedup", func(t *testing.T) {
		cfg := DefaultConfig().GitHub.Labels
		cfg.Stages = map[string]string{
			"shipped":          "completed",
			"ft:shipped":       "completed",
			"ft:stage/shipped": "completed",
		}
		if err := githubConfigWith(cfg).Validate(); err != nil {
			t.Errorf("Validate rejected three keys that all name the SAME stage: %v.\n"+
				"Collapsing those loses nothing — the operator gets the alias they "+
				"asked for either way — and rejecting them would be a false positive.", err)
		}

		m := NewLabelMapper(cfg)
		stage, ok := m.authorizationStage("ft:shipped")
		if !ok || stage != task.StageCompleted {
			t.Errorf("authorizationStage(ft:shipped) = (%q, %v), want (completed, true)", stage, ok)
		}
	})

	t.Run("conflicting_targets_collapse_to_one_entry", func(t *testing.T) {
		cfg := DefaultConfig().GitHub.Labels
		cfg.Stages = map[string]string{
			"shipped":    "completed",
			"ft:shipped": "wont_fix",
		}

		// The collapse itself, measured: two keys in, one entry out.
		m := NewLabelMapper(cfg)
		normalised := map[string]bool{}
		for key := range cfg.Stages {
			normalised[m.stripForMatch(key)] = true
		}
		if len(normalised) != 1 {
			t.Fatalf("the two keys normalise to %d distinct keys (%v), want 1; this "+
				"case no longer models the collision", len(normalised), normalised)
		}

		// A3's cost. Both stages are terminal, so whichever wins is an
		// authorization answer, and it is decided by map iteration order.
		winners := map[task.Stage]int{}
		for i := 0; i < 500; i++ {
			if stage, ok := NewLabelMapper(cfg).authorizationStage("ft:shipped"); ok {
				winners[stage]++
			}
		}
		t.Logf("500 mappers from ONE unchanged config: ft:shipped resolved as %v", winners)

		if len(winners) != 1 {
			t.Errorf("NONDETERMINISTIC: %v. Sorted-key iteration in NewLabelMapper is "+
				"supposed to make the arbitrary winner at least reproducible.", winners)
		}

		// And the loud half: an operator who wrote two conflicting aliases must
		// be told, not silently given one of them.
		err := githubConfigWith(cfg).Validate()
		if err == nil {
			t.Fatal("Validate accepted two alias keys that normalise to one key with " +
				"DIFFERENT stages. One of them is silently discarded, and which one is " +
				"not the operator's choice.")
		}
		for _, want := range []string{"shipped", "completed", "wont_fix"} {
			if !strings.Contains(err.Error(), want) {
				t.Errorf("Validate error %q does not name %q; an operator cannot act "+
					"on a diagnostic that does not identify the colliding keys", err, want)
			}
		}
	})

	t.Run("control_distinct_aliases_are_untouched", func(t *testing.T) {
		cfg := DefaultConfig().GitHub.Labels
		cfg.Stages = map[string]string{
			"shipped": "completed",
			"binned":  "wont_fix",
		}
		if err := githubConfigWith(cfg).Validate(); err != nil {
			t.Fatalf("CONTROL BROKEN: Validate rejected two aliases that do not "+
				"collide at all (%v); the rejection above is not attributable to the "+
				"collision", err)
		}
		m := NewLabelMapper(cfg)
		if stage, ok := m.authorizationStage("ft:shipped"); !ok || stage != task.StageCompleted {
			t.Errorf("ft:shipped = (%q, %v), want completed", stage, ok)
		}
		if stage, ok := m.authorizationStage("ft:binned"); !ok || stage != task.StageWontFix {
			t.Errorf("ft:binned = (%q, %v), want wont_fix", stage, ok)
		}
	})
}

// preA3KeyRule replicates the alias-key rule in force at ea8ac39, before A3:
// the configured key was lowercased and stored VERBATIM, while every lookup
// went through stripForMatch. That mismatch is what made a prefixed key dead.
//
// It is applied by rebuilding the alias entries on a live mapper rather than by
// reasoning about the old code, so the comparison below is a measurement of two
// rules and not a recollection of one.
func preA3KeyRule(cfg LabelConfig) *LabelMapper {
	m := NewLabelMapper(cfg)
	for label, stageStr := range cfg.Stages {
		stage := task.Stage(stageStr)
		if err := task.StageValidator(stage); err != nil {
			continue
		}
		delete(m.labelToStage, m.stripForMatch(label))
		m.labelToStage[strings.ToLower(label)] = stage
	}
	return m
}

// TestAliasKeyNormalisation_WidensTheCollisionForPrefixedKeysOnly answers the
// EM's question 2: does A3's alias-key normalisation make the seam MORE
// reachable?
//
// MEASURED ANSWER: yes, but for exactly one population, and the population is
// the one round 5 created.
//
//	key "shipped"     -> alias live BEFORE A3 and after. A3 changes nothing.
//	key "ft:shipped"  -> alias DEAD before A3, LIVE after.
//
// An alias always collides with the built-in spellings of its target stage —
// that is what an alias IS, and it is intended. So A3 does not create the
// collision class. What it does is revive the aliases of operators who wrote
// the key WITH the prefix, which is precisely what round 5's remediation text
// told them to write. Those deployments had a dead alias and now have a live
// one, and a live alias is one more label resolving onto one stage.
//
// Stated the other way, because this is the part that must not be soft: A3 is
// still the right fix — a silently dead alias is worse than a live one — but it
// does hand the r7 seam additional reachable inputs, and the r6 log must not
// claim otherwise.
func TestAliasKeyNormalisation_WidensTheCollisionForPrefixedKeysOnly(t *testing.T) {
	cases := []struct {
		name       string
		key        string
		liveBefore bool
	}{
		{
			name: "bare_key", key: "shipped", liveBefore: true,
			// Stored lowercased as "shipped"; lookups strip to "shipped". Hit
			// under both rules, so A3 is neutral here.
		},
		{
			name: "prefixed_key", key: "ft:shipped", liveBefore: false,
			// Stored verbatim as "ft:shipped" pre-A3; lookups strip to
			// "shipped". Never hit. This is the spelling round 5 published.
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := DefaultConfig().GitHub.Labels
			cfg.Stages = map[string]string{tc.key: "completed"}

			// The label an operator would actually apply on GitHub. It must carry
			// the prefix under B6 regardless of how the KEY is spelled.
			const aliasLabel = "ft:shipped"

			old := preA3KeyRule(cfg)
			_, wasLive := old.authorizationStage(aliasLabel)
			if wasLive != tc.liveBefore {
				t.Fatalf("pre-A3 replica: alias %q with key %q live = %v, want %v. "+
					"The replica no longer models ea8ac39, so the comparison below "+
					"is not a measurement of the change.", aliasLabel, tc.key, wasLive, tc.liveBefore)
			}

			now := NewLabelMapper(cfg)
			stage, isLive := now.authorizationStage(aliasLabel)
			if !isLive || stage != task.StageCompleted {
				t.Fatalf("post-A3: alias %q with key %q = (%q, %v), want (completed, true); "+
					"A3's whole point is that both key spellings work",
					aliasLabel, tc.key, stage, isLive)
			}

			// The reachability delta, counted rather than described.
			corpus := append(defaultCorpus(defaultPushPrefix), aliasLabel)
			oldCount := len(authorizedSpellings(old, corpus)[task.StageCompleted])
			newCount := len(authorizedSpellings(now, corpus)[task.StageCompleted])

			t.Logf("key %-11q labels resolving to completed: pre-A3 %d, post-A3 %d",
				tc.key, oldCount, newCount)

			if tc.liveBefore {
				if newCount != oldCount {
					t.Errorf("key %q: count moved %d -> %d, but this key spelling was "+
						"already live and A3 should be neutral for it", tc.key, oldCount, newCount)
				}
			} else if newCount != oldCount+1 {
				t.Errorf("key %q: count moved %d -> %d, want exactly one more; A3's "+
					"widening should be one revived alias and nothing else",
					tc.key, oldCount, newCount)
			}

			// Either way the END STATE collides, which is the fact r7 needs: an
			// alias plus the built-in spellings is always two-labels-one-stage.
			if newCount < 2 {
				t.Errorf("key %q: only %d labels resolve to completed post-A3; an "+
					"alias is supposed to sit alongside the built-in spellings",
					tc.key, newCount)
			}
		})
	}
}
