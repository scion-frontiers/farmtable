package cli

import (
	"context"
	"fmt"
	"strings"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/spf13/cobra"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func newTaskCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "task",
		Short: "Task operations",
	}
	cmd.AddCommand(
		newTaskGetCmd(globals),
		newTaskListCmd(globals),
		newTaskCreateCmd(globals),
		newTaskUpdateCmd(globals),
		newTaskClaimCmd(globals),
		newTaskCloseCmd(globals),
		newReadyCmd(globals),
		newBlockedCmd(globals),
		newTreeCmd(globals),
		newCriticalPathCmd(globals),
		newBottlenecksCmd(globals),
	)
	return cmd
}

func newTaskGetCmd(globals *globalFlags) *cobra.Command {
	var withComments, withChanges bool

	cmd := &cobra.Command{
		Use:   "get <id>",
		Short: "Get full task details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			collection := resolveCollectionFromServer(ctx, client, globals.collection)
			req := &pb.GetTaskRequest{
				Id:              args[0],
				IncludeComments: withComments,
				IncludeChanges:  withChanges,
			}
			if collection != "" {
				req.CollectionId = &collection
			}

			resp, err := client.GetTask(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				printQuiet(resp.GetTask().GetId())
			case "table":
				printJSON(taskToMap(resp.GetTask(), false))
			default:
				m := taskToMap(resp.GetTask(), false)
				if withComments && len(resp.GetComments()) > 0 {
					var comments []interface{}
					for _, c := range resp.GetComments() {
						comments = append(comments, commentToMap(c))
					}
					m["comments"] = comments
				}
				if withChanges && len(resp.GetChanges()) > 0 {
					var changes []interface{}
					for _, c := range resp.GetChanges() {
						changes = append(changes, changeToMap(c))
					}
					m["changes"] = changes
				}
				printJSON(m)
			}
			return nil
		},
	}
	cmd.Flags().BoolVar(&withComments, "with-comments", false, "Include comment thread")
	cmd.Flags().BoolVar(&withChanges, "with-changes", false, "Include change audit trail")
	return cmd
}

func newTaskListCmd(globals *globalFlags) *cobra.Command {
	var (
		phase    string
		stages   []string
		assignee string
		priority string
		taskType string
		labels   []string
		parent   string
		sort     string
		order    string
		full     bool
		limit    int32
		cursor   string
	)

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List tasks with filters",
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			collection := resolveCollectionFromServer(ctx, client, globals.collection)
			req := &pb.ListTasksRequest{
				Full:      full,
				PageSize:  limit,
				PageToken: cursor,
			}

			if collection != "" {
				req.CollectionId = &collection
			}
			if phase != "" {
				p, err := parsePhase(phase)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.Phase = &p
			}
			for _, s := range stages {
				st, err := parseStage(s)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.Stages = append(req.Stages, st)
			}
			if assignee != "" {
				req.Assignee = &assignee
			}
			if priority != "" {
				p, err := parsePriority(priority)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.Priority = &p
			}
			if taskType != "" {
				req.Type = &taskType
			}
			if len(labels) > 0 {
				req.Labels = labels
			}
			if parent != "" {
				req.ParentTaskId = &parent
			}
			if sort != "" {
				v, ok := sortFieldValues[sort]
				if !ok {
					return exitError(ExitValidation, "VALIDATION_ERROR",
						fmt.Sprintf("invalid sort field %q; valid: created, updated, priority, due_date", sort))
				}
				req.SortField = v
			}
			if order != "" {
				v, ok := sortOrderValues[order]
				if !ok {
					return exitError(ExitValidation, "VALIDATION_ERROR",
						fmt.Sprintf("invalid sort order %q; valid: asc, desc", order))
				}
				req.SortOrder = v
			}

			resp, err := client.ListTasks(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				for _, t := range resp.GetItems() {
					printQuiet(t.GetId())
				}
			case "jsonl":
				for _, t := range resp.GetItems() {
					printJSONLine(taskToMap(t, !full))
				}
			case "table":
				printTaskTable(resp.GetItems(), resp.GetTotalCount())
			default:
				var items []interface{}
				for _, t := range resp.GetItems() {
					items = append(items, taskToMap(t, !full))
				}
				printList(items, resp.GetNextPageToken(), resp.GetHasMore(), resp.GetTotalCount())
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&phase, "phase", "", "Filter by phase: OPEN, IN_PROGRESS, ON_HOLD, CLOSED")
	cmd.Flags().StringSliceVar(&stages, "stage", nil, "Filter by stage (repeatable)")
	cmd.Flags().StringVarP(&assignee, "assignee", "a", "", "Filter by assignee (use 'me' or 'none')")
	cmd.Flags().StringVarP(&priority, "priority", "p", "", "Filter by priority: URGENT, HIGH, NORMAL, LOW")
	cmd.Flags().StringVarP(&taskType, "type", "t", "", "Filter by task type")
	cmd.Flags().StringSliceVarP(&labels, "label", "l", nil, "Filter by label (repeatable)")
	cmd.Flags().StringVar(&parent, "parent", "", "Filter by parent task ID")
	cmd.Flags().StringVar(&sort, "sort", "", "Sort field: created, updated, priority, due_date")
	cmd.Flags().StringVar(&order, "order", "", "Sort order: asc, desc")
	cmd.Flags().BoolVar(&full, "full", false, "Return complete NTO for each task")
	cmd.Flags().Int32Var(&limit, "limit", 50, "Max results (max: 200)")
	cmd.Flags().StringVar(&cursor, "cursor", "", "Pagination cursor")
	return cmd
}

