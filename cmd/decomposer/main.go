package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/farmtable-io/farmtable/internal/decomposer"
	"github.com/spf13/cobra"
)

func main() {
	if err := newRootCmd().Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func newRootCmd() *cobra.Command {
	var (
		collection  string
		server      string
		token       string
		provider    string
		model       string
		apiKey      string
		project     string
		location    string
		promptFile  string
		maxDepth    int
		concurrency int
		verbose     bool
	)

	cmd := &cobra.Command{
		Use:   "decomposer [flags] <input-file-or-\"-\">",
		Short: "Decompose a design document into a Farmtable task DAG using LLM inference",
		Long: `Decomposer takes a design document or high-level outcome statement and
recursively decomposes it into a structured Farmtable task DAG using LLM inference.

Tasks are organized into parallel groups where tasks in the same group can run
concurrently, and higher-numbered groups depend on lower groups completing first.`,
		Args:          cobra.ExactArgs(1),
		SilenceUsage:  true,
		SilenceErrors: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return run(args[0], collection, server, token, provider, model, apiKey,
				project, location, promptFile, maxDepth, concurrency, verbose)
		},
	}

	// Required flags.
	cmd.Flags().StringVar(&collection, "collection", "", "Collection ID or name (required, auto-creates if name not found)")
	cmd.MarkFlagRequired("collection")

	// Farmtable connection.
	cmd.Flags().StringVar(&server, "server", "", "Farmtable server address (or FARMTABLE_SERVER env)")
	cmd.Flags().StringVar(&token, "token", "", "Auth token (or FARMTABLE_TOKEN env)")

	// LLM.
	cmd.Flags().StringVar(&provider, "provider", "genai", `LLM provider: "genai" or "anthropic" (default: "genai")`)
	cmd.Flags().StringVar(&model, "model", "", "Model name (default: provider-specific)")
	cmd.Flags().StringVar(&apiKey, "api-key", "", "LLM API key (for anthropic provider: or ANTHROPIC_API_KEY env)")
	cmd.Flags().StringVar(&project, "project", "", "Google Cloud project (or GOOGLE_CLOUD_PROJECT env; for genai provider)")
	cmd.Flags().StringVar(&location, "location", "", "Google Cloud location (or GOOGLE_CLOUD_LOCATION env; default: us-central1)")
	cmd.Flags().StringVar(&promptFile, "prompt-file", "", "Path to custom system prompt file (overrides embedded default)")

	// Engine.
	cmd.Flags().IntVar(&maxDepth, "max-depth", 3, "Maximum recursion depth")
	cmd.Flags().IntVar(&concurrency, "concurrency", 4, "Max parallel LLM calls")
	cmd.Flags().BoolVar(&verbose, "verbose", false, "Log LLM prompts/responses to stderr")

	return cmd
}

func run(inputArg, collection, server, token, provider, model, apiKey,
	project, location, promptFile string, maxDepth, concurrency int, verbose bool) error {

	// Read input.
	inputText, err := readInput(inputArg)
	if err != nil {
		return fmt.Errorf("reading input: %w", err)
	}
	if strings.TrimSpace(inputText) == "" {
		return fmt.Errorf("input is empty")
	}

	// Load custom system prompt if specified.
	var systemPrompt string
	if promptFile != "" {
		data, err := os.ReadFile(promptFile)
		if err != nil {
			return fmt.Errorf("reading prompt file: %w", err)
		}
		systemPrompt = string(data)
	}

	// Create LLM client.
	llm, err := createLLM(provider, model, apiKey, project, location)
	if err != nil {
		return err
	}

	// Create Farmtable writer.
	writer, err := decomposer.NewGRPCWriter(server, token)
	if err != nil {
		return err
	}
	defer writer.Close()

	// Resolve or create collection.
	collectionID, err := resolveOrCreateCollection(context.Background(), writer, collection)
	if err != nil {
		return err
	}
	writer.SetCollectionID(collectionID)

	// Create engine.
	engine := decomposer.NewEngine(decomposer.EngineConfig{
		LLM:          llm,
		Writer:       writer,
		SystemPrompt: systemPrompt,
		MaxDepth:     maxDepth,
		Concurrency:  concurrency,
		Verbose:      verbose,
	})

	// Set up graceful shutdown via Ctrl-C.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigCh
		fmt.Fprintln(os.Stderr, "\nInterrupted — finishing in-flight LLM calls...")
		cancel()
	}()

	// Derive root task title from first line of input or truncated text.
	rootTitle := deriveTitle(inputText)

	// Run decomposition.
	fmt.Fprintf(os.Stderr, "Starting decomposition into collection %s...\n", collectionID)
	if err := engine.Run(ctx, collectionID, inputText, rootTitle); err != nil {
		// Print partial summary even on error.
		printSummary(collectionID, rootTitle, engine, server)
		return fmt.Errorf("decomposition failed: %w", err)
	}

	// Print summary.
	printSummary(collectionID, rootTitle, engine, server)
	return nil
}

