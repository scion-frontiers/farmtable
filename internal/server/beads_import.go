package server

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"time"

	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/relationship"
	"github.com/google/uuid"
)

// beadsIssue represents a single issue record from a Beads JSONL export.
type beadsIssue struct {
	Type               string            `json:"_type"`
	ID                 string            `json:"id"`
	Title              string            `json:"title"`
	Description        string            `json:"description"`
	Status             string            `json:"status"`
	Priority           int               `json:"priority"`
	IssueType          string            `json:"issue_type"`
	Assignee           string            `json:"assignee"`
	Owner              string            `json:"owner"`
	Labels             []string          `json:"labels"`
	Dependencies       []beadsDependency `json:"dependencies"`
	AcceptanceCriteria string            `json:"acceptance_criteria"`
	Design             string            `json:"design"`
	Notes              string            `json:"notes"`
	CreatedAt          time.Time         `json:"created_at"`
	UpdatedAt          time.Time         `json:"updated_at"`
	ClosedAt           *time.Time        `json:"closed_at"`
	StartedAt          *time.Time        `json:"started_at"`
	DueAt              *time.Time        `json:"due_at"`
	Comments           []beadsComment    `json:"comments"`
	Metadata           json.RawMessage   `json:"metadata"`
	ExternalRef        *string           `json:"external_ref"`
	SourceSystem       string            `json:"source_system"`
	EstimatedMinutes   *int              `json:"estimated_minutes"`
}

type beadsDependency struct {
	IssueID     string `json:"issue_id"`
	DependsOnID string `json:"depends_on_id"`
	Type        string `json:"type"`
}

