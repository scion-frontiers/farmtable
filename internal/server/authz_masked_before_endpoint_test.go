package server_test

import (
	"testing"

	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// ── #194 round 11: the label already on the issue must not discount the write ──
//
// THE DEFECT THIS PINS, stated as a price rather than as a mechanism.
//
// The gate charges for a DIFFERENCE between two endpoints. Round 10 widened the
// lifecycle predicate to close a fail-open gap on the AFTER endpoint and applied
// the same widening to BEFORE, where it did the opposite of what was intended:
// a label the deployment does not honour started counting as the state the
// caller was transitioning FROM, the two endpoints collapsed onto each other,
// and the write cost nothing.
//
// MEASURED at round-10 HEAD 6d8f19e, narrow principal {task:read, task:write},
// DefaultConfig, toggle ON, no config change, OPEN issue at accepted:
//
//	labels already present        add_labels             base    r10    here
//	[duplicate]                   ft:stage/duplicate     DENIED  FREE   DENIED
//	[completed]                   ft:stage/completed     DENIED  FREE   DENIED
//	[ft2:stage/wont_fix]          ft:stage/wont_fix      DENIED  FREE   DENIED
//	[]                            ft:stage/duplicate     DENIED  DENIED DENIED
//	[needs-triage]                ft:stage/duplicate     DENIED  DENIED DENIED
//
// "duplicate" is stock GitHub. It exists in every new repository, GitHub's own
// "mark as duplicate" flow applies it, and the read side does not render it as
// a lifecycle label — so the masking step cost an attacker nothing, required no
// privilege, and was invisible in the UI. Plant it, then close the task for
// free.
//
// THIS IS ALSO THE ROUND-4 SEAM, AND THAT IS WHY IT LIVES IN ITS OWN FILE.
//
// Round 4 established that a stock GitHub label must not decide a Farm Table
// privilege question, and enforced it with the push_prefix requirement in
// authorizationStage. Round 11's brief asked whether making the write claim
// delimiter-agnostic conflicts with that. It does not: the claim governs the
// WRITE side, where claiming more only ever refuses a write, and refusing is
// not deciding a privilege question in anyone's favour.
//
// But the seam was ALREADY BROKEN at round-10 HEAD by a mechanism the audit did
// not name. canonicalLifecycleLabels rewrote a label the deployment does not
// honour into the local authoritative spelling and handed the result to the
// read predicate — laundering a mere CLAIM into AUTHORITY, on the endpoint that
// decides how much the caller owes. The prefix requirement was intact and
// bypassed. The rows below are the regression pin for both readings at once.
//
// THE READ SIDE MUST NOT MOVE. Every row asserts that the stock label is still
// not authoritative for display and availability — because the tempting fix for
// the price is to make the read side honour more labels, and that would take
// tasks out of `ft ready` on the strength of a label a drive-by contributor can
// apply.

func TestUpdateTask_APresentLabelCannotDiscountALifecycleWrite(t *testing.T) {
	rows := []struct {
		name    string
		present []string
		add     string
		why     string
	}{
		{
			name:    "stock_github_duplicate_masks_nothing",
			present: []string{"duplicate"},
			add:     "ft:stage/duplicate",
			why: "THE CRITICAL as reported. Stock GitHub label, applied by GitHub's own " +
				"\"mark as duplicate\" flow, present in every new repository.",
		},
		{
			name:    "bare_english_stage_name_masks_nothing",
			present: []string{"completed"},
			add:     "ft:stage/completed",
			why: "Stage names are ordinary English words. A repository using \"completed\" " +
				"as a plain workflow label hands the same discount to anyone.",
		},
		{
			name:    "foreign_prefix_does_not_launder_into_local",
			present: []string{"ft2:stage/wont_fix"},
			add:     "ft:stage/wont_fix",
			why: "The upgrade path: plant a spelling this deployment does not honour, " +
				"then restamp it in the local spelling for free. This is the row that " +
				"shows canonicalisation reaching the BEFORE endpoint, not just a " +
				"coincidence about bare words.",
		},
		{
			name:    "control_nothing_present",
			present: nil,
			add:     "ft:stage/duplicate",
			why:     "CONTROL. Priced at base and at round-10 HEAD; must stay priced.",
		},
		{
			name:    "control_ordinary_label_present",
			present: []string{"needs-triage"},
			add:     "ft:stage/duplicate",
			why: "CONTROL. A non-lifecycle label present on the issue must not change " +
				"the price either way. Separates \"the fix stopped the discount\" from " +
				"\"the fix stopped reading t.Labels at all\".",
		},
	}

	executed := 0
	for _, row := range rows {
		t.Run(row.name, func(t *testing.T) {
			executed++

			f := newLabelWriteFixture(t, "OPEN", "", row.present...)
			f.issue.registerLabel(row.add)

			// BASELINE. The masking label must not already have made the task
			// terminal, or the discount below would be a correct price for a
			// state that really did exist.
			if got := f.lifecycleStages(t); containsStage(got, task.StageDuplicate) ||
				containsStage(got, task.StageCompleted) || containsStage(got, task.StageWontFix) {
				t.Fatalf("BASELINE BROKEN: with %v present the task already names a terminal "+
					"stage (%v). The read side has started honouring a label round 4 says it "+
					"must not, and this row can no longer measure a discount", row.present, got)
			}
			if avail := f.availability(t); !avail.Available {
				t.Fatalf("BASELINE BROKEN: the task is already unavailable (%v) with only %v "+
					"present", avail.Reasons, row.present)
			}

			// THE PRICE. Every row is a move to a terminal stage.
			err := f.addLabels(narrowPrincipal, row.add)
			if err == nil {
				t.Fatalf("A LIFECYCLE WRITE WAS FREE. A principal holding only %v added %q to "+
					"an OPEN issue already carrying %v, and was charged nothing; the lifecycle "+
					"stage set is now %v.\n\nwhy this row exists: %s\n\n"+
					"The label already on the issue discounted the write. The BEFORE endpoint "+
					"must be computed from what this deployment ACTUALLY believes the task is "+
					"in — see currentLifecycleStages and the monotonicity argument on "+
					"LabelDeltaLifecycleStages.",
					narrowPrincipal, row.add, row.present, f.lifecycleStages(t), row.why)
			}
			requireDeniedFor(t, err, server.ScopeTaskClose,
				"adding "+row.add+" over present labels")

			// The denial has to have stopped the write, not merely reported on
			// it.
			if got := f.issue.currentLabels(); containsLabelFold(got, row.add) {
				t.Fatalf("the caller was DENIED and %q landed anyway; labels now %v",
					row.add, got)
			}

			// THE READ SIDE MUST NOT HAVE MOVED. The fix belongs entirely on
			// the write side; if the price got right because the read side
			// started honouring stock labels, that is a different and worse
			// change.
			if len(row.present) > 0 {
				if got := f.lifecycleStages(t); containsStage(got, task.StageDuplicate) ||
					containsStage(got, task.StageCompleted) || containsStage(got, task.StageWontFix) {
					t.Fatalf("the read side now names a terminal stage (%v) for an issue "+
						"carrying only %v. The price was fixed by widening the READ predicate, "+
						"which takes tasks out of `ft ready` on the strength of a label any "+
						"drive-by contributor can apply (#194 round 4)", got, row.present)
				}
			}
		})
	}

	if executed != len(rows) || executed == 0 {
		t.Fatalf("SWEEP BROKEN: executed %d rows of %d", executed, len(rows))
	}
}

// TestUpdateTask_ThePricedLifecycleWriteStillLands is the differential for the
// test above. Every row there ends in a denial, so a gate that refused every
// label write would pass all of them.
//
// It is a separate test rather than a row because it needs a different
// principal, and folding it in as a "wantDenied: false" column is how a control
// ends up sharing the code path it is supposed to be independent of.
func TestUpdateTask_ThePricedLifecycleWriteStillLands(t *testing.T) {
	for _, present := range [][]string{
		nil,
		{"duplicate"},
		{"completed"},
		{"ft2:stage/wont_fix"},
		{"needs-triage"},
	} {
		t.Run(labelsName(present), func(t *testing.T) {
			f := newLabelWriteFixture(t, "OPEN", "", present...)
			label := stageLabel(task.StageDuplicate)
			f.issue.registerLabel(label)

			if err := f.addLabels(withScope(server.ScopeTaskClose), label); err != nil {
				t.Fatalf("a caller holding task:close could not add %q over %v (%v); the "+
					"round-11 predicate has disabled a legitimate close", label, present, err)
			}
			if got := f.issue.currentLabels(); !containsLabelFold(got, label) {
				t.Fatalf("the authorized close did nothing; labels now %v", got)
			}
			if got := f.lifecycleStages(t); !containsStage(got, task.StageDuplicate) {
				t.Fatalf("the authorized close did not move the lifecycle stage set: %v", got)
			}
		})
	}
}

func labelsName(labels []string) string {
	if len(labels) == 0 {
		return "no_labels_present"
	}
	name := ""
	for i, l := range labels {
		if i > 0 {
			name += "_"
		}
		name += l
	}
	return name
}
