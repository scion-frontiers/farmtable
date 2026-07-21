package main

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	farmtable "github.com/farmtable-io/farmtable"
	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/platform/github"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/serverapp"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/streaming"
	"google.golang.org/grpc"
)

var version = "dev"

const grpcMaxMessageSize = 64 << 20

func main() {
	storeOpts, err := serverStoreOptions()
	if err != nil {
		log.Fatal("FARMTABLE_DB_URL is required")
	}
	port := serverPort()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	entStore, err := store.NewEntStore(ctx, storeOpts)
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}

	// Wrap EntStore with MultiStore so platform-specific stores can be
	// registered later (e.g. via lazy registration in B3). With no
	// platform stores registered the MultiStore passes all operations
	// through to the primary EntStore.
	s := store.NewMultiStore(entStore)
	s.SetResolver(github.NewPlatformResolver())
	defer s.Close()

	var lookup server.TokenLookup
	token := os.Getenv("FARMTABLE_TOKEN")
	if token == "" {
		log.Println("WARNING: FARMTABLE_TOKEN not set — server running in open access mode")
	} else {
		lookup = server.NewStoreTokenLookup(s)
		log.Println("Token authentication enabled (store-backed)")
	}

	eventBus := streaming.NewEventBus()

	grpcServer := grpc.NewServer(
		grpc.MaxRecvMsgSize(grpcMaxMessageSize),
		grpc.MaxSendMsgSize(grpcMaxMessageSize),
		grpc.UnaryInterceptor(server.TokenAuthInterceptor(lookup)),
		grpc.StreamInterceptor(server.TokenAuthStreamInterceptor(lookup)),
	)
	pb.RegisterFarmTableServiceServer(grpcServer, server.NewFarmTableService(s, version, server.WithEventBus(eventBus)))

	subFS, err := fs.Sub(farmtable.WebAssets, "web/dist")
	if err != nil {
		log.Fatalf("Failed to create web asset filesystem: %v", err)
	}

	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: serverapp.UnifiedHandler(grpcServer, http.FS(subFS)),
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("Shutting down gracefully...")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			log.Printf("HTTP shutdown error: %v", err)
		}
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

	log.Printf("farmtable-server %s listening on :%s", version, port)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("HTTP server error: %v", err)
	}
}

func serverPort() string {
	if port := os.Getenv("PORT"); port != "" {
		return port
	}
	if port := os.Getenv("FARMTABLE_PORT"); port != "" {
		return port
	}
	return "8080"
}

func serverStoreOptions() (store.StoreOptions, error) {
	dbURL := os.Getenv("FARMTABLE_DB_URL")
	if dbURL == "" {
		return store.StoreOptions{}, fmt.Errorf("FARMTABLE_DB_URL is required")
	}

	if dbPassword := os.Getenv("FARMTABLE_DB_PASSWORD"); dbPassword != "" && !strings.Contains(dbURL, "password=") {
		dbURL = fmt.Sprintf("%s password=%s", dbURL, dbPassword)
	}

	dbDialect := os.Getenv("FARMTABLE_DB_DIALECT")
	if dbDialect == "" {
		dbDialect = "postgres"
	}

	return store.StoreOptions{
		Dialect: dbDialect,
		DSN:     dbURL,
		Migrate: true,
	}, nil
}
