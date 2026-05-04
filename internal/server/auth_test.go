package server_test

import (
	"context"
	"net"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
)

func startServerWithToken(t *testing.T, token string) (pb.FarmTableServiceClient, func()) {
	t.Helper()
	s, storeCleanup := testutil.NewTestStore(t)

	lis := bufconn.Listen(1 << 20)
	srv := grpc.NewServer(
		grpc.UnaryInterceptor(server.TokenAuthInterceptor(token)),
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
	return client, cleanup
}

func TestAuthInterceptor_NoTokenConfigured(t *testing.T) {
	client, cleanup := startServerWithToken(t, "")
	defer cleanup()

	_, err := client.GetVersion(context.Background(), &pb.GetVersionRequest{})
	if err != nil {
		t.Fatalf("expected open access when no token configured, got: %v", err)
	}
}

func TestAuthInterceptor_ValidToken(t *testing.T) {
	client, cleanup := startServerWithToken(t, "secret-token")
	defer cleanup()

	ctx := metadata.AppendToOutgoingContext(context.Background(), "authorization", "Bearer secret-token")
	_, err := client.GetVersion(ctx, &pb.GetVersionRequest{})
	if err != nil {
		t.Fatalf("expected success with valid token, got: %v", err)
	}
}

func TestAuthInterceptor_InvalidToken(t *testing.T) {
	client, cleanup := startServerWithToken(t, "secret-token")
	defer cleanup()

	ctx := metadata.AppendToOutgoingContext(context.Background(), "authorization", "Bearer wrong-token")
	_, err := client.GetVersion(ctx, &pb.GetVersionRequest{})
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
	client, cleanup := startServerWithToken(t, "secret-token")
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

func TestAuthInterceptor_MissingToken(t *testing.T) {
	client, cleanup := startServerWithToken(t, "secret-token")
	defer cleanup()

	_, err := client.GetVersion(context.Background(), &pb.GetVersionRequest{})
	if err == nil {
		t.Fatal("expected Unauthenticated error for missing token")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Unauthenticated {
		t.Errorf("code = %v, want Unauthenticated", st.Code())
	}
}
