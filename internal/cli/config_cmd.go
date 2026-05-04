package cli

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

func newConfigCmd(globals *globalFlags) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "Manage CLI configuration",
	}
	cmd.AddCommand(
		newConfigShowCmd(globals),
		newConfigSetCmd(),
		newConfigPathCmd(),
	)
	return cmd
}

func newConfigShowCmd(globals *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "show",
		Short: "Print resolved configuration",
		RunE: func(cmd *cobra.Command, args []string) error {
			output := resolveOutput(globals.output)
			cfg := LoadConfig()

			tokenDisplay := ""
			token := resolveToken(globals.token)
			if token != "" {
				if len(token) > 8 {
					tokenDisplay = token[:4] + "..." + token[len(token)-4:]
				} else {
					tokenDisplay = "****"
				}
			}

			m := map[string]interface{}{
				"server":             resolveServer(globals.server),
				"token":              tokenDisplay,
				"default_collection": nilIfEmpty(resolveCollection(globals.collection)),
				"output":             resolveOutput(globals.output),
				"config_file":        defaultConfigPath(),
			}

			switch output {
			case "quiet":
				fmt.Printf("server=%s\n", resolveServer(globals.server))
				fmt.Printf("default_collection=%s\n", cfg.DefaultCollection)
				fmt.Printf("output=%s\n", resolveOutput(globals.output))
			default:
				printJSON(m)
			}
			return nil
		},
	}
}

func newConfigSetCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "set <key> <value>",
		Short: "Set a configuration value",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			key := args[0]
			value := args[1]

			validKeys := map[string]bool{
				"server":             true,
				"token":              true,
				"default_collection": true,
				"output":             true,
			}
			if !validKeys[key] {
				return exitError(ExitValidation, "VALIDATION_ERROR",
					fmt.Sprintf("invalid config key %q; valid keys: %s", key, strings.Join(configKeys(), ", ")))
			}

			if err := SaveConfigValue(key, value); err != nil {
				return exitError(ExitGeneral, "INTERNAL_ERROR", fmt.Sprintf("saving config: %v", err))
			}

			fmt.Fprintf(os.Stderr, "Set %s = %q\n", key, value)
			return nil
		},
	}
}

func newConfigPathCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "path",
		Short: "Print config file path",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println(defaultConfigPath())
			return nil
		},
	}
}

func configKeys() []string {
	return []string{"server", "token", "default_collection", "output"}
}
