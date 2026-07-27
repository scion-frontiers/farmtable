package github

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestPassThroughCloseTask_ConcurrentClosesDoNotRaceLabelIndex is issue #198.
//
// GitHubPassThroughStore caches the repo's label-name-to-node-ID map in
// s.labelIndex, populated lazily on first use. Every RPC that writes a label
// goes through it, and one store instance serves every request for its
// collection — the gRPC server shares it across handlers, so concurrent calls
// are the normal case, not an edge case. Nothing synchronised that map.
//
// CloseTask alone touches it three times per call: ensureLabelIndex may write
// it, and the two labelNamesToIDs calls (for the remove set and the add set)
// each read it. Two agents closing tasks at the same moment can therefore have
// one goroutine ranging over the map in labelNameToID while another assigns to
// it in ensureLabelIndex. In Go that is not a torn read or a lost update — it
// is a concurrent map read and map write, a fatal runtime error that is not
// recoverable and takes the whole process down, every tenant with it.
//
// The harness deliberately does not reuse fakeIssueRepo. That fake mutates its
// own fields on every request, so concurrent use would trip the race detector
// inside the test double and mask, or be mistaken for, the production race.
// The handler here derives its response purely from the request body and
// shares nothing, so any race the detector reports is in the store.
//
// Run under -race. Before the fix this fails; the detector reports the write
// in ensureLabelIndex against the reads in labelNameToID.
func TestPassThroughCloseTask_ConcurrentClosesDoNotRaceLabelIndex(t *testing.T) {
	const issues = 8

	s := &GitHubPassThroughStore{
		gql:          testGraphQLClient(t, statelessIssueHandler(t, issues)),
		mapper:       NewLabelMapper(DefaultConfig().GitHub.Labels),
		owner:        "acme",
		repo:         "repo",
		collectionID: uuid.New(),
	}

	// Every goroutine closes a different issue, so nothing about the scenario
	// is contentious except the cache they all share.
	var wg sync.WaitGroup
	start := make(chan struct{})
	errs := make(chan error, issues)
	for i := 1; i <= issues; i++ {
		wg.Add(1)
		go func(number int) {
			defer wg.Done()
			<-start
			if _, err := s.CloseTask(context.Background(), s.issueUUID(number), task.StageCompleted, "", uuid.Nil); err != nil {
				errs <- fmt.Errorf("CloseTask(#%d): %w", number, err)
			}
		}(i)
	}
	close(start)
	wg.Wait()
	close(errs)

	for err := range errs {
		t.Error(err)
	}

	// The cache must also end up populated exactly once and intact: a
	// last-writer-wins double populate is benign only because every writer
	// builds the same map, and that is worth pinning.
	if len(s.labelIndex) == 0 {
		t.Fatal("label index empty after 8 concurrent closes")
	}
	if _, ok := s.labelNameToID("ft:stage/completed"); !ok {
		t.Errorf("label index missing ft:stage/completed after concurrent closes; got %v", s.labelIndex)
	}
}

// TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace is the same race on the
// other lazily cached field. CreateTask is the only caller, but it is reachable
// concurrently by exactly the same route.
func TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace(t *testing.T) {
	s := &GitHubPassThroughStore{
		gql:          testGraphQLClient(t, statelessIssueHandler(t, 1)),
		mapper:       NewLabelMapper(DefaultConfig().GitHub.Labels),
		owner:        "acme",
		repo:         "repo",
		collectionID: uuid.New(),
	}

	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			if err := s.ensureRepoID(context.Background()); err != nil {
				t.Errorf("ensureRepoID: %v", err)
			}
		}()
	}
	close(start)
	wg.Wait()

	if s.repoID != "REPO" {
		t.Errorf("repoID = %v, want REPO", s.repoID)
	}
}

var issueNumberInBody = regexp.MustCompile(`"number":(\d+)`)

// statelessIssueHandler serves the GraphQL surface CloseTask needs for n open
// issues. It holds no mutable state: every response is a function of the
// request body alone, so it can be hit concurrently without synchronisation
// and without contributing races of its own.
func statelessIssueHandler(t *testing.T, n int) http.HandlerFunc {
	t.Helper()

	issueJSON := func(number int, closed bool) string {
		state, reason, closedAt, labels := "OPEN", "null", "null", `[{"name":"ft:stage/working"}]`
		if closed {
			state, reason, closedAt = "CLOSED", `"COMPLETED"`, `"2026-01-02T00:00:00Z"`
			labels = `[{"name":"ft:stage/completed"}]`
		}
		return fmt.Sprintf(`{"id":"ISSUE%d","number":%d,"title":"Task","body":"","state":%q,`+
			`"stateReason":%s,"closedAt":%s,`+
			`"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-02T00:00:00Z",`+
			`"url":"https://example.test/%d","labels":{"nodes":%s},"assignees":{"nodes":[]},`+
			`"milestone":null,"subIssues":{"nodes":[],"totalCount":0},`+
			`"subIssuesSummary":{"total":0,"completed":0,"percentCompleted":0},"parent":null}`,
			number, number, state, reason, closedAt, number, labels)
	}

	labelsJSON := `{"data":{"repository":{"labels":{"nodes":[` +
		`{"id":"L_WORKING","name":"ft:stage/working"},` +
		`{"id":"L_COMPLETED","name":"ft:stage/completed"}` +
		`],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`

	return func(w http.ResponseWriter, r *http.Request) {
		body := mustReadBody(t, r.Body)
		w.Header().Set("Content-Type", "application/json")

		number := 1
		if m := issueNumberInBody.FindStringSubmatch(body); m != nil {
			number, _ = strconv.Atoi(m[1])
		}

		switch {
		case strings.Contains(body, "closeIssue"):
			_, _ = fmt.Fprintf(w, `{"data":{"closeIssue":{"issue":%s}}}`, issueJSON(number, true))
		case strings.Contains(body, "addLabelsToLabelable"):
			_, _ = w.Write([]byte(`{"data":{"addLabelsToLabelable":{"labelable":{"labels":{"nodes":[]}}}}}`))
		case strings.Contains(body, "removeLabelsFromLabelable"):
			_, _ = w.Write([]byte(`{"data":{"removeLabelsFromLabelable":{"labelable":{"labels":{"nodes":[]}}}}}`))
		case strings.Contains(body, "repository(owner:"):
			switch {
			case strings.Contains(body, "issue(number:"):
				_, _ = fmt.Fprintf(w, `{"data":{"repository":{"issue":%s}}}`, issueJSON(number, true))
			case strings.Contains(body, "issues("):
				nodes := make([]string, 0, n)
				for i := 1; i <= n; i++ {
					nodes = append(nodes, issueJSON(i, false))
				}
				_, _ = fmt.Fprintf(w,
					`{"data":{"repository":{"issues":{"nodes":[%s],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`,
					strings.Join(nodes, ","))
			case strings.Contains(body, "labels("):
				_, _ = w.Write([]byte(labelsJSON))
			default:
				_, _ = w.Write([]byte(`{"data":{"repository":{"id":"REPO"}}}`))
			}
		default:
			t.Errorf("unexpected GraphQL request: %s", body)
			_, _ = w.Write([]byte(`{"data":{}}`))
		}
	}
}
