package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func printJSON(v interface{}) {
	data, _ := json.MarshalIndent(v, "", "  ")
	fmt.Fprintln(os.Stdout, string(data))
}

func printJSONLine(v interface{}) {
	data, _ := json.Marshal(v)
	fmt.Fprintln(os.Stdout, string(data))
}

func printQuiet(id string) {
	fmt.Fprintln(os.Stdout, id)
}

func formatTimestamp(ts *timestamppb.Timestamp) interface{} {
	if ts == nil || (ts.GetSeconds() == 0 && ts.GetNanos() == 0) {
		return nil
	}
	return ts.AsTime().UTC().Format("2006-01-02T15:04:05Z")
}

func taskToMap(t *pb.Task, compact bool) map[string]interface{} {
	m := map[string]interface{}{
		"id":            t.GetId(),
		"name":          t.GetName(),
		"phase":         phaseNames[t.GetPhase()],
		"stage":         stageNames[t.GetStage()],
		"priority":      nilIfZeroPriority(t.GetPriority()),
		"type":          nilIfEmpty(t.GetType()),
		"assignees":     usersToList(t.GetAssignees()),
		"collection_id": t.GetCollectionId(),
		"remote_id":     nilIfEmpty(t.GetRemoteId()),
		"remote_url":    nilIfEmpty(t.GetRemoteUrl()),
		"updated_at":    formatTimestamp(t.GetUpdatedAt()),
	}

	if !compact {
		m["description"] = nilIfEmpty(t.GetDescription())
		m["acceptance_criteria"] = nilIfEmpty(t.GetAcceptanceCriteria())
		m["native_status"] = nilIfEmpty(t.GetNativeStatus())
		m["creator"] = userToMap(t.GetCreator())
		m["start_date"] = formatTimestamp(t.GetStartDate())
		m["due_date"] = formatTimestamp(t.GetDueDate())
		m["parent_task_id"] = nilIfEmpty(t.GetParentTaskId())
		m["relationships"] = relationshipsToList(t.GetRelationships())
		m["labels"] = t.GetLabels()
		m["custom_fields"] = customFieldsToList(t.GetCustomFields())
		m["code_context"] = codeContextToMap(t.GetCodeContext())
		m["remote_data"] = nil
		m["platform"] = platformNames[t.GetPlatform()]
		m["created_at"] = formatTimestamp(t.GetCreatedAt())
		m["closed_at"] = formatTimestamp(t.GetClosedAt())
		m["version"] = t.GetVersion()
	}

	return m
}

func insertTasksAfterToMap(resp *pb.InsertTasksAfterResponse) map[string]interface{} {
	inserted := make([]interface{}, 0, len(resp.GetInsertedTasks()))
	for _, t := range resp.GetInsertedTasks() {
		inserted = append(inserted, taskToMap(t, false))
	}
	return map[string]interface{}{
		"inserted_tasks": inserted,
		"anchor_task":    taskToMap(resp.GetAnchorTask(), false),
	}
}

func collectionToMap(c *pb.Collection) map[string]interface{} {
	m := map[string]interface{}{
		"id":          c.GetId(),
		"name":        c.GetName(),
		"description": nilIfEmpty(c.GetDescription()),
		"platform":    platformNames[c.GetPlatform()],
		"remote_id":   nilIfEmpty(c.GetRemoteId()),
		"created_at":  formatTimestamp(c.GetCreatedAt()),
		"updated_at":  formatTimestamp(c.GetUpdatedAt()),
	}
	if c.GetWorkspaceId() != "" {
		m["workspace_id"] = c.GetWorkspaceId()
	}
	if c.GetLinkedAccountId() != "" {
		m["linked_account_id"] = c.GetLinkedAccountId()
	}
	if len(c.GetStatusMappings()) > 0 {
		var mappings []map[string]interface{}
		for _, sm := range c.GetStatusMappings() {
			mappings = append(mappings, map[string]interface{}{
				"native_status": sm.GetNativeStatus(),
				"phase":         phaseNames[sm.GetPhase()],
				"stage":         stageNames[sm.GetStage()],
			})
		}
		m["status_mappings"] = mappings
	}
	if len(c.GetCustomFieldDefinitions()) > 0 {
		var defs []map[string]interface{}
		for _, d := range c.GetCustomFieldDefinitions() {
			defs = append(defs, map[string]interface{}{
				"field_id":   d.GetFieldId(),
				"field_name": d.GetFieldName(),
				"field_type": d.GetFieldType().String(),
				"required":   d.GetRequired(),
			})
		}
		m["custom_field_definitions"] = defs
	}
	return m
}

func commentToMap(c *pb.Comment) map[string]interface{} {
	return map[string]interface{}{
		"id":         c.GetId(),
		"task_id":    c.GetTaskId(),
		"author":     userToMap(c.GetAuthor()),
		"body":       c.GetBody(),
		"created_at": formatTimestamp(c.GetCreatedAt()),
		"updated_at": formatTimestamp(c.GetUpdatedAt()),
	}
}

func userToMap(u *pb.User) interface{} {
	if u == nil {
		return nil
	}
	m := map[string]interface{}{
		"id":   u.GetId(),
		"name": u.GetName(),
		"type": userTypeNames[u.GetType()],
	}
	if u.GetEmail() != "" {
		m["email"] = u.GetEmail()
	}
	return m
}

func userFullToMap(u *pb.User) map[string]interface{} {
	m := map[string]interface{}{
		"id":     u.GetId(),
		"name":   u.GetName(),
		"email":  nilIfEmpty(u.GetEmail()),
		"type":   userTypeNames[u.GetType()],
		"status": identityStatusName(u.GetStatus()),
	}
	return m
}

