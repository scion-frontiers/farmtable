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
		{"triage to backlog", task.StageTriage, task.StageBacklog, server.ScopeTaskAccept},
		{"triage to ready", task.StageTriage, task.StageReady, server.ScopeTaskAccept},
		{"triage to working", task.StageTriage, task.StageWorking, server.ScopeTaskAccept},
		{"triage to in_review", task.StageTriage, task.StageInReview, server.ScopeTaskAccept},
		{"triage to in_qa", task.StageTriage, task.StageInQa, server.ScopeTaskAccept},
		{"triage to deploying", task.StageTriage, task.StageDeploying, server.ScopeTaskAccept},
		// On-hold stages are not an escape hatch out of triage: parking a task
		// in blocked/scheduled and then moving it on would otherwise launder it
		// past the accept gate with only task:write.
		{"triage to blocked", task.StageTriage, task.StageBlocked, server.ScopeTaskAccept},
		{"triage to waiting_for_input", task.StageTriage, task.StageWaitingForInput, server.ScopeTaskAccept},
		{"triage to deferred", task.StageTriage, task.StageDeferred, server.ScopeTaskAccept},
		{"triage to scheduled", task.StageTriage, task.StageScheduled, server.ScopeTaskAccept},

		// Taking ownership.
		{"backlog to working", task.StageBacklog, task.StageWorking, server.ScopeTaskClaim},
		{"ready to working", task.StageReady, task.StageWorking, server.ScopeTaskClaim},
		{"blocked to working", task.StageBlocked, task.StageWorking, server.ScopeTaskClaim},
		{"in_review to working", task.StageInReview, task.StageWorking, server.ScopeTaskClaim},
		{"deferred to working", task.StageDeferred, task.StageWorking, server.ScopeTaskClaim},

		// Handoff stages.
		{"working to in_review", task.StageWorking, task.StageInReview, server.ScopeTaskWrite},
		{"working to in_qa", task.StageWorking, task.StageInQa, server.ScopeTaskWrite},
		{"working to deploying", task.StageWorking, task.StageDeploying, server.ScopeTaskWrite},

		// Closing, from every phase group.
		{"working to completed", task.StageWorking, task.StageCompleted, server.ScopeTaskClose},
		{"triage to completed", task.StageTriage, task.StageCompleted, server.ScopeTaskClose},
		{"ready to wont_fix", task.StageReady, task.StageWontFix, server.ScopeTaskClose},
		{"backlog to duplicate", task.StageBacklog, task.StageDuplicate, server.ScopeTaskClose},
		{"blocked to cancelled", task.StageBlocked, task.StageCancelled, server.ScopeTaskClose},
		{"in_review to completed", task.StageInReview, task.StageCompleted, server.ScopeTaskClose},
		// Moving between terminal stages is still a close, not a reopen.
		{"completed to cancelled", task.StageCompleted, task.StageCancelled, server.ScopeTaskClose},
		{"wont_fix to duplicate", task.StageWontFix, task.StageDuplicate, server.ScopeTaskClose},

		// Reopening a closed task is a re-accept.
		{"completed to triage", task.StageCompleted, task.StageTriage, server.ScopeTaskAccept},
		{"completed to backlog", task.StageCompleted, task.StageBacklog, server.ScopeTaskAccept},
		{"cancelled to backlog", task.StageCancelled, task.StageBacklog, server.ScopeTaskAccept},
		{"wont_fix to triage", task.StageWontFix, task.StageTriage, server.ScopeTaskAccept},
		{"duplicate to ready", task.StageDuplicate, task.StageReady, server.ScopeTaskAccept},
		{"completed to working", task.StageCompleted, task.StageWorking, server.ScopeTaskAccept},
		{"completed to blocked", task.StageCompleted, task.StageBlocked, server.ScopeTaskAccept},

		// Pausing work.
		{"working to blocked", task.StageWorking, task.StageBlocked, server.ScopeTaskWrite},
		{"working to waiting_for_input", task.StageWorking, task.StageWaitingForInput, server.ScopeTaskWrite},
		{"working to deferred", task.StageWorking, task.StageDeferred, server.ScopeTaskWrite},
		{"ready to blocked", task.StageReady, task.StageBlocked, server.ScopeTaskWrite},

		// Ordinary movement within accepted work.
		{"backlog to ready", task.StageBacklog, task.StageReady, server.ScopeTaskWrite},
		{"ready to backlog", task.StageReady, task.StageBacklog, server.ScopeTaskWrite},
		{"in_review to in_qa", task.StageInReview, task.StageInQa, server.ScopeTaskWrite},
		{"blocked to ready", task.StageBlocked, task.StageReady, server.ScopeTaskWrite},
		{"working to ready", task.StageWorking, task.StageReady, server.ScopeTaskWrite},
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
		task.StageBacklog,
		task.StageReady,
		task.StageWorking,
		task.StageInReview,
		task.StageBlocked,
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
	if got := server.TransitionScope("", string(task.StageReady)); got != server.ScopeTaskWrite {
		t.Errorf("empty from stage = %q, want %q", got, server.ScopeTaskWrite)
	}
}

// Every valid stage pair must resolve to a known scope; nothing may fall
// through the table into an empty or unrecognized scope.
func TestTransitionScope_AllStagePairsResolveToKnownScope(t *testing.T) {
	all := []task.Stage{
		task.StageTriage, task.StageBacklog, task.StageReady, task.StageWorking,
		task.StageInReview, task.StageInQa, task.StageDeploying, task.StageBlocked,
		task.StageWaitingForInput, task.StageDeferred, task.StageScheduled,
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
	withoutID := server.TransitionScope(string(task.StageTriage), string(task.StageReady))
	withID := server.TransitionScope(string(task.StageTriage), string(task.StageReady), uuid.New())
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
