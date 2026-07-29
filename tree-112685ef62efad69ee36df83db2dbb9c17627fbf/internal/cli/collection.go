package cli

import (
	"context"
	"fmt"
	"io"
	"os"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/spf13/cobra"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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
		newCollectionExportCmd(globals),
		newCollectionImportCmd(globals),
		newCollectionLinkCmd(globals),
		newCollectionUnlinkCmd(globals),
		newCollectionLinksCmd(globals),
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

func newCollectionExportCmd(globals *globalFlags) *cobra.Command {
	var out string
	var includeChanges bool

	cmd := &cobra.Command{
		Use:   "export <id-or-name>",
		Short: "Export a farmtable collection",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			collectionID, err := resolveCollectionIDArg(ctx, client, args[0])
			if err != nil {
				return err
			}
			resp, err := client.ExportCollection(ctx, &pb.ExportCollectionRequest{
				Id:             collectionID,
				IncludeChanges: includeChanges,
			})
			if err != nil {
				return handleGRPCError(err)
			}
			for _, warning := range resp.GetWarnings() {
				fmt.Fprintln(os.Stderr, warning)
			}
			if out != "" {
				if err := os.WriteFile(out, resp.GetData(), 0o600); err != nil {
					return exitError(ExitGeneral, "IO_ERROR", fmt.Sprintf("writing export file: %v", err))
				}
				return nil
			}
			_, err = os.Stdout.Write(resp.GetData())
			if err != nil {
				return exitError(ExitGeneral, "IO_ERROR", fmt.Sprintf("writing stdout: %v", err))
			}
			if len(resp.GetData()) == 0 || resp.GetData()[len(resp.GetData())-1] != '\n' {
				fmt.Fprintln(os.Stdout)
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&out, "out", "", "Write export JSON to file instead of stdout")
	cmd.Flags().BoolVar(&includeChanges, "include-changes", false, "Include audit trail change history")
	return cmd
}

func newCollectionImportCmd(globals *globalFlags) *cobra.Command {
	var name string
	var dryRun bool

	cmd := &cobra.Command{
		Use:   "import <file|-|@path>",
		Short: "Import a farmtable collection",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)
			data, err := readCollectionImportData(args[0])
			if err != nil {
				return exitError(ExitGeneral, "IO_ERROR", err.Error())
			}

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			req := &pb.ImportCollectionRequest{
				Data:   data,
				DryRun: dryRun,
			}
			if name != "" {
				req.Name = &name
			}
			resp, err := client.ImportCollection(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}
			for _, warning := range resp.GetWarnings() {
				fmt.Fprintln(os.Stderr, warning)
			}
			switch output {
			case "quiet":
				if resp.GetCollectionId() != "" {
					printQuiet(resp.GetCollectionId())
				}
			default:
				printJSON(importCollectionResponseToMap(resp, dryRun))
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&name, "name", "", "Override imported collection name")
	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "Validate without importing")
	return cmd
}

func readCollectionImportData(arg string) ([]byte, error) {
	if arg == "-" {
		return io.ReadAll(os.Stdin)
	}
	path := arg
	if len(arg) > 0 && arg[0] == '@' {
		path = arg[1:]
	}
	return os.ReadFile(path)
}

func resolveCollectionIDArg(ctx context.Context, client pb.FarmTableServiceClient, arg string) (string, error) {
	_, err := client.GetCollection(ctx, &pb.GetCollectionRequest{Id: arg})
	if err == nil {
		return arg, nil
	}
	code := status.Code(err)
	if code != codes.InvalidArgument && code != codes.NotFound {
		return "", handleGRPCError(err)
	}
	pageToken := ""
	for {
		resp, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{PageSize: 200, PageToken: pageToken})
		if err != nil {
			return "", handleGRPCError(err)
		}
		for _, coll := range resp.GetItems() {
			if coll.GetId() == arg || coll.GetName() == arg {
				return coll.GetId(), nil
			}
		}
		if !resp.GetHasMore() {
			break
		}
		pageToken = resp.GetNextPageToken()
	}
	return "", exitError(ExitNotFound, "NOT_FOUND", fmt.Sprintf("collection %q not found", arg))
}

func importCollectionResponseToMap(resp *pb.ImportCollectionResponse, dryRun bool) map[string]interface{} {
	stats := resp.GetStats()
	return map[string]interface{}{
		"collection_id": resp.GetCollectionId(),
		"dry_run":       dryRun,
		"stats": map[string]interface{}{
			"users_matched": stats.GetUsersMatched(),
			"users_created": stats.GetUsersCreated(),
			"tasks":         stats.GetTasks(),
			"comments":      stats.GetComments(),
			"relationships": stats.GetRelationships(),
			"changes":       stats.GetChanges(),
		},
		"warnings": resp.GetWarnings(),
	}
}
