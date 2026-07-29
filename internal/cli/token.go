package cli

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/google/uuid"
	"github.com/spf13/cobra"
)

// Sentinel errors for scope-merge guard rails. Scripts driving bulk token
// migrations can branch on the error code to auto-retry legacy tokens with
// --set-scopes while hard-failing on genuine errors.
var (
	errUnscopedToken = errors.New("unscoped token")
	errWildcardToken = errors.New("wildcard token")
	errEmptyScopes   = errors.New("empty scope set")
)

// mergeScopes computes a new scope set from the token's current scopes and
// the operator's add/remove/set instructions. It rejects operations that
// would silently escalate or demote a token:
//   - Removing all scopes would leave nil/empty, which is interpreted as
//     wildcard (full access) — refuse rather than silently escalate.
//   - Adding/removing on a nil/empty-scope (legacy wildcard) token would
//     silently restrict it — require --set-scopes for an explicit intent.
//   - Removing from a ["*"]-scoped token is a no-op that reports success
//     but changes nothing — refuse rather than silently lie.
func mergeScopes(current, add, remove, set []string) ([]string, error) {
	if len(set) > 0 {
		result := make([]string, len(set))
		copy(result, set)
		sort.Strings(result)
		return result, nil
	}

	// Detect legacy wildcard tokens (nil/empty scope list = full access).
	if len(current) == 0 {
		return nil, fmt.Errorf(
			"%w: token has no stored scopes (legacy wildcard); --add-scope/--remove-scope "+
				"would silently restrict it. Use --set-scopes to state the full intended scope set",
			errUnscopedToken)
	}

	// Detect explicit wildcard ["*"] — removing individual scopes is a no-op.
	if len(remove) > 0 {
		for _, s := range current {
			if s == server.ScopeWildcard {
				return nil, fmt.Errorf(
					"%w: token holds the wildcard scope \"*\"; removing individual scopes has no effect. "+
						"Use --set-scopes to replace the wildcard with an explicit scope list",
					errWildcardToken)
			}
		}
	}

	// Build new scope set from current + add - remove.
	scopeSet := make(map[string]bool, len(current))
	for _, s := range current {
		scopeSet[s] = true
	}
	for _, s := range add {
		scopeSet[s] = true
	}
	for _, s := range remove {
		delete(scopeSet, s)
	}

	// Refuse to write an empty scope set — it would be interpreted as wildcard.
	if len(scopeSet) == 0 {
		return nil, fmt.Errorf(
			"%w: an empty scope list is interpreted as wildcard (full access). "+
				"Use --set-scopes to state the full intended scope set, or "+
				"ft token revoke to disable the token",
			errEmptyScopes)
	}

	result := make([]string, 0, len(scopeSet))
	for s := range scopeSet {
		result = append(result, s)
	}
	sort.Strings(result)
	return result, nil
}

func newTokenCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "token",
		Short: "API token management",
	}
	cmd.AddCommand(
		newTokenCreateCmd(globals),
		newTokenListCmd(globals),
		newTokenUpdateCmd(globals),
		newTokenRevokeCmd(globals),
	)
	return cmd
}

