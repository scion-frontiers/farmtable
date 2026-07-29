package cli

import (
	"context"
	"fmt"
	"os"
	"text/tabwriter"
	"time"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/google/uuid"
	"github.com/spf13/cobra"
)

func newTokenCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "token",
		Short: "API token management",
	}
	cmd.AddCommand(
		newTokenCreateCmd(globals),
		newTokenListCmd(globals),
		newTokenRevokeCmd(globals),
	)
	return cmd
}

func newTokenCreateCmd(globals *globalFlags) *cobra.Command {
	var name, expires string

	cmd := &cobra.Command{
		Use:   "create <user-id>",
		Short: "Create an API token for a user",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			output := resolveOutput(globals.output)

			userID, err := uuid.Parse(args[0])
			if err != nil {
				return exitError(ExitValidation, "INVALID_USER_ID", fmt.Sprintf("invalid user ID: %v", err))
			}

			s, cleanup, err := openDirectStore()
			if err != nil {
				return exitError(ExitServerUnavail, "STORE_ERROR", fmt.Sprintf("failed to open store: %v", err))
			}
			defer cleanup()

			p := store.CreateAPITokenParams{
				UserID: userID,
				Name:   name,
			}
			if name == "" {
				p.Name = "cli-generated"
			}
			if expires != "" {
				d, err := time.ParseDuration(expires)
				if err != nil {
					return exitError(ExitValidation, "INVALID_EXPIRES", fmt.Sprintf("invalid duration: %v", err))
				}
				t := time.Now().Add(d)
				p.ExpiresAt = &t
			}

			tok, rawToken, err := s.CreateAPIToken(context.Background(), p)
			if err != nil {
				return exitError(ExitGeneral, "CREATE_FAILED", fmt.Sprintf("creating token: %v", err))
			}

			switch output {
			case "quiet":
				fmt.Fprintln(os.Stdout, rawToken)
			default:
				m := map[string]interface{}{
					"id":      tok.ID.String(),
					"user_id": tok.UserID.String(),
					"name":    tok.Name,
					"token":   rawToken,
				}
				if tok.ExpiresAt != nil {
					m["expires_at"] = tok.ExpiresAt.UTC().Format(time.RFC3339)
				}
				printJSON(m)
				fmt.Fprintln(os.Stderr, "\nSave this token — it will not be shown again.")
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Descriptive label for the token")
	cmd.Flags().StringVar(&expires, "expires", "", "Token expiry duration (e.g. 720h)")
	return cmd
}

func newTokenListCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List API tokens (never shows token values)",
		RunE: func(cmd *cobra.Command, args []string) error {
			output := resolveOutput(globals.output)

			s, cleanup, err := openDirectStore()
			if err != nil {
				return exitError(ExitServerUnavail, "STORE_ERROR", fmt.Sprintf("failed to open store: %v", err))
			}
			defer cleanup()

			tokens, total, err := s.ListAPITokens(context.Background(), store.ListAPITokensParams{
				Limit: 200,
			})
			if err != nil {
				return exitError(ExitGeneral, "LIST_FAILED", fmt.Sprintf("listing tokens: %v", err))
			}

			switch output {
			case "quiet":
				for _, t := range tokens {
					fmt.Fprintln(os.Stdout, t.ID.String())
				}
			case "table":
				w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
				fmt.Fprintln(w, "ID\tNAME\tUSER\tCREATED\tLAST_USED\tEXPIRES")
				for _, t := range tokens {
					id := t.ID.String()
					if len(id) > 8 {
						id = id[:8]
					}
					userName := t.UserID.String()[:8]
					if t.Edges.User != nil {
						userName = t.Edges.User.DisplayName
					}
					lastUsed := "never"
					if t.LastUsedAt != nil {
						lastUsed = t.LastUsedAt.UTC().Format("2006-01-02")
					}
					expires := "—"
					if t.ExpiresAt != nil {
						expires = t.ExpiresAt.UTC().Format("2006-01-02")
					}
					fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\n",
						id,
						truncate(t.Name, 20),
						truncate(userName, 15),
						t.CreatedAt.UTC().Format("2006-01-02"),
						lastUsed,
						expires,
					)
				}
				w.Flush()
			default:
				var items []interface{}
				for _, t := range tokens {
					m := map[string]interface{}{
						"id":         t.ID.String(),
						"name":       t.Name,
						"user_id":    t.UserID.String(),
						"created_at": t.CreatedAt.UTC().Format(time.RFC3339),
					}
					if t.Edges.User != nil {
						m["user_name"] = t.Edges.User.DisplayName
					}
					if t.LastUsedAt != nil {
						m["last_used_at"] = t.LastUsedAt.UTC().Format(time.RFC3339)
					}
					if t.ExpiresAt != nil {
						m["expires_at"] = t.ExpiresAt.UTC().Format(time.RFC3339)
					}
					items = append(items, m)
				}
				printList(items, "", false, int32(total))
			}
			return nil
		},
	}
	return cmd
}

func newTokenRevokeCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "revoke <token-id>",
		Short: "Revoke an API token",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			tokenID, err := uuid.Parse(args[0])
			if err != nil {
				return exitError(ExitValidation, "INVALID_TOKEN_ID", fmt.Sprintf("invalid token ID: %v", err))
			}

			s, cleanup, err := openDirectStore()
			if err != nil {
				return exitError(ExitServerUnavail, "STORE_ERROR", fmt.Sprintf("failed to open store: %v", err))
			}
			defer cleanup()

			if err := s.RevokeAPIToken(context.Background(), tokenID); err != nil {
				return exitError(ExitGeneral, "REVOKE_FAILED", fmt.Sprintf("revoking token: %v", err))
			}

			fmt.Fprintln(os.Stdout, "Token revoked.")
			return nil
		},
	}
	return cmd
}
