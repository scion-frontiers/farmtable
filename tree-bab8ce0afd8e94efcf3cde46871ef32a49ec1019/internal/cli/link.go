package cli

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/spf13/cobra"
)

// linkedAccountStatusNames maps proto enum values to display strings.
var linkedAccountStatusNames = map[pb.LinkedAccountStatus]string{
	pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_ACTIVE:  "ACTIVE",
	pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_EXPIRED: "EXPIRED",
	pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_REVOKED: "REVOKED",
}

// authMethodNames maps proto enum values to display strings.
var authMethodNames = map[pb.AuthMethod]string{
	pb.AuthMethod_AUTH_METHOD_OAUTH2_PKCE:       "oauth2_pkce",
	pb.AuthMethod_AUTH_METHOD_API_KEY:           "api_key",
	pb.AuthMethod_AUTH_METHOD_PAT:               "pat",
	pb.AuthMethod_AUTH_METHOD_SERVICE_ACCOUNT:   "service_account",
	pb.AuthMethod_AUTH_METHOD_MCP_OAUTH:         "mcp_oauth",
	pb.AuthMethod_AUTH_METHOD_GITHUB_APP:        "github_app",
	pb.AuthMethod_AUTH_METHOD_ATLASSIAN_CONNECT: "atlassian_connect",
	pb.AuthMethod_AUTH_METHOD_LOCAL_PROCESS:     "local_process",
}

func newCollectionLinkCmd(globals *globalFlags) *cobra.Command {
	var (
		collection string
		token      string
		repo       string
	)

	cmd := &cobra.Command{
		Use:   "link <platform>",
		Short: "Link an external platform account to a collection",
		Long: `Link an external platform account to a collection.

The auth token can be provided via:
  --token flag
  FARMTABLE_LINK_TOKEN environment variable
  stdin (pipe from a secret manager)

Example:
  ft collection link github --collection <id> --token ghp_xxx --repo owner/repo
  echo ghp_xxx | ft collection link github --collection <id> --repo owner/repo`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			apiToken := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			platform, err := parsePlatform(args[0])
			if err != nil {
				return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
			}

			linkToken := resolveLinkToken(token)
			if linkToken == "" {
				return exitError(ExitValidation, "VALIDATION_ERROR",
					"auth token is required; use --token, set FARMTABLE_LINK_TOKEN, or pipe via stdin")
			}

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), apiToken)

			collectionID := resolveCollection(collection)
			if collectionID == "" {
				collectionID = resolveCollectionFromServer(ctx, client, globals.collection)
			}
			if collectionID == "" {
				return exitError(ExitValidation, "VALIDATION_ERROR",
					"collection is required; use --collection or set default_collection in config")
			}

			// Determine auth method from platform and flags.
			authMethod := inferAuthMethod(platform)

			// Build scopes from platform defaults.
			scopes := inferScopes(platform)

			req := &pb.CreateLinkedAccountRequest{
				CollectionId: collectionID,
				Platform:     platform,
				AuthMethod:   authMethod,
				AuthToken:    linkToken,
				Scopes:       scopes,
			}
			if repo != "" {
				req.RemoteUserId = &repo
			}

			resp, err := client.CreateLinkedAccount(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			la := resp.GetLinkedAccount()
			switch output {
			case "quiet":
				printQuiet(la.GetId())
			default:
				printJSON(linkedAccountToMap(la))
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&collection, "collection", "", "Collection ID to link to")
	cmd.Flags().StringVar(&token, "token", "", "Auth token for the external platform (e.g. GitHub PAT)")
	cmd.Flags().StringVar(&repo, "repo", "", "Repository in owner/repo format (GitHub)")
	return cmd
}

