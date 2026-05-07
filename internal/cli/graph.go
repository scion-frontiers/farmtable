package cli

import (
	"context"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/spf13/cobra"
)

func newReadyCmd(globals *globalFlags) *cobra.Command {
	var (
		assignee        string
		minPriority     string
		includeUnblocked bool
		limit           int32
		cursor          string
	)

	cmd := &cobra.Command{
		Use:   "ready",
		Short: "List tasks ready to work on",
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
			req := &pb.GetReadyTasksRequest{
				IncludeUnblockedOpen: includeUnblocked,
				PageSize:             limit,
				PageToken:            cursor,
			}
			if collection != "" {
				req.CollectionId = &collection
			}
			if assignee != "" {
				req.Assignee = &assignee
			}
			if minPriority != "" {
				p, err := parsePriority(minPriority)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.MinPriority = &p
			}

			resp, err := client.GetReadyTasks(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				for _, item := range resp.GetItems() {
					printQuiet(item.GetTask().GetId())
				}
			case "jsonl":
				for _, item := range resp.GetItems() {
					printJSONLine(readyTaskToMap(item))
				}
			case "table":
				printReadyTable(resp.GetItems(), resp.GetTotalCount())
			default:
				var items []interface{}
				for _, item := range resp.GetItems() {
					items = append(items, readyTaskToMap(item))
				}
				printList(items, resp.GetNextPageToken(), resp.GetHasMore(), resp.GetTotalCount())
			}
			return nil
		},
	}

	cmd.Flags().StringVarP(&assignee, "assignee", "a", "", "Filter by assignee")
	cmd.Flags().StringVar(&minPriority, "min-priority", "", "Minimum priority: URGENT, HIGH, NORMAL, LOW")
	cmd.Flags().BoolVar(&includeUnblocked, "include-unblocked", false, "Include unblocked open tasks")
	cmd.Flags().Int32Var(&limit, "limit", 50, "Max results (max: 200)")
	cmd.Flags().StringVar(&cursor, "cursor", "", "Pagination cursor")
	return cmd
}

func newBlockedCmd(globals *globalFlags) *cobra.Command {
	var (
		assignee string
		limit    int32
		cursor   string
	)

	cmd := &cobra.Command{
		Use:   "blocked",
		Short: "List blocked tasks and their blockers",
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
			req := &pb.GetBlockedTasksRequest{
				PageSize:  limit,
				PageToken: cursor,
			}
			if collection != "" {
				req.CollectionId = &collection
			}
			if assignee != "" {
				req.Assignee = &assignee
			}

			resp, err := client.GetBlockedTasks(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				for _, item := range resp.GetItems() {
					printQuiet(item.GetTask().GetId())
				}
			case "jsonl":
				for _, item := range resp.GetItems() {
					printJSONLine(blockedTaskToMap(item))
				}
			case "table":
				printBlockedTable(resp.GetItems(), resp.GetTotalCount())
			default:
				var items []interface{}
				for _, item := range resp.GetItems() {
					items = append(items, blockedTaskToMap(item))
				}
				printList(items, resp.GetNextPageToken(), resp.GetHasMore(), resp.GetTotalCount())
			}
			return nil
		},
	}

	cmd.Flags().StringVarP(&assignee, "assignee", "a", "", "Filter by assignee")
	cmd.Flags().Int32Var(&limit, "limit", 50, "Max results (max: 200)")
	cmd.Flags().StringVar(&cursor, "cursor", "", "Pagination cursor")
	return cmd
}

