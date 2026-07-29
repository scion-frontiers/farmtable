package server_test

// INDEPENDENT TEST-LEG PROBE, #194 round 5. NOT FOR MERGE.
//
// This file exists to answer the priority charge: what inputs can the round-5
// fixtures not express? It is deleted after measurement; nothing here is a
// proposed test.

import (
	"context"
	"net/http/httptest"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	ghplatform "github.com/farmtable-io/farmtable/internal/platform/github"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
	"github.com/shurcooL/githubv4"
)

// probeFixture builds the same production object graph newLabelWriteFixture
// does, but with the label CONFIG as an input — both push_prefix and the
// cfg.Stages alias map, which no test in the repository sets.
func probeFixture(t *testing.T, stages map[string]string, pushPrefix, state string, labels ...string) *labelWriteFixture {
	t.Helper()
	ctx := context.Background()

	entStore, storeCleanup := testutil.NewTestStore(t)
	t.Cleanup(storeCleanup)
	ms := store.NewMultiStore(entStore)
	t.Cleanup(func() { _ = ms.Close() })

	coll, err := ms.CreateCollection(ctx, store.CreateCollectionParams{
		Name: "acme/widgets", Platform: string(collection.PlatformGithub), RemoteID: "acme/widgets",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	if _, err := ms.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: coll.ID, Platform: "github", AuthToken: "ghp_mock_test_token",
		AuthMethod: "pat", Scopes: []string{"repo"},
	}); err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}

	mockGH, issue := newLabelWriteIssueMock(t, state, "", labels)

	ms.SetResolver(func(platform collection.Platform, token string, rid string, cid uuid.UUID) (store.Store, error) {
		if platform != collection.PlatformGithub {
			return nil, nil
		}
		owner, repo, ok := store.ParseOwnerRepo(rid)
		if !ok {
			return nil, nil
		}
		cfg := ghplatform.DefaultConfig()
		cfg.GitHub.Labels.PushPrefix = pushPrefix
		cfg.GitHub.Labels.Stages = stages
		s := ghplatform.NewPassThroughStore("mock-token", owner, repo, cfg, &cid)
		ghplatform.SetTestGraphQLClient(s, githubv4.NewEnterpriseClient(mockGH.URL, mockGH.Client()))
		return s, nil
	})

	svc := server.NewFarmTableService(ms, "test")
	collIDStr := coll.ID.String()
	list, err := svc.ListTasks(ctx, &pb.ListTasksRequest{CollectionId: &collIDStr})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(list.GetItems()) != 1 {
		t.Fatalf("got %d tasks, want 1", len(list.GetItems()))
	}
	return &labelWriteFixture{
		svc: svc, ms: ms, taskID: list.GetItems()[0].GetId(), collID: coll.ID, issue: issue,
	}
}

var _ = httptest.NewServer

// ProbeA answers: after B6, does a deployment-configured terminal ALIAS in
// cfg.Stages still feed the authorization / terminal-stage answer, and under
// which spelling of the config KEY and of the LABEL?
//
// The developer's log says such a deployment "must now spell them with the
// prefix" and that no such configuration exists in-tree. Both halves of that
// sentence are checkable and the second one is why the first was never tested.
func TestProbeA_ConfiguredTerminalAliasUnderB6(t *testing.T) {
	cases := []struct {
		name      string
		configKey string
		label     string
	}{
		{"config_key_bare__label_bare", "shipped", "shipped"},
		{"config_key_bare__label_prefixed", "shipped", "ft:shipped"},
		{"config_key_prefixed__label_prefixed", "ft:shipped", "ft:shipped"},
		{"config_key_prefixed__label_bare", "ft:shipped", "shipped"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stages := map[string]string{tc.configKey: "completed"}
			f := probeFixture(t, stages, "ft:", "OPEN", tc.label)

			lifecycle := f.lifecycleStage(t)
			avail := f.availability(t)

			// Display projection, the same mapper, same label.
			m := ghplatform.NewLabelMapper(func() ghplatform.LabelConfig {
				c := ghplatform.DefaultConfig()
				c.GitHub.Labels.Stages = stages
				return c.GitHub.Labels
			}())
			displayStage, displayOK := m.MapLabelsToStage([]string{tc.label})
			allTerminal := m.AllTerminalLabelStages([]string{tc.label})

			t.Logf("PROBE_A key=%q label=%q | lifecycle=%q available=%v reasons=%v | display=%q,%v | AllTerminalLabelStages=%v",
				tc.configKey, tc.label, lifecycle, avail.Available, avail.Reasons,
				displayStage, displayOK, allTerminal)
		})
	}
}