func newTaskCreateCmd(globals *globalFlags) *cobra.Command {
	var (
		description        string
		acceptanceCriteria string
		stage              string
		priority           string
		taskType           string
		assignees          []string
		labelFlags         []string
		parent             string
		dueDate            string
		startDate          string
		blocks             []string
		blockedBy          []string
		repo               string
		branch             string
		reason             string
	)

	cmd := &cobra.Command{
		Use:   "create <name>",
		Short: "Create a new task",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			collection := resolveCollectionFromServer(ctx, client, globals.collection)
			if collection == "" {
				return exitError(ExitValidation, "VALIDATION_ERROR", "collection is required; use --collection or set default_collection in config")
			}

			req := &pb.CreateTaskRequest{
				Name:         args[0],
				CollectionId: collection,
			}

			if description != "" {
				desc, err := readInputValue(description)
				if err != nil {
					return exitError(ExitGeneral, "INTERNAL_ERROR", err.Error())
				}
				req.Description = &desc
			}
			if acceptanceCriteria != "" {
				ac, err := readInputValue(acceptanceCriteria)
				if err != nil {
					return exitError(ExitGeneral, "INTERNAL_ERROR", err.Error())
				}
				req.AcceptanceCriteria = &ac
			}
			if stage != "" {
				st, err := parseStage(stage)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.Stage = &st
			}
			if priority != "" {
				p, err := parsePriority(priority)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.Priority = &p
			}
			if taskType != "" {
				req.Type = &taskType
			}
			if len(assignees) > 0 {
				req.AssigneeIds = assignees
			}
			if len(labelFlags) > 0 {
				req.Labels = labelFlags
			}
			if parent != "" {
				req.ParentTaskId = &parent
			}
			if dueDate != "" {
				ts, err := parseDate(dueDate)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", fmt.Sprintf("invalid due-date: %v", err))
				}
				req.DueDate = ts
			}
			if startDate != "" {
				ts, err := parseDate(startDate)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", fmt.Sprintf("invalid start-date: %v", err))
				}
				req.StartDate = ts
			}
			if len(blocks) > 0 {
				req.BlocksTaskIds = blocks
			}
			if len(blockedBy) > 0 {
				req.BlockedByTaskIds = blockedBy
			}
			if repo != "" {
				req.Repo = &repo
			}
			if branch != "" {
				req.Branch = &branch
			}
			if reason != "" {
				req.Reason = &reason
			}

			task, err := client.CreateTask(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				printQuiet(task.GetId())
			default:
				printJSON(taskToMap(task, false))
			}
			return nil
		},
	}

	cmd.Flags().StringVarP(&description, "description", "d", "", "Task description (supports @file and - for stdin)")
	cmd.Flags().StringVar(&acceptanceCriteria, "acceptance-criteria", "", "Completion criteria (supports @file and - for stdin)")
	cmd.Flags().StringVarP(&stage, "stage", "s", "", "Initial stage (default: triage)")
	cmd.Flags().StringVarP(&priority, "priority", "p", "", "Priority: URGENT, HIGH, NORMAL, LOW")
	cmd.Flags().StringVarP(&taskType, "type", "t", "", "Task type: bug, story, task, epic, etc.")
	cmd.Flags().StringSliceVarP(&assignees, "assignee", "a", nil, "Assignee (repeatable)")
	cmd.Flags().StringSliceVarP(&labelFlags, "label", "l", nil, "Label (repeatable)")
	cmd.Flags().StringVar(&parent, "parent", "", "Parent task ID")
	cmd.Flags().StringVar(&dueDate, "due-date", "", "Due date (ISO 8601 or YYYY-MM-DD)")
	cmd.Flags().StringVar(&startDate, "start-date", "", "Start date (ISO 8601 or YYYY-MM-DD)")
	cmd.Flags().StringSliceVar(&blocks, "blocks", nil, "Task IDs this task blocks (repeatable)")
	cmd.Flags().StringSliceVar(&blockedBy, "blocked-by", nil, "Task IDs blocking this task (repeatable)")
	cmd.Flags().StringVar(&repo, "repo", "", "code_context: repository")
	cmd.Flags().StringVar(&branch, "branch", "", "code_context: branch")
	cmd.Flags().StringVar(&reason, "reason", "", "Audit trail reason")
	return cmd
}

