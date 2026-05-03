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

	port := os.Getenv("FARMTABLE_PORT")
	if port == "" {
		port = "50051"
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	s, err := store.NewPostgresStoreFromDSN(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}
	defer s.Close()

	grpcServer := grpc.NewServer()
	pb.RegisterFarmTableServiceServer(grpcServer, server.NewFarmTableService(s))

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
