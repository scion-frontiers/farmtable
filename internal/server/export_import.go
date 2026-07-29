package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/relationship"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type exportDocument struct {
	FormatVersion int                  `json:"format_version"`
	ExportedAt    time.Time            `json:"exported_at"`
	Generator     string               `json:"generator"`
	Collection    exportCollection     `json:"collection"`
	Users         []exportUser         `json:"users"`
	Tasks         []exportTask         `json:"tasks"`
	Comments      []exportComment      `json:"comments"`
	Relationships []exportRelationship `json:"relationships"`
	Changes       []exportChange       `json:"changes"`
}

type exportCollection struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Platform    string         `json:"platform"`
	RemoteData  map[string]any `json:"remote_data,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

type exportUser struct {
	ID          string  `json:"id"`
	DisplayName string  `json:"display_name"`
	Email       *string `json:"email"`
	Type        string  `json:"type"`
	Status      string  `json:"status"`
}

type exportTask struct {
	ID                 string              `json:"id"`
	Title              string              `json:"title"`
	Description        string              `json:"description"`
	Phase              string              `json:"phase"`
	Stage              string              `json:"stage"`
	HoldReason         *string             `json:"hold_reason,omitempty"`
	NativeLabel        string              `json:"native_label"`
	Type               string              `json:"type"`
	Priority           *string             `json:"priority"`
	Rank               *int                `json:"rank,omitempty"`
	AssigneeID         *string             `json:"assignee_id"`
	ParentTaskID       *string             `json:"parent_task_id"`
	StartDate          *time.Time          `json:"start_date"`
	DueDate            *time.Time          `json:"due_date"`
	ClosedAt           *time.Time          `json:"closed_at"`
	CreatedAt          time.Time           `json:"created_at"`
	UpdatedAt          time.Time           `json:"updated_at"`
	AcceptanceCriteria *string             `json:"acceptance_criteria"`
	Labels             []string            `json:"labels"`
	Repo               string              `json:"repo"`
	Branch             string              `json:"branch"`
	CIStatus           *string             `json:"ci_status"`
	PullRequests       []map[string]string `json:"pull_requests"`
	RemoteData         map[string]any      `json:"remote_data"`
}

type exportComment struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`
	AuthorID  string    `json:"author_id"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type exportRelationship struct {
	ID           string `json:"id"`
	SourceTaskID string `json:"source_task_id"`
	TargetTaskID string `json:"target_task_id"`
	Type         string `json:"type"`
}

type exportChange struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`
	AuthorID  string    `json:"author_id"`
	FieldName string    `json:"field_name"`
	OldValue  string    `json:"old_value"`
	NewValue  string    `json:"new_value"`
	CreatedAt time.Time `json:"created_at"`
}

// serverAuthoredFieldPrefix namespaces change rows that the server writes about
// an import rather than importing from the payload. Payload documents may not
// author rows in this namespace: if they could, an attacker could plant a
// forged provenance stamp naming somebody else and the remedy below would
// become a weapon.
const serverAuthoredFieldPrefix = "server:"

// ImportProvenanceField is the change field_name under which ImportCollection
// records who actually performed an import and when the server actually
// ingested it.
//
// WHY THIS EXISTS. ImportCollection accepts a document whose change and comment
// rows carry an author, which resolveImportUsers binds to a REAL existing
// account by matching the payload's email, and a created_at that is taken
// verbatim from the payload. Without a server-authored record, a fabricated row
// attributed to a real person at a time of the attacker's choosing is
// indistinguishable from a genuine one.
//
// Holding collection:admin does not make this acceptable. Wildcard permission
// lets a principal act as THEMSELVES with full authority; it does not entitle
// them to author history attributed to a DIFFERENT user, nor to choose the
// timestamp that history claims. Impersonation and backdating are privileges
// nobody legitimately holds, so "the importer is already privileged" is not an
// argument against recording who they were.
//
// Provenance is recorded per imported task, which covers every row the import
// creates: ImportCollection only ever CREATES tasks (taskMapping is populated
// exclusively with uuid.New(), and the store's import transaction uses
// tx.Task.Create with no upsert or update path), so every task an import
// touches is a task that import created.
//
// It is surfaced through the existing Change message rather than a new proto
// field. The generated protobuf code is committed and its generator versions
// are pinned nowhere in this repo, so regenerating it to add one field would
// produce a large unreviewable diff. Reusing the shipped
// ListChanges -> changeToProto read path costs no codegen at all, and follows
// the task_state_migration precedent already in this file.
const ImportProvenanceField = serverAuthoredFieldPrefix + "import_provenance"

