package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"sort"
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
	NativeLabel        string              `json:"native_label"`
	Type               string              `json:"type"`
	Priority           *string             `json:"priority"`
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

func (s *FarmTableService) ExportCollection(ctx context.Context, req *pb.ExportCollectionRequest) (*pb.ExportCollectionResponse, error) {
	collectionID, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid collection id: %v", err)
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
		FormatVersion: 1,
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
		if doc.FormatVersion != 1 {
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

	for _, exportedTask := range orderedTasks {
		imported, err := importedTask(exportedTask, taskMapping, userMapping)
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		importParams.Tasks = append(importParams.Tasks, imported)
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
	for _, exportedChange := range doc.Changes {
		imported, err := importedChange(exportedChange, taskMapping, userMapping)
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		importParams.Changes = append(importParams.Changes, imported)
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
		if _, err := parseTaskStage(t.Stage); err != nil {
			return nil, err
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

func importedTask(t exportTask, taskMapping map[string]uuid.UUID, userMapping map[string]uuid.UUID) (store.ImportTask, error) {
	newID, ok := taskMapping[t.ID]
	if !ok {
		return store.ImportTask{}, fmt.Errorf("missing task mapping for %q", t.ID)
	}
	phase, err := parseTaskPhase(t.Phase)
	if err != nil {
		return store.ImportTask{}, err
	}
	stage, err := parseTaskStage(t.Stage)
	if err != nil {
		return store.ImportTask{}, err
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
	if t.Priority != nil && *t.Priority != "" {
		priority, err := parseTaskPriority(*t.Priority)
		if err != nil {
			return store.ImportTask{}, err
		}
		imported.Priority = &priority
	}
	if t.AssigneeID != nil && *t.AssigneeID != "" {
		assigneeID, ok := userMapping[*t.AssigneeID]
		if !ok {
			return store.ImportTask{}, fmt.Errorf("task %q references missing assignee_id %q", t.ID, *t.AssigneeID)
		}
		imported.AssigneeID = &assigneeID
	}
	if t.ParentTaskID != nil && *t.ParentTaskID != "" {
		parentID, ok := taskMapping[*t.ParentTaskID]
		if !ok {
			return store.ImportTask{}, fmt.Errorf("task %q references missing parent_task_id %q", t.ID, *t.ParentTaskID)
		}
		imported.ParentTaskID = &parentID
	}
	if t.CIStatus != nil && *t.CIStatus != "" {
		ciStatus, err := parseTaskCIStatus(*t.CIStatus)
		if err != nil {
			return store.ImportTask{}, err
		}
		imported.CIStatus = &ciStatus
	}
	return imported, nil
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

func parseTaskStage(value string) (task.Stage, error) {
	if value == "" {
		return task.StageTriage, nil
	}
	switch task.Stage(value) {
	case task.StageTriage, task.StageBacklog, task.StageReady, task.StageWorking, task.StageInReview, task.StageInQa, task.StageDeploying, task.StageBlocked, task.StageWaitingForInput, task.StageDeferred, task.StageScheduled, task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
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