type beadsComment struct {
	ID        string    `json:"id"`
	IssueID   string    `json:"issue_id"`
	Author    string    `json:"author"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
}

// parseBeadsJSONL parses Beads JSONL data into a slice of beadsIssue structs.
// Each line must be a valid JSON object. Lines with _type != "issue" (or empty
// _type with a title) are included; lines that fail to parse are skipped with
// a warning.
func parseBeadsJSONL(data []byte) ([]beadsIssue, []string, error) {
	var issues []beadsIssue
	var warnings []string
	scanner := bufio.NewScanner(bytes.NewReader(data))
	// Allow large lines (up to 10MB per line).
	scanner.Buffer(make([]byte, 0, 64*1024), 10*1024*1024)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}
		var issue beadsIssue
		if err := json.Unmarshal(line, &issue); err != nil {
			warnings = append(warnings, fmt.Sprintf("line %d: skipped (invalid JSON: %v)", lineNum, err))
			continue
		}
		// Skip non-issue records if _type is set to something else.
		if issue.Type != "" && issue.Type != "issue" {
			continue
		}
		// Must have a title.
		if issue.Title == "" {
			warnings = append(warnings, fmt.Sprintf("line %d: skipped (missing title)", lineNum))
			continue
		}
		issues = append(issues, issue)
	}
	if err := scanner.Err(); err != nil {
		return nil, nil, fmt.Errorf("reading JSONL: %w", err)
	}
	if len(issues) == 0 {
		return nil, nil, fmt.Errorf("no valid issues found in JSONL data")
	}
	return issues, warnings, nil
}

// beadsStatusToPhaseStage maps a Beads status string to Farmtable phase and stage.
func beadsStatusToPhaseStage(status string) (phase string, stage string) {
	switch status {
	case "open":
		return "open", "ready"
	case "in_progress", "hooked":
		return "in_progress", "working"
	case "blocked":
		return "in_progress", "blocked"
	case "deferred":
		return "on_hold", "deferred"
	case "closed":
		return "closed", "completed"
	case "pinned":
		return "open", "backlog"
	default:
		// Unknown status: default to open/triage.
		return "open", "triage"
	}
}

// beadsPriorityToFarmtable maps a Beads priority int (0-4) to a Farmtable
// priority string. Returns nil for values outside the expected range.
func beadsPriorityToFarmtable(p int) *string {
	var s string
	switch {
	case p == 0:
		s = "urgent"
	case p == 1:
		s = "high"
	case p == 2:
		s = "normal"
	case p == 3:
		s = "low"
	case p >= 4:
		s = "low"
	default:
		return nil
	}
	return &s
}

// beadsTypeToFarmtable maps a Beads issue_type to a Farmtable task type.
func beadsTypeToFarmtable(issueType string) string {
	switch issueType {
	case "bug":
		return "bug"
	case "epic":
		return "epic"
	case "story":
		return "story"
	case "task":
		return "task"
	case "feature":
		return "task"
	case "chore":
		return "task"
	case "subtask":
		return "subtask"
	default:
		return "task"
	}
}

// convertBeadsToExportDocument transforms parsed Beads issues into a Farmtable
// exportDocument, ready to be processed by the existing import pipeline.
func convertBeadsToExportDocument(issues []beadsIssue, collectionName string) (exportDocument, []string, error) {
	var warnings []string
	now := time.Now().UTC()

	// Build ID mapping: beads string ID -> new UUID.
	idMapping := make(map[string]string, len(issues))
	for _, issue := range issues {
		idMapping[issue.ID] = uuid.New().String()
	}

	// Collect unique user names for user creation.
	usersByName := make(map[string]string) // display_name -> user UUID string
	ensureUser := func(name string) string {
		if name == "" {
			return ""
		}
		if id, ok := usersByName[name]; ok {
			return id
		}
		id := uuid.New().String()
		usersByName[name] = id
		return id
	}

	// First pass: collect users from assignees, owners, and comment authors.
	for _, issue := range issues {
		if issue.Assignee != "" {
			ensureUser(issue.Assignee)
		}
		if issue.Owner != "" {
			ensureUser(issue.Owner)
		}
		for _, c := range issue.Comments {
			if c.Author != "" {
				ensureUser(c.Author)
			}
		}
	}

	// Build users list.
	var users []exportUser
	for name, id := range usersByName {
		users = append(users, exportUser{
			ID:          id,
			DisplayName: name,
			Type:        "human",
			Status:      "active",
		})
	}

	// Build tasks, comments, and relationships.
	var tasks []exportTask
	var comments []exportComment
	var relationships []exportRelationship

	// Track parent-child relationships from beads dependencies.
	parentMap := make(map[string]string) // child beads ID -> parent beads ID

	// First pass: identify parents.
	for _, issue := range issues {
		for _, dep := range issue.Dependencies {
			if dep.Type == "parent-child" && dep.IssueID == issue.ID {
				parentMap[issue.ID] = dep.DependsOnID
			}
		}
	}

	for _, issue := range issues {
		taskUUID, ok := idMapping[issue.ID]
		if !ok {
			continue
		}

		phase, stage := beadsStatusToPhaseStage(issue.Status)
		priority := beadsPriorityToFarmtable(issue.Priority)
		taskType := beadsTypeToFarmtable(issue.IssueType)

		// Build description: append design and notes if present.
		desc := issue.Description
		if issue.Design != "" {
			if desc != "" {
				desc += "\n\n"
			}
			desc += "## Design\n\n" + issue.Design
		}
		if issue.Notes != "" {
			if desc != "" {
				desc += "\n\n"
			}
			desc += "## Notes\n\n" + issue.Notes
		}

		// Handle acceptance criteria.
		var ac *string
		if issue.AcceptanceCriteria != "" {
			ac = &issue.AcceptanceCriteria
		}

		// Handle parent.
		var parentTaskID *string
		if parentBeadsID, ok := parentMap[issue.ID]; ok {
			if parentUUID, ok := idMapping[parentBeadsID]; ok {
				parentTaskID = &parentUUID
			} else {
				warnings = append(warnings, fmt.Sprintf("issue %q: parent %q not found in import, skipping parent link", issue.ID, parentBeadsID))
			}
		}

		// Handle assignee.
		var assigneeID *string
		if issue.Assignee != "" {
			if uid, ok := usersByName[issue.Assignee]; ok {
				assigneeID = &uid
			}
		}

		// Labels.
		labels := issue.Labels
		if labels == nil {
			labels = []string{}
		}

		t := exportTask{
			ID:                 taskUUID,
			Title:              issue.Title,
			Description:        desc,
			Phase:              phase,
			Stage:              stage,
			NativeLabel:        issue.Status,
			Type:               taskType,
			Priority:           priority,
			AssigneeID:         assigneeID,
			ParentTaskID:       parentTaskID,
			StartDate:          issue.StartedAt,
			DueDate:            issue.DueAt,
			ClosedAt:           issue.ClosedAt,
			CreatedAt:          issue.CreatedAt,
			UpdatedAt:          issue.UpdatedAt,
			AcceptanceCriteria: ac,
			Labels:             labels,
			PullRequests:       []map[string]string{},
		}
		tasks = append(tasks, t)

		// Handle comments.
		for _, c := range issue.Comments {
			authorID := ""
			if c.Author != "" {
				authorID = usersByName[c.Author]
			}
			if authorID == "" {
				// Create a placeholder user for unknown authors.
				authorID = ensureUser("Unknown")
			}
			comments = append(comments, exportComment{
				ID:        uuid.New().String(),
				TaskID:    taskUUID,
				AuthorID:  authorID,
				Body:      c.Text,
				CreatedAt: c.CreatedAt,
				UpdatedAt: c.CreatedAt,
			})
		}

		// Handle dependency relationships (non-parent-child).
		for _, dep := range issue.Dependencies {
			if dep.Type == "parent-child" {
				continue // Handled via parentTaskID.
			}
			// dep.IssueID is this issue, dep.DependsOnID is the target.
			sourceUUID, sourceOK := idMapping[dep.IssueID]
			targetUUID, targetOK := idMapping[dep.DependsOnID]
			if !sourceOK || !targetOK {
				continue // Skip references to issues not in the import.
			}

			var relType relationship.Type
			switch dep.Type {
			case "blocks":
				// In beads: dep.DependsOnID blocks dep.IssueID.
				// In farmtable: source blocks target.
				// So the blocker is DependsOnID, and the blocked is IssueID.
				relType = relationship.TypeBlocks
				// Swap: source = blocker (DependsOnID), target = blocked (IssueID)
				sourceUUID, targetUUID = targetUUID, sourceUUID
			case "related", "relates-to", "discovered-from":
				relType = relationship.TypeRelatesTo
			case "duplicates":
				relType = relationship.TypeDuplicates
			default:
				relType = relationship.TypeRelatesTo
			}

			relationships = append(relationships, exportRelationship{
				ID:           uuid.New().String(),
				SourceTaskID: sourceUUID,
				TargetTaskID: targetUUID,
				Type:         string(relType),
			})
		}
	}

	// Rebuild users list to include any users added during comment processing.
	users = nil
	for name, id := range usersByName {
		users = append(users, exportUser{
			ID:          id,
			DisplayName: name,
			Type:        "human",
			Status:      "active",
		})
	}

	doc := exportDocument{
		FormatVersion: 1,
		ExportedAt:    now,
		Generator:     "farmtable",
		Collection: exportCollection{
			ID:          uuid.New().String(),
			Name:        collectionName,
			Description: "Imported from Beads issue tracker",
			Platform:    string(collection.PlatformFarmtable),
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		Users:         users,
		Tasks:         tasks,
		Comments:      comments,
		Relationships: relationships,
		Changes:       []exportChange{},
	}

	return doc, warnings, nil
}

// detectImportFormat examines raw data and returns the detected format.
// Returns "farmtable" for native JSON, "beads" for Beads JSONL, or empty string.
//
// Heuristic: try parsing as a single JSON object with format_version first
// (native format). If that fails or format_version is missing, check if the
// first non-empty line looks like a Beads issue (has _type:"issue" or title).
func detectImportFormat(data []byte) string {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return ""
	}

	// Try native farmtable: single JSON object with format_version.
	if trimmed[0] == '{' {
		var probe struct {
			FormatVersion *int   `json:"format_version"`
			Generator     string `json:"generator"`
		}
		if err := json.Unmarshal(trimmed, &probe); err == nil && probe.FormatVersion != nil {
			return "farmtable"
		}
		// Single JSON object without format_version — could be a single-line
		// JSONL. Fall through to Beads detection.
	}

	// Try Beads JSONL: check the first non-empty line.
	scanner := bufio.NewScanner(bytes.NewReader(trimmed))
	scanner.Buffer(make([]byte, 0, 64*1024), 10*1024*1024)
	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}
		if line[0] == '{' {
			var probe struct {
				Type  string `json:"_type"`
				Title string `json:"title"`
			}
			if err := json.Unmarshal(line, &probe); err == nil {
				if probe.Type == "issue" || probe.Title != "" {
					return "beads"
				}
			}
		}
		break
	}
	return ""
}

// deduplicateRelationships removes duplicate relationships that have the same
// source, target, and type. This can happen when both sides of a beads
// dependency are present.
func deduplicateRelationships(rels []exportRelationship) []exportRelationship {
	type relKey struct {
		source, target, relType string
	}
	seen := make(map[relKey]bool)
	var result []exportRelationship
	for _, r := range rels {
		// For relates_to, normalize direction.
		k := relKey{r.SourceTaskID, r.TargetTaskID, r.Type}
		if r.Type == string(relationship.TypeRelatesTo) {
			if r.SourceTaskID > r.TargetTaskID {
				k = relKey{r.TargetTaskID, r.SourceTaskID, r.Type}
			}
		}
		if seen[k] {
			continue
		}
		seen[k] = true
		result = append(result, r)
	}
	return result
}