// unattributableImportMessage explains a refused import to whoever has to fix
// it. This text is the entire user-facing surface of the refusal, so it states
// three things in order: what was refused, why, and which specific knob to turn.
//
// It is scoped deliberately. The refusal denies ImportCollection and nothing
// else, and it cannot affect the embedded `ft` CLI, which always provisions a
// local user and token and so is never open-access. Saying so prevents an
// operator reading this from concluding that local tooling is broken too.
//
// The cause never changes the outcome, only this sentence.
func unattributableImportMessage(cause OpenAccessCause) string {
	const problem = "cannot import: an import records who performed it, and this server " +
		"cannot identify the caller, so the imported history would name nobody. " +
		"Importing without attribution is refused rather than recorded as \"unknown\"."
	const scope = " Only collection import is affected; other operations are unchanged, " +
		"and the embedded `ft` CLI is unaffected because it always authenticates locally."

	switch cause {
	case OpenAccessCauseDeliberate:
		return problem + " This server was started in open-access mode " +
			"(FARMTABLE_OPEN_ACCESS=1), which disables identity enforcement. " +
			"To import, run the server with authentication enabled (set FARMTABLE_TOKEN " +
			"and unset FARMTABLE_OPEN_ACCESS) and retry as an authenticated user." + scope
	case OpenAccessCauseMissingToken:
		return problem + " This server has no authentication configured because " +
			"FARMTABLE_TOKEN is not set, so it accepted this request unauthenticated. " +
			"Set FARMTABLE_TOKEN and restart, then retry as an authenticated user." + scope
	default:
		return problem + " No identity reached this request, which means the server " +
			"is running without authentication configured. Enable authentication " +
			"(set FARMTABLE_TOKEN) and retry as an authenticated user." + scope
	}
}

// importProvenance is the JSON body of an ImportProvenanceField change row.
//
// ImportedAt is the server's own clock. It deliberately sits ALONGSIDE the
// payload's timestamps rather than replacing them: imports legitimately carry
// historical timestamps, so the point is not to overwrite what the payload
// claims but to make the claim and the actual ingestion distinguishable.
type importProvenance struct {
	// ImportedBy is always a real caller. Import refuses to run without one, so
	// this field has no empty, placeholder or "unknown" state to interpret.
	ImportedBy   string `json:"imported_by"`
	ImportedAt   string `json:"imported_at"`
	SourceFormat string `json:"source_format"`
	Generator    string `json:"generator,omitempty"`
	// ClaimedCollectionCreatedAt is what the payload asserted, kept next to the
	// actual ingestion time above.
	ClaimedCollectionCreatedAt string `json:"claimed_collection_created_at,omitempty"`
}

func (s *FarmTableService) ExportCollection(ctx context.Context, req *pb.ExportCollectionRequest) (*pb.ExportCollectionResponse, error) {
	if err := RequireScope(ctx, ScopeCollectionRead); err != nil {
		return nil, err
	}
	collectionID, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid collection id: %v", err)
	}
	if err := RequireCollectionAccess(ctx, collectionID); err != nil {
		return nil, err
	}
	coll, err := s.store.GetCollection(ctx, collectionID)
	if err != nil {
		return nil, storeErr(err, "collection")
	}
	if coll.Platform != collection.PlatformFarmtable {
		return nil, status.Error(codes.FailedPrecondition, "export only supports farmtable platform collections")
	}

	tasks, err := s.store.ListAllTasksForCollection(ctx, store.ListAllTasksForCollectionParams{CollectionID: coll.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "listing tasks: %v", err)
	}
	taskIDs := make(map[uuid.UUID]struct{}, len(tasks))
	userIDs := map[uuid.UUID]struct{}{}
	doc := exportDocument{
		FormatVersion: 2,
		ExportedAt:    time.Now().UTC(),
		Generator:     "farmtable",
		Collection: exportCollection{
			ID:          coll.ID.String(),
			Name:        coll.Name,
			Description: coll.Description,
			Platform:    string(coll.Platform),
			RemoteData:  coll.RemoteData,
			CreatedAt:   coll.CreatedAt,
			UpdatedAt:   coll.UpdatedAt,
		},
		Users:         []exportUser{},
		Tasks:         make([]exportTask, 0, len(tasks)),
		Comments:      []exportComment{},
		Relationships: []exportRelationship{},
		Changes:       []exportChange{},
	}
	for _, t := range tasks {
		taskIDs[t.ID] = struct{}{}
		doc.Tasks = append(doc.Tasks, taskExport(t))
		if t.AssigneeID != nil {
			userIDs[*t.AssigneeID] = struct{}{}
		}
	}

	comments, err := s.store.ListAllCommentsForCollection(ctx, store.ListAllCommentsForCollectionParams{CollectionID: coll.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "listing comments: %v", err)
	}
	commentsByTask := make(map[uuid.UUID][]*ent.Comment)
	for _, c := range comments {
		commentsByTask[c.TaskID] = append(commentsByTask[c.TaskID], c)
	}
	var changesByTask map[uuid.UUID][]*ent.Change
	if req.GetIncludeChanges() {
		changes, err := s.store.ListAllChangesForCollection(ctx, store.ListAllChangesForCollectionParams{CollectionID: coll.ID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "listing changes: %v", err)
		}
		changesByTask = make(map[uuid.UUID][]*ent.Change)
		for _, c := range changes {
			changesByTask[c.TaskID] = append(changesByTask[c.TaskID], c)
		}
	}
	for _, t := range tasks {
		for _, c := range commentsByTask[t.ID] {
			doc.Comments = append(doc.Comments, exportComment{
				ID:        c.ID.String(),
				TaskID:    c.TaskID.String(),
				AuthorID:  c.AuthorID.String(),
				Body:      c.Body,
				CreatedAt: c.CreatedAt,
				UpdatedAt: c.UpdatedAt,
			})
			userIDs[c.AuthorID] = struct{}{}
		}
		if req.GetIncludeChanges() {
			for _, c := range changesByTask[t.ID] {
				// Server-authored rows ARE exported. They are audit content: an
				// operator reading an export should be able to see that this
				// collection arrived by import and who performed it. Their
				// author is always a real account (import refuses an
				// unidentifiable caller), so they add that account to users[]
				// like any other change author and the document stays
				// self-consistent. Re-importing such a document drops them with
				// a warning rather than trusting them; see ImportProvenanceField.
				doc.Changes = append(doc.Changes, exportChange{
					ID:        c.ID.String(),
					TaskID:    c.TaskID.String(),
					AuthorID:  c.AuthorID.String(),
					FieldName: c.FieldName,
					OldValue:  c.OldValue,
					NewValue:  c.NewValue,
					CreatedAt: c.CreatedAt,
				})
				userIDs[c.AuthorID] = struct{}{}
			}
		}
	}

	relationships, err := s.store.ListAllRelationshipsForCollection(ctx, store.ListAllRelationshipsForCollectionParams{CollectionID: coll.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "listing relationships: %v", err)
	}
	droppedRelationships := 0
	for _, r := range relationships {
		_, sourceOK := taskIDs[r.SourceTaskID]
		_, targetOK := taskIDs[r.TargetTaskID]
		if !sourceOK || !targetOK {
			droppedRelationships++
			continue
		}
		doc.Relationships = append(doc.Relationships, exportRelationship{
			ID:           r.ID.String(),
			SourceTaskID: r.SourceTaskID.String(),
			TargetTaskID: r.TargetTaskID.String(),
			Type:         string(r.Type),
		})
	}

	var userIDList []uuid.UUID
	for id := range userIDs {
		userIDList = append(userIDList, id)
	}
	sort.Slice(userIDList, func(i, j int) bool { return userIDList[i].String() < userIDList[j].String() })
	if len(userIDList) > 0 {
		users, err := s.store.GetUsersByIDs(ctx, userIDList)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "getting users: %v", err)
		}
		usersByID := make(map[uuid.UUID]*ent.User, len(users))
		for _, u := range users {
			usersByID[u.ID] = u
		}
		for _, id := range userIDList {
			u, ok := usersByID[id]
			if !ok {
				return nil, storeErr(store.ErrNotFound, "user")
			}
			doc.Users = append(doc.Users, exportUser{
				ID:          u.ID.String(),
				DisplayName: u.DisplayName,
				Email:       u.Email,
				Type:        u.Type,
				Status:      u.Status,
			})
		}
	}

	data, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, status.Errorf(codes.Internal, "encoding export: %v", err)
	}
	resp := &pb.ExportCollectionResponse{Data: data}
	if droppedRelationships > 0 {
		resp.Warnings = append(resp.Warnings, fmt.Sprintf("Dropped %d cross-collection relationships", droppedRelationships))
	}
	return resp, nil
}