func newTreeCmd(globals *globalFlags) *cobra.Command {
	var (
		direction string
		maxDepth  int32
	)

	cmd := &cobra.Command{
		Use:   "tree <id>",
		Short: "Show dependency tree for a task",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			dir, err := parseDirection(direction)
			if err != nil {
				return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
			}
			if maxDepth > 20 {
				return exitError(ExitValidation, "VALIDATION_ERROR", "max-depth cannot exceed 20")
			}

			ctx := authCtx(context.Background(), token)
			req := &pb.GetDependencyTreeRequest{
				TaskId:   args[0],
				Direction: dir,
				MaxDepth:  maxDepth,
			}

			resp, err := client.GetDependencyTree(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				if resp.GetRoot() != nil {
					printQuiet(resp.GetRoot().GetTask().GetId())
				}
			case "table":
				printDependencyTree(resp.GetRoot(), 0)
			default:
				printJSON(dependencyNodeToMap(resp.GetRoot()))
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&direction, "direction", "both", "Direction: up, down, both")
	cmd.Flags().Int32Var(&maxDepth, "max-depth", 5, "Maximum tree depth (max: 20)")
	return cmd
}

func newCriticalPathCmd(globals *globalFlags) *cobra.Command {
	var root string

	cmd := &cobra.Command{
		Use:   "critical-path",
		Short: "Find the critical path through task dependencies",
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

			req := &pb.GetCriticalPathRequest{
				CollectionId: collection,
			}
			if root != "" {
				req.RootTaskId = &root
			}

			resp, err := client.GetCriticalPath(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				for _, n := range resp.GetPath() {
					printQuiet(n.GetId())
				}
			case "table":
				printCriticalPathTable(resp)
			default:
				m := map[string]interface{}{
					"path":        criticalPathNodesToList(resp.GetPath()),
					"total_depth": resp.GetTotalDepth(),
					"bottleneck":  bottleneckToMap(resp.GetBottleneck()),
				}
				printJSON(m)
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&root, "root", "", "Root task UUID (optional)")
	return cmd
}

func newBottlenecksCmd(globals *globalFlags) *cobra.Command {
	var limit int32

	cmd := &cobra.Command{
		Use:   "bottlenecks",
		Short: "Find tasks that block the most downstream work",
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

			if limit > 100 {
				return exitError(ExitValidation, "VALIDATION_ERROR", "limit cannot exceed 100")
			}

			req := &pb.GetBottlenecksRequest{
				CollectionId: collection,
				Limit:        limit,
			}

			resp, err := client.GetBottlenecks(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				for _, item := range resp.GetItems() {
					printQuiet(item.GetId())
				}
			case "jsonl":
				for _, item := range resp.GetItems() {
					printJSONLine(bottleneckTaskToMap(item))
				}
			case "table":
				printBottlenecksTable(resp.GetItems())
			default:
				var items []interface{}
				for _, item := range resp.GetItems() {
					items = append(items, bottleneckTaskToMap(item))
				}
				printJSON(map[string]interface{}{"items": items})
			}
			return nil
		},
	}

	cmd.Flags().Int32Var(&limit, "limit", 10, "Max results (max: 100)")
	return cmd
}

// --- helpers ---

func parseDirection(s string) (pb.DependencyDirection, error) {
	switch strings.ToLower(s) {
	case "up":
		return pb.DependencyDirection_DEPENDENCY_DIRECTION_UP, nil
	case "down":
		return pb.DependencyDirection_DEPENDENCY_DIRECTION_DOWN, nil
	case "both", "":
		return pb.DependencyDirection_DEPENDENCY_DIRECTION_BOTH, nil
	default:
		return 0, fmt.Errorf("invalid direction %q; valid: up, down, both", s)
	}
}

func readyTaskToMap(rt *pb.ReadyTask) map[string]interface{} {
	t := rt.GetTask()
	return map[string]interface{}{
		"id":                t.GetId(),
		"name":              t.GetName(),
		"phase":             phaseNames[t.GetPhase()],
		"stage":             stageNames[t.GetStage()],
		"priority":          nilIfZeroPriority(t.GetPriority()),
		"assignees":         usersToList(t.GetAssignees()),
		"collection_id":     t.GetCollectionId(),
		"blockers_resolved": rt.GetBlockersResolved(),
		"updated_at":        formatTimestamp(t.GetUpdatedAt()),
	}
}

func blockedTaskToMap(bt *pb.BlockedTask) map[string]interface{} {
	t := bt.GetTask()
	var blockedBy []interface{}
	for _, b := range bt.GetBlockedBy() {
		blockedBy = append(blockedBy, map[string]interface{}{
			"task_id": b.GetTaskId(),
			"name":   b.GetName(),
			"phase":  phaseNames[b.GetPhase()],
			"stage":  stageNames[b.GetStage()],
		})
	}
	return map[string]interface{}{
		"id":            t.GetId(),
		"name":          t.GetName(),
		"phase":         phaseNames[t.GetPhase()],
		"stage":         stageNames[t.GetStage()],
		"priority":      nilIfZeroPriority(t.GetPriority()),
		"assignees":     usersToList(t.GetAssignees()),
		"collection_id": t.GetCollectionId(),
		"blocker_count": len(bt.GetBlockedBy()),
		"blocked_by":    blockedBy,
		"updated_at":    formatTimestamp(t.GetUpdatedAt()),
	}
}

func dependencyNodeToMap(n *pb.DependencyNode) map[string]interface{} {
	if n == nil {
		return nil
	}
	t := n.GetTask()
	m := map[string]interface{}{
		"id":    t.GetId(),
		"name":  t.GetName(),
		"phase": phaseNames[t.GetPhase()],
		"stage": stageNames[t.GetStage()],
	}
	if len(n.GetBlocks()) > 0 {
		var blocks []interface{}
		for _, child := range n.GetBlocks() {
			blocks = append(blocks, dependencyNodeToMap(child))
		}
		m["blocks"] = blocks
	}
	if len(n.GetBlockedBy()) > 0 {
		var blockedBy []interface{}
		for _, parent := range n.GetBlockedBy() {
			blockedBy = append(blockedBy, dependencyNodeToMap(parent))
		}
		m["blocked_by"] = blockedBy
	}
	return m
}

func criticalPathNodesToList(nodes []*pb.CriticalPathNode) []interface{} {
	result := make([]interface{}, 0, len(nodes))
	for _, n := range nodes {
		result = append(result, map[string]interface{}{
			"id":    n.GetId(),
			"name":  n.GetName(),
			"stage": stageNames[n.GetStage()],
			"depth": n.GetDepth(),
		})
	}
	return result
}

func bottleneckToMap(b *pb.Bottleneck) interface{} {
	if b == nil {
		return nil
	}
	return map[string]interface{}{
		"id":      b.GetId(),
		"name":    b.GetName(),
		"fan_out": b.GetFanOut(),
		"reason":  b.GetReason(),
	}
}

func bottleneckTaskToMap(bt *pb.BottleneckTask) map[string]interface{} {
	return map[string]interface{}{
		"id":                bt.GetId(),
		"name":              bt.GetName(),
		"stage":             stageNames[bt.GetStage()],
		"downstream_count":  bt.GetDownstreamCount(),
		"direct_dependents": bt.GetDirectDependents(),
	}
}

// --- table printers ---

func printReadyTable(items []*pb.ReadyTask, totalCount int32) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tNAME\tSTAGE\tPRI\tBLOCKERS_RESOLVED")
	for _, item := range items {
		t := item.GetTask()
		id := t.GetId()
		if len(id) > 8 {
			id = id[:8]
		}
		pri := "—"
		if t.GetPriority() != pb.TaskPriority_TASK_PRIORITY_UNSPECIFIED {
			pri = priorityNames[t.GetPriority()]
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%d\n",
			id,
			truncate(t.GetName(), 45),
			stageNames[t.GetStage()],
			pri,
			item.GetBlockersResolved(),
		)
	}
	w.Flush()
	if totalCount > 0 {
		fmt.Fprintf(os.Stderr, "\nShowing %d of %d tasks. Use --cursor to page.\n", len(items), totalCount)
	}
}

