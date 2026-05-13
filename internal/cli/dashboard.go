package cli

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/streaming"
	grpcweb "github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"

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

	// Bootstrap: serve on bufconn to ensure default collection exists
	bufLis := bufconn.Listen(1 << 20)
	go grpcServer.Serve(bufLis)

	bootstrapConn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return bufLis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return fmt.Errorf("dialing bootstrap server: %w", err)
	}
	token := resolveToken("")
	bootstrapClient := pb.NewFarmTableServiceClient(bootstrapConn)
	if err := ensureDefaultCollection(authCtx(ctx, token), bootstrapClient); err != nil {
		bootstrapConn.Close()
		return fmt.Errorf("ensuring default collection: %w", err)
	}
	bootstrapConn.Close()

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

	listenAddr := fmt.Sprintf(":%d", port)
	lis, err := net.Listen("tcp", listenAddr)
	if err != nil {
		if isAddrInUse(err) {
			return fmt.Errorf("port %d is already in use — try a different port with --port", port)
		}
		return fmt.Errorf("listen on port %d: %w", port, err)
	}

	boundPort := lis.Addr().(*net.TCPAddr).Port
	httpServer := &http.Server{
		Handler: mux,
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("Shutting down...")

		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()
		httpServer.Shutdown(shutdownCtx)

		done := make(chan struct{})
		go func() {
			grpcServer.GracefulStop()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			log.Println("Forcing gRPC server stop")
			grpcServer.Stop()
		}

		cancel()
	}()

	url := fmt.Sprintf("http://localhost:%d", boundPort)
	fmt.Printf("Farm Table dashboard: %s\n", url)

	if openBrowser {
		openURL(url)
	}

	if err := httpServer.Serve(lis); err != http.ErrServerClosed {
		return fmt.Errorf("HTTP server error: %w", err)
	}
	return nil
}

func isAddrInUse(err error) bool {
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		var sysErr *os.SyscallError
		if errors.As(opErr.Err, &sysErr) {
			return errors.Is(sysErr.Err, syscall.EADDRINUSE)
		}
	}
	return false
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