func (s *FarmTableService) ImportCollection(ctx context.Context, req *pb.ImportCollectionRequest) (*pb.ImportCollectionResponse, error) {
	// The importer's identity is the one thing the server knows for certain
	// about this request. It is recorded as provenance on every task the import
	// creates; see ImportProvenanceField.
	importerID, err := RequireIdentity(ctx)
	if err != nil {
		return nil, err
	}
	// RequireIdentity has two distinct absent-identity outcomes and BOTH must be
	// loud. It returns an error when auth is enforced but the caller has no
	// usable identity — handled above. It returns (uuid.Nil, nil) in open-access
	// mode, where no auth interceptor is configured; that is the case below.
	//
	// Import refuses rather than recording a placeholder. Writing "", "unknown",
	// "system" or the zero UUID and proceeding would make absence read as
	// permission, which is the exact habit this change exists to correct — and
	// planting a fresh instance of it inside the remedy would be worse than the
	// original defect, because the stamp would then look authoritative while
	// naming nobody. An import whose actor cannot be established is not
	// auditable, so it does not happen.
	//
	// Note what this does NOT do: it does not inspect the caller's type, scopes,
	// or provisioning. It requires only that a caller exists and has an id. The
	// identity model belongs to the auth architecture and may change underneath
	// this code; these audit semantics must not shift when it does.
	if importerID == uuid.Nil {
		return nil, status.Error(codes.FailedPrecondition, unattributableImportMessage(s.openAccessCause))
	}
	if err := RequireScope(ctx, ScopeCollectionAdmin); err != nil {
		return nil, err
	}
	// Server clock, captured once so every row of one import shares an
	// ingestion time.
	ingestedAt := time.Now().UTC()
	format := detectImportFormat(req.GetData())

	var doc exportDocument
	var beadsWarnings []string

	switch format {
	case "beads":
		issues, parseWarnings, err := parseBeadsJSONL(req.GetData())
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid Beads JSONL: %v", err)
		}
		beadsWarnings = parseWarnings
		collName := "Beads Import"
		if req.Name != nil && req.GetName() != "" {
			collName = req.GetName()
		}
		converted, convertWarnings, err := convertBeadsToExportDocument(issues, collName)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "converting Beads data: %v", err)
		}
		beadsWarnings = append(beadsWarnings, convertWarnings...)
		converted.Relationships = deduplicateRelationships(converted.Relationships)
		doc = converted
	case "farmtable":
		decoder := json.NewDecoder(bytes.NewReader(req.GetData()))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&doc); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid export JSON: %v", err)
		}
		if doc.FormatVersion != 1 && doc.FormatVersion != 2 {
			return nil, status.Errorf(codes.InvalidArgument, "unsupported format_version: %d", doc.FormatVersion)
		}
		if doc.Generator != "" && doc.Generator != "farmtable" {
			return nil, status.Errorf(codes.InvalidArgument, "unsupported generator: %s", doc.Generator)
		}
		if doc.Collection.Platform != string(collection.PlatformFarmtable) {
			return nil, status.Error(codes.FailedPrecondition, "import only supports farmtable platform collections")
		}
	default:
		return nil, status.Errorf(codes.InvalidArgument, "unsupported import format: data must be Farmtable JSON or Beads JSONL")
	}

	taskMapping := make(map[string]uuid.UUID, len(doc.Tasks))
	for _, exportedTask := range doc.Tasks {
		if _, err := uuid.Parse(exportedTask.ID); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid task id %q: %v", exportedTask.ID, err)
		}
		taskMapping[exportedTask.ID] = uuid.New()
	}
	hasOldBlocker := oldBlockedByEvidence(doc.Relationships)

	orderedTasks, err := orderImportTasks(doc.Tasks)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	importParams := store.ImportCollectionParams{
		Collection: store.ImportCollection{
			Name:        doc.Collection.Name,
			Description: doc.Collection.Description,
			Platform:    collection.PlatformFarmtable,
			RemoteData:  doc.Collection.RemoteData,
			CreatedAt:   doc.Collection.CreatedAt,
			UpdatedAt:   doc.Collection.UpdatedAt,
		},
	}
	if req.Name != nil {
		importParams.Collection.Name = req.GetName()
	}
	if importParams.Collection.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "collection name is required")
	}

	userIDs, err := validateImportReferences(doc, taskMapping)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	userMapping, usersToCreate, usersMatched, usersCreated, warnings, err := s.resolveImportUsers(ctx, doc.Users, userIDs, req.GetDryRun())
	if err != nil {
		return nil, err
	}
	importParams.Users = usersToCreate
	stats := &pb.ImportStats{
		UsersMatched:  int32(usersMatched),
		UsersCreated:  int32(usersCreated),
		Tasks:         int32(len(doc.Tasks)),
		Comments:      int32(len(doc.Comments)),
		Relationships: int32(len(doc.Relationships)),
		Changes:       int32(len(doc.Changes)),
	}

	migrationAuthorID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	var migrationNotes []store.ImportChange
	for _, exportedTask := range orderedTasks {
		imported, note, err := importedTask(exportedTask, taskMapping, userMapping, hasOldBlocker[exportedTask.ID], doc.FormatVersion)
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		importParams.Tasks = append(importParams.Tasks, imported)
		if note != nil {
			note.AuthorID = migrationAuthorID
			migrationNotes = append(migrationNotes, *note)
		}
	}
	for _, exportedComment := range doc.Comments {
		imported, err := importedComment(exportedComment, taskMapping, userMapping)
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		importParams.Comments = append(importParams.Comments, imported)
	}
	for _, exportedRel := range doc.Relationships {
		imported, err := importedRelationship(exportedRel, taskMapping)
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		importParams.Relationships = append(importParams.Relationships, imported)
	}
	// Payload rows are not allowed to occupy the server-authored namespace. A
	// document that could carry its own "server:import_provenance" row would let
	// an attacker plant a second, forged stamp naming an innocent party, leaving
	// a reader unable to tell which stamp was real. Dropping them keeps the
	// namespace server-authored by construction.
	//
	// They are dropped with a warning rather than rejected outright: exporting a
	// previously imported collection with --include-changes reproduces these
	// rows, so rejecting would make such an export impossible to re-import. The
	// stale stamp is not worth preserving anyway, since the provenance that
	// matters is who put the data in THIS system.
	reservedNamespaceRows := 0
	for _, exportedChange := range doc.Changes {
		if strings.HasPrefix(exportedChange.FieldName, serverAuthoredFieldPrefix) {
			reservedNamespaceRows++
			continue
		}
		imported, err := importedChange(exportedChange, taskMapping, userMapping)
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		importParams.Changes = append(importParams.Changes, imported)
	}
	if reservedNamespaceRows > 0 {
		stats.Changes -= int32(reservedNamespaceRows)
		warnings = append(warnings, fmt.Sprintf(
			"Dropped %d change rows using the reserved %q field-name namespace; those rows are written by the server, not accepted from a payload",
			reservedNamespaceRows, serverAuthoredFieldPrefix))
	}
	if len(migrationNotes) > 0 {
		importParams.Users = append(importParams.Users, store.ImportUser{
			ID:          migrationAuthorID,
			DisplayName: "system:migration",
			Type:        "service_account",
			Status:      "active",
		})
		importParams.Changes = append(importParams.Changes, migrationNotes...)
	}

	// Stamp every task the import creates with who performed the import and when
	// the server ingested it. These rows are server-authored: their author is
	// the authenticated caller, never anyone named by the payload, and their
	// created_at is the server clock, never a payload timestamp.
	// The error is discarded deliberately: importProvenance is five string
	// fields, and encoding/json cannot fail on those. A guarded branch here
	// would be unreachable, and an unreachable branch is one no test can kill —
	// the same shape as the dead export-side strip removed from this file
	// earlier. If a non-string field is ever added to importProvenance, restore
	// the error check along with it.
	provenance, _ := json.Marshal(importProvenance{
		ImportedBy:                 importerID.String(),
		ImportedAt:                 ingestedAt.Format(time.RFC3339Nano),
		SourceFormat:               format,
		Generator:                  doc.Generator,
		ClaimedCollectionCreatedAt: claimedTime(doc.Collection.CreatedAt),
	})
	for _, imported := range importParams.Tasks {
		importParams.Changes = append(importParams.Changes, store.ImportChange{
			ID:        uuid.New(),
			TaskID:    imported.ID,
			AuthorID:  importerID,
			FieldName: ImportProvenanceField,
			NewValue:  string(provenance),
			CreatedAt: ingestedAt,
		})
	}

	warnings = append(beadsWarnings, warnings...)

	if req.GetDryRun() {
		return &pb.ImportCollectionResponse{Stats: stats, Warnings: warnings}, nil
	}

	coll, err := s.store.ImportCollection(ctx, importParams)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "importing collection: %v", err)
	}
	return &pb.ImportCollectionResponse{CollectionId: coll.ID.String(), Stats: stats, Warnings: warnings}, nil
}

func claimedTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339Nano)
}

func taskExport(t *ent.Task) exportTask {
	out := exportTask{
		ID:                 t.ID.String(),
		Title:              t.Title,
		Description:        t.Description,
		Phase:              string(t.Phase),
		Stage:              string(t.Stage),
		NativeLabel:        t.NativeLabel,
		Type:               t.Type,
		StartDate:          t.StartDate,
		DueDate:            t.DueDate,
		ClosedAt:           t.ClosedAt,
		CreatedAt:          t.CreatedAt,
		UpdatedAt:          t.UpdatedAt,
		AcceptanceCriteria: t.AcceptanceCriteria,
		Labels:             t.Labels,
		Repo:               t.Repo,
		Branch:             t.Branch,
		PullRequests:       t.PullRequests,
		RemoteData:         t.RemoteData,
	}
	if t.Priority != nil {
		p := string(*t.Priority)
		out.Priority = &p
	}
	if t.HoldReason != nil {
		hr := string(*t.HoldReason)
		out.HoldReason = &hr
	}
	if t.Rank != nil {
		out.Rank = t.Rank
	}
	if t.AssigneeID != nil {
		id := t.AssigneeID.String()
		out.AssigneeID = &id
	}
	if t.ParentTaskID != nil {
		id := t.ParentTaskID.String()
		out.ParentTaskID = &id
	}
	if t.CiStatus != nil {
		cs := string(*t.CiStatus)
		out.CIStatus = &cs
	}
	if out.Labels == nil {
		out.Labels = []string{}
	}
	if out.PullRequests == nil {
		out.PullRequests = []map[string]string{}
	}
	return out
}