func newCollectionUnlinkCmd(globals *globalFlags) *cobra.Command {
	var (
		collection string
		accountID  string
	)

	cmd := &cobra.Command{
		Use:   "unlink",
		Short: "Unlink (delete) a linked external platform account",
		Long: `Unlink a linked external platform account from a collection.

If --account is provided, deletes that specific linked account.
Otherwise, lists linked accounts for the collection and deletes the first one found.

Example:
  ft collection unlink --account <linked-account-id>
  ft collection unlink --collection <collection-id>`,
		RunE: func(cmd *cobra.Command, args []string) error {
			apiToken := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), apiToken)

			targetID := accountID
			if targetID == "" {
				// Resolve collection and find linked accounts.
				collectionID := resolveCollection(collection)
				if collectionID == "" {
					collectionID = resolveCollectionFromServer(ctx, client, globals.collection)
				}
				if collectionID == "" {
					return exitError(ExitValidation, "VALIDATION_ERROR",
						"either --account or --collection is required")
				}

				listReq := &pb.ListLinkedAccountsRequest{
					CollectionId: &collectionID,
				}
				listResp, err := client.ListLinkedAccounts(ctx, listReq)
				if err != nil {
					return handleGRPCError(err)
				}
				if len(listResp.GetItems()) == 0 {
					return exitError(ExitNotFound, "NOT_FOUND",
						fmt.Sprintf("no linked accounts found for collection %s", collectionID))
				}
				if len(listResp.GetItems()) > 1 {
					// Multiple accounts — show them and ask the user to specify.
					fmt.Fprintf(os.Stderr, "Multiple linked accounts found. Use --account to specify which one to unlink:\n\n")
					for _, la := range listResp.GetItems() {
						fmt.Fprintf(os.Stderr, "  %s  %s  %s\n",
							la.GetId(),
							platformNames[la.GetPlatform()],
							linkedAccountStatusNames[la.GetStatus()],
						)
					}
					return exitError(ExitValidation, "VALIDATION_ERROR",
						"multiple linked accounts found; use --account <id> to specify")
				}
				targetID = listResp.GetItems()[0].GetId()
			}

			_, err = client.DeleteLinkedAccount(ctx, &pb.DeleteLinkedAccountRequest{
				Id: targetID,
			})
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				printQuiet(targetID)
			default:
				printJSON(map[string]interface{}{
					"deleted":    true,
					"account_id": targetID,
				})
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&collection, "collection", "", "Collection ID to unlink from")
	cmd.Flags().StringVar(&accountID, "account", "", "Linked account ID to delete directly")
	return cmd
}

func newCollectionLinksCmd(globals *globalFlags) *cobra.Command {
	var (
		collection string
		platform   string
	)

	cmd := &cobra.Command{
		Use:   "links",
		Short: "List linked external platform accounts",
		Long: `List linked external platform accounts, optionally filtered by collection or platform.

Example:
  ft collection links
  ft collection links --collection <id>
  ft collection links --platform github`,
		RunE: func(cmd *cobra.Command, args []string) error {
			apiToken := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), apiToken)
			req := &pb.ListLinkedAccountsRequest{}

			collectionID := resolveCollection(collection)
			if collectionID == "" && collection == "" {
				collectionID = resolveCollectionFromServer(ctx, client, globals.collection)
			}
			if collectionID != "" {
				req.CollectionId = &collectionID
			}

			if platform != "" {
				p, err := parsePlatform(platform)
				if err != nil {
					return exitError(ExitValidation, "VALIDATION_ERROR", err.Error())
				}
				req.Platform = &p
			}

			resp, err := client.ListLinkedAccounts(ctx, req)
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				for _, la := range resp.GetItems() {
					printQuiet(la.GetId())
				}
			case "jsonl":
				for _, la := range resp.GetItems() {
					printJSONLine(linkedAccountToMap(la))
				}
			case "table":
				printLinkedAccountTable(resp.GetItems())
			default:
				var items []interface{}
				for _, la := range resp.GetItems() {
					items = append(items, linkedAccountToMap(la))
				}
				printList(items, resp.GetNextPageToken(), resp.GetHasMore(), resp.GetTotalCount())
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&collection, "collection", "", "Filter by collection ID")
	cmd.Flags().StringVar(&platform, "platform", "", "Filter by platform: github, linear, jira, asana, beads")
	return cmd
}

