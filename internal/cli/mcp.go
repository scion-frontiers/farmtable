package cli

import (
	"fmt"
	"io"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	ftmcp "github.com/farmtable-io/farmtable/internal/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/spf13/cobra"
)

func newMCPCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "mcp",
		Short: "MCP (Model Context Protocol) server",
	}
	cmd.AddCommand(newMCPServeCmd(globals))
	return cmd
}

func newMCPServeCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Start MCP server on stdio",
		Long:  "Start a Model Context Protocol server that exposes Farm Table operations as tools. Communicates via JSON-RPC 2.0 over stdin/stdout.",
		RunE: func(cmd *cobra.Command, args []string) error {
			factory := func() (pb.FarmTableServiceClient, io.Closer, string, error) {
				client, closer, err := newClient(globals)
				if err != nil {
					return nil, nil, "", err
				}
				token := resolveToken(globals.token)
				return client, closer, token, nil
			}

			s, err := ftmcp.NewServer(factory)
			if err != nil {
				return fmt.Errorf("starting MCP server: %w", err)
			}
			defer s.Close()

			return server.ServeStdio(s.MCPServer())
		},
	}
	return cmd
}