func validateImportReferences(doc exportDocument, taskMapping map[string]uuid.UUID) (map[string]struct{}, error) {
	userIDs := make(map[string]struct{}, len(doc.Users))
	for _, exported := range doc.Users {
		if _, err := uuid.Parse(exported.ID); err != nil {
			return nil, fmt.Errorf("invalid user id %q: %v", exported.ID, err)
		}
		userIDs[exported.ID] = struct{}{}
	}
	for _, t := range doc.Tasks {
		if _, err := parseTaskPhase(t.Phase); err != nil {
			return nil, err
		}
		if _, err := parseNativeTaskStage(t.Stage); err != nil {
			if doc.FormatVersion != 1 || !isRemovedNativeStage(t.Stage) {
				return nil, err
			}
		}
		if t.Priority != nil && *t.Priority != "" {
			if _, err := parseTaskPriority(*t.Priority); err != nil {
				return nil, err
			}
		}
		if t.CIStatus != nil && *t.CIStatus != "" {
			if _, err := parseTaskCIStatus(*t.CIStatus); err != nil {
				return nil, err
			}
		}
		if t.AssigneeID != nil && *t.AssigneeID != "" {
			if _, ok := userIDs[*t.AssigneeID]; !ok {
				return nil, fmt.Errorf("task %q references missing assignee_id %q", t.ID, *t.AssigneeID)
			}
		}
	}
	for _, c := range doc.Comments {
		if _, err := uuid.Parse(c.ID); err != nil {
			return nil, fmt.Errorf("invalid comment id %q: %v", c.ID, err)
		}
		if _, ok := taskMapping[c.TaskID]; !ok {
			return nil, fmt.Errorf("comment %q references missing task_id %q", c.ID, c.TaskID)
		}
		if _, ok := userIDs[c.AuthorID]; !ok {
			return nil, fmt.Errorf("comment %q references missing author_id %q", c.ID, c.AuthorID)
		}
	}
	for _, r := range doc.Relationships {
		if _, err := uuid.Parse(r.ID); err != nil {
			return nil, fmt.Errorf("invalid relationship id %q: %v", r.ID, err)
		}
		if _, ok := taskMapping[r.SourceTaskID]; !ok {
			return nil, fmt.Errorf("relationship %q references missing source_task_id %q", r.ID, r.SourceTaskID)
		}
		if _, ok := taskMapping[r.TargetTaskID]; !ok {
			return nil, fmt.Errorf("relationship %q references missing target_task_id %q", r.ID, r.TargetTaskID)
		}
		if _, err := parseRelationshipType(r.Type); err != nil {
			return nil, err
		}
	}
	for _, c := range doc.Changes {
		if _, err := uuid.Parse(c.ID); err != nil {
			return nil, fmt.Errorf("invalid change id %q: %v", c.ID, err)
		}
		if _, ok := taskMapping[c.TaskID]; !ok {
			return nil, fmt.Errorf("change %q references missing task_id %q", c.ID, c.TaskID)
		}
		if _, ok := userIDs[c.AuthorID]; !ok {
			return nil, fmt.Errorf("change %q references missing author_id %q", c.ID, c.AuthorID)
		}
	}
	return userIDs, nil
}

