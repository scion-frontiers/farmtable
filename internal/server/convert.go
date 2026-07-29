package server

import (
	"log"
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
		log.Printf("%s dropped: sanitized remote_data is not structpb-representable: %v", field, err)
		return nil
	}
	return s
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
		// UpdateCollection (:1399) and ImportCollection (:2117). The reason this
		// line does not fire is that NO IN-TREE CALLER POPULATES
		// CreateCollectionParams.RemoteData OR UpdateCollectionParams.RemoteData.
		// server.go:1057, server.go:1085 and graph_routing.go:83 all omit the
		// field. That is a CALLER property, not a type property, and it is a
		// reachability precondition rather than a guarantee.
		//
		// THE INVALIDATING EVENT, NAMED: anyone setting RemoteData on either param
		// struct arms this line. Not a rename, not a refactor -- one new field
		// assignment at one call site, by someone who has no reason to read this
		// comment. Expect it to fire eventually; that is the design, not a defect.
		//
		// AND WHEN IT FIRES, THE CONSEQUENCE IS NOT "a field goes missing." The
		// dashboard reads collection remote_data as a WRITE-AUTHORIZATION GATE:
		// capabilities.ts getCapabilities and ft-app.ts isCollectionWritable both
		// branch on the `writable` key to choose between the GitHub capability set
		// and everything-disabled. If this conversion returns nil, that key is
		// undefined and the UI SILENTLY DROPS TO READ-ONLY. It fails CLOSED, so it
		// is not a vulnerability -- but a user losing their write buttons with no
		// error message is a support ticket nobody will trace back to a dropped
		// struct conversion. That is why this line logs rather than staying quiet.
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
