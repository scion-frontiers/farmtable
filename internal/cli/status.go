package cli

import (
	"context"
	"fmt"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/spf13/cobra"
)

func newStatusCmd(globals *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Check server and platform connection health",
		RunE: func(cmd *cobra.Command, args []string) error {
			server := resolveServer(globals.server)
			token := resolveToken(globals.token)
			requireToken(token)
			output := resolveOutput(globals.output)

			client, conn, err := newClient(server, token)
			if err != nil {
				exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect to %s: %v", server, err))
			}
			defer conn.Close()

			ctx := authCtx(context.Background(), token)
			start := time.Now()
			resp, err := client.GetStatus(ctx, &pb.GetStatusRequest{})
			latency := time.Since(start).Milliseconds()
			if err != nil {
				handleGRPCError(err)
			}

			m := map[string]interface{}{
				"server":         server,
				"server_version": resp.GetServerVersion(),
				"api_protocol":   "grpc",
				"status":         resp.GetStatus(),
				"latency_ms":     latency,
			}
			if resp.GetAuthenticatedAs() != nil {
				m["authenticated_as"] = userToMap(resp.GetAuthenticatedAs())
			}
			var platforms []interface{}
			for _, p := range resp.GetPlatforms() {
				platforms = append(platforms, map[string]interface{}{
					"platform":    platformNames[p.GetPlatform()],
					"status":      p.GetStatus(),
					"collections": p.GetCollections(),
				})
			}
			m["platforms"] = platforms

			switch output {
			case "quiet":
				fmt.Println(resp.GetStatus())
			default:
				printJSON(m)
			}
			return nil
		},
	}
}