func newTokenCreateCmd(globals *globalFlags) *cobra.Command {
	var name, expires string
	var scopes, collectionIDs []string

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

			// Handle scopes: explicit --scope flags override defaults.
			if len(scopes) > 0 {
				if err := server.ValidateScopes(scopes); err != nil {
					return exitError(ExitValidation, "INVALID_SCOPE", err.Error())
				}
				p.Scopes = scopes
			} else {
				// Apply user type-based default scopes.
				u, err := s.GetUser(context.Background(), userID)
				if err != nil {
					return exitError(ExitGeneral, "USER_LOOKUP_FAILED", fmt.Sprintf("looking up user for default scopes: %v", err))
				}
				// An unrecognised user type has no permission set, so there is
				// no token to issue. Refuse rather than mint a scope-less token
				// that would be denied at every call.
				defaults, err := server.DefaultScopesForUserType(u.Type)
				if err != nil {
					return exitError(ExitValidation, "UNKNOWN_USER_TYPE", fmt.Sprintf(
						"user %s: %v. Fix the user's type, or pass explicit --scope flags",
						userID, err))
				}
				p.Scopes = defaults
			}

			// Handle collection restrictions.
			if len(collectionIDs) > 0 {
				for _, cidStr := range collectionIDs {
					cid, err := uuid.Parse(cidStr)
					if err != nil {
						return exitError(ExitValidation, "INVALID_COLLECTION_ID", fmt.Sprintf("invalid collection ID %q: %v", cidStr, err))
					}
					p.CollectionIDs = append(p.CollectionIDs, cid)
				}
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
				if len(tok.Scopes) > 0 {
					m["scopes"] = tok.Scopes
				}
				if len(tok.CollectionIds) > 0 {
					ids := make([]string, len(tok.CollectionIds))
					for i, id := range tok.CollectionIds {
						ids[i] = id.String()
					}
					m["collection_ids"] = ids
				}
				printJSON(m)
				fmt.Fprintln(os.Stderr, "\nSave this token — it will not be shown again.")
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Descriptive label for the token")
	cmd.Flags().StringVar(&expires, "expires", "", "Token expiry duration (e.g. 720h)")
	cmd.Flags().StringSliceVar(&scopes, "scope", nil, "Token scope (repeatable, e.g. --scope task:read --scope task:write). Valid scopes: "+strings.Join(server.AllScopes, ", ")+", *")
	cmd.Flags().StringSliceVar(&collectionIDs, "collection", nil, "Restrict token to collection UUID (repeatable)")
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
					if len(t.Scopes) > 0 {
						m["scopes"] = t.Scopes
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

func newTokenUpdateCmd(globals *globalFlags) *cobra.Command {
	var addScopes, removeScopes, setScopes []string

	cmd := &cobra.Command{
		Use:   "update <token-id>",
		Short: "Update scopes on an existing API token",
		Long: `Modify the scope set on an existing API token.

Use --add-scope to grant additional scopes, --remove-scope to revoke specific
scopes, or --set-scopes to replace the entire scope set.  --add-scope and
--remove-scope can be combined in a single call; --set-scopes is mutually
exclusive with both.

Guard rails:
  UNSCOPED_TOKEN  Token has no stored scopes (legacy wildcard). --add-scope and
                  --remove-scope would silently restrict a full-access token.
                  Use --set-scopes to state the full intended scope set.
  WILDCARD_TOKEN  Token holds the "*" scope. --remove-scope has no effect on
                  individual scopes. Use --set-scopes to replace the wildcard.
  EMPTY_SCOPES    The resulting scope set would be empty, which is interpreted
                  as wildcard (full access). Use --set-scopes or ft token revoke.

Examples:

  # Grant task:close to an existing agent token (rollout scenario)
  ft token update <id> --add-scope task:close

  # Remove task:write and add task:accept + task:close
  ft token update <id> --remove-scope task:write --add-scope task:accept --add-scope task:close

  # Replace the scope set entirely
  ft token update <id> --set-scopes task:read,task:write,task:claim

  # Legacy/wildcard tokens require --set-scopes (explicit intent)
  ft token update <id> --set-scopes task:read,task:write,task:claim,task:close`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			tokenID, err := uuid.Parse(args[0])
			if err != nil {
				return exitError(ExitValidation, "INVALID_TOKEN_ID", fmt.Sprintf("invalid token ID: %v", err))
			}

			if len(setScopes) > 0 && (len(addScopes) > 0 || len(removeScopes) > 0) {
				return exitError(ExitValidation, "CONFLICTING_FLAGS", "--set-scopes cannot be combined with --add-scope or --remove-scope")
			}
			if len(addScopes) == 0 && len(removeScopes) == 0 && len(setScopes) == 0 {
				return exitError(ExitValidation, "NO_CHANGES", "at least one of --add-scope, --remove-scope, or --set-scopes is required")
			}

			s, cleanup, err := openDirectStore()
			if err != nil {
				return exitError(ExitServerUnavail, "STORE_ERROR", fmt.Sprintf("failed to open store: %v", err))
			}
			defer cleanup()

			ctx := context.Background()

			// Get current token to read existing scopes.
			tok, err := s.GetAPIToken(ctx, tokenID)
			if err != nil {
				return exitError(ExitGeneral, "TOKEN_NOT_FOUND", fmt.Sprintf("looking up token: %v", err))
			}

			newScopes, err := mergeScopes(tok.Scopes, addScopes, removeScopes, setScopes)
			if err != nil {
				code := "SCOPE_MERGE_ERROR"
				switch {
				case errors.Is(err, errUnscopedToken):
					code = "UNSCOPED_TOKEN"
				case errors.Is(err, errWildcardToken):
					code = "WILDCARD_TOKEN"
				case errors.Is(err, errEmptyScopes):
					code = "EMPTY_SCOPES"
				}
				return exitError(ExitValidation, code, err.Error())
			}

			// Validate all scopes before writing.
			if err := server.ValidateScopes(newScopes); err != nil {
				return exitError(ExitValidation, "INVALID_SCOPE", err.Error())
			}

			updated, err := s.UpdateAPITokenScopes(ctx, tokenID, newScopes)
			if err != nil {
				return exitError(ExitGeneral, "UPDATE_FAILED", fmt.Sprintf("updating token scopes: %v", err))
			}

			output := resolveOutput(globals.output)
			switch output {
			case "quiet":
				printQuiet(updated.ID.String())
			default:
				m := map[string]interface{}{
					"id":         updated.ID.String(),
					"name":       updated.Name,
					"old_scopes": tok.Scopes,
					"new_scopes": updated.Scopes,
				}
				printJSON(m)
				fmt.Fprintf(os.Stderr, "\nToken %s scopes updated.\n", updated.ID.String()[:8])
			}
			return nil
		},
	}
	cmd.Flags().StringSliceVar(&addScopes, "add-scope", nil, "Scope to add (repeatable)")
	cmd.Flags().StringSliceVar(&removeScopes, "remove-scope", nil, "Scope to remove (repeatable)")
	cmd.Flags().StringSliceVar(&setScopes, "set-scopes", nil, "Replace all scopes (comma-separated)")
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
