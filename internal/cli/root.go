package cli

import (
	"errors"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

type globalFlags struct {
	output     string
	collection string
	server     string
	token      string
	verbose    bool
}

func Execute(version string) {
	globals := &globalFlags{}

	root := &cobra.Command{
		Use:           "ft",
		Short:         "Farm Table CLI — agent-first task management",
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	root.PersistentFlags().StringVarP(&globals.output, "output", "o", "", "Output format: json, table, quiet, jsonl")
	root.PersistentFlags().StringVarP(&globals.collection, "collection", "c", "", "Scope to a collection (UUID or name)")
	root.PersistentFlags().StringVar(&globals.server, "server", "", "Server address (host:port)")
	root.PersistentFlags().StringVar(&globals.token, "token", "", "API token override")
	root.PersistentFlags().BoolVarP(&globals.verbose, "verbose", "v", false, "Verbose output")

	root.AddCommand(
		newTaskCmd(globals),
		newCollectionCmd(globals),
		newCommentCmd(globals),
		newConfigCmd(globals),
		newVersionCmd(globals, version),
		newStatusCmd(globals),
	)

	if err := root.Execute(); err != nil {
		var exitErr *ExitError
		if errors.As(err, &exitErr) {
			os.Exit(exitErr.Code)
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