func (s *FarmTableService) resolveImportUsers(ctx context.Context, users []exportUser, requiredUserIDs map[string]struct{}, dryRun bool) (map[string]uuid.UUID, []store.ImportUser, int, int, []string, error) {
	mapping := make(map[string]uuid.UUID, len(users))
	var usersToCreate []store.ImportUser
	matched := 0
	created := 0
	var warnings []string
	for _, exported := range users {
		if _, required := requiredUserIDs[exported.ID]; !required {
			continue
		}
		if _, err := uuid.Parse(exported.ID); err != nil {
			return nil, nil, 0, 0, nil, status.Errorf(codes.InvalidArgument, "invalid user id %q: %v", exported.ID, err)
		}
		if exported.Email != nil && *exported.Email != "" {
			matches, err := s.store.GetUserByEmail(ctx, *exported.Email)
			if err != nil {
				return nil, nil, 0, 0, nil, status.Errorf(codes.Internal, "looking up user by email: %v", err)
			}
			if len(matches) == 1 {
				mapping[exported.ID] = matches[0].ID
				matched++
				continue
			}
			if len(matches) > 1 {
				action := "created"
				if dryRun {
					action = "would create"
				}
				warnings = append(warnings, fmt.Sprintf("Ambiguous email %q matched %d users; %s a new user", *exported.Email, len(matches), action))
			}
		}
		created++
		newID := uuid.New()
		mapping[exported.ID] = newID
		if !dryRun {
			usersToCreate = append(usersToCreate, store.ImportUser{
				ID:          newID,
				DisplayName: exported.DisplayName,
				Email:       exported.Email,
				Type:        exported.Type,
				Status:      exported.Status,
			})
		}
	}
	if created > 0 {
		if dryRun {
			warnings = append(warnings, fmt.Sprintf("Would create %d new users", created))
		} else {
			warnings = append(warnings, fmt.Sprintf("Created %d new users", created))
		}
	}
	return mapping, usersToCreate, matched, created, warnings, nil
}

func orderImportTasks(tasks []exportTask) ([]exportTask, error) {
	byID := make(map[string]exportTask, len(tasks))
	for _, t := range tasks {
		if _, exists := byID[t.ID]; exists {
			return nil, fmt.Errorf("duplicate task id %q", t.ID)
		}
		byID[t.ID] = t
	}
	var ordered []exportTask
	visiting := map[string]bool{}
	visited := map[string]bool{}
	var visit func(exportTask) error
	visit = func(t exportTask) error {
		if visited[t.ID] {
			return nil
		}
		if visiting[t.ID] {
			return fmt.Errorf("cycle detected in parent_task_id references at task %q", t.ID)
		}
		visiting[t.ID] = true
		if t.ParentTaskID != nil && *t.ParentTaskID != "" {
			parent, ok := byID[*t.ParentTaskID]
			if !ok {
				return fmt.Errorf("task %q references missing parent_task_id %q", t.ID, *t.ParentTaskID)
			}
			if err := visit(parent); err != nil {
				return err
			}
		}
		visiting[t.ID] = false
		visited[t.ID] = true
		ordered = append(ordered, t)
		return nil
	}
	for _, t := range tasks {
		if err := visit(t); err != nil {
			return nil, err
		}
	}
	return ordered, nil
}

func oldBlockedByEvidence(relationships []exportRelationship) map[string]bool {
	blocked := map[string]bool{}
	for _, rel := range relationships {
		switch rel.Type {
		case string(relationship.TypeBlockedBy):
			blocked[rel.SourceTaskID] = true
		case string(relationship.TypeBlocks):
			blocked[rel.TargetTaskID] = true
		}
	}
	return blocked
}

