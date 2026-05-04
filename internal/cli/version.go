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

			serverAddr := resolveServer(globals.server)
			token := resolveToken(globals.token)
			if serverAddr != "" {
				m["server"] = serverAddr
			} else {
				m["server"] = "embedded"
			}

			client, closer, err := newClient(globals)
			if err == nil {
				defer closer.Close()
				ctx := authCtx(context.Background(), token)
				resp, err := client.GetVersion(ctx, &pb.GetVersionRequest{})
				if err == nil {
					m["server_version"] = resp.GetServerVersion()
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