func readInput(arg string) (string, error) {
	if arg == "-" {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			return "", err
		}
		return string(data), nil
	}
	data, err := os.ReadFile(arg)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func createLLM(provider, model, apiKey, project, location string) (decomposer.Inferencer, error) {
	switch provider {
	case "genai":
		// Resolve project from flag → env.
		if project == "" {
			project = os.Getenv("GOOGLE_CLOUD_PROJECT")
		}
		if project == "" {
			return nil, fmt.Errorf("genai provider requires --project or GOOGLE_CLOUD_PROJECT env var")
		}
		// Resolve location from flag → env.
		if location == "" {
			location = os.Getenv("GOOGLE_CLOUD_LOCATION")
		}
		fmt.Fprintf(os.Stderr, "Using GenAI provider (project=%s, location=%s)\n", project, location)
		return decomposer.NewGenAIClient(project, location, model), nil
	case "anthropic":
		return decomposer.NewAnthropicClient(apiKey, model), nil
	default:
		return nil, fmt.Errorf("unknown provider %q: must be \"genai\" or \"anthropic\"", provider)
	}
}

func resolveOrCreateCollection(ctx context.Context, writer *decomposer.GRPCWriter, collection string) (string, error) {
	// Try resolving first.
	id, err := writer.ResolveCollection(ctx, collection)
	if err == nil {
		fmt.Fprintf(os.Stderr, "Using existing collection: %s (id: %s)\n", collection, id)
		return id, nil
	}

	// Auto-create if not found.
	fmt.Fprintf(os.Stderr, "Collection %q not found, creating...\n", collection)
	id, err = writer.CreateCollection(ctx, collection)
	if err != nil {
		return "", fmt.Errorf("auto-creating collection: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Created collection: %s (id: %s)\n", collection, id)
	return id, nil
}

func deriveTitle(text string) string {
	// Use first line, stripped of markdown heading markers.
	lines := strings.SplitN(text, "\n", 2)
	title := strings.TrimSpace(lines[0])
	title = strings.TrimLeft(title, "# ")
	if len(title) > 100 {
		title = title[:97] + "..."
	}
	if title == "" {
		title = "Decomposition Root"
	}
	return title
}

func printSummary(collectionID, rootTitle string, engine *decomposer.Engine, server string) {
	total, terminal, maxDepth := engine.Stats()
	nonTerminal := total - terminal
	fmt.Printf("\n--- Decomposition Summary ---\n")
	fmt.Printf("Collection:     %s\n", collectionID)
	fmt.Printf("Root task:      %s\n", rootTitle)
	fmt.Printf("Tasks created:  %d (%d terminal, %d non-terminal)\n", total, terminal, nonTerminal)
	fmt.Printf("Max depth:      %d\n", maxDepth)
	dashServer := server
	if dashServer == "" {
		dashServer = os.Getenv("FARMTABLE_SERVER")
	}
	if dashServer != "" {
		// Strip port for URL (handles both IPv4 and IPv6 addresses).
		host := dashServer
		if h, _, err := net.SplitHostPort(dashServer); err == nil {
			host = h
		}
		if host != "" {
			fmt.Printf("Dashboard:      https://%s/?collection=%s\n", host, collectionID)
		}
	}
}
