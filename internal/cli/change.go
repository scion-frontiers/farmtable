package cli

import (
	"context"
	"fmt"
	"os"
	"text/tabwriter"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/spf13/cobra"
)

func newChangeCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "change",
		Short: "Audit trail operations",
	}
	cmd.AddCommand(
		newChangeListCmd(globals),
	)
	return cmd
}

func newChangeListCmd(globals *globalFlags) *cobra.Command {
	var (
		field  string
		limit  int32
		cursor string
	)

	cmd := &cobra.Command{
		Use:   "list <task-id>",
		Short: "List change records for a task",
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
			req := &pb.ListChangesRequest{
				TaskId:    args[0],
				PageSize:  limit,
				PageToken: cursor,
			}
			if field != "" {
				req.Field = &field
			}

			resp, err := client.ListChanges(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				for _, c := range resp.GetItems() {
					printQuiet(c.GetId())
				}
			case "jsonl":
				for _, c := range resp.GetItems() {
					printJSONLine(changeToMap(c))
				}
			case "table":
				printChangeTable(resp.GetItems())
			default:
				var items []interface{}
				for _, c := range resp.GetItems() {
					items = append(items, changeToMap(c))
				}
				printList(items, resp.GetNextPageToken(), resp.GetHasMore(), resp.GetTotalCount())
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&field, "field", "", "Filter by field name (e.g., stage, priority)")
	cmd.Flags().Int32Var(&limit, "limit", 50, "Max changes to return")
	cmd.Flags().StringVar(&cursor, "cursor", "", "Pagination cursor")
	return cmd
}

func printChangeTable(changes []*pb.Change) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tFIELD\tOLD\tNEW\tCHANGED_BY\tCHANGED_AT")
	for _, c := range changes {
		id := c.GetId()
		if len(id) > 8 {
			id = id[:8]
		}
		author := "—"
		if c.GetChangedBy() != nil {
			author = c.GetChangedBy().GetName()
			if author == "" {
				author = c.GetChangedBy().GetId()
			}
		}
		oldVal := "—"
		if c.GetOldValue() != nil {
			oldVal = fmt.Sprintf("%v", c.GetOldValue().AsInterface())
		}
		newVal := "—"
		if c.GetNewValue() != nil {
			newVal = fmt.Sprintf("%v", c.GetNewValue().AsInterface())
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%v\n",
			id,
			c.GetField(),
			truncate(oldVal, 20),
			truncate(newVal, 20),
			truncate(author, 15),
			formatTimestamp(c.GetChangedAt()),
		)
	}
	w.Flush()
}