func printBlockedTable(items []*pb.BlockedTask, totalCount int32) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tNAME\tSTAGE\tBLOCKER_COUNT\tBLOCKERS")
	for _, item := range items {
		t := item.GetTask()
		id := t.GetId()
		if len(id) > 8 {
			id = id[:8]
		}
		var blockerNames []string
		for _, b := range item.GetBlockedBy() {
			name := b.GetName()
			if name == "" {
				name = b.GetTaskId()
			}
			blockerNames = append(blockerNames, name)
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%d\t%s\n",
			id,
			truncate(t.GetName(), 45),
			stageNames[t.GetStage()],
			len(item.GetBlockedBy()),
			truncate(strings.Join(blockerNames, ", "), 60),
		)
	}
	w.Flush()
	if totalCount > 0 {
		fmt.Fprintf(os.Stderr, "\nShowing %d of %d tasks. Use --cursor to page.\n", len(items), totalCount)
	}
}

func printDependencyTree(node *pb.DependencyNode, depth int) {
	if node == nil {
		return
	}
	t := node.GetTask()
	indent := strings.Repeat("  ", depth)
	id := t.GetId()
	if len(id) > 8 {
		id = id[:8]
	}
	fmt.Printf("%s%s %s [%s]\n", indent, id, truncate(t.GetName(), 45), stageNames[t.GetStage()])
	for _, child := range node.GetBlocks() {
		printDependencyTree(child, depth+1)
	}
	for _, parent := range node.GetBlockedBy() {
		printDependencyTree(parent, depth+1)
	}
}

func printCriticalPathTable(resp *pb.GetCriticalPathResponse) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "DEPTH\tID\tNAME\tSTAGE")
	for _, n := range resp.GetPath() {
		id := n.GetId()
		if len(id) > 8 {
			id = id[:8]
		}
		fmt.Fprintf(w, "%d\t%s\t%s\t%s\n",
			n.GetDepth(),
			id,
			truncate(n.GetName(), 45),
			stageNames[n.GetStage()],
		)
	}
	w.Flush()
	fmt.Fprintf(os.Stderr, "\nTotal depth: %d\n", resp.GetTotalDepth())
	if b := resp.GetBottleneck(); b != nil {
		fmt.Fprintf(os.Stderr, "Bottleneck: %s — %s\n", b.GetName(), b.GetReason())
	}
}

func printBottlenecksTable(items []*pb.BottleneckTask) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tNAME\tSTAGE\tDOWNSTREAM\tDIRECT_DEPS")
	for _, item := range items {
		id := item.GetId()
		if len(id) > 8 {
			id = id[:8]
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%d\t%d\n",
			id,
			truncate(item.GetName(), 45),
			stageNames[item.GetStage()],
			item.GetDownstreamCount(),
			item.GetDirectDependents(),
		)
	}
	w.Flush()
}