// resolveLinkToken resolves the external platform auth token from:
// 1. The --token flag value
// 2. FARMTABLE_LINK_TOKEN environment variable
// 3. stdin (if data is available, for piping from secret managers)
func resolveLinkToken(flagVal string) string {
	if flagVal != "" {
		return flagVal
	}
	if v := os.Getenv("FARMTABLE_LINK_TOKEN"); v != "" {
		return v
	}
	// Try reading from stdin if it's not a terminal (i.e., data is piped in).
	if !isTerminal(os.Stdin) {
		scanner := bufio.NewScanner(os.Stdin)
		if scanner.Scan() {
			tok := strings.TrimSpace(scanner.Text())
			if tok != "" {
				return tok
			}
		}
	}
	return ""
}

// isTerminal returns true if the file is a terminal/tty.
func isTerminal(f *os.File) bool {
	fi, err := f.Stat()
	if err != nil {
		return false
	}
	return fi.Mode()&os.ModeCharDevice != 0
}

// inferAuthMethod returns the default auth method for a given platform.
func inferAuthMethod(platform pb.Platform) pb.AuthMethod {
	switch platform {
	case pb.Platform_PLATFORM_GITHUB:
		return pb.AuthMethod_AUTH_METHOD_PAT
	case pb.Platform_PLATFORM_LINEAR:
		return pb.AuthMethod_AUTH_METHOD_API_KEY
	case pb.Platform_PLATFORM_JIRA:
		return pb.AuthMethod_AUTH_METHOD_API_KEY
	case pb.Platform_PLATFORM_ASANA:
		return pb.AuthMethod_AUTH_METHOD_PAT
	default:
		return pb.AuthMethod_AUTH_METHOD_PAT
	}
}

// inferScopes returns reasonable default scopes for a given platform.
func inferScopes(platform pb.Platform) []string {
	switch platform {
	case pb.Platform_PLATFORM_GITHUB:
		return []string{"repo", "read:org"}
	default:
		return nil
	}
}

// linkedAccountToMap converts a LinkedAccount proto to a map for JSON output.
func linkedAccountToMap(la *pb.LinkedAccount) map[string]interface{} {
	m := map[string]interface{}{
		"id":             la.GetId(),
		"collection_id":  la.GetCollectionId(),
		"platform":       platformNames[la.GetPlatform()],
		"auth_method":    authMethodNames[la.GetAuthMethod()],
		"scopes":         la.GetScopes(),
		"remote_user_id": nilIfEmpty(la.GetRemoteUserId()),
		"status":         linkedAccountStatusNames[la.GetStatus()],
		"created_at":     formatTimestamp(la.GetCreatedAt()),
		"updated_at":     formatTimestamp(la.GetUpdatedAt()),
		"expires_at":     formatTimestamp(la.GetExpiresAt()),
	}
	return m
}

// printLinkedAccountTable prints linked accounts in a tabular format.
func printLinkedAccountTable(accounts []*pb.LinkedAccount) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tCOLLECTION\tPLATFORM\tMETHOD\tSTATUS\tREMOTE_USER")
	for _, la := range accounts {
		id := la.GetId()
		if len(id) > 8 {
			id = id[:8]
		}
		collID := la.GetCollectionId()
		if len(collID) > 8 {
			collID = collID[:8]
		}
		remoteUser := la.GetRemoteUserId()
		if remoteUser == "" {
			remoteUser = "-"
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\n",
			id,
			collID,
			platformNames[la.GetPlatform()],
			authMethodNames[la.GetAuthMethod()],
			linkedAccountStatusNames[la.GetStatus()],
			truncate(remoteUser, 30),
		)
	}
	w.Flush()
}
