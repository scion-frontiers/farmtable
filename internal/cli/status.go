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
			token := resolveToken(globals.token)
			output := resolveOutput(globals.output)

			client, closer, err := newClient(globals)
			if err != nil {
				return exitError(ExitServerUnavail, "SERVER_UNAVAILABLE", fmt.Sprintf("failed to connect: %v", err))
			}
			defer closer.Close()

			ctx := authCtx(context.Background(), token)
			start := time.Now()
			resp, err := client.GetStatus(ctx, &pb.GetStatusRequest{})
			latency := time.Since(start).Milliseconds()
			if err != nil {
				return handleGRPCError(err)
			}

			serverAddr := resolveServer(globals.server)
			if serverAddr == "" {
				serverAddr = "embedded"
			}

			m := map[string]interface{}{
				"server":         serverAddr,
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
