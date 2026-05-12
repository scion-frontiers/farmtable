package cli

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"text/tabwriter"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/spf13/cobra"
)

var eventTypeNames = map[pb.TaskEventType]string{
	pb.TaskEventType_TASK_EVENT_TYPE_UNSPECIFIED:       "UNKNOWN",
	pb.TaskEventType_TASK_EVENT_TYPE_INITIAL:           "INITIAL",
	pb.TaskEventType_TASK_EVENT_TYPE_CREATED:           "CREATED",
	pb.TaskEventType_TASK_EVENT_TYPE_UPDATED:           "UPDATED",
	pb.TaskEventType_TASK_EVENT_TYPE_CLOSED:            "CLOSED",
	pb.TaskEventType_TASK_EVENT_TYPE_DELETED:           "DELETED",
	pb.TaskEventType_TASK_EVENT_TYPE_HEARTBEAT:         "HEARTBEAT",
	pb.TaskEventType_TASK_EVENT_TYPE_SNAPSHOT_COMPLETE: "SNAP_DONE",
}

func eventTypeName(t pb.TaskEventType) string {
	if n, ok := eventTypeNames[t]; ok {
		return n
	}
	return "UNKNOWN"
}

func eventToMap(e *pb.TaskEvent) map[string]interface{} {
	m := map[string]interface{}{
		"event_type": eventTypeName(e.GetEventType()),
		"timestamp":  formatTimestamp(e.GetTimestamp()),
		"sequence":   e.GetSequence(),
	}
	if e.GetTask() != nil {
		m["task"] = taskToMap(e.GetTask(), true)
	}
	if len(e.GetChanges()) > 0 {
		var changes []interface{}
		for _, c := range e.GetChanges() {
			changes = append(changes, changeToMap(c))
		}
		m["changes"] = changes
	}
	return m
}

func newWatchCmd(globals *globalFlags) *cobra.Command {
	var (
		stages         []string
		phase          string
		taskID         string
		assignee       string
		labels         []string
		priority       string
		includeInitial bool
	)

	cmd := &cobra.Command{
		Use:   "watch",
		Short: "Watch task events in real time",
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx, cancel := context.WithCancel(authCtx(context.Background(), token))
			defer cancel()

			sigCh := make(chan os.Signal, 1)
			signal.Notify(sigCh, os.Interrupt)
			go func() {
				<-sigCh
				cancel()
			}()

			collection := resolveCollectionFromServer(ctx, client, globals.collection)

			req := &pb.WatchTasksRequest{
				IncludeInitial: includeInitial,
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
			if len(labels) > 0 {
				req.Labels = labels
			}
			if taskID != "" {
				req.TaskId = &taskID
			}
			if priority != "" {
				p, err := parsePriority(priority)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.Priority = &p
			}

			stream, err := client.WatchTasks(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			var tw *tabwriter.Writer
			if output == "table" {
				tw = tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
				fmt.Fprintln(tw, "TIME\tEVENT\tTASK ID\tNAME\tSTAGE")
				tw.Flush()
			}

			for {
				event, err := stream.Recv()
				if err != nil {
					if err == io.EOF || ctx.Err() != nil {
						return nil
					}
					return handleGRPCError(err)
				}

				switch output {
				case "jsonl":
					printJSONLine(eventToMap(event))
				case "table":
					printEventTableRow(tw, event)
				default:
					printJSON(eventToMap(event))
				}
			}
		},
	}

	cmd.Flags().StringSliceVar(&stages, "stage", nil, "Filter by stage (repeatable)")
	cmd.Flags().StringVar(&phase, "phase", "", "Filter by phase: OPEN, IN_PROGRESS, ON_HOLD, CLOSED")
	cmd.Flags().StringVar(&taskID, "task-id", "", "Watch a single task by ID")
	cmd.Flags().StringVarP(&assignee, "assignee", "a", "", "Filter by assignee (UUID or 'none')")
	cmd.Flags().StringSliceVarP(&labels, "label", "l", nil, "Filter by label (repeatable, AND logic)")
	cmd.Flags().StringVarP(&priority, "priority", "p", "", "Filter by priority: URGENT, HIGH, NORMAL, LOW")
	cmd.Flags().BoolVar(&includeInitial, "include-initial", false, "Include initial task snapshot")
	return cmd
}

func printEventTableRow(tw *tabwriter.Writer, e *pb.TaskEvent) {
	ts := "—"
	if e.GetTimestamp() != nil {
		ts = e.GetTimestamp().AsTime().Local().Format(time.TimeOnly)
	}

	taskID := "—"
	name := "—"
	stage := "—"
	if e.GetTask() != nil {
		taskID = e.GetTask().GetId()
		name = truncate(e.GetTask().GetName(), 30)
		stage = stageNames[e.GetTask().GetStage()]
	}

	fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%s\n", ts, eventTypeName(e.GetEventType()), taskID, name, stage)
	tw.Flush()
}
