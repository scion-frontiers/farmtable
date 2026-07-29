package server

import (
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/linkedaccount"
	"github.com/farmtable-io/farmtable/internal/store/ent/relationship"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// Phase/Stage enum conversions

func phaseToProto(p task.Phase) pb.TaskPhase {
	switch p {
	case task.PhaseOpen:
		return pb.TaskPhase_TASK_PHASE_OPEN
	case task.PhaseInProgress:
		return pb.TaskPhase_TASK_PHASE_IN_PROGRESS
	case task.PhaseOnHold:
		return pb.TaskPhase_TASK_PHASE_ON_HOLD
	case task.PhaseClosed:
		return pb.TaskPhase_TASK_PHASE_CLOSED
	default:
		return pb.TaskPhase_TASK_PHASE_UNSPECIFIED
	}
}

func stageToProto(s task.Stage) pb.TaskStage {
	switch s {
	case task.StageTriage:
		return pb.TaskStage_TASK_STAGE_TRIAGE
	case task.StageAccepted:
		return pb.TaskStage_TASK_STAGE_ACCEPTED
	case task.StageWorking:
		return pb.TaskStage_TASK_STAGE_WORKING
	case task.StageInReview:
		return pb.TaskStage_TASK_STAGE_IN_REVIEW
	case task.StageInQa:
		return pb.TaskStage_TASK_STAGE_IN_QA
	case task.StageDeploying:
		return pb.TaskStage_TASK_STAGE_DEPLOYING
	case task.StageCompleted:
		return pb.TaskStage_TASK_STAGE_COMPLETED
	case task.StageWontFix:
		return pb.TaskStage_TASK_STAGE_WONT_FIX
	case task.StageDuplicate:
		return pb.TaskStage_TASK_STAGE_DUPLICATE
	case task.StageCancelled:
		return pb.TaskStage_TASK_STAGE_CANCELLED
	default:
		return pb.TaskStage_TASK_STAGE_UNSPECIFIED
	}
}

func phaseForStage(s task.Stage) task.Phase {
	switch s {
	case task.StageTriage, task.StageAccepted:
		return task.PhaseOpen
	case task.StageWorking, task.StageInReview, task.StageInQa, task.StageDeploying:
		return task.PhaseInProgress
	case task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
		return task.PhaseClosed
	default:
		return task.PhaseOpen
	}
}

func holdReasonToProto(hr task.HoldReason) pb.TaskHoldReason {
	switch hr {
	case task.HoldReasonWaitingForInput:
		return pb.TaskHoldReason_TASK_HOLD_REASON_WAITING_FOR_INPUT
	case task.HoldReasonDeferred:
		return pb.TaskHoldReason_TASK_HOLD_REASON_DEFERRED
	default:
		return pb.TaskHoldReason_TASK_HOLD_REASON_UNSPECIFIED
	}
}

func holdReasonFromProto(hr pb.TaskHoldReason) task.HoldReason {
	switch hr {
	case pb.TaskHoldReason_TASK_HOLD_REASON_WAITING_FOR_INPUT:
		return task.HoldReasonWaitingForInput
	case pb.TaskHoldReason_TASK_HOLD_REASON_DEFERRED:
		return task.HoldReasonDeferred
	default:
		return ""
	}
}

func availabilityReasonToProto(reason store.AvailabilityReason) pb.AvailabilityReason {
	switch reason {
	case store.AvailabilityReasonTriage:
		return pb.AvailabilityReason_AVAILABILITY_REASON_TRIAGE
	case store.AvailabilityReasonTerminal:
		return pb.AvailabilityReason_AVAILABILITY_REASON_TERMINAL
	case store.AvailabilityReasonHeld:
		return pb.AvailabilityReason_AVAILABILITY_REASON_HELD
	case store.AvailabilityReasonBlockedByDependency:
		return pb.AvailabilityReason_AVAILABILITY_REASON_BLOCKED_BY_DEPENDENCY
	case store.AvailabilityReasonFutureStartDate:
		return pb.AvailabilityReason_AVAILABILITY_REASON_FUTURE_START_DATE
	default:
		return pb.AvailabilityReason_AVAILABILITY_REASON_UNSPECIFIED
	}
}

func availabilityToProto(availability store.TaskAvailability) *pb.TaskAvailability {
	resp := &pb.TaskAvailability{Available: availability.Available}
	for _, reason := range availability.Reasons {
		resp.Reasons = append(resp.Reasons, availabilityReasonToProto(reason))
	}
	return resp
}

func basicAvailabilityForTask(t *ent.Task) store.TaskAvailability {
	reasons := make([]store.AvailabilityReason, 0, 3)
	if t.Stage == task.StageTriage {
		reasons = append(reasons, store.AvailabilityReasonTriage)
	}
	switch t.Stage {
	case task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
		reasons = append(reasons, store.AvailabilityReasonTerminal)
	}
	if t.HoldReason != nil {
		reasons = append(reasons, store.AvailabilityReasonHeld)
	}
	if t.StartDate != nil && t.StartDate.After(timeNow()) {
		reasons = append(reasons, store.AvailabilityReasonFutureStartDate)
	}
	return store.TaskAvailability{Available: len(reasons) == 0, Reasons: reasons}
}

func timeNow() time.Time {
	return time.Now()
}

func priorityToProto(p task.Priority) pb.TaskPriority {
	switch p {
	case task.PriorityUrgent:
		return pb.TaskPriority_TASK_PRIORITY_URGENT
	case task.PriorityHigh:
		return pb.TaskPriority_TASK_PRIORITY_HIGH
	case task.PriorityNormal:
		return pb.TaskPriority_TASK_PRIORITY_NORMAL
	case task.PriorityLow:
		return pb.TaskPriority_TASK_PRIORITY_LOW
	default:
		return pb.TaskPriority_TASK_PRIORITY_UNSPECIFIED
	}
}

func platformToProto(p collection.Platform) pb.Platform {
	switch p {
	case collection.PlatformFarmtable:
		return pb.Platform_PLATFORM_FARMTABLE
	case collection.PlatformGithub:
		return pb.Platform_PLATFORM_GITHUB
	case collection.PlatformLinear:
		return pb.Platform_PLATFORM_LINEAR
	case collection.PlatformJira:
		return pb.Platform_PLATFORM_JIRA
	case collection.PlatformAsana:
		return pb.Platform_PLATFORM_ASANA
	case collection.PlatformBeads:
		return pb.Platform_PLATFORM_BEADS
	default:
		return pb.Platform_PLATFORM_UNSPECIFIED
	}
}

// platformStringToProto maps a lowercase platform name (as stored in
// RemoteData) to the corresponding proto enum value. Unknown or empty
// strings fall back to PLATFORM_FARMTABLE so native tasks keep their
// existing behaviour.
func platformStringToProto(s string) pb.Platform {
	switch s {
	case "github":
		return pb.Platform_PLATFORM_GITHUB
	case "linear":
		return pb.Platform_PLATFORM_LINEAR
	case "jira":
		return pb.Platform_PLATFORM_JIRA
	case "asana":
		return pb.Platform_PLATFORM_ASANA
	case "beads":
		return pb.Platform_PLATFORM_BEADS
	case "farmtable":
		return pb.Platform_PLATFORM_FARMTABLE
	default:
		return pb.Platform_PLATFORM_FARMTABLE
	}
}

// User type conversions

func userTypeToProto(t string) pb.UserType {
	switch t {
	case "human":
		return pb.UserType_USER_TYPE_HUMAN
	case "agent":
		return pb.UserType_USER_TYPE_AGENT
	case "service_account":
		return pb.UserType_USER_TYPE_SERVICE_ACCOUNT
	default:
		return pb.UserType_USER_TYPE_AGENT
	}
}

func userTypeFromProto(t pb.UserType) string {
	switch t {
	case pb.UserType_USER_TYPE_HUMAN:
		return "human"
	case pb.UserType_USER_TYPE_AGENT:
		return "agent"
	case pb.UserType_USER_TYPE_SERVICE_ACCOUNT:
		return "service_account"
	default:
		return ""
	}
}

func userStatusToProto(s string) pb.IdentityStatus {
	switch s {
	case "active":
		return pb.IdentityStatus_IDENTITY_STATUS_ACTIVE
	case "suspended":
		return pb.IdentityStatus_IDENTITY_STATUS_SUSPENDED
	case "archived":
		return pb.IdentityStatus_IDENTITY_STATUS_ARCHIVED
	default:
		return pb.IdentityStatus_IDENTITY_STATUS_ACTIVE
	}
}

func userToProto(u *ent.User) *pb.User {
	pu := &pb.User{
		Id:     u.ID.String(),
		Name:   u.DisplayName,
		Type:   userTypeToProto(u.Type),
		Status: userStatusToProto(u.Status),
	}
	if u.Email != nil {
		pu.Email = u.Email
	}
	return pu
}

// structOrNilLoggingErr converts an ALREADY-SANITIZED remote_data map into a
// structpb.Struct. On failure it logs and returns nil, which is exactly what
// the discarded-error form `x, _ = structpb.NewStruct(...)` did before it, so
// this changes NO wire behaviour: an unrepresentable map yielded a nil field
// then and yields a nil field now. The only new thing is that it is audible.
//
// It takes the sanitized map rather than the raw one, which keeps
// `sanitizeRemoteData(` lexically on the right-hand side of the assignment for
// remoteDataWriteIsSanitized to find. That property was briefly load-bearing
// and is no longer: the write-site scanner is an AST walk now (see
// remoteDataWriteSites) and does not constrain the shape of either side. This
// form is kept because it is the clearest way to log from a package-level
// converter. IT IS NOT THE GUARD; do not preserve it on the belief that it is.
//
// The message describes what a failure means TODAY: the sanitizer is
// type-preserving, so it can hand structpb a Go type structpb cannot represent
// (map[string]string and []string have no case in structpb.NewValue). If
// representability normalisation is ever added to the sanitizer, THIS MESSAGE
// MUST CHANGE to report an INVARIANT VIOLATION -- a normaliser gap -- because at
// that point a failure here is a bug in the normaliser and not a property of the
// input, and the present wording would send the next reader after the wrong bug.
//
// ON REACHABILITY, STATED RATHER THAN ASSUMED, because this log was queried
// specifically for the collection path.
//
// THERE IS ONE LOG STATEMENT, NOT TWO. Both taskToProto and collectionToProto
// call this function, so the log cannot be shipped for one and withheld from the
// other; the `field` argument is the only thing that differs. That makes the
// question "is this log reachable" a question about the UNION of the two paths,
// and it is REACHABLE ON THE TASK PATH -- see
// TestMapStringStringStaysUnrepresentable_GuardsO1 and
// TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident, which pin the two
// live triggers (a Go-native map[string]string, and a []string from the
// passthrough-GraphQL builder). So it ships as an ordinary reachable log and
// carries NO "unreachable by construction" claim, because that claim would be
// false.
//
// The COLLECTION half has NO CALLER today. That is a caller property, set out
// in full at the collectionToProto call site, and it is NOT a type property: a
// Go-native map[string]string handed to CreateCollection fires this line, which
// a review leg demonstrated by doing exactly that. So it is a reachability
// precondition, not a bound. It does not matter either way for whether this log
// ships, because the shared statement is already reachable via the task path.
func structOrNilLoggingErr(sanitized map[string]any, field string) *structpb.Struct {
	s, err := structpb.NewStruct(sanitized)
	if err != nil {
		logRemoteDataDropped(field, sanitized, err)
		return nil
	}
	return s
}

// remoteDataLogInterval is the minimum gap between two dropped-remote_data log
// lines. Everything in between is counted and reported on the next line out.
const remoteDataLogInterval = time.Minute

// remoteDataSamplerState is one field's worth of sampler state.
type remoteDataSamplerState struct {
	last       time.Time
	suppressed int
}

var (
	remoteDataLogMu sync.Mutex

	// remoteDataLogSamplers is KEYED BY FIELD, and that keying is the whole
	// point of the map.
	//
	// It used to be a single package-level last/suppressed pair, with `field`
	// as a formatting parameter only. That is a defect and not a small one:
	// `labels` is unconditional on the passthrough task path, so
	// "task.remote_data" drops CONTINUOUSLY the moment anybody browses a
	// passthrough collection. With one shared limiter, a task drop inside the
	// preceding minute silences the collection line entirely -- and the
	// collection line is the one that matters, because collection remote_data
	// is the input to the write-authorization gate documented in
	// collectionToProto below. The high-frequency, low-value event was
	// suppressing the low-frequency, high-value one, and the suppressed COUNTER
	// was shared too, so the collection drop was not even visible as a number.
	//
	// It fails in the direction that hides things, and it needed a passthrough
	// collection to be browsed within the same minute to show up, which is why
	// no test caught it.
	//
	// UNBOUNDED-MAP QUESTION, ANSWERED SO NOBODY HAS TO RE-DERIVE IT: the key
	// space is closed. `field` is only ever a string literal written in this
	// package -- "task.remote_data" and "collection.remote_data" today -- so
	// this map has as many entries as there are call sites, not as many as
	// there are requests. If a caller ever passes a per-request value, that is
	// the bug, not this map.
	remoteDataLogSamplers = map[string]*remoteDataSamplerState{}

	// remoteDataLogNow is a seam, not a design flourish: the sampler's whole
	// behaviour is a function of elapsed time, and a test that cannot move the
	// clock can only assert the first line. Overridden by
	// withRemoteDataLogClock in the tests.
	remoteDataLogNow = time.Now
)

// logRemoteDataDropped reports a dropped remote_data conversion at most once per
// remoteDataLogInterval PER FIELD, naming the offending keys and their Go types.
//
// Per field, not per process. See remoteDataLogSamplers for why that distinction
// is load-bearing rather than tidy.
//
// WHY THIS IS SAMPLED RATHER THAN LOGGED PER TASK. `labels` is unconditional on
// the passthrough path and issueLabels returns make([]string, n), never nil, so
// EVERY passthrough task fails conversion. With defaultPageSize at 50 and a cap
// of 200, the unsampled version emitted 50-200 identical lines per list call,
// constant message, no task ID, no issue number, no key -- and any authenticated
// user browsing a passthrough collection triggered it. Phase 1 is live, so that
// went straight into a real log pipeline.
//
// WHY IT IS NOT JUST A COUNTER. A number going up tells you something changed;
// it does not tell you WHAT. The sampled line names the offending keys and
// their Go types, which is what makes the NEXT carrier change diagnosable
// instead of merely visible. When the sanitizer someday grows representability
// normalisation, this line is how the gap gets identified. Keep both halves:
// removing the sample leaves an undiagnosable counter, and removing the count
// hides the volume.
//
// The suppressed count is reported on the next line rather than discarded, so
// the volume signal survives sampling. It is deliberately NOT reset by a timer:
// a burst that stops entirely leaves its tail uncounted until the next drop,
// which is the right trade for a diagnostic that must not itself become a
// background timer in every server process.
func logRemoteDataDropped(field string, sanitized map[string]any, err error) {
	remoteDataLogMu.Lock()
	now := remoteDataLogNow()
	st := remoteDataLogSamplers[field]
	if st == nil {
		st = &remoteDataSamplerState{}
		remoteDataLogSamplers[field] = st
	}
	if !st.last.IsZero() && now.Sub(st.last) < remoteDataLogInterval {
		st.suppressed++
		remoteDataLogMu.Unlock()
		return
	}
	suppressed := st.suppressed
	st.suppressed = 0
	st.last = now
	remoteDataLogMu.Unlock()

	keys := unrepresentableKeys(sanitized)
	if suppressed > 0 {
		log.Printf("%s dropped: sanitized remote_data is not structpb-representable: %v; "+
			"offending keys: %s (+%d further drop(s) suppressed since the last line)",
			field, err, strings.Join(keys, ", "), suppressed)
		return
	}
	log.Printf("%s dropped: sanitized remote_data is not structpb-representable: %v; "+
		"offending keys: %s", field, err, strings.Join(keys, ", "))
}

// unrepresentableKeys names every key structpb cannot represent, with its Go
// type.
//
// structpb.NewStruct's own error mentions only the FIRST key it trips over, and
// the passthrough map has at least two independent offenders (labels []string
// and sub_issues []map[string]any). Reporting only the first would have someone
// fix labels, redeploy, and find the field still nil with no new information in
// the log. This walks the whole map so one line names the whole problem.
//
// Top level only. A nested offender is reported against the top-level key that
// contains it, since that is the key an operator can act on; the %T then names
// the container rather than the inner value, which is a real limit of this
// message and not an oversight.
func unrepresentableKeys(sanitized map[string]any) []string {
	out := make([]string, 0, len(sanitized))
	for k, v := range sanitized {
		if _, err := structpb.NewValue(v); err != nil {
			// %q, NOT %s. These keys are attacker-authored -- they arrive from
			// an uploaded import document or a platform API response -- and
			// they go straight into log.Printf. An unquoted key containing a
			// newline forges log records; one containing a terminal escape
			// acts on whoever tails the log. Quoting also makes leading and
			// trailing whitespace visible, which is the difference between an
			// operator finding the key and an operator not finding it.
			out = append(out, fmt.Sprintf("%q (%T)", k, v))
		}
	}
	sort.Strings(out)
	if len(out) == 0 {
		// NewStruct refused the map but no individual VALUE did, so the fault
		// is in a KEY. This is reachable and deterministic, not a paradox:
		// NewStruct requires every key to be valid UTF-8 and NewValue is never
		// asked about keys at all. map[string]any{"\xff\xfe": "ok"} lands
		// here, with structpb reporting `invalid UTF-8 in string`.
		//
		// An earlier version of this message said "this should not happen",
		// which is worse than unhelpful -- it tells the one operator who ever
		// sees it that they have found an impossible state, when what they have
		// actually found is a remote API or an uploaded document sending a
		// non-UTF-8 key. Go strings do not guarantee UTF-8, so nothing upstream
		// rejects it for us.
		//
		// The keys are not printed here: if one of them is invalid UTF-8, that
		// is exactly the byte sequence that should not be pasted into a log
		// line unescaped.
		return []string{"<no unrepresentable VALUE at top level -- structpb.NewStruct " +
			"refused the map, so the offending element is a KEY, most likely one that " +
			"is not valid UTF-8; NewValue does not check keys>"}
	}
	return out
}

// Entity → Proto conversions

func taskToProto(t *ent.Task) *pb.Task {
	platform := pb.Platform_PLATFORM_FARMTABLE
	if t.RemoteData != nil {
		if p, ok := t.RemoteData["platform"].(string); ok {
			platform = platformStringToProto(p)
		}
	}

	pt := &pb.Task{
		Id:           t.ID.String(),
		Name:         t.Title,
		Phase:        phaseToProto(t.Phase),
		Stage:        stageToProto(t.Stage),
		CollectionId: t.CollectionID.String(),
		Platform:     platform,
		CreatedAt:    timestamppb.New(t.CreatedAt),
		UpdatedAt:    timestamppb.New(t.UpdatedAt),
		Version:      t.Version,
		Availability: availabilityToProto(basicAvailabilityForTask(t)),
	}

	if t.Description != "" {
		pt.Description = &t.Description
	}
	if t.AcceptanceCriteria != nil {
		pt.AcceptanceCriteria = t.AcceptanceCriteria
	}
	if t.NativeLabel != "" {
		pt.NativeStatus = &t.NativeLabel
	}
	if t.Type != "" {
		pt.Type = &t.Type
	}
	if t.Priority != nil {
		p := priorityToProto(*t.Priority)
		pt.Priority = &p
	}
	if t.HoldReason != nil {
		hr := holdReasonToProto(*t.HoldReason)
		pt.HoldReason = &hr
	}
	if t.Rank != nil {
		rank := int64(*t.Rank)
		pt.Rank = &rank
	}
	if t.AssigneeID != nil {
		pt.Assignees = []*pb.User{{Id: t.AssigneeID.String()}}
	}
	if t.ParentTaskID != nil {
		s := t.ParentTaskID.String()
		pt.ParentTaskId = &s
	}
	if t.StartDate != nil {
		pt.StartDate = timestamppb.New(*t.StartDate)
	}
	if t.DueDate != nil {
		pt.DueDate = timestamppb.New(*t.DueDate)
	}
	if t.ClosedAt != nil {
		pt.ClosedAt = timestamppb.New(*t.ClosedAt)
	}
	if t.RemoteData != nil {
		if remoteID, ok := t.RemoteData["remote_id"].(string); ok && remoteID != "" {
			pt.RemoteId = &remoteID
		}
		if remoteURL, ok := t.RemoteData["remote_url"].(string); ok && remoteURL != "" {
			// Validate on the way OUT, not just at the write boundary.
			//
			// Not every value on this path is client-written and passed through
			// validateURLField first. The live GitHub passthrough store
			// synthesises remote_url from the GraphQL response on EVERY
			// ListTasks/GetTask (platform/github/graphql_queries.go:480) and
			// never persists it, so there is no write boundary to guard -- and
			// GitHubPassThroughStore.UpdateTask ignores RemoteData entirely, so
			// the value the server validated in UpdateTask is discarded anyway.
			// Rows written before the write-boundary check existed are the other
			// unvalidated source.
			//
			// Drop rather than error: a bad URL from upstream must not fail the
			// whole read.
			//
			// Note what the degradation actually is, because an earlier version
			// of this comment got it wrong. Omitting the field is NOT the same
			// as safeHref's degradation. ft-inspector-meta.ts:628 guards the
			// whole row on `t.remoteUrl`, so an omitted field makes the External
			// Source row VANISH, whereas safeHref rejecting a value renders a
			// visible inert <span class="external-source-unsafe">. Vanish is the
			// harsher of the two; it is accepted here because the alternative on
			// a read path is failing the whole list.
			if err := validateURLField("remote_url", remoteURL); err == nil {
				pt.RemoteUrl = &remoteURL
			}
		}
		// Sanitize the map too, not just the typed field above.
		//
		// This line serialises the WHOLE of RemoteData, so before it was
		// sanitized the rejected remote_url rode out to the client anyway --
		// dropped from pb.Task.remote_url and re-emitted, byte for byte, inside
		// pb.Task.remote_data one line later. The same GitHub adapters also
		// write the identical URL under "html_url", which no validator had ever
		// looked at and which is the more natural key for a "view on GitHub"
		// link. See sanitizeRemoteData in urlvalidate.go.
		pt.RemoteData = structOrNilLoggingErr(sanitizeRemoteData(t.RemoteData), "task.remote_data")
	}
	if len(t.Labels) > 0 {
		pt.Labels = t.Labels
	}
	if t.Repo != "" || t.Branch != "" || t.CiStatus != nil || len(t.PullRequests) > 0 {
		pt.CodeContext = &pb.CodeContext{}
		if t.Repo != "" {
			pt.CodeContext.Repo = &t.Repo
		}
		if t.Branch != "" {
			pt.CodeContext.Branch = &t.Branch
		}
		if t.CiStatus != nil {
			cs := ciStatusToProto(*t.CiStatus)
			pt.CodeContext.CiStatus = &cs
		}
		for _, pr := range t.PullRequests {
			pt.CodeContext.PullRequests = append(pt.CodeContext.PullRequests, &pb.PullRequest{
				Id:     pr["id"],
				Url:    pr["url"],
				Status: prStatusToProto(pr["status"]),
			})
		}
	}
	if edges := t.Edges.SourceRelationships; len(edges) > 0 {
		for _, r := range edges {
			pt.Relationships = append(pt.Relationships, &pb.Relationship{
				Type:         relationshipTypeToProto(r.Type),
				TargetTaskId: r.TargetTaskID.String(),
			})
		}
	}
	if edges := t.Edges.TargetRelationships; len(edges) > 0 {
		for _, r := range edges {
			pt.Relationships = append(pt.Relationships, &pb.Relationship{
				Type:         invertRelationshipType(relationshipTypeToProto(r.Type)),
				TargetTaskId: r.SourceTaskID.String(),
			})
		}
	}

	return pt
}

func ciStatusToProto(cs task.CiStatus) pb.CIStatus {
	switch cs {
	case task.CiStatusPending:
		return pb.CIStatus_CI_STATUS_PENDING
	case task.CiStatusRunning:
		return pb.CIStatus_CI_STATUS_RUNNING
	case task.CiStatusPassed:
		return pb.CIStatus_CI_STATUS_PASSED
	case task.CiStatusFailed:
		return pb.CIStatus_CI_STATUS_FAILED
	default:
		return pb.CIStatus_CI_STATUS_UNSPECIFIED
	}
}

func ciStatusFromProto(cs pb.CIStatus) string {
	switch cs {
	case pb.CIStatus_CI_STATUS_PENDING:
		return "pending"
	case pb.CIStatus_CI_STATUS_RUNNING:
		return "running"
	case pb.CIStatus_CI_STATUS_PASSED:
		return "passed"
	case pb.CIStatus_CI_STATUS_FAILED:
		return "failed"
	default:
		return "unknown"
	}
}

func prStatusToProto(s string) pb.PullRequestStatus {
	switch s {
	case "open":
		return pb.PullRequestStatus_PULL_REQUEST_STATUS_OPEN
	case "merged":
		return pb.PullRequestStatus_PULL_REQUEST_STATUS_MERGED
	case "closed":
		return pb.PullRequestStatus_PULL_REQUEST_STATUS_CLOSED
	default:
		return pb.PullRequestStatus_PULL_REQUEST_STATUS_UNSPECIFIED
	}
}

func prStatusFromProto(s pb.PullRequestStatus) string {
	switch s {
	case pb.PullRequestStatus_PULL_REQUEST_STATUS_OPEN:
		return "open"
	case pb.PullRequestStatus_PULL_REQUEST_STATUS_MERGED:
		return "merged"
	case pb.PullRequestStatus_PULL_REQUEST_STATUS_CLOSED:
		return "closed"
	default:
		return ""
	}
}

func relationshipTypeToProto(rt relationship.Type) pb.RelationshipType {
	switch rt {
	case relationship.TypeBlocks:
		return pb.RelationshipType_RELATIONSHIP_TYPE_BLOCKS
	case relationship.TypeBlockedBy:
		return pb.RelationshipType_RELATIONSHIP_TYPE_BLOCKED_BY
	case relationship.TypeRelatesTo:
		return pb.RelationshipType_RELATIONSHIP_TYPE_RELATED
	case relationship.TypeDuplicates, relationship.TypeDuplicatedBy:
		return pb.RelationshipType_RELATIONSHIP_TYPE_DUPLICATE
	default:
		return pb.RelationshipType_RELATIONSHIP_TYPE_UNSPECIFIED
	}
}

// invertRelationshipType returns the inverse proto relationship type.
// Used when serializing TargetRelationships so that, e.g., a BLOCKED_BY
// record where this task is the target becomes a BLOCKS from this task's
// perspective.
func invertRelationshipType(rt pb.RelationshipType) pb.RelationshipType {
	switch rt {
	case pb.RelationshipType_RELATIONSHIP_TYPE_BLOCKS:
		return pb.RelationshipType_RELATIONSHIP_TYPE_BLOCKED_BY
	case pb.RelationshipType_RELATIONSHIP_TYPE_BLOCKED_BY:
		return pb.RelationshipType_RELATIONSHIP_TYPE_BLOCKS
	default:
		return rt // RELATED, DUPLICATE are symmetric
	}
}

func sortFieldToString(f pb.SortField) string {
	switch f {
	case pb.SortField_SORT_FIELD_CREATED:
		return "created"
	case pb.SortField_SORT_FIELD_UPDATED:
		return "updated"
	case pb.SortField_SORT_FIELD_PRIORITY:
		return "priority"
	case pb.SortField_SORT_FIELD_DUE_DATE:
		return "due_date"
	default:
		return ""
	}
}

func sortOrderToString(o pb.SortOrder) string {
	switch o {
	case pb.SortOrder_SORT_ORDER_ASC:
		return "asc"
	case pb.SortOrder_SORT_ORDER_DESC:
		return "desc"
	default:
		return "asc"
	}
}

func collectionToProto(c *ent.Collection) *pb.Collection {
	pc := &pb.Collection{
		Id:        c.ID.String(),
		Name:      c.Name,
		Platform:  platformToProto(c.Platform),
		CreatedAt: timestamppb.New(c.CreatedAt),
		UpdatedAt: timestamppb.New(c.UpdatedAt),
	}
	if c.Description != "" {
		pc.Description = &c.Description
	}
	if c.RemoteID != "" {
		pc.RemoteId = &c.RemoteID
	}
	if c.RemoteData != nil {
		// Sanitized on the same terms as pb.Task.remote_data above. A collection
		// carries the same untyped platform payload through the same
		// structpb.Struct into the same client; there is no reason for the two to
		// disagree, and until now they did -- this line shipped the map raw.
		//
		// THIS LOG LINE HAS NO CALLER TODAY. That is a weaker claim than the one
		// this comment used to make, and the weaker claim is the true one.
		//
		// What it used to say was that no input path to a COLLECTION's remote_data
		// could carry a Go type structpb rejects -- a claim about TYPES. That was
		// FALSIFIED: a review leg passed a Go-native map[string]string into
		// CreateCollection and fired this line. Nothing in the type system stops
		// it. The citations were wrong too, and wrongly in the worst way: they
		// pointed at entstore.go:408 and :898, which are the TASK Create/Update
		// SetRemoteData sites, not collection sites at all. Both line numbers
		// RESOLVE, to plausible-looking SetRemoteData calls, so a reader who
		// responsibly went and checked came back with false confidence.
		//
		// The real collection writers are CreateCollection (entstore.go:1366),
		// UpdateCollection (:1399) and ImportCollection (:2117).
		//
		// TWO SEPARATE ARGUMENTS HOLD THIS LINE DOWN AND BOTH ARE LOAD-BEARING.
		// An earlier version of this comment named all three writers and then
		// discharged only two, which is this round's own defect class -- a
		// conclusion written at a wider scope than its evidence -- committed in
		// the very comment convened to remove it.
		//
		// (1) A CALLER argument, covering Create and Update. No in-tree caller
		// populates CreateCollectionParams.RemoteData or
		// UpdateCollectionParams.RemoteData: server.go:1057, server.go:1085 and
		// graph_routing.go:83 all omit the field. A reachability precondition,
		// not a guarantee.
		//
		// (2) A TYPE argument, covering Import -- which the caller argument does
		// NOT cover, because ImportCollection IS populated by an in-tree caller on
		// every call. export_import.go builds importParams.Collection.RemoteData
		// from an attacker-uploaded document -- the field initialised as
		// `RemoteData: sanitizeRemoteData(doc.Collection.RemoteData)` in
		// ImportCollection -- and reaches the store at
		// `s.store.ImportCollection(ctx, importParams)` in the same function.
		// What stops it is that the payload arrives through encoding/json
		// into a map[string]any, with no UseNumber on the decoder, so every value
		// is nil, bool, float64, string, []any or map[string]any -- exactly
		// structpb's representable set -- and sanitizeRemoteData preserves types,
		// so it stays that way.
		//
		// YES, (2) IS A TYPE ARGUMENT, AND THIS COMMENT CALLS A TYPE ARGUMENT
		// FALSIFIED A FEW LINES ABOVE. Both are right, and the difference is
		// scope, not subject. What was falsified was a UNIVERSAL claim -- that NO
		// input path could carry a hostile type -- and one counterexample killed
		// it. What holds here is a BOUNDED claim about one writer whose decoder is
		// known and named. Do not "simplify" this by deleting (2) as a discredited
		// style of reasoning: deleting it leaves Import undischarged, which is
		// exactly how this comment was wrong before.
		//
		// THE INVALIDATING EVENTS, NAMED. There are THREE, and the third is the
		// likeliest:
		//   - Setting RemoteData on either param struct arms Create or Update.
		//     One new field assignment at one call site, by someone with no
		//     reason to read this comment.
		//   - Decoding the import document with UseNumber, or feeding
		//     ImportCollectionParams from any source that is not encoding/json,
		//     arms Import. It breaks argument (2) without touching argument (1),
		//     so the caller argument will still look satisfied.
		//   - Adding a RemoteData field to the ent.Collection STRUCT LITERAL in
		//     syntheticCollection (internal/platform/github/passthrough.go:645)
		//     arms this line while BYPASSING BOTH PARAM STRUCTS, so neither
		//     argument above is even engaged. That literal is returned by
		//     CreateCollection (:630), GetCollection (:638) and ListCollections
		//     (:642), making it the collection object for every GitHub
		//     PASSTHROUGH collection. Today it sets no RemoteData at all, so the
		//     != nil guard above skips this line entirely for that path.
		// Expect this to fire eventually; that is the design, not a defect.
		//
		// ─────────────────────────────────────────────────────────────────────
		// AND WHEN IT FIRES, THE CONSEQUENCE IS NOT "A FIELD GOES MISSING."
		// THIS FIELD IS ONE OF THE TWO INPUTS TO A WRITE-AUTHORIZATION GATE.
		// ─────────────────────────────────────────────────────────────────────
		//
		// THE INVARIANT, WHICH IS THE LOAD-BEARING SENTENCE IN THIS COMMENT:
		//
		//   The GitHub capability set is reachable only by a collection object that
		//   carries platform GITHUB *and* a remote_data map containing writable=true,
		//   TOGETHER, IN ONE OBJECT. No producer in this tree yields both. That
		//   conjunction failing is the entire gate.
		//
		// web/src/capabilities.ts getCapabilities has exactly one branch that reads
		// collection remote_data, and it is the GITHUB branch:
		//
		//     if (platform === FARMTABLE) return ALL_ENABLED;   // never reads it
		//     if (platform === GITHUB) {
		//         const rd = collection.remoteData;
		//         if (rd && rd.writable === true) return GITHUB_CAPABILITIES;
		//     }
		//     return ALL_DISABLED;
		//
		// GITHUB_CAPABILITIES enables nine write operations. ft-app.ts
		// isCollectionWritable branches on the same key.
		//
		// AND NOTHING IN GO ENFORCES ANY OF IT. `writable` has no functional Go
		// reader -- the identifier appears in Go only in comments. There is no
		// server-side notion of a read-only collection, so the nine operations are
		// gated in the browser and nowhere else. A caller with a token and curl is
		// not subject to this gate at all. Whoever arms it is not enabling a feature
		// behind an existing control; they are creating a control that only one
		// client honours.
		//
		// THAT SENTENCE IS ABOUT `writable`. DO NOT PROMOTE IT TO "THE PLANTED KEY".
		// Import copies an uploaded document's collection remote_data into storage
		// with NO KEY VALIDATION, so `writable` is not the only thing that can be
		// planted -- it is only the one this gate is about. A neighbouring comment
		// once generalised this to "the FARMTABLE path never consults the planted
		// key", which is a claim about EVERY key and is a different, larger claim
		// than the one the evidence supports.
		//
		// COLLECTION-SCOPE remote_data READERS IN GO, ENUMERATED AT af9ea8c.
		// AS-OF-THIS-COMMIT, NOT AN INVARIANT.
		//
		//   ENUMERATED 8 = FLAGGED 1 + EXCLUDED 7
		//   instrument: grep -rn 'RemoteData\[' --include='*.go' internal/
		//               | grep -v '_test.go'   (then resolve each receiver's type)
		//
		//   FLAGGED, i.e. actually reads a COLLECTION's map:
		//     - collectionSupportsGraph, in internal/server/graph_support.go.
		//       Key `graph_queries`, not `writable`.
		//   EXCLUDED 7, all reading a TASK's map or WRITING a params struct:
		//     taskToProto x3 (platform, remote_id, remote_url), BeadsAdapter and
		//     GitHubAdapter buildRemoteIDIndex (remote_id each), UpdateTask x2
		//     (writes remote_id and remote_url, never reads them).
		//
		// SO: `writable` has no functional Go reader, but collection remote_data
		// DOES, and a planted `graph_queries` IS consulted in Go. It is inert today
		// only because collectionSupportsGraph's single caller takes a farmtable
		// early return before reaching it -- a THIRD farmtable early return, in a
		// file this round never opened. It is not named here beyond this sentence:
		// it is tracked separately as audit Finding 9 and is deliberately NOT part
		// of this round. Do not treat its absence from the two-conjunct model as
		// evidence that the model covers it. IT DOES NOT.
		//
		// WHY THERE IS NO NUMBER IN THE PARAGRAPH ABOVE, AND PLEASE DO NOT ADD ONE.
		// An earlier draft of this comment said "the two producers". A count is a
		// population claim with nothing guarding it: the day someone adds another
		// producer the sentence is false and no test goes red. The count is the part
		// that rots. This whole round exists because instruments measured a result
		// and assumed a population, so the invariant is stated as a conjunction and
		// the producers are listed BELOW IT, under a SHA, as an observation rather
		// than a law.
		//
		// PRODUCERS OF A COLLECTION OBJECT, ENUMERATED AT c108acb. AS-OF-THIS-COMMIT,
		// NOT AN INVARIANT. Each with the one-line reason it cannot yield both halves.
		//
		//   - CreateCollection RPC, server.go:1035, platform via platformFromProto
		//     (:2144), persisted by entstore.go:1359. PLATFORM IS CALLER-CONTROLLED
		//     and the only extra condition is a non-empty remote_id (:1053), never
		//     validated against GitHub. Cannot yield both because no caller populates
		//     CreateCollectionParams.RemoteData -- argument (1) above.
		//
		//   - EntStore.ImportCollection, entstore.go:2112. PLATFORM IS CALLER-
		//     CONTROLLED, from the params struct. Cannot yield both only because the
		//     layer above it, server/export_import.go ImportCollection, refuses a
		//     non-farmtable document (the
		//     `doc.Collection.Platform != string(collection.PlatformFarmtable)`
		//     guard) and then hardcodes farmtable into the params anyway (the
		//     `Platform: collection.PlatformFarmtable` field in the importParams
		//     literal).
		//
		//   - syntheticCollection, internal/platform/github/passthrough.go:645,
		//     returned by :630, :638 and :642. Platform is GITHUB and it is the
		//     collection object for every GitHub PASSTHROUGH view. Cannot yield both
		//     because the struct literal sets no RemoteData field at all. In-memory
		//     only; never persisted.
		//
		//   - Hardcoded farmtable, so out of scope by platform, all three citing the
		//     enclosing function rather than a line: the
		//     `Platform: collection.PlatformFarmtable` field in ImportCollection's
		//     importParams literal (export_import.go); the exportCollection literal
		//     in convertBeadsToExportDocument (beads_import.go); and the
		//     CreateCollectionParams literal in loadEphemeralStore
		//     (graph_routing.go).
		//
		// ARMING EDITS, RANKED BY HOW ORDINARY THEY LOOK, WHICH IS THE ONLY RANKING
		// THAT MATTERS FOR A COMMENT.
		//
		//   1. THE IMPORT PATH, AND IT IS NOT CLOSE. Look at entstore.go:2112-2118:
		//      SetPlatform(p.Collection.Platform) and, three lines later,
		//      SetRemoteData(p.Collection.RemoteData) -- BOTH INPUTS TO THE GATE,
		//      WRITTEN FROM THE SAME CALLER-SUPPLIED STRUCT, IN ONE STATEMENT AND THE
		//      BRANCH UNDER IT. Not two features that would have to meet. It is held
		//      shut one layer up, in export_import.go ImportCollection, by the
		//      `doc.Collection.Platform != string(collection.PlatformFarmtable)`
		//      guard and the `Platform: collection.PlatformFarmtable` field in the
		//      importParams literal, and BOTH ARE REMOVED BY THE SAME SINGLE
		//      FEATURE: "support importing a GitHub collection export." The
		//      remote_data half is already wired from the uploaded document (the
		//      `RemoteData: sanitizeRemoteData(doc.Collection.RemoteData)` field in
		//      that same literal) because sanitizeRemoteData
		//      (urlvalidate.go:250) is a URL sanitizer, not a key allowlist -- it
		//      keeps every key it does not recognise as URL-bearing, and `writable` is
		//      not URL-bearing, so it passes through untouched. Nobody implementing
		//      GitHub import is thinking about a browser capability gate.
		//
		//   2. The RPC path. One line ADDED that does not exist today: the RPC copying
		//      a request field into CreateCollectionParams.RemoteData. Ordinary proto
		//      plumbing in server.go, nowhere near GitHub. entstore.go:1366 is already
		//      `if p.RemoteData != nil { create.SetRemoteData(...) }`, so the store
		//      side is wired and waiting.
		//
		//   3. Adding RemoteData to the syntheticCollection literal. Requires editing
		//      a GitHub file, where a reviewer at least has a chance of thinking about
		//      GitHub authorization.
		//
		// If you are making any of these three: the fix is a server-side check, and
		// this comment is the notice that there is not one.
		//
		// The nil-revokes direction still holds and is the benign one: a nil here
		// makes the flag unreadable and the dashboard treats unreadable as
		// not-writable, so THIS LINE SILENTLY REVOKES anything that ever sets it.
		// Fail-closed, which is why it logs rather than staying quiet. Bounded to this
		// tree on purpose -- out-of-tree writers are not a population these searches
		// could bound.
		//
		// Note what the old reason also got wrong. It is NOT "collections are read
		// back out of the database": Ent's Create().Save() returns the entity
		// holding the ORIGINAL in-memory map, with no round-trip, so a caller that
		// converted a freshly-created collection would see the Go types it passed
		// in. The storage round-trip protects nothing here.
		pc.RemoteData = structOrNilLoggingErr(sanitizeRemoteData(c.RemoteData), "collection.remote_data")
	}
	return pc
}

func commentToProto(c *ent.Comment) *pb.Comment {
	return &pb.Comment{
		Id:        c.ID.String(),
		TaskId:    c.TaskID.String(),
		Author:    &pb.User{Id: c.AuthorID.String()},
		Body:      c.Body,
		CreatedAt: timestamppb.New(c.CreatedAt),
		UpdatedAt: timestamppb.New(c.UpdatedAt),
	}
}

func changeToProto(c *ent.Change) *pb.Change {
	ch := &pb.Change{
		Id:        c.ID.String(),
		TaskId:    c.TaskID.String(),
		Field:     c.FieldName,
		ChangedBy: &pb.User{Id: c.AuthorID.String()},
		ChangedAt: timestamppb.New(c.CreatedAt),
	}
	if c.OldValue != "" {
		ch.OldValue, _ = structpb.NewValue(c.OldValue)
	}
	if c.NewValue != "" {
		ch.NewValue, _ = structpb.NewValue(c.NewValue)
	}
	return ch
}

// ── LinkedAccount conversions ──

// linkedAccountToProto converts an ent LinkedAccount to the proto representation.
// SECURITY: auth_token is intentionally omitted from the response.
func linkedAccountToProto(la *ent.LinkedAccount) *pb.LinkedAccount {
	pla := &pb.LinkedAccount{
		Id:           la.ID.String(),
		CollectionId: la.CollectionID.String(),
		Platform:     linkedAccountPlatformToProto(la.Platform),
		AuthMethod:   linkedAccountAuthMethodToProto(la.AuthMethod),
		Scopes:       la.Scopes,
		Status:       linkedAccountStatusToProto(la.Status),
		CreatedAt:    timestamppb.New(la.CreatedAt),
		UpdatedAt:    timestamppb.New(la.UpdatedAt),
	}
	if la.RemoteUserID != "" {
		pla.RemoteUserId = &la.RemoteUserID
	}
	if la.ExpiresAt != nil {
		pla.ExpiresAt = timestamppb.New(*la.ExpiresAt)
	}
	return pla
}

func linkedAccountPlatformToProto(p linkedaccount.Platform) pb.Platform {
	switch p {
	case linkedaccount.PlatformGithub:
		return pb.Platform_PLATFORM_GITHUB
	case linkedaccount.PlatformLinear:
		return pb.Platform_PLATFORM_LINEAR
	case linkedaccount.PlatformJira:
		return pb.Platform_PLATFORM_JIRA
	case linkedaccount.PlatformAsana:
		return pb.Platform_PLATFORM_ASANA
	case linkedaccount.PlatformBeads:
		return pb.Platform_PLATFORM_BEADS
	default:
		return pb.Platform_PLATFORM_UNSPECIFIED
	}
}

func linkedAccountPlatformFromProto(p pb.Platform) string {
	switch p {
	case pb.Platform_PLATFORM_GITHUB:
		return "github"
	case pb.Platform_PLATFORM_LINEAR:
		return "linear"
	case pb.Platform_PLATFORM_JIRA:
		return "jira"
	case pb.Platform_PLATFORM_ASANA:
		return "asana"
	case pb.Platform_PLATFORM_BEADS:
		return "beads"
	default:
		return ""
	}
}

func linkedAccountAuthMethodToProto(am linkedaccount.AuthMethod) pb.AuthMethod {
	switch am {
	case linkedaccount.AuthMethodPat:
		return pb.AuthMethod_AUTH_METHOD_PAT
	case linkedaccount.AuthMethodOauth:
		return pb.AuthMethod_AUTH_METHOD_OAUTH2_PKCE
	case linkedaccount.AuthMethodGithubApp:
		return pb.AuthMethod_AUTH_METHOD_GITHUB_APP
	default:
		return pb.AuthMethod_AUTH_METHOD_UNSPECIFIED
	}
}

func linkedAccountAuthMethodFromProto(am pb.AuthMethod) string {
	switch am {
	case pb.AuthMethod_AUTH_METHOD_PAT:
		return "pat"
	case pb.AuthMethod_AUTH_METHOD_OAUTH2_PKCE:
		return "oauth"
	case pb.AuthMethod_AUTH_METHOD_GITHUB_APP:
		return "github_app"
	default:
		return ""
	}
}

func linkedAccountStatusToProto(s linkedaccount.Status) pb.LinkedAccountStatus {
	switch s {
	case linkedaccount.StatusActive:
		return pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_ACTIVE
	case linkedaccount.StatusExpired:
		return pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_EXPIRED
	case linkedaccount.StatusRevoked:
		return pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_REVOKED
	default:
		return pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_UNSPECIFIED
	}
}

func linkedAccountStatusFromProto(s pb.LinkedAccountStatus) string {
	switch s {
	case pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_ACTIVE:
		return "active"
	case pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_EXPIRED:
		return "expired"
	case pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_REVOKED:
		return "revoked"
	default:
		return ""
	}
}