func identityStatusName(s pb.IdentityStatus) string {
	switch s {
	case pb.IdentityStatus_IDENTITY_STATUS_ACTIVE:
		return "ACTIVE"
	case pb.IdentityStatus_IDENTITY_STATUS_SUSPENDED:
		return "SUSPENDED"
	case pb.IdentityStatus_IDENTITY_STATUS_ARCHIVED:
		return "ARCHIVED"
	default:
		return "UNKNOWN"
	}
}

func usersToList(users []*pb.User) []interface{} {
	result := make([]interface{}, 0, len(users))
	for _, u := range users {
		result = append(result, userToMap(u))
	}
	return result
}

func relationshipsToList(rels []*pb.Relationship) []interface{} {
	result := make([]interface{}, 0, len(rels))
	for _, r := range rels {
		result = append(result, map[string]interface{}{
			"type":           r.GetType().String(),
			"target_task_id": r.GetTargetTaskId(),
		})
	}
	return result
}

func customFieldsToList(fields []*pb.CustomFieldValue) []interface{} {
	result := make([]interface{}, 0, len(fields))
	for _, f := range fields {
		result = append(result, map[string]interface{}{
			"field_id":   f.GetFieldId(),
			"field_name": f.GetFieldName(),
			"value":      f.GetValue().AsInterface(),
		})
	}
	return result
}

func codeContextToMap(cc *pb.CodeContext) interface{} {
	if cc == nil {
		return nil
	}
	m := map[string]interface{}{
		"repo":        nilIfEmpty(cc.GetRepo()),
		"branch":      nilIfEmpty(cc.GetBranch()),
		"ci_status":   nil,
		"commit_shas": cc.GetCommitShas(),
	}
	if cc.GetCiStatus() != pb.CIStatus_CI_STATUS_UNSPECIFIED {
		m["ci_status"] = strings.ToLower(strings.TrimPrefix(cc.GetCiStatus().String(), "CI_STATUS_"))
	}
	var prs []map[string]interface{}
	for _, pr := range cc.GetPullRequests() {
		prs = append(prs, map[string]interface{}{
			"id":     pr.GetId(),
			"url":    pr.GetUrl(),
			"status": strings.ToLower(strings.TrimPrefix(pr.GetStatus().String(), "PULL_REQUEST_STATUS_")),
		})
	}
	m["pull_requests"] = prs
	return m
}

func nilIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nilIfZeroPriority(p pb.TaskPriority) interface{} {
	if p == pb.TaskPriority_TASK_PRIORITY_UNSPECIFIED {
		return nil
	}
	return priorityNames[p]
}

func printList(items []interface{}, nextCursor string, hasMore bool, totalCount int32) {
	env := map[string]interface{}{
		"items":       items,
		"next_cursor": nilIfEmpty(nextCursor),
		"has_more":    hasMore,
		"total_count": totalCount,
	}
	printJSON(env)
}

func printListJSONL(items []interface{}) {
	for _, item := range items {
		printJSONLine(item)
	}
}

func printListQuiet(ids []string) {
	for _, id := range ids {
		fmt.Fprintln(os.Stdout, id)
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-1] + "…"
}

func printTaskTable(tasks []*pb.Task, totalCount int32) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tNAME\tPHASE\tSTAGE\tPRI\tASSIGNEE\tREMOTE")
	for _, t := range tasks {
		assignee := "—"
		if len(t.GetAssignees()) > 0 {
			assignee = t.GetAssignees()[0].GetName()
			if assignee == "" {
				assignee = t.GetAssignees()[0].GetId()
			}
		}
		pri := "—"
		if t.GetPriority() != pb.TaskPriority_TASK_PRIORITY_UNSPECIFIED {
			pri = priorityNames[t.GetPriority()]
		}
		remoteID := "—"
		if t.GetRemoteId() != "" {
			remoteID = t.GetRemoteId()
		}
		id := t.GetId()
		if len(id) > 8 {
			id = id[:8]
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
			id,
			truncate(t.GetName(), 45),
			phaseNames[t.GetPhase()],
			stageNames[t.GetStage()],
			pri,
			truncate(assignee, 15),
			remoteID,
		)
	}
	w.Flush()
	if totalCount > 0 {
		fmt.Fprintf(os.Stderr, "\nShowing %d of %d tasks. Use --cursor to page.\n", len(tasks), totalCount)
	}
}

func printCollectionTable(collections []*pb.Collection) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tNAME\tPLATFORM\tREMOTE_ID")
	for _, c := range collections {
		id := c.GetId()
		if len(id) > 8 {
			id = id[:8]
		}
		remoteID := "—"
		if c.GetRemoteId() != "" {
			remoteID = c.GetRemoteId()
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n",
			id,
			truncate(c.GetName(), 30),
			platformNames[c.GetPlatform()],
			remoteID,
		)
	}
	w.Flush()
}

func printCommentTable(comments []*pb.Comment) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tAUTHOR\tCREATED\tBODY")
	for _, c := range comments {
		id := c.GetId()
		if len(id) > 8 {
			id = id[:8]
		}
		author := "—"
		if c.GetAuthor() != nil {
			author = c.GetAuthor().GetName()
			if author == "" {
				author = c.GetAuthor().GetId()
			}
		}
		fmt.Fprintf(w, "%s\t%s\t%v\t%s\n",
			id,
			truncate(author, 15),
			formatTimestamp(c.GetCreatedAt()),
			truncate(c.GetBody(), 60),
		)
	}
	w.Flush()
}