// ProbeB answers: is a MULTI-LABEL delta expressible, and does the B1 gate
// behave the same way on one? Every addLabels/removeLabels call in the round-5
// file passes exactly one label.
func TestProbeB_MultiLabelDelta(t *testing.T) {
	cases := []struct {
		name    string
		initial []string
		add     []string
		remove  []string
	}{
		{
			name:    "add_two_terminals_at_once",
			initial: []string{stageLabel(task.StageAccepted)},
			add:     []string{stageLabel(task.StageCompleted), stageLabel(task.StageWontFix)},
		},
		{
			name:    "remove_two_terminals_at_once",
			initial: []string{stageLabel(task.StageCompleted), stageLabel(task.StageWontFix)},
			remove:  []string{stageLabel(task.StageCompleted), stageLabel(task.StageWontFix)},
		},
		{
			name:    "swap_in_one_request",
			initial: []string{stageLabel(task.StageWontFix)},
			add:     []string{stageLabel(task.StageCompleted)},
			remove:  []string{stageLabel(task.StageWontFix)},
		},
		{
			name:    "same_label_in_add_and_remove",
			initial: []string{stageLabel(task.StageAccepted)},
			add:     []string{stageLabel(task.StageCompleted)},
			remove:  []string{stageLabel(task.StageCompleted)},
		},
		{
			name:    "three_terminals_end_to_end",
			initial: []string{stageLabel(task.StageCompleted), stageLabel(task.StageWontFix), stageLabel(task.StageDuplicate)},
			add:     []string{stageLabel(task.StageCancelled)},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := probeFixture(t, nil, "ft:", "OPEN", tc.initial...)
			before := f.lifecycleStage(t)
			_, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
				Id: f.taskID, AddLabels: tc.add, RemoveLabels: tc.remove,
			})
			after := f.lifecycleStage(t)
			t.Logf("PROBE_B %s | before=%q err=%v after=%q labels=%v",
				tc.name, before, err, after, f.issue.currentLabels())
		})
	}
}

// ProbeC answers: at cardinality 3 and 4, does the END-TO-END gate behave the
// way the unit-level AllTerminalLabelStages test says it should? The developer
// discloses 3-4 are "exercised at the unit level only, not end to end".
func TestProbeC_HighCardinalityEndToEnd(t *testing.T) {
	all := []task.Stage{task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled}
	for _, n := range []int{2, 3, 4} {
		initial := make([]string, 0, n)
		for _, s := range all[:n] {
			initial = append(initial, stageLabel(s))
		}
		for _, dest := range all {
			t.Run(nameFor(n, dest), func(t *testing.T) {
				f := probeFixture(t, nil, "ft:", "OPEN", initial...)
				// Re-assert `dest` as a stage change, no label write at all.
				_, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
					Id: f.taskID, Stage: stageEnum(dest),
				})
				t.Logf("PROBE_C card=%d dest=%s | agentScopes err=%v", n, dest, err)
			})
		}
	}
}

func nameFor(n int, s task.Stage) string { return "card" + string(rune('0'+n)) + "_to_" + string(s) }

func stageEnum(s task.Stage) *pb.TaskStage {
	m := map[task.Stage]pb.TaskStage{
		task.StageCompleted: pb.TaskStage_TASK_STAGE_COMPLETED,
		task.StageWontFix:   pb.TaskStage_TASK_STAGE_WONT_FIX,
		task.StageDuplicate: pb.TaskStage_TASK_STAGE_DUPLICATE,
		task.StageCancelled: pb.TaskStage_TASK_STAGE_CANCELLED,
	}
	v := m[s]
	return &v
}
