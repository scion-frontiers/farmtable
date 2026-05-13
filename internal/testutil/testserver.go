package testutil

import (
	"context"
	"net"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/streaming"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"
)

func NewTestServer(t *testing.T) (pb.FarmTableServiceClient, func()) {
	t.Helper()
	s, storeCleanup := NewTestStore(t)

	lis := bufconn.Listen(1 << 20)
	srv := grpc.NewServer()
	pb.RegisterFarmTableServiceServer(srv, server.NewFarmTableService(s, "test"))
	go srv.Serve(lis)

	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		srv.Stop()
		storeCleanup()
		t.Fatalf("dialing bufconn: %v", err)
	}

	client := pb.NewFarmTableServiceClient(conn)
	cleanup := func() {
		conn.Close()
		srv.Stop()
		storeCleanup()
	}
	return client, cleanup
}

func NewTestServerWithStreaming(t *testing.T) (pb.FarmTableServiceClient, func()) {
	t.Helper()
	s, storeCleanup := NewTestStore(t)
	eventBus := streaming.NewEventBus()

	lis := bufconn.Listen(1 << 20)
	srv := grpc.NewServer()
	pb.RegisterFarmTableServiceServer(srv, server.NewFarmTableService(s, "test", server.WithEventBus(eventBus)))
	go srv.Serve(lis)

	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		srv.Stop()
		storeCleanup()
		t.Fatalf("dialing bufconn: %v", err)
	}

	client := pb.NewFarmTableServiceClient(conn)
	cleanup := func() {
		conn.Close()
		srv.Stop()
		storeCleanup()
	}
	return client, cleanup
}

func NewTestServerPostgres(t *testing.T) (pb.FarmTableServiceClient, func()) {
	t.Helper()
	s, storeCleanup := NewTestStorePostgres(t)

	lis := bufconn.Listen(1 << 20)
	srv := grpc.NewServer()
	pb.RegisterFarmTableServiceServer(srv, server.NewFarmTableService(s, "test"))
	go srv.Serve(lis)

	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		srv.Stop()
		storeCleanup()
		t.Fatalf("dialing bufconn: %v", err)
	}

	client := pb.NewFarmTableServiceClient(conn)
	cleanup := func() {
		conn.Close()
		srv.Stop()
		storeCleanup()
	}
	return client, cleanup
}

func NewTestServerWithAuth(t *testing.T, s *store.EntStore) (pb.FarmTableServiceClient, *grpc.Server, func()) {
	t.Helper()

	lookup := server.NewStoreTokenLookup(s)
	lis := bufconn.Listen(1 << 20)
	srv := grpc.NewServer(
		grpc.UnaryInterceptor(server.TokenAuthInterceptor(lookup)),
	)
	pb.RegisterFarmTableServiceServer(srv, server.NewFarmTableService(s, "test"))
	go srv.Serve(lis)

	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		srv.Stop()
		t.Fatalf("dialing bufconn: %v", err)
	}

	client := pb.NewFarmTableServiceClient(conn)
	cleanup := func() {
		conn.Close()
		srv.Stop()
	}
	return client, srv, cleanup
}
