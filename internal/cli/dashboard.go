package cli

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/streaming"
	grpcweb "github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"

	farmtable "github.com/farmtable-io/farmtable"
	"github.com/farmtable-io/farmtable/internal/store"
)

func newDashboardCmd(globals *globalFlags) *cobra.Command {
	var port int
	var openBrowser bool

	cmd := &cobra.Command{
		Use:   "dashboard",
		Short: "Launch the web dashboard",
		Long:  "Start an embedded server and serve the Farm Table web UI.",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runDashboard(globals, port, openBrowser)
		},
	}

	cmd.Flags().IntVar(&port, "port", 8080, "HTTP port to listen on")
	cmd.Flags().BoolVar(&openBrowser, "open", false, "Open browser automatically")

	return cmd
}

func runDashboard(_ *globalFlags, port int, openBrowser bool) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	dbPath := resolveDBPath()
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return fmt.Errorf("creating data directory: %w", err)
	}

	s, err := store.NewEntStore(ctx, store.StoreOptions{
		Dialect: "sqlite3",
		DSN:     fmt.Sprintf("file:%s?_fk=1", dbPath),
		Migrate: true,
	})
	if err != nil {
		return fmt.Errorf("opening database: %w", err)
	}
	defer s.Close()

	if err := ensureLocalUser(ctx, s); err != nil {
		return fmt.Errorf("ensuring local user: %w", err)
	}

	eventBus := streaming.NewEventBus()

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(server.TokenAuthInterceptor(server.NewStoreTokenLookup(s))),
		grpc.StreamInterceptor(server.TokenAuthStreamInterceptor(server.NewStoreTokenLookup(s))),
	)
	pb.RegisterFarmTableServiceServer(grpcServer, server.NewFarmTableService(s, "dashboard", server.WithEventBus(eventBus)))

	wrappedGrpc := grpcweb.WrapServer(grpcServer,
		grpcweb.WithOriginFunc(func(origin string) bool { return true }),
		grpcweb.WithWebsockets(true),
		grpcweb.WithWebsocketOriginFunc(func(req *http.Request) bool { return true }),
	)

	subFS, err := fs.Sub(farmtable.WebAssets, "web/dist")
	if err != nil {
		return fmt.Errorf("creating sub-filesystem: %w", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/farmtable.v1/", func(w http.ResponseWriter, r *http.Request) {
		wrappedGrpc.ServeHTTP(w, r)
	})
	mux.Handle("/", http.FileServer(http.FS(subFS)))

	addr := fmt.Sprintf(":%d", port)
	httpServer := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("Shutting down...")
		grpcServer.GracefulStop()
		httpServer.Shutdown(context.Background())
		cancel()
	}()

	url := fmt.Sprintf("http://localhost:%d", port)
	fmt.Printf("Farm Table dashboard: %s\n", url)

	if openBrowser {
		openURL(url)
	}

	if err := httpServer.ListenAndServe(); err != http.ErrServerClosed {
		return fmt.Errorf("HTTP server error: %w", err)
	}
	return nil
}

func openURL(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	cmd.Start()
}
