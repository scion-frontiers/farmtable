package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"google.golang.org/grpc"
)

var version = "dev"

func main() {
	dbURL := os.Getenv("FARMTABLE_DB_URL")
	if dbURL == "" {
		log.Fatal("FARMTABLE_DB_URL is required")
	}

	dbDialect := os.Getenv("FARMTABLE_DB_DIALECT")
	if dbDialect == "" {
		dbDialect = "postgres"
	}

	port := os.Getenv("FARMTABLE_PORT")
	if port == "" {
		port = "50051"
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	s, err := store.NewEntStore(ctx, store.StoreOptions{
		Dialect: dbDialect,
		DSN:     dbURL,
		Migrate: true,
	})
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}
	defer s.Close()

	var lookup server.TokenLookup
	token := os.Getenv("FARMTABLE_TOKEN")
	if token == "" {
		log.Println("WARNING: FARMTABLE_TOKEN not set — server running in open access mode")
	} else {
		lookup = server.NewStoreTokenLookup(s)
		log.Println("Token authentication enabled (store-backed)")
	}

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(server.TokenAuthInterceptor(lookup)),
	)
	pb.RegisterFarmTableServiceServer(grpcServer, server.NewFarmTableService(s, version))

	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		log.Fatalf("Failed to listen on port %s: %v", port, err)
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("Shutting down gracefully...")
		grpcServer.GracefulStop()
		cancel()
	}()

	log.Printf("farmtable-server %s listening on :%s", version, port)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("gRPC server error: %v", err)
	}
}
