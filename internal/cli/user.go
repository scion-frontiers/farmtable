package cli

import (
	"context"
	"fmt"
	"os"
	"text/tabwriter"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/spf13/cobra"
)

func newUserCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "user",
		Short: "User management",
	}
	cmd.AddCommand(
		newUserCreateCmd(globals),
		newUserListCmd(globals),
		newUserWhoAmICmd(globals),
	)
	return cmd
}

func newUserCreateCmd(globals *globalFlags) *cobra.Command {
	var email, userType string

	cmd := &cobra.Command{
		Use:   "create <name>",
		Short: "Create a user",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			output := resolveOutput(globals.output)

			s, cleanup, err := openDirectStore()
			if err != nil {
				return exitError(ExitServerUnavail, "STORE_ERROR", fmt.Sprintf("failed to open store: %v", err))
			}
			defer cleanup()

			p := store.CreateUserParams{
				DisplayName: args[0],
				Type:        userType,
				Status:      "active",
			}
			if email != "" {
				p.Email = &email
			}

			u, err := s.CreateUser(context.Background(), p)
			if err != nil {
				return exitError(ExitGeneral, "CREATE_FAILED", fmt.Sprintf("creating user: %v", err))
			}

			switch output {
			case "quiet":
				printQuiet(u.ID.String())
			default:
				m := map[string]interface{}{
					"id":     u.ID.String(),
					"name":   u.DisplayName,
					"type":   u.Type,
					"status": u.Status,
				}
				if u.Email != nil {
					m["email"] = *u.Email
				}
				printJSON(m)
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&email, "email", "", "Email address")
	cmd.Flags().StringVar(&userType, "type", "agent", "User type: human, agent, service_account")
	return cmd
}

func newUserListCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List users",
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			resp, err := client.ListUsers(ctx, &pb.ListUsersRequest{})
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				for _, u := range resp.GetItems() {
					fmt.Fprintln(os.Stdout, u.GetId())
				}
			case "table":
				printUserTable(resp.GetItems())
			default:
				var items []interface{}
				for _, u := range resp.GetItems() {
					items = append(items, userFullToMap(u))
				}
				printList(items, resp.GetNextPageToken(), resp.GetHasMore(), resp.GetTotalCount())
			}
			return nil
		},
	}
	return cmd
}

func newUserWhoAmICmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "whoami",
		Short: "Show the currently authenticated user",
		RunE: func(cmd *cobra.Command, args []string) error {
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			u, err := client.WhoAmI(ctx, &pb.WhoAmIRequest{})
			if err != nil {
				return handleGRPCError(err)
			}

			switch output {
			case "quiet":
				printQuiet(u.GetId())
			default:
				printJSON(userFullToMap(u))
			}
			return nil
		},
	}
	return cmd
}

func printUserTable(users []*pb.User) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tNAME\tTYPE\tSTATUS\tEMAIL")
	for _, u := range users {
		id := u.GetId()
		if len(id) > 8 {
			id = id[:8]
		}
		email := "—"
		if u.GetEmail() != "" {
			email = u.GetEmail()
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n",
			id,
			truncate(u.GetName(), 25),
			userTypeNames[u.GetType()],
			identityStatusName(u.GetStatus()),
			email,
		)
	}
	w.Flush()
}
