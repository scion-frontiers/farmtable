package github

import (
	"net/url"
	"testing"
	"time"

	gh "github.com/google/go-github/v62/github"
	githubv4 "github.com/shurcooL/githubv4"
	"google.golang.org/protobuf/types/known/structpb"
)

// This file is the PRODUCER-SIDE pin for the C-1 fail-closed accident, and it
// is the first thing in internal/platform/github ever to import structpb.
//
// WHY IT HAD TO BE IN THIS PACKAGE, since an end-to-end pin already existed.
// TestPassthroughReadDropsUnsafeRemoteURL over in internal/server does exercise
// this property, and it was proven live rather than assumed. It is still not a
// substitute, for two reasons:
//
//   - It can only fail AFTER the bad value has travelled the whole path, so it
//     demonstrates the CONSEQUENCE and cannot LOCALISE THE CAUSE. When it goes
//     red, the builder, the sanitizer and the converter are all suspects.
//   - It cannot distinguish "the builder emits an unrepresentable map" from
//     "the sanitizer cleaned up after the builder". Those are different facts
//     with different failure modes, and only one of them is C-1.
//
// Before this file, NO test anywhere called issueBuildRemoteData or
// issueLabels, and this package never imported structpb -- an import-graph
// fact, not a name search. The property that the whole remote_data axis rests
// on had never been measured at the point where it is produced.
//
// WHAT C-1 ACTUALLY IS. structpb.NewValue has no case for []string, for
// map[string]string, or for []map[string]any. The sanitizer is
// TYPE-PRESERVING, so it hands those through unchanged and structpb then
// refuses the whole struct, which convert.go turns into a nil field. Nothing
// chose to drop it. It is an ACCIDENT that happens to fail closed, and these
// tests exist so that the day it stops being true is a red build and not a
// silent XSS.

// realisticIssueNode returns an issueNode populated the way a live GraphQL
// response populates one, so that issueBuildRemoteData walks its real branches
// rather than a hand-typed literal's.
//
// withSubIssues is the reason this helper exists. The canned fixture used by
// the server-side tests sets "subIssues": {"nodes": [], "totalCount": 0}, and
// issueBuildRemoteData writes sub_issues only under len(...) > 0, so THAT
// BRANCH HAD NEVER EXECUTED IN ANY TEST. C-1 is a two-carrier property and
// exactly one carrier had ever been exercised against real code.
func realisticIssueNode(t *testing.T, withSubIssues bool) *issueNode {
	t.Helper()
	u, err := url.Parse("https://github.com/farmtable-io/farmtable/issues/7")
	if err != nil {
		t.Fatalf("parsing fixture URL: %v", err)
	}
	when := time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC)

	n := &issueNode{
		ID:        githubv4.ID("I_issue7"),
		Number:    githubv4.Int(7),
		Title:     githubv4.String("a realistic issue"),
		State:     githubv4.String("OPEN"),
		CreatedAt: githubv4.DateTime{Time: when},
		UpdatedAt: githubv4.DateTime{Time: when},
		URL:       githubv4.URI{URL: u},
	}
	n.Labels.Nodes = []struct {
		Name githubv4.String
	}{{Name: githubv4.String("bug")}}
	n.SubIssuesSummary = subIssuesSummary{Total: 0, Completed: 0}

	if withSubIssues {
		n.SubIssues.Nodes = []subIssueNode{{
			ID:     githubv4.ID("I_sub1"),
			Number: githubv4.Int(8),
			Title:  githubv4.String("a sub-issue"),
			State:  githubv4.String("OPEN"),
		}}
		n.SubIssues.TotalCount = githubv4.Int(1)
		n.SubIssuesSummary = subIssuesSummary{Total: 1, Completed: 0}
	}
	return n
}

// TestIssueBuildRemoteDataIsNotStructpbRepresentable pins C-1 at the producer,
// and fills the 2x2 over the two carriers.
//
// Deleting a key from the built map is how a future "make remote_data
// representable" change is simulated. Doing it one carrier at a time is the
// only way to show that each is INDEPENDENTLY load-bearing -- with both present
// a single assertion cannot tell you whether it would still hold if one were
// fixed, and would hand out a green light for a change that leaves the defect
// in place.
func TestIssueBuildRemoteDataIsNotStructpbRepresentable(t *testing.T) {
	tests := []struct {
		name        string
		withSubs    bool
		dropKeys    []string
		wantErr     bool
		wantCarrier string
	}{
		{
			name:        "both carriers present",
			withSubs:    true,
			wantErr:     true,
			wantCarrier: "labels []string and sub_issues []map[string]any",
		},
		{
			name:        "labels deleted, sub_issues present",
			withSubs:    true,
			dropKeys:    []string{"labels"},
			wantErr:     true,
			wantCarrier: "sub_issues []map[string]any, ALONE -- this arrangement had never run",
		},
		{
			name:        "labels present, sub_issues absent",
			withSubs:    false,
			wantErr:     true,
			wantCarrier: "labels []string, ALONE -- the only case the old suite covered",
		},
		{
			name:     "both carriers deleted",
			withSubs: false,
			dropKeys: []string{"labels"},
			// The positive control. If this errors too there is a THIRD
			// unrepresentable carrier nobody has enumerated, and the two-carrier
			// story in urlvalidate_differential_test.go is wrong.
			wantErr:     false,
			wantCarrier: "none -- positive control, the map must become representable",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rd := issueBuildRemoteData("farmtable-io", "farmtable", realisticIssueNode(t, tc.withSubs))

			for _, k := range tc.dropKeys {
				if _, ok := rd[k]; !ok {
					t.Fatalf("fixture drift: wanted to delete %q from the built map but it is not there. "+
						"issueBuildRemoteData no longer writes that key, so this row is testing nothing.", k)
				}
				delete(rd, k)
			}

			if tc.withSubs {
				if _, ok := rd["sub_issues"]; !ok {
					t.Fatal("fixture drift: withSubs is set but issueBuildRemoteData wrote no sub_issues key. " +
						"The len(issue.SubIssues.Nodes) > 0 branch did not execute, which is the exact " +
						"vacuity this fixture was built to eliminate. Do not relax this into a skip.")
				}
			}

			_, err := structpb.NewStruct(rd)
			if tc.wantErr && err == nil {
				t.Fatalf("structpb.NewStruct ACCEPTED issueBuildRemoteData output (carrier expected: %s).\n"+
					"C-1 IS THE ONLY THING KEEPING PASSTHROUGH remote_data OFF THE WIRE, and it just stopped "+
					"holding. THE RED IS THE ALARM, NOT THE BUG: do not update this expectation. Passthrough "+
					"remote_data is attacker-authored, is NOT JSON-round-tripped, and now serialises to every "+
					"client. Check that sanitizeRemoteData actually walks every key this builder writes "+
					"before letting that ship.", tc.wantCarrier)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("positive control FAILED: with both known carriers removed the map should be "+
					"structpb-representable, but NewStruct still refused it: %v\n"+
					"That means a THIRD unrepresentable carrier exists that the enumeration in "+
					"urlvalidate_differential_test.go does not name. Find it and add it there; the "+
					"two-carrier account of C-1 is incomplete.", err)
			}
		})
	}
}

