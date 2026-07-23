package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
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
		iapAudience string
		provider    string
		model       string
		apiKey      string
		project     string
		location    string
		promptFile  string
		maxDepth    int
		concurrency int
		verbose     bool
		resume      bool
		rootTask    string
	)

	cmd := &cobra.Command{
		Use:   "decomposer [flags] <input-file-or-\"-\">",
		Short: "Decompose a design document into a Farmtable task DAG using LLM inference",
		Long: `Decomposer takes a design document or high-level outcome statement and
recursively decomposes it into a structured Farmtable task DAG using LLM inference.

Tasks are organized into parallel groups where tasks in the same group can run
concurrently, and higher-numbered groups depend on lower groups completing first.

Use --resume with --root-task to resume an incomplete decomposition, walking
the existing tree and decomposing only unfinished branches.`,
		Args:          cobra.MaximumNArgs(1),
		SilenceUsage:  true,
		SilenceErrors: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			if resume {
				return runResume(collection, server, token, iapAudience, provider, model, apiKey,
					project, location, promptFile, rootTask, maxDepth, concurrency, verbose)
			}
			if len(args) == 0 {
				return fmt.Errorf("requires an input file argument (or \"-\" for stdin)")
			}
			return run(args[0], collection, server, token, iapAudience, provider, model, apiKey,
				project, location, promptFile, maxDepth, concurrency, verbose)
		},
	}

	// Required flags.
	cmd.Flags().StringVar(&collection, "collection", "", "Collection ID or name (required, auto-creates if name not found)")
	cmd.MarkFlagRequired("collection")

	// Farmtable connection.
	cmd.Flags().StringVar(&server, "server", "", "Farmtable server address (or FARMTABLE_SERVER env)")
	cmd.Flags().StringVar(&token, "token", "", "Auth token (or FARMTABLE_TOKEN env)")
	cmd.Flags().StringVar(&iapAudience, "iap-audience", "", "IAP OAuth client ID; auto-mints OIDC identity token via gcloud (or IAP_AUDIENCE env)")

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

	// Resume mode.
	cmd.Flags().BoolVar(&resume, "resume", false, "Resume an incomplete decomposition (requires --root-task)")
	cmd.Flags().StringVar(&rootTask, "root-task", "", "Task ID to resume from (required with --resume)")

	return cmd
}

func run(inputArg, collection, server, token, iapAudience, provider, model, apiKey,
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

	// Handle IAP authentication if audience is specified.
	if iapAudience == "" {
		iapAudience = os.Getenv("IAP_AUDIENCE")
	}
	if iapAudience != "" {
		iapToken, err := mintIAPToken(iapAudience)
		if err != nil {
			return fmt.Errorf("minting IAP identity token: %w", err)
		}
		writer.SetIAPToken(iapToken)
		fmt.Fprintf(os.Stderr, "IAP authentication enabled (audience=%s)\n", iapAudience)
	}

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

func runResume(collection, server, token, iapAudience, provider, model, apiKey,
	project, location, promptFile, rootTask string, maxDepth, concurrency int, verbose bool) error {

	if rootTask == "" {
		return fmt.Errorf("--root-task is required when using --resume")
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

	// Handle IAP authentication if audience is specified.
	if iapAudience == "" {
		iapAudience = os.Getenv("IAP_AUDIENCE")
	}
	if iapAudience != "" {
		iapToken, err := mintIAPToken(iapAudience)
		if err != nil {
			return fmt.Errorf("minting IAP identity token: %w", err)
		}
		writer.SetIAPToken(iapToken)
		fmt.Fprintf(os.Stderr, "IAP authentication enabled (audience=%s)\n", iapAudience)
	}

	// Resolve collection (must exist, don't auto-create in resume mode).
	collectionID, err := writer.ResolveCollection(context.Background(), collection)
	if err != nil {
		return fmt.Errorf("collection not found (resume mode does not auto-create): %w", err)
	}
	fmt.Fprintf(os.Stderr, "Using existing collection: %s (id: %s)\n", collection, collectionID)
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

	// Run resume.
	fmt.Fprintf(os.Stderr, "Resuming decomposition from task %s in collection %s...\n", rootTask, collectionID)
	if err := engine.Resume(ctx, collectionID, rootTask); err != nil {
		printResumeSummary(collectionID, rootTask, engine, server)
		return fmt.Errorf("resume failed: %w", err)
	}

	printResumeSummary(collectionID, rootTask, engine, server)
	return nil
}

func printResumeSummary(collectionID, rootTaskID string, engine *decomposer.Engine, server string) {
	existing, skipped, newTasks, maxDepth := engine.ResumeStats()
	_, terminal, _ := engine.Stats()
	fmt.Printf("\n--- Resume Summary ---\n")
	fmt.Printf("Collection:       %s\n", collectionID)
	fmt.Printf("Root task:        %s\n", rootTaskID)
	fmt.Printf("Existing tasks:   %d\n", existing)
	fmt.Printf("Skipped terminal: %d\n", skipped)
	fmt.Printf("New tasks:        %d\n", newTasks)
	fmt.Printf("Total terminal:   %d\n", terminal)
	fmt.Printf("Max depth:        %d\n", maxDepth)
	dashServer := server
	if dashServer == "" {
		dashServer = os.Getenv("FARMTABLE_SERVER")
	}
	if dashServer != "" {
		host := dashServer
		if h, _, err := net.SplitHostPort(dashServer); err == nil {
			host = h
		}
		if host != "" {
			fmt.Printf("Dashboard:        https://%s/?collection=%s\n", host, collectionID)
		}
	}
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

func mintIAPToken(audience string) (string, error) {
	// Use gcloud to mint an identity token for the IAP audience.
	// Works with user credentials (gcloud auth login) and
	// service account credentials (ADC / attached SA).
	cmd := exec.Command("gcloud", "auth", "print-identity-token",
		"--audiences="+audience)
	out, err := cmd.Output()
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			return "", fmt.Errorf("gcloud failed: %s", string(exitErr.Stderr))
		}
		return "", err
	}
	token := strings.TrimSpace(string(out))
	if token == "" {
		return "", fmt.Errorf("gcloud returned empty identity token")
	}
	return token, nil
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
