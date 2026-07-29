package cli

import (
	"context"
	"fmt"
	"os"
	"text/tabwriter"
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
				"server_mode":    resp.GetServerMode(),
				"api_protocol":   "grpc",
				"status":         resp.GetStatus(),
				"latency_ms":     latency,
				"uptime_seconds": resp.GetUptimeSeconds(),
				"task_count":     resp.GetTaskCount(),
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
			case "jsonl":
				printJSONLine(m)
			case "table":
				w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
				fmt.Fprintf(w, "SERVER\t%s\n", serverAddr)
				fmt.Fprintf(w, "VERSION\t%s\n", resp.GetServerVersion())
				fmt.Fprintf(w, "MODE\t%s\n", resp.GetServerMode())
				fmt.Fprintf(w, "STATUS\t%s\n", resp.GetStatus())
				fmt.Fprintf(w, "LATENCY\t%dms\n", latency)
				fmt.Fprintf(w, "UPTIME\t%ds\n", resp.GetUptimeSeconds())
				fmt.Fprintf(w, "TASKS\t%d\n", resp.GetTaskCount())
				if resp.GetAuthenticatedAs() != nil {
					name := resp.GetAuthenticatedAs().GetName()
					if name == "" {
						name = resp.GetAuthenticatedAs().GetId()
					}
					fmt.Fprintf(w, "USER\t%s\n", name)
				}
				w.Flush()
			default:
				printJSON(m)
			}
			return nil
		},
	}
}