func migrateTaskState(t exportTask, hasOldBlocker bool, formatVersion int) (task.Phase, task.Stage, *task.HoldReason, string, error) {
	stageValue := task.Stage(t.Stage)
	switch stageValue {
	case task.StageTriage, task.StageAccepted, task.StageWorking, task.StageInReview, task.StageInQa, task.StageDeploying, task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
		phase := phaseForStage(stageValue)
		var holdReason *task.HoldReason
		if t.HoldReason != nil && *t.HoldReason != "" {
			hr := task.HoldReason(*t.HoldReason)
			if err := task.HoldReasonValidator(hr); err != nil {
				return "", "", nil, "", err
			}
			holdReason = &hr
		}
		return phase, stageValue, holdReason, "", nil
	case "backlog", "ready":
		if formatVersion != 1 {
			return "", "", nil, "", fmt.Errorf("invalid task stage %q", t.Stage)
		}
		return task.PhaseOpen, task.StageAccepted, nil, "old_" + t.Stage + "_stage_to_accepted", nil
	case "waiting_for_input":
		if formatVersion != 1 {
			return "", "", nil, "", fmt.Errorf("invalid task stage %q", t.Stage)
		}
		hr := task.HoldReasonWaitingForInput
		return task.PhaseOpen, task.StageAccepted, &hr, "old_waiting_for_input_stage_to_hold_reason", nil
	case "deferred":
		if formatVersion != 1 {
			return "", "", nil, "", fmt.Errorf("invalid task stage %q", t.Stage)
		}
		if t.StartDate != nil && t.StartDate.After(time.Now()) {
			return task.PhaseOpen, task.StageAccepted, nil, "old_deferred_stage_future_start_date_cleared_hold", nil
		}
		hr := task.HoldReasonDeferred
		return task.PhaseOpen, task.StageAccepted, &hr, "old_deferred_stage_to_hold_reason", nil
	case "scheduled":
		if formatVersion != 1 {
			return "", "", nil, "", fmt.Errorf("invalid task stage %q", t.Stage)
		}
		if t.StartDate != nil {
			return task.PhaseOpen, task.StageAccepted, nil, "old_scheduled_stage_with_start_date", nil
		}
		hr := task.HoldReasonDeferred
		return task.PhaseOpen, task.StageAccepted, &hr, "old_scheduled_stage_without_start_date_to_deferred", nil
	case "blocked":
		if formatVersion != 1 {
			return "", "", nil, "", fmt.Errorf("invalid task stage %q", t.Stage)
		}
		if hasOldBlocker {
			return task.PhaseOpen, task.StageAccepted, nil, "old_blocked_stage_with_blocker_to_dependency_availability", nil
		}
		hr := task.HoldReasonWaitingForInput
		return task.PhaseOpen, task.StageAccepted, &hr, "old_blocked_stage_without_blocker_to_waiting_for_input", nil
	default:
		return "", "", nil, "", fmt.Errorf("invalid task stage %q", t.Stage)
	}
}

func importedTask(t exportTask, taskMapping map[string]uuid.UUID, userMapping map[string]uuid.UUID, hasOldBlocker bool, formatVersion int) (store.ImportTask, *store.ImportChange, error) {
	newID, ok := taskMapping[t.ID]
	if !ok {
		return store.ImportTask{}, nil, fmt.Errorf("missing task mapping for %q", t.ID)
	}
	phase, stage, holdReason, migrationReason, err := migrateTaskState(t, hasOldBlocker, formatVersion)
	if err != nil {
		return store.ImportTask{}, nil, err
	}
	if err := validateImportedTaskState(stage, holdReason, t.StartDate); err != nil {
		return store.ImportTask{}, nil, err
	}
	imported := store.ImportTask{
		ID:                 newID,
		Title:              t.Title,
		Description:        t.Description,
		Phase:              phase,
		Stage:              stage,
		NativeLabel:        t.NativeLabel,
		Type:               t.Type,
		StartDate:          t.StartDate,
		DueDate:            t.DueDate,
		ClosedAt:           t.ClosedAt,
		CreatedAt:          t.CreatedAt,
		UpdatedAt:          t.UpdatedAt,
		AcceptanceCriteria: t.AcceptanceCriteria,
		Labels:             t.Labels,
		Repo:               t.Repo,
		Branch:             t.Branch,
		PullRequests:       t.PullRequests,
		RemoteData:         t.RemoteData,
		Version:            "1",
	}
	if holdReason != nil {
		imported.HoldReason = holdReason
	}
	if t.Rank != nil {
		imported.Rank = t.Rank
	}
	if t.Priority != nil && *t.Priority != "" {
		priority, err := parseTaskPriority(*t.Priority)
		if err != nil {
			return store.ImportTask{}, nil, err
		}
		imported.Priority = &priority
	}
	if t.AssigneeID != nil && *t.AssigneeID != "" {
		assigneeID, ok := userMapping[*t.AssigneeID]
		if !ok {
			return store.ImportTask{}, nil, fmt.Errorf("task %q references missing assignee_id %q", t.ID, *t.AssigneeID)
		}
		imported.AssigneeID = &assigneeID
	}
	if t.ParentTaskID != nil && *t.ParentTaskID != "" {
		parentID, ok := taskMapping[*t.ParentTaskID]
		if !ok {
			return store.ImportTask{}, nil, fmt.Errorf("task %q references missing parent_task_id %q", t.ID, *t.ParentTaskID)
		}
		imported.ParentTaskID = &parentID
	}
	if t.CIStatus != nil && *t.CIStatus != "" {
		ciStatus, err := parseTaskCIStatus(*t.CIStatus)
		if err != nil {
			return store.ImportTask{}, nil, err
		}
		imported.CIStatus = &ciStatus
	}
	var note *store.ImportChange
	if migrationReason != "" {
		oldValue, _ := json.Marshal(map[string]any{
			"phase":        t.Phase,
			"stage":        t.Stage,
			"native_label": t.NativeLabel,
			"start_date":   t.StartDate,
			"has_blocker":  hasOldBlocker,
		})
		newState := map[string]any{
			"stage":  string(imported.Stage),
			"reason": migrationReason,
		}
		if imported.HoldReason != nil {
			newState["hold_reason"] = string(*imported.HoldReason)
		}
		newValue, _ := json.Marshal(newState)
		note = &store.ImportChange{
			ID:        uuid.New(),
			TaskID:    newID,
			FieldName: "task_state_migration",
			OldValue:  string(oldValue),
			NewValue:  string(newValue),
			CreatedAt: time.Now(),
		}
	}
	return imported, note, nil
}

