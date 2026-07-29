package server_test

import (
	"context"
	"net"
	"testing"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
)

func startServerWithLookup(t *testing.T, lookup server.TokenLookup) (pb.FarmTableServiceClient, *store.EntStore, func()) {
	t.Helper()
	s, storeCleanup := testutil.NewTestStore(t)

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
		storeCleanup()
		t.Fatalf("dialing bufconn: %v", err)
	}

	client := pb.NewFarmTableServiceClient(conn)
	cleanup := func() {
		conn.Close()
		srv.Stop()
		storeCleanup()
	}
	return client, s, cleanup
}

func TestAuthInterceptor_NoLookupConfigured(t *testing.T) {
	client, _, cleanup := startServerWithLookup(t, nil)
	defer cleanup()

	_, err := client.GetVersion(context.Background(), &pb.GetVersionRequest{})
	if err != nil {
		t.Fatalf("expected open access when no lookup configured, got: %v", err)
	}
}

func TestAuthInterceptor_StoreBackedValidToken(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "test-agent",
		Type:        "agent",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("creating user: %v", err)
	}

	_, rawToken, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "test-token",
	})
	if err != nil {
		t.Fatalf("creating token: %v", err)
	}

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
		t.Fatalf("dialing: %v", err)
	}
	defer conn.Close()
	defer srv.Stop()

	client := pb.NewFarmTableServiceClient(conn)
	authCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+rawToken)
	_, err = client.GetVersion(authCtx, &pb.GetVersionRequest{})
	if err != nil {
		t.Fatalf("expected success with valid token, got: %v", err)
	}
}

func TestAuthInterceptor_InvalidToken(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, _ := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "test-agent",
		Type:        "agent",
		Status:      "active",
	})
	s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "test-token",
	})

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
		t.Fatalf("dialing: %v", err)
	}
	defer conn.Close()
	defer srv.Stop()

	client := pb.NewFarmTableServiceClient(conn)
	authCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer wrong-token")
	_, err = client.GetVersion(authCtx, &pb.GetVersionRequest{})
	if err == nil {
		t.Fatal("expected Unauthenticated error for wrong token")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Unauthenticated {
		t.Errorf("code = %v, want Unauthenticated", st.Code())
	}
}

func TestAuthInterceptor_MissingBearerPrefix(t *testing.T) {
	lookup := server.LegacyTokenAuth("secret-token")
	client, _, cleanup := startServerWithLookup(t, lookup)
	defer cleanup()

	ctx := metadata.AppendToOutgoingContext(context.Background(), "authorization", "secret-token")
	_, err := client.GetVersion(ctx, &pb.GetVersionRequest{})
	if err == nil {
		t.Fatal("expected Unauthenticated error for missing Bearer prefix")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Unauthenticated {
		t.Errorf("code = %v, want Unauthenticated", st.Code())
	}
}

func TestAuthInterceptor_NoTokenSentAllowsAccess(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

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
		t.Fatalf("dialing: %v", err)
	}
	defer conn.Close()
	defer srv.Stop()

	client := pb.NewFarmTableServiceClient(conn)
	_, err = client.GetVersion(context.Background(), &pb.GetVersionRequest{})
	if err != nil {
		t.Fatalf("expected access without token (no mandatory auth), got: %v", err)
	}
}

func TestAuthInterceptor_RecordUsageHasDeadline(t *testing.T) {
	lookup := &deadlineLookup{
		result: &server.TokenLookupResult{
			UserID:  uuid.New(),
			TokenID: uuid.New(),
		},
		used: make(chan context.Context, 1),
	}
	client, _, cleanup := startServerWithLookup(t, lookup)
	defer cleanup()

	ctx := metadata.AppendToOutgoingContext(context.Background(), "authorization", "Bearer secret-token")
	if _, err := client.GetVersion(ctx, &pb.GetVersionRequest{}); err != nil {
		t.Fatalf("expected success with valid token, got: %v", err)
	}

	select {
	case usageCtx := <-lookup.used:
		deadline, ok := usageCtx.Deadline()
		if !ok {
			t.Fatal("expected token usage context to have a deadline")
		}
		if time.Until(deadline) <= 0 {
			t.Fatalf("expected token usage deadline to be in the future, got %v", deadline)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for token usage recording")
	}
}

func TestAuthInterceptor_CustomHeader(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "test-agent",
		Type:        "agent",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("creating user: %v", err)
	}

	_, rawToken, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "test-token",
	})
	if err != nil {
		t.Fatalf("creating token: %v", err)
	}

	lookup := server.NewStoreTokenLookup(s)
	client, _, cleanup := startServerWithLookup(t, lookup)
	defer cleanup()

	// Send token via x-farmtable-token only (no authorization header)
	authCtx := metadata.AppendToOutgoingContext(ctx, "x-farmtable-token", rawToken)
	_, err = client.GetVersion(authCtx, &pb.GetVersionRequest{})
	if err != nil {
		t.Fatalf("expected success with custom header token, got: %v", err)
	}
}

func TestAuthInterceptor_CustomHeaderPrecedence(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "test-agent",
		Type:        "agent",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("creating user: %v", err)
	}

	_, rawToken, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "test-token",
	})
	if err != nil {
		t.Fatalf("creating token: %v", err)
	}

	lookup := server.NewStoreTokenLookup(s)
	client, _, cleanup := startServerWithLookup(t, lookup)
	defer cleanup()

	// Send valid token via x-farmtable-token, invalid token via authorization.
	// The custom header should take precedence, so auth should succeed.
	authCtx := metadata.AppendToOutgoingContext(ctx,
		"x-farmtable-token", rawToken,
		"authorization", "Bearer wrong-token",
	)
	_, err = client.GetVersion(authCtx, &pb.GetVersionRequest{})
	if err != nil {
		t.Fatalf("expected custom header to take precedence over authorization, got: %v", err)
	}
}

type deadlineLookup struct {
	result *server.TokenLookupResult
	used   chan context.Context
}

func (l *deadlineLookup) LookupByHash(context.Context, string) (*server.TokenLookupResult, error) {
	return l.result, nil
}

func (l *deadlineLookup) RecordUsage(ctx context.Context, _ uuid.UUID) {
	l.used <- ctx
}
