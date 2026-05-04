package cli

import (
	"context"
	"fmt"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/spf13/cobra"
)

func newCollectionCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "collection",
		Short: "Collection operations",
	}
	cmd.AddCommand(
		newCollectionListCmd(globals),
		newCollectionGetCmd(globals),
		newCollectionCreateCmd(globals),
	)
	return cmd
}

func newCollectionListCmd(globals *globalFlags) *cobra.Command {
	var platform string

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List collections",
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			req := &pb.ListCollectionsRequest{}
			if platform != "" {
				p, err := parsePlatform(platform)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.Platform = &p
			}

			resp, err := client.ListCollections(ctx, req)
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
					printJSONLine(collectionToMap(c))
				}
			case "table":
				printCollectionTable(resp.GetItems())
			default:
				var items []interface{}
				for _, c := range resp.GetItems() {
					items = append(items, collectionToMap(c))
				}
				printList(items, resp.GetNextPageToken(), resp.GetHasMore(), resp.GetTotalCount())
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&platform, "platform", "", "Filter by platform: farmtable, github, linear, jira, asana, beads")
	return cmd
}

func newCollectionGetCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "get <id>",
		Short: "Get collection details",
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
			resp, err := client.GetCollection(ctx, &pb.GetCollectionRequest{Id: args[0]})
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				printQuiet(resp.GetId())
			default:
				printJSON(collectionToMap(resp))
			}
			return nil
		},
	}
	return cmd
}

func newCollectionCreateCmd(globals *globalFlags) *cobra.Command {
	var description string

	cmd := &cobra.Command{
		Use:   "create <name>",
		Short: "Create a collection (built-in backend)",
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
			req := &pb.CreateCollectionRequest{
				Name: args[0],
			}
			if description != "" {
				req.Description = &description
			}

			coll, err := client.CreateCollection(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				printQuiet(coll.GetId())
			default:
				printJSON(collectionToMap(coll))
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&description, "description", "", "Collection description")
	return cmd
}
