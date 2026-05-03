package cli

import (
	"context"
	"fmt"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/spf13/cobra"
)

func newVersionCmd(globals *globalFlags, cliVersion string) *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print version information",
		RunE: func(cmd *cobra.Command, args []string) error {
			output := resolveOutput(globals.output)

			m := map[string]interface{}{
				"cli_version":    cliVersion,
				"server_version": nil,
				"api_protocol":   "grpc",
				"server":         nil,
			}

			server := resolveServer(globals.server)
			token := resolveToken(globals.token)
			m["server"] = server

			if token != "" {
				client, conn, err := newClient(server, token)
				if err == nil {
					defer conn.Close()
					ctx := authCtx(context.Background(), token)
					resp, err := client.GetVersion(ctx, &pb.GetVersionRequest{})
					if err == nil {
						m["server_version"] = resp.GetServerVersion()
					}
				}
			}

			switch output {
			case "quiet":
				fmt.Println(cliVersion)
			default:
				printJSON(m)
			}
			return nil
		},
	}
}
