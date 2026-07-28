package server_test

import (
	"fmt"
	"testing"

	ghplatform "github.com/farmtable-io/farmtable/internal/platform/github"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// ── #194 round 10: the label-write price must not depend on today's config ──
//
// WHY THIS IS A MATRIX AND NOT AN END-TO-END ASSERTION.
//
// The control under test is inert in production for TWO independent reasons,
// so a single "the write was refused" observation is uninterpretable:
//
//	arm 1  the config. A label the config does not recognise is priced at
//	       nothing. That is the bug this round fixes.
//	arm 2  the credential. RequireScope treats an EMPTY scope set as a wildcard
//	       (scopes.go:83-85), and in production essentially all traffic carries
//	       an empty-scoped token. A bare task:write holder — the population this
//	       control protects — may currently be of size zero.
//
// Fix arm 1 while arm 2 stands and nothing observable changes. So every row
// below is run against TWO principals, and the wildcard principal is a
// POSITIVE CONTROL: it proves the write is otherwise well-formed and would
// have landed, so a refusal in the narrow column is caused by the SCOPE and
// not by a broken fixture, an unparseable label or a mock that rejects
// everything. Without that column, "refused" and "broken" are the same
// observation — which is how this workstream has fooled itself before.
//
//	                     | wildcard principal | narrow principal (task:write) |
//	  config recognises  | ALLOWED (control)  | REFUSED                       |
//	  config does NOT    | ALLOWED (control)  | REFUSED  <-- THE FALSIFYING   |
//	                     |                    |              CELL             |
//
// THE FALSIFYING CELL IS THE BOTTOM RIGHT: a narrow-scoped principal writing a
// lifecycle label that TODAY'S config does not recognise. Before round 10 that
// cell ALLOWED the write, because the price collapsed to nothing. It is the
// only cell that can fail if the fix is wrong; the top row passes both before
// and after, and the wildcard column passes by construction.
//
// "Does not recognise" is instantiated three ways, because the round-9 audit
// measured three independent config axes that each produce the identical
// defect and only one of them is the enabled toggle. See configBlindAxes.

// wildcardPrincipal is the empty scope set: RequireScope's wildcard. This is
// the positive control, not a test of the wildcard behaviour itself.
var wildcardPrincipal = []string{}

// narrowPrincipal holds task:write and nothing that could pay for a lifecycle
// transition. Constructed in-process and deliberately NOT read from any token
// table: the coordinator measured that the only narrow-scoped token in
// production has never been used, so depending on one would make this suite
// assert against a population of size zero.
var narrowPrincipal = []string{server.ScopeTaskRead, server.ScopeTaskWrite}

// configBlindAxes are the ways a deployment's config can fail to recognise a
// label that is nonetheless a lifecycle stage assertion.
//
// Each supplies a config mutation and a label to write under it. In every case
// the label either IS authoritative under some other configuration this same
// deployment might adopt, or becomes authoritative when the toggle flips —
// with nothing re-pricing the labels already written.
type configBlindAxis struct {
	name    string
	mutate  func(*ghplatform.GitHubConfig)
	label   string
	rescues string // what makes this label authoritative under another config
}

func configBlindAxes() []configBlindAxis {
	return []configBlindAxis{
		{
			name:    "axis0_recognised_today",
			mutate:  func(cfg *ghplatform.GitHubConfig) {},
			label:   "ft:stage/completed",
			rescues: "recognised today — this is the TOP row, the sanity check that the matrix can charge at all",
		},
		{
			name:    "axis1_enabled_false",
			mutate:  func(cfg *ghplatform.GitHubConfig) { cfg.GitHub.Labels.Enabled = false },
			label:   "ft:stage/completed",
			rescues: "github.labels.enabled flipping to true",
		},
		{
			name:    "axis2_foreign_push_prefix",
			mutate:  func(cfg *ghplatform.GitHubConfig) {},
			label:   "ft2:stage/completed",
			rescues: "push_prefix changing from \"ft:\" to \"ft2:\"",
		},
		{
			name: "axis2_foreign_prefix_and_disabled",
			mutate: func(cfg *ghplatform.GitHubConfig) {
				cfg.GitHub.Labels.Enabled = false
			},
			label:   "ft2:stage/completed",
			rescues: "push_prefix changing AND the toggle flipping — the two axes composed",
		},
		{
			name: "axis3_configured_alias_while_disabled",
			mutate: func(cfg *ghplatform.GitHubConfig) {
				cfg.GitHub.Labels.Enabled = false
				cfg.GitHub.Labels.Stages = map[string]string{"shipped": "completed"}
			},
			label:   "ft:shipped",
			rescues: "the toggle flipping, with an alias the operator has ALREADY configured",
		},
	}
}

// TestLabelWriteScope_IsBlindToTodaysConfig is the four-cell matrix, run once
// per config axis.
//
// The write under test is the same in every cell: add a label asserting the
// terminal stage "completed" to an OPEN issue sitting at "accepted". Under a
// config that recognises the label that is accepted -> completed, which
// TransitionScope prices at task:close. The narrow principal cannot pay it.
func TestLabelWriteScope_IsBlindToTodaysConfig(t *testing.T) {
	var (
		executed     int
		narrowCells  int
		refusedCells int
	)

	for _, axis := range configBlindAxes() {
		for _, principal := range []struct {
			name        string
			scopes      []string
			wantAllowed bool
		}{
			{"wildcard_positive_control", wildcardPrincipal, true},
			{"narrow_task_write", narrowPrincipal, false},
		} {
			t.Run(axis.name+"/"+principal.name, func(t *testing.T) {
				executed++
				if !principal.wantAllowed {
					narrowCells++
				}

				f := newLabelWriteFixtureWithConfig(t, axis.mutate, "OPEN", "")

				// THE CONTROL HAS TO BE ABLE TO WRITE THE LABEL (#194 round 11,
				// B6a). The GraphQL mock resolves label names through a node-ID
				// index and silently drops anything not in it, so "ft2:stage/
				// completed" and "ft:shipped" were unwritable by construction.
				// Both principals get the same registration, because a control
				// that differs from the cell it controls for is not a control.
				f.issue.registerLabel(axis.label)

				err := f.addLabels(principal.scopes, axis.label)

				if principal.wantAllowed {
					if err != nil {
						t.Fatalf("POSITIVE CONTROL FAILED for axis %q: the wildcard principal "+
							"could not add %q either, so a refusal in the narrow cell would "+
							"prove nothing about scope. Fix the fixture before reading the "+
							"narrow cell. err=%v",
							axis.name, axis.label, err)
					}
					// AND THE WRITE MUST HAVE LANDED. `err == nil` alone is
					// satisfied by an UpdateTask that authorized fine and then
					// wrote nothing, which is precisely the state this fixture
					// was in for 3 of the 5 axes: the control certified that
					// the narrow cell's refusal was about scope, on the
					// strength of a write that never happened.
					if got := f.issue.currentLabels(); !containsLabelFold(got, axis.label) {
						t.Fatalf("POSITIVE CONTROL IS HOLLOW for axis %q: the wildcard principal's "+
							"UpdateTask returned no error and %q is NOT on the issue; labels now "+
							"%v. The control's whole job is to prove the write is otherwise "+
							"well-formed and would have landed. It cannot do that for a write "+
							"that did not land, and the narrow cell below it is then "+
							"uninterpretable.", axis.name, axis.label, got)
					}
					return
				}

				if err == nil {
					t.Fatalf("FALSIFYING CELL FAILED for axis %q: a principal holding only %v "+
						"added %q to an OPEN issue at stage %q and was CHARGED NOTHING. "+
						"That label is a lifecycle stage assertion under another "+
						"configuration this deployment might adopt (%s), and nothing "+
						"re-prices a label once it is written. The write side must be "+
						"priced against what a label could EVER mean, not against what "+
						"today's config says it means (#194 round 10, Ruling 1).",
						axis.name, narrowPrincipal, axis.label, task.StageAccepted, axis.rescues)
				}
				refusedCells++
				requireDeniedFor(t, err, server.ScopeTaskClose,
					fmt.Sprintf("adding %q under axis %q", axis.label, axis.name))

				// A denial that still wrote the label would be worse than no
				// denial at all: the caller is told no and the privilege change
				// happens anyway. Cheap to check now that the label is
				// writable, and impossible to check before.
				if got := f.issue.currentLabels(); containsLabelFold(got, axis.label) {
					t.Fatalf("axis %q: the narrow principal was DENIED and %q is on the issue "+
						"anyway; labels now %v", axis.name, axis.label, got)
				}
			})
		}
	}

	// The tables above are data, and data can be emptied by an edit that looks
	// like a cleanup. These counters make that edit fail loudly instead of
	// turning the whole matrix into a green no-op (#194 round 10, C3).
	if want := 2 * len(configBlindAxes()); executed != want {
		t.Fatalf("SWEEP BROKEN: executed %d cells, want %d (2 principals x %d axes). "+
			"The matrix did not run the grid it claims to run",
			executed, want, len(configBlindAxes()))
	}
	if narrowCells == 0 || refusedCells != narrowCells {
		t.Fatalf("VACUOUS: %d narrow-principal cells ran and %d of them refused. "+
			"Every narrow cell must be refused, and there must be at least one, "+
			"or this test cannot report its own disappearance",
			narrowCells, refusedCells)
	}
}

// TestLabelWriteScope_PriorityAndTypeAxesDoNotPriceStages records what round 10
// did about the two LabelConfig fields the audit did NOT measure.
//
// Priorities and Types cannot make a label name a STAGE, and a stage is the
// only thing TransitionScope prices. So the correct behaviour is that a
// priority or type label costs task:write and no more — charging task:close for
// a triage edit would be a denial of legitimate work, which this workstream
// treats as a bug of the same severity as an underpriced write.
//
// This is a NEGATIVE claim ("these labels are not priced"), so it carries its
// own positive control: the same principal, the same fixture and the same call
// DOES get refused for a stage label. Without that row, a fixture that refused
// nothing would pass.
func TestLabelWriteScope_PriorityAndTypeAxesDoNotPriceStages(t *testing.T) {
	cases := []struct {
		name       string
		mutate     func(*ghplatform.GitHubConfig)
		label      string
		wantDenied bool
	}{
		{
			name:       "priority_label_is_free",
			mutate:     func(cfg *ghplatform.GitHubConfig) { cfg.GitHub.Labels.Enabled = false },
			label:      "priority:high",
			wantDenied: false,
		},
		{
			name:       "type_label_is_free",
			mutate:     func(cfg *ghplatform.GitHubConfig) { cfg.GitHub.Labels.Enabled = false },
			label:      "bug",
			wantDenied: false,
		},
		{
			name:       "unrelated_label_is_free",
			mutate:     func(cfg *ghplatform.GitHubConfig) { cfg.GitHub.Labels.Enabled = false },
			label:      "needs-triage",
			wantDenied: false,
		},

		// ── THE ROWS THAT CAN ACTUALLY FAIL (#194 round 11) ──
		//
		// The three rows above cannot fail for the reason this test exists.
		// "priority:high", "bug" and "needs-triage" have no stage name in them
		// at all, so no plausible widening of the claim predicate reaches them;
		// they were green against round 10's predicate too, which denied four
		// measured labels of ordinary work.
		//
		// A denial-of-legitimate-work pin has to carry the shape that gets
		// denied: a FOREIGN NAMESPACE whose tail is an English word that is
		// also a Farm Table stage name. These four are the exact labels round
		// 10 broke, MEASURED at 6d8f19e against a task:write holder — all four
		// DENIED task:close, all four allowed at base and allowed here.
		//
		// They are not hypothetical spellings. "status:duplicate" and
		// "release:completed" are ordinary GitHub project conventions, and
		// "release:" is itself a legal push_prefix, which is why no predicate
		// can price "ft2:completed" and free "release:completed" — see the
		// axis-2 residue table in lifecycle_claim.go.
		{
			name:       "foreign_namespace_status_duplicate_is_free",
			mutate:     func(cfg *ghplatform.GitHubConfig) {},
			label:      "status:duplicate",
			wantDenied: false,
		},
		{
			name:       "foreign_namespace_kanban_working_is_free",
			mutate:     func(cfg *ghplatform.GitHubConfig) {},
			label:      "kanban:working",
			wantDenied: false,
		},
		{
			name:       "foreign_namespace_release_completed_is_free",
			mutate:     func(cfg *ghplatform.GitHubConfig) {},
			label:      "release:completed",
			wantDenied: false,
		},
		{
			name:       "foreign_namespace_epic_cancelled_is_free",
			mutate:     func(cfg *ghplatform.GitHubConfig) {},
			label:      "epic:cancelled",
			wantDenied: false,
		},
		{
			name:       "slash_namespace_area_duplicate_is_free",
			mutate:     func(cfg *ghplatform.GitHubConfig) {},
			label:      "area/duplicate",
			wantDenied: false,
		},
		{
			// The same shape with the toggle off, because a predicate that
			// ignores the toggle is exactly what this round installed and the
			// free rows have to hold on both sides of it.
			name:       "foreign_namespace_while_disabled_is_free",
			mutate:     func(cfg *ghplatform.GitHubConfig) { cfg.GitHub.Labels.Enabled = false },
			label:      "status:duplicate",
			wantDenied: false,
		},

		// SECOND POSITIVE CONTROL, one character away from the free rows above.
		// "notastage/completed" is free and "ft-stage/completed" is charged;
		// the only difference is whether the "stage/" marker sits at a segment
		// boundary. Without this row the free rows are consistent with a
		// predicate that simply stopped charging for anything namespaced.
		{
			name:       "marker_at_a_boundary_is_charged_positive_control",
			mutate:     func(cfg *ghplatform.GitHubConfig) {},
			label:      "ft-stage/completed",
			wantDenied: true,
		},
		{
			name:       "marker_not_at_a_boundary_is_free",
			mutate:     func(cfg *ghplatform.GitHubConfig) {},
			label:      "notastage/completed",
			wantDenied: false,
		},
		{
			// POSITIVE CONTROL. Same principal, same fixture, same call.
			name:       "stage_label_is_charged_positive_control",
			mutate:     func(cfg *ghplatform.GitHubConfig) { cfg.GitHub.Labels.Enabled = false },
			label:      "ft:stage/completed",
			wantDenied: true,
		},
	}

	sawFree, sawDenied := 0, 0
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newLabelWriteFixtureWithConfig(t, tc.mutate, "OPEN", "")
			f.issue.registerLabel(tc.label)
			err := f.addLabels(narrowPrincipal, tc.label)

			if tc.wantDenied {
				sawDenied++
				if err == nil {
					t.Fatalf("POSITIVE CONTROL FAILED: %q was not charged, so the "+
						"\"free\" rows above prove nothing — a fixture that refuses "+
						"nothing would pass them all", tc.label)
				}
				requireDeniedFor(t, err, server.ScopeTaskClose, "adding "+tc.label)
				return
			}

			sawFree++
			if err != nil {
				t.Fatalf("DENIAL OF LEGITIMATE WORK: %q carries no lifecycle stage claim — "+
					"either it names no stage at all, or its stage name sits behind no "+
					"recognised \"stage/\" marker and so is an ordinary namespaced label "+
					"such as any GitHub project uses — so a task:write holder must be able "+
					"to write it. The claim predicate has widened too far; this is the "+
					"round-10 failure, which denied four measured labels of ordinary work. "+
					"err=%v", tc.label, err)
			}
			// "Free" has to mean the write HAPPENED, not that it was waved
			// through and then dropped. Without this the free rows would pass
			// against a store that silently discarded every label (B6a).
			if got := f.issue.currentLabels(); !containsLabelFold(got, tc.label) {
				t.Fatalf("%q was not denied and did not land either; labels now %v. A row "+
					"that asserts a write is free must first show that the write occurs",
					tc.label, got)
			}
		})
	}

	if sawFree == 0 || sawDenied == 0 {
		t.Fatalf("VACUOUS: %d free rows and %d charged rows ran. This test is only "+
			"meaningful with at least one of each", sawFree, sawDenied)
	}
}