func validateImportedTaskState(stage task.Stage, holdReason *task.HoldReason, startDate *time.Time) error {
	if holdReason == nil {
		return nil
	}
	switch stage {
	case task.StageAccepted, task.StageWorking, task.StageInReview, task.StageInQa, task.StageDeploying:
	default:
		return fmt.Errorf("%w: hold_reason is only valid for accepted or active stages", store.ErrInvalidArgument)
	}
	if *holdReason == task.HoldReasonDeferred && startDate != nil && startDate.After(time.Now()) {
		return fmt.Errorf("%w: hold_reason=deferred cannot be combined with a future start_date", store.ErrInvalidArgument)
	}
	return nil
}

func importedComment(c exportComment, taskMapping map[string]uuid.UUID, userMapping map[string]uuid.UUID) (store.ImportComment, error) {
	if _, err := uuid.Parse(c.ID); err != nil {
		return store.ImportComment{}, fmt.Errorf("invalid comment id %q: %v", c.ID, err)
	}
	taskID, ok := taskMapping[c.TaskID]
	if !ok {
		return store.ImportComment{}, fmt.Errorf("comment %q references missing task_id %q", c.ID, c.TaskID)
	}
	authorID, ok := userMapping[c.AuthorID]
	if !ok {
		return store.ImportComment{}, fmt.Errorf("comment %q references missing author_id %q", c.ID, c.AuthorID)
	}
	return store.ImportComment{ID: uuid.New(), TaskID: taskID, AuthorID: authorID, Body: c.Body, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt}, nil
}

func importedRelationship(r exportRelationship, taskMapping map[string]uuid.UUID) (store.ImportRelationship, error) {
	if _, err := uuid.Parse(r.ID); err != nil {
		return store.ImportRelationship{}, fmt.Errorf("invalid relationship id %q: %v", r.ID, err)
	}
	sourceID, ok := taskMapping[r.SourceTaskID]
	if !ok {
		return store.ImportRelationship{}, fmt.Errorf("relationship %q references missing source_task_id %q", r.ID, r.SourceTaskID)
	}
	targetID, ok := taskMapping[r.TargetTaskID]
	if !ok {
		return store.ImportRelationship{}, fmt.Errorf("relationship %q references missing target_task_id %q", r.ID, r.TargetTaskID)
	}
	relType, err := parseRelationshipType(r.Type)
	if err != nil {
		return store.ImportRelationship{}, err
	}
	return store.ImportRelationship{ID: uuid.New(), SourceTaskID: sourceID, TargetTaskID: targetID, Type: relType}, nil
}

func importedChange(c exportChange, taskMapping map[string]uuid.UUID, userMapping map[string]uuid.UUID) (store.ImportChange, error) {
	if _, err := uuid.Parse(c.ID); err != nil {
		return store.ImportChange{}, fmt.Errorf("invalid change id %q: %v", c.ID, err)
	}
	taskID, ok := taskMapping[c.TaskID]
	if !ok {
		return store.ImportChange{}, fmt.Errorf("change %q references missing task_id %q", c.ID, c.TaskID)
	}
	authorID, ok := userMapping[c.AuthorID]
	if !ok {
		return store.ImportChange{}, fmt.Errorf("change %q references missing author_id %q", c.ID, c.AuthorID)
	}
	return store.ImportChange{
		ID:        uuid.New(),
		TaskID:    taskID,
		AuthorID:  authorID,
		FieldName: c.FieldName,
		OldValue:  c.OldValue,
		NewValue:  c.NewValue,
		CreatedAt: c.CreatedAt,
	}, nil
}

func parseTaskPhase(value string) (task.Phase, error) {
	switch task.Phase(value) {
	case task.PhaseOpen, task.PhaseInProgress, task.PhaseOnHold, task.PhaseClosed:
		return task.Phase(value), nil
	default:
		return "", fmt.Errorf("invalid task phase %q", value)
	}
}

func isRemovedNativeStage(value string) bool {
	switch value {
	case "backlog", "ready", "blocked", "waiting_for_input", "deferred", "scheduled":
		return true
	default:
		return false
	}
}

func parseNativeTaskStage(value string) (task.Stage, error) {
	if value == "" {
		return task.StageTriage, nil
	}
	switch task.Stage(value) {
	case task.StageTriage, task.StageAccepted, task.StageWorking, task.StageInReview, task.StageInQa, task.StageDeploying, task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
		return task.Stage(value), nil
	default:
		return "", fmt.Errorf("invalid task stage %q", value)
	}
}

func parseTaskPriority(value string) (task.Priority, error) {
	switch task.Priority(value) {
	case task.PriorityUrgent, task.PriorityHigh, task.PriorityNormal, task.PriorityLow:
		return task.Priority(value), nil
	default:
		return "", fmt.Errorf("invalid task priority %q", value)
	}
}

func parseTaskCIStatus(value string) (task.CiStatus, error) {
	switch task.CiStatus(value) {
	case task.CiStatusUnknown, task.CiStatusPending, task.CiStatusRunning, task.CiStatusPassed, task.CiStatusFailed:
		return task.CiStatus(value), nil
	default:
		return "", fmt.Errorf("invalid task ci_status %q", value)
	}
}

func parseRelationshipType(value string) (relationship.Type, error) {
	switch relationship.Type(value) {
	case relationship.TypeBlocks, relationship.TypeBlockedBy, relationship.TypeRelatesTo, relationship.TypeDuplicates, relationship.TypeDuplicatedBy:
		return relationship.Type(value), nil
	default:
		return "", fmt.Errorf("invalid relationship type %q", value)
	}
}
