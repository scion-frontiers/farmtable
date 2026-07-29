package cli

import (
	"context"
	"fmt"
	"io"
	"os"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/spf13/cobra"
)

func newCommentCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "comment",
		Short: "Comment operations",
	}
	cmd.AddCommand(
		newCommentAddCmd(globals),
		newCommentListCmd(globals),
	)
	return cmd
}

func newCommentAddCmd(globals *globalFlags) *cobra.Command {
	var body string

	cmd := &cobra.Command{
		Use:   "add <task-id> [body]",
		Short: "Add a comment to a task",
		Args:  cobra.RangeArgs(1, 2),
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			var commentBody string
			if len(args) > 1 {
				commentBody = args[1]
			} else if body != "" {
				b, err := readInputValue(body)
				if err != nil {
					return exitError(ExitGeneral, "INTERNAL_ERROR", err.Error())
				}
				commentBody = b
			} else {
				data, err := io.ReadAll(os.Stdin)
				if err != nil {
					return exitError(ExitGeneral, "INTERNAL_ERROR", fmt.Sprintf("reading stdin: %v", err))
				}
				commentBody = string(data)
			}

			if commentBody == "" {
				return exitError(ExitValidation, "VALIDATION_ERROR", "comment body is required")
			}

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			comment, err := client.AddComment(ctx, &pb.AddCommentRequest{
				TaskId: args[0],
				Body:   commentBody,
			})
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				printQuiet(comment.GetId())
			default:
				printJSON(commentToMap(comment))
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&body, "body", "", "Comment body (supports @file and - for stdin)")
	return cmd
}

func newCommentListCmd(globals *globalFlags) *cobra.Command {
	var (
		limit  int32
		cursor string
		order  string
	)

	cmd := &cobra.Command{
		Use:   "list <task-id>",
		Short: "List comments on a task",
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
			req := &pb.ListCommentsRequest{
				TaskId:    args[0],
				PageSize:  limit,
				PageToken: cursor,
			}
			if order != "" {
				v, ok := sortOrderValues[order]
				if !ok {
					return exitError(ExitValidation, "VALIDATION_ERROR",
						fmt.Sprintf("invalid sort order %q; valid: asc, desc", order))
				}
				req.Order = v
			}

			resp, err := client.ListComments(ctx, req)
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
					printJSONLine(commentToMap(c))
				}
			case "table":
				printCommentTable(resp.GetItems())
			default:
				var items []interface{}
				for _, c := range resp.GetItems() {
					items = append(items, commentToMap(c))
				}
				printList(items, resp.GetNextPageToken(), resp.GetHasMore(), resp.GetTotalCount())
			}
			return nil
		},
	}

	cmd.Flags().Int32Var(&limit, "limit", 50, "Max comments to return")
	cmd.Flags().StringVar(&cursor, "cursor", "", "Pagination cursor")
	cmd.Flags().StringVar(&order, "order", "", "Sort order: asc (default), desc")
	return cmd
}