func newTaskUpdateCmd(globals *globalFlags) *cobra.Command {
	var (
		name               string
		description        string
		acceptanceCriteria string
		stage              string
		priority           string
		taskType           string
		assignees          []string
		dueDate            string
		startDate          string
		parentID           string
		addLabels          []string
		removeLabels       []string
		addBlocks          []string
		addBlockedBy       []string
		removeRels         []string
		repoFlag           string
		branchFlag         string
		clearDueDate       bool
		clearStartDate     bool
		clearRepo          bool
		clearBranch        bool
		addPRURL           string
		addPRStatus        string
		ciStatus           string
		clearCIStatus      bool
		reason             string
		version            string
	)

	cmd := &cobra.Command{
		Use:   "update <id>",
		Short: "Update task fields",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			req := &pb.UpdateTaskRequest{
				Id: args[0],
			}

			if name != "" {
				req.Name = &name
			}
			if description != "" {
				desc, err := readInputValue(description)
				if err != nil {
					return exitError(ExitGeneral, "INTERNAL_ERROR", err.Error())
				}
				req.Description = &desc
			}
			if acceptanceCriteria != "" {
				ac, err := readInputValue(acceptanceCriteria)
				if err != nil {
					return exitError(ExitGeneral, "INTERNAL_ERROR", err.Error())
				}
				req.AcceptanceCriteria = &ac
			}
			if stage != "" {
				st, err := parseStage(stage)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.Stage = &st
			}
			if priority != "" {
				p, err := parsePriority(priority)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.Priority = &p
			}
			if taskType != "" {
				req.Type = &taskType
			}

			if len(assignees) > 0 {
				if len(assignees) == 1 && strings.ToLower(assignees[0]) == "none" {
					req.ClearAssignees = true
				} else {
					req.AssigneeIds = assignees
				}
			}

			if clearDueDate {
				req.ClearDueDate = true
			} else if cmd.Flags().Changed("due-date") {
				if strings.ToLower(dueDate) == "none" {
					req.ClearDueDate = true
				} else {
					ts, err := parseDate(dueDate)
					if err != nil {
						return exitError(ExitValidation, "VALIDATION_ERROR", fmt.Sprintf("invalid due-date: %v", err))
					}
					req.DueDate = ts
				}
			}
			if clearStartDate {
				req.ClearStartDate = true
			} else if cmd.Flags().Changed("start-date") {
				if strings.ToLower(startDate) == "none" {
					req.ClearStartDate = true
				} else {
					ts, err := parseDate(startDate)
					if err != nil {
						return exitError(ExitValidation, "VALIDATION_ERROR", fmt.Sprintf("invalid start-date: %v", err))
					}
					req.StartDate = ts
				}
			}

			if cmd.Flags().Changed("parent") {
				if strings.ToLower(parentID) == "none" {
					req.ClearParent = true
				} else {
					req.ParentTaskId = &parentID
				}
			}

			if len(addLabels) > 0 {
				req.AddLabels = addLabels
			}
			if len(removeLabels) > 0 {
				req.RemoveLabels = removeLabels
			}
			if len(addBlocks) > 0 {
				req.AddBlocks = addBlocks
			}
			if len(addBlockedBy) > 0 {
				req.AddBlockedBy = addBlockedBy
			}
			if len(removeRels) > 0 {
				req.RemoveRelationships = removeRels
			}

			if clearRepo {
				empty := ""
				req.Repo = &empty
			} else if repoFlag != "" {
				req.Repo = &repoFlag
			}
			if clearBranch {
				empty := ""
				req.Branch = &empty
			} else if branchFlag != "" {
				req.Branch = &branchFlag
			}
			if addPRURL != "" && addPRStatus != "" {
				prSt, ok := prStatusValues[strings.ToLower(addPRStatus)]
				if !ok {
					return exitError(ExitValidation, "VALIDATION_ERROR", fmt.Sprintf("invalid PR status %q; valid: open, merged, closed", addPRStatus))
				}
				req.AddPullRequests = []*pb.PullRequest{{
					Url:    addPRURL,
					Status: prSt,
				}}
			} else if addPRURL != "" || addPRStatus != "" {
				return exitError(ExitValidation, "VALIDATION_ERROR", "--add-pr-url and --add-pr-status must be used together")
			}
			if clearCIStatus {
				unspecified := pb.CIStatus_CI_STATUS_UNSPECIFIED
				req.CiStatus = &unspecified
			} else if ciStatus != "" {
				ci, ok := ciStatusValues[strings.ToLower(ciStatus)]
				if !ok {
					return exitError(ExitValidation, "VALIDATION_ERROR", fmt.Sprintf("invalid CI status %q; valid: pending, running, passed, failed", ciStatus))
				}
				req.CiStatus = &ci
			}
			if reason != "" {
				req.Reason = &reason
			}
			if version != "" {
				req.Version = &version
			}

			task, err := client.UpdateTask(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				printQuiet(task.GetId())
			default:
				printJSON(taskToMap(task, false))
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&name, "name", "", "New task name")
	cmd.Flags().StringVarP(&description, "description", "d", "", "New description (supports @file and - for stdin)")
	cmd.Flags().StringVar(&acceptanceCriteria, "acceptance-criteria", "", "New acceptance criteria")
	cmd.Flags().StringVarP(&stage, "stage", "s", "", "New stage")
	cmd.Flags().StringVarP(&priority, "priority", "p", "", "New priority")
	cmd.Flags().StringVarP(&taskType, "type", "t", "", "New task type")
	cmd.Flags().StringSliceVarP(&assignees, "assignee", "a", nil, "Set assignee(s); 'none' to clear")
	cmd.Flags().StringVar(&dueDate, "due-date", "", "New due date; 'none' to clear")
	cmd.Flags().BoolVar(&clearDueDate, "clear-due-date", false, "Clear due date")
	cmd.Flags().StringVar(&startDate, "start-date", "", "New start date; 'none' to clear")
	cmd.Flags().BoolVar(&clearStartDate, "clear-start-date", false, "Clear start date")
	cmd.Flags().StringVar(&parentID, "parent", "", "New parent task ID; 'none' to clear")
	cmd.Flags().StringSliceVar(&addLabels, "add-label", nil, "Add label (repeatable)")
	cmd.Flags().StringSliceVar(&removeLabels, "remove-label", nil, "Remove label (repeatable)")
	cmd.Flags().StringSliceVar(&addBlocks, "add-blocks", nil, "Add BLOCKS relationship (repeatable)")
	cmd.Flags().StringSliceVar(&addBlockedBy, "add-blocked-by", nil, "Add BLOCKED_BY relationship (repeatable)")
	cmd.Flags().StringSliceVar(&removeRels, "remove-relationship", nil, "Remove relationship (repeatable)")
	cmd.Flags().StringVar(&repoFlag, "repo", "", "Update code_context repo")
	cmd.Flags().BoolVar(&clearRepo, "clear-repo", false, "Clear code_context repo")
	cmd.Flags().StringVar(&branchFlag, "branch", "", "Update code_context branch")
	cmd.Flags().BoolVar(&clearBranch, "clear-branch", false, "Clear code_context branch")
	cmd.Flags().StringVar(&addPRURL, "add-pr-url", "", "PR URL (must pair with --add-pr-status)")
	cmd.Flags().StringVar(&addPRStatus, "add-pr-status", "", "PR status: open, merged, closed")
	cmd.Flags().StringVar(&ciStatus, "ci-status", "", "CI status: pending, running, passed, failed")
	cmd.Flags().BoolVar(&clearCIStatus, "clear-ci-status", false, "Clear CI status")
	cmd.Flags().StringVar(&reason, "reason", "", "Audit trail reason")
	cmd.Flags().StringVar(&version, "version", "", "Expected version for CAS update")
	return cmd
}

func newTaskClaimCmd(globals *globalFlags) *cobra.Command {
	var (
		stage   string
		reason  string
		version string
	)

	cmd := &cobra.Command{
		Use:   "claim <id>",
		Short: "Atomically claim and start a task",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			req := &pb.ClaimTaskRequest{
				Id: args[0],
			}
			if stage != "" {
				st, err := parseStage(stage)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.Stage = &st
			}
			if reason != "" {
				req.Reason = &reason
			}
			if version != "" {
				req.Version = &version
			}

			resp, err := client.ClaimTask(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				printQuiet(resp.GetTask().GetId())
			default:
				m := taskToMap(resp.GetTask(), true)
				m["claimed_at"] = formatTimestamp(resp.GetClaimedAt())
				printJSON(m)
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&stage, "stage", "", "Override target stage (default: working)")
	cmd.Flags().StringVar(&reason, "reason", "", "Audit trail reason")
	cmd.Flags().StringVar(&version, "version", "", "Expected version for CAS claim")
	return cmd
}

func newTaskCloseCmd(globals *globalFlags) *cobra.Command {
	var (
		stage       string
		reason      string
		duplicateOf string
		version     string
	)

	cmd := &cobra.Command{
		Use:   "close <id>",
		Short: "Close a task",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			req := &pb.CloseTaskRequest{
				Id: args[0],
			}
			if stage != "" {
				st, err := parseStage(stage)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.Stage = &st
			}
			if reason != "" {
				req.Reason = &reason
			}
			if duplicateOf != "" {
				req.DuplicateOfTaskId = &duplicateOf
			}
			if version != "" {
				req.Version = &version
			}

			task, err := client.CloseTask(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				printQuiet(task.GetId())
			default:
				printJSON(taskToMap(task, false))
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&stage, "stage", "", "Close stage: completed, wont_fix, duplicate, cancelled")
	cmd.Flags().StringVar(&reason, "reason", "", "Audit trail reason")
	cmd.Flags().StringVar(&duplicateOf, "duplicate-of", "", "Canonical task ID when --stage duplicate")
	cmd.Flags().StringVar(&version, "version", "", "Expected version for CAS close")
	return cmd
}

func changeToMap(c *pb.Change) map[string]interface{} {
	m := map[string]interface{}{
		"id":         c.GetId(),
		"task_id":    c.GetTaskId(),
		"field":      c.GetField(),
		"old_value":  nil,
		"new_value":  nil,
		"changed_by": userToMap(c.GetChangedBy()),
		"changed_at": formatTimestamp(c.GetChangedAt()),
		"reason":     nilIfEmpty(c.GetReason()),
	}
	if c.GetOldValue() != nil {
		m["old_value"] = c.GetOldValue().AsInterface()
	}
	if c.GetNewValue() != nil {
		m["new_value"] = c.GetNewValue().AsInterface()
	}
	return m
}

func parseDate(s string) (*timestamppb.Timestamp, error) {
	for _, layout := range []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z",
		"2006-01-02",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return timestamppb.New(t), nil
		}
	}
	return nil, fmt.Errorf("cannot parse date %q (use ISO 8601 or YYYY-MM-DD)", s)
}