// TestGitHubBuilderRepresentabilityAsymmetry pins the difference between the two
// GitHub builders, which have near-identical names and are reached by the same
// name search.
//
//	issueBuildRemoteData  graphql_queries.go  PASSTHROUGH  labels ALWAYS set
//	buildRemoteData       github.go           SYNC         labels set only if len > 0
//
// The C-1 prose used to read as "GitHub remote_data never ships". On the sync
// path that is FALSE: a zero-label issue makes buildRemoteData return a map of
// strings and ints, which structpb accepts, so remote_data ships. That is not a
// vulnerability -- the sync path is JSON-round-tripped, so the sanitizer walks
// it and html_url is validated -- but a reader who carries the passthrough
// conclusion across to the sync path believes a sink is empty when it is not,
// and an empty sink set is how this axis went five rounds without anyone
// checking the consumers.
func TestGitHubBuilderRepresentabilityAsymmetry(t *testing.T) {
	str := func(s string) *string { return &s }
	num := 7
	when := gh.Timestamp{Time: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC)}

	syncIssue := func(labels ...string) *gh.Issue {
		iss := &gh.Issue{
			NodeID:    str("I_issue7"),
			HTMLURL:   str("https://github.com/farmtable-io/farmtable/issues/7"),
			Number:    &num,
			CreatedAt: &when,
			UpdatedAt: &when,
		}
		for _, l := range labels {
			iss.Labels = append(iss.Labels, &gh.Label{Name: str(l)})
		}
		return iss
	}

	t.Run("sync builder with zero labels IS representable and DOES ship", func(t *testing.T) {
		rd := buildRemoteData(syncIssue(), "farmtable-io/farmtable#7")
		if _, ok := rd["labels"]; ok {
			t.Fatal("buildRemoteData wrote a labels key for a zero-label issue. Its `if len(labelNames) > 0` " +
				"guard is what makes the sync path representable; if that guard is gone the asymmetry this " +
				"test documents no longer exists and the C-1 prose needs revisiting, not this assertion.")
		}
		if _, err := structpb.NewStruct(rd); err != nil {
			t.Fatalf("sync buildRemoteData output is no longer structpb-representable: %v\n"+
				"remote_data has just STOPPED shipping on the sync path. That is a silent behaviour "+
				"change for every synced GitHub task, not a security improvement.", err)
		}
	})

	t.Run("sync builder with labels is unrepresentable, same as passthrough", func(t *testing.T) {
		rd := buildRemoteData(syncIssue("bug"), "farmtable-io/farmtable#7")
		if _, err := structpb.NewStruct(rd); err == nil {
			t.Fatal("structpb.NewStruct now accepts a []string under labels. Both GitHub builders " +
				"therefore ship remote_data unconditionally, and every test that relies on C-1 to " +
				"keep passthrough remote_data off the wire is now vacuous.")
		}
	})

	t.Run("passthrough builder sets labels unconditionally", func(t *testing.T) {
		// This is the asymmetry itself, and it is why the two builders cannot be
		// reasoned about together. issueLabels returns make([]string, n), never
		// nil, and []string of ANY length including zero is rejected by structpb.
		n := realisticIssueNode(t, false)
		n.Labels.Nodes = nil

		if got := issueLabels(n); got == nil {
			t.Fatal("issueLabels returned nil for a zero-label issue. It used to return " +
				"make([]string, 0), which structpb rejects; a nil slice would make the passthrough " +
				"carrier CONDITIONAL, matching the sync path. That is a real behaviour change and it " +
				"weakens C-1 -- the labels carrier would no longer be present on every passthrough task.")
		}
		rd := issueBuildRemoteData("farmtable-io", "farmtable", n)
		if _, err := structpb.NewStruct(rd); err == nil {
			t.Fatal("a zero-label PASSTHROUGH issue is now structpb-representable. The labels carrier " +
				"has become conditional, so C-1 no longer holds for every passthrough task -- only for " +
				"labelled ones. Re-measure before treating passthrough remote_data as unreachable.")
		}
	})
}
