package server_test

import (
	"testing"

	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

func TestTransitionScope_Table(t *testing.T) {
	tests := []struct {
		name string
		from task.Stage
		to   task.Stage
		want string
	}{
		// Accepting work out of triage.
		{"triage to accepted", task.StageTriage, task.StageAccepted, server.ScopeTaskAccept},
		{"triage remains accepted", task.StageTriage, task.StageAccepted, server.ScopeTaskAccept},
		{"triage to working", task.StageTriage, task.StageWorking, server.ScopeTaskAccept},
		{"triage to in_review", task.StageTriage, task.StageInReview, server.ScopeTaskAccept},
		{"triage to in_qa", task.StageTriage, task.StageInQa, server.ScopeTaskAccept},
		{"triage to deploying", task.StageTriage, task.StageDeploying, server.ScopeTaskAccept},
		// Moving triage into accepted work is not an escape hatch: follow-on
		// writes still require the accept gate first.
		{"triage to held accepted", task.StageTriage, task.StageAccepted, server.ScopeTaskAccept},

		// Taking ownership.
		{"accepted to working", task.StageAccepted, task.StageWorking, server.ScopeTaskClaim},
		{"claimable accepted to working", task.StageAccepted, task.StageWorking, server.ScopeTaskClaim},
		{"held accepted to working", task.StageAccepted, task.StageWorking, server.ScopeTaskClaim},
		{"in_review to working", task.StageInReview, task.StageWorking, server.ScopeTaskClaim},
		{"deferred hold to working", task.StageAccepted, task.StageWorking, server.ScopeTaskClaim},

		// Handoff stages.
		{"working to in_review", task.StageWorking, task.StageInReview, server.ScopeTaskWrite},
		{"working to in_qa", task.StageWorking, task.StageInQa, server.ScopeTaskWrite},
		{"working to deploying", task.StageWorking, task.StageDeploying, server.ScopeTaskWrite},

		// Closing, from every phase group.
		{"working to completed", task.StageWorking, task.StageCompleted, server.ScopeTaskClose},
		{"triage to completed", task.StageTriage, task.StageCompleted, server.ScopeTaskClose},
		{"accepted to wont_fix", task.StageAccepted, task.StageWontFix, server.ScopeTaskClose},
		{"accepted to duplicate", task.StageAccepted, task.StageDuplicate, server.ScopeTaskClose},
		{"accepted to cancelled", task.StageAccepted, task.StageCancelled, server.ScopeTaskClose},
		{"in_review to completed", task.StageInReview, task.StageCompleted, server.ScopeTaskClose},
		// Moving between terminal stages is still a close, not a reopen.
		{"completed to cancelled", task.StageCompleted, task.StageCancelled, server.ScopeTaskClose},
		{"wont_fix to duplicate", task.StageWontFix, task.StageDuplicate, server.ScopeTaskClose},

		// Reopening a closed task is a re-accept.
		{"completed to triage", task.StageCompleted, task.StageTriage, server.ScopeTaskAccept},
		{"completed to accepted", task.StageCompleted, task.StageAccepted, server.ScopeTaskAccept},
		{"cancelled to accepted", task.StageCancelled, task.StageAccepted, server.ScopeTaskAccept},
		{"wont_fix to triage", task.StageWontFix, task.StageTriage, server.ScopeTaskAccept},
		{"duplicate to accepted", task.StageDuplicate, task.StageAccepted, server.ScopeTaskAccept},
		{"completed to working", task.StageCompleted, task.StageWorking, server.ScopeTaskAccept},
		{"completed to held accepted", task.StageCompleted, task.StageAccepted, server.ScopeTaskAccept},

		// Pausing work.
		{"working to accepted hold", task.StageWorking, task.StageAccepted, server.ScopeTaskWrite},
		{"working to waiting hold", task.StageWorking, task.StageAccepted, server.ScopeTaskWrite},
		{"working to deferred hold", task.StageWorking, task.StageAccepted, server.ScopeTaskWrite},
		{"accepted to held accepted", task.StageAccepted, task.StageAccepted, server.ScopeTaskWrite},

		// Ordinary movement within accepted work.
		{"accepted order change", task.StageAccepted, task.StageAccepted, server.ScopeTaskWrite},
		{"accepted metadata change", task.StageAccepted, task.StageAccepted, server.ScopeTaskWrite},
		{"in_review to in_qa", task.StageInReview, task.StageInQa, server.ScopeTaskWrite},
		{"held accepted to accepted", task.StageAccepted, task.StageAccepted, server.ScopeTaskWrite},
		{"working to accepted", task.StageWorking, task.StageAccepted, server.ScopeTaskWrite},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := server.TransitionScope(string(tt.from), string(tt.to))
			if got != tt.want {
				t.Errorf("TransitionScope(%q, %q) = %q, want %q", tt.from, tt.to, got, tt.want)
			}
		})
	}
}

func TestTransitionScope_NoOpStageIsWrite(t *testing.T) {
	stages := []task.Stage{
		task.StageTriage,
		task.StageAccepted,
		task.StageAccepted,
		task.StageWorking,
		task.StageInReview,
		task.StageAccepted,
		task.StageCompleted,
	}
	for _, s := range stages {
		if got := server.TransitionScope(string(s), string(s)); got != server.ScopeTaskWrite {
			t.Errorf("TransitionScope(%q, %q) = %q, want %q", s, s, got, server.ScopeTaskWrite)
		}
	}
}

func TestTransitionScope_UnknownStagesFallBackToWrite(t *testing.T) {
	if got := server.TransitionScope("not_a_stage", "also_not_a_stage"); got != server.ScopeTaskWrite {
		t.Errorf("unknown transition = %q, want %q", got, server.ScopeTaskWrite)
	}
	if got := server.TransitionScope("", string(task.StageAccepted)); got != server.ScopeTaskWrite {
		t.Errorf("empty from stage = %q, want %q", got, server.ScopeTaskWrite)
	}
}

// Every valid stage pair must resolve to a known scope; nothing may fall
// through the table into an empty or unrecognized scope.
func TestTransitionScope_AllStagePairsResolveToKnownScope(t *testing.T) {
	all := []task.Stage{
		task.StageTriage, task.StageAccepted, task.StageAccepted, task.StageWorking,
		task.StageInReview, task.StageInQa, task.StageDeploying, task.StageAccepted,
		task.StageAccepted, task.StageAccepted, task.StageAccepted,
		task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled,
	}
	known := map[string]bool{
		server.ScopeTaskWrite:  true,
		server.ScopeTaskClaim:  true,
		server.ScopeTaskAccept: true,
		server.ScopeTaskClose:  true,
	}
	for _, from := range all {
		for _, to := range all {
			got := server.TransitionScope(string(from), string(to))
			if !known[got] {
				t.Errorf("TransitionScope(%q, %q) = %q, want a known task scope", from, to, got)
			}
		}
	}
}

// The collectionID variadic is reserved for future per-collection policy
// binding and must not change the result today.
func TestTransitionScope_CollectionIDIgnored(t *testing.T) {
	withoutID := server.TransitionScope(string(task.StageTriage), string(task.StageAccepted))
	withID := server.TransitionScope(string(task.StageTriage), string(task.StageAccepted), uuid.New())
	if withoutID != withID {
		t.Errorf("collection id changed result: %q vs %q", withoutID, withID)
	}
}

func TestAllScopes_IncludesNewScopes(t *testing.T) {
	found := map[string]bool{}
	for _, s := range server.AllScopes {
		found[s] = true
	}
	for _, want := range []string{server.ScopeTaskAccept, server.ScopeTaskClose} {
		if !found[want] {
			t.Errorf("AllScopes missing %q", want)
		}
	}
	if err := server.ValidateScopes([]string{server.ScopeTaskAccept, server.ScopeTaskClose}); err != nil {
		t.Errorf("ValidateScopes rejected new scopes: %v", err)
	}
}

func TestDefaultScopesForUserType_LifecycleRoles(t *testing.T) {
	tests := []struct {
		userType   string
		wantScopes []string
	}{
		{"agent", []string{
			server.ScopeTaskRead, server.ScopeTaskWrite, server.ScopeTaskClaim,
			server.ScopeCollectionRead,
		}},
		{"reviewer", []string{
			server.ScopeTaskRead, server.ScopeTaskWrite, server.ScopeTaskClaim,
			server.ScopeTaskAccept, server.ScopeTaskClose, server.ScopeCollectionRead,
		}},
		{"orchestrator", []string{
			server.ScopeTaskRead, server.ScopeTaskWrite, server.ScopeTaskClaim,
			server.ScopeTaskAccept, server.ScopeTaskClose, server.ScopeCollectionRead,
		}},
	}

	for _, tt := range tests {
		t.Run(tt.userType, func(t *testing.T) {
			got := server.DefaultScopesForUserType(tt.userType)
			if len(got) != len(tt.wantScopes) {
				t.Fatalf("scopes = %v, want %v", got, tt.wantScopes)
			}
			for i, want := range tt.wantScopes {
				if got[i] != want {
					t.Errorf("scopes[%d] = %q, want %q (full: %v)", i, got[i], want, got)
				}
			}
		})
	}

	// Agents explicitly must not receive lifecycle authority.
	for _, s := range server.DefaultScopesForUserType("agent") {
		if s == server.ScopeTaskAccept || s == server.ScopeTaskClose {
			t.Errorf("agent default scopes must not include %q", s)
		}
	}
}
