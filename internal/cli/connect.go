package cli

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/test/bufconn"
)

func resolveServer(flagVal string) string {
	if flagVal != "" {
		return flagVal
	}
	if v := os.Getenv("FARMTABLE_SERVER"); v != "" {
		return v
	}
	cfg := LoadConfig()
	return cfg.Server
}

func resolveToken(flagVal string) string {
	if flagVal != "" {
		return flagVal
	}
	if v := os.Getenv("FARMTABLE_TOKEN"); v != "" {
		return v
	}
	cfg := LoadConfig()
	return cfg.Token
}

func resolveCollection(flagVal string) string {
	if flagVal != "" {
		return flagVal
	}
	if v := os.Getenv("FARMTABLE_COLLECTION"); v != "" {
		return v
	}
	cfg := LoadConfig()
	return cfg.DefaultCollection
}

func resolveCollectionFromServer(ctx context.Context, client pb.FarmTableServiceClient, flagVal string) string {
	if c := resolveCollection(flagVal); c != "" {
		return c
	}
	resp, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{})
	if err != nil || len(resp.GetItems()) != 1 {
		return ""
	}
	return resp.GetItems()[0].GetId()
}

func resolveOutput(flagVal string) string {
	if flagVal != "" {
		return flagVal
	}
	if v := os.Getenv("FARMTABLE_OUTPUT"); v != "" {
		return v
	}
	cfg := LoadConfig()
	if cfg.Output != "" {
		return cfg.Output
	}
	return "json"
}

func resolveDBPath() string {
	if v := os.Getenv("FARMTABLE_DB_PATH"); v != "" {
		return v
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".farmtable", "farmtable.db")
}

func dialServer(server string) (*grpc.ClientConn, error) {
	var creds grpc.DialOption
	if os.Getenv("FARMTABLE_INSECURE") == "1" || isLocalhost(server) {
		creds = grpc.WithTransportCredentials(insecure.NewCredentials())
	} else {
		creds = grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{}))
	}
	return grpc.NewClient(server, creds)
}

func isLocalhost(addr string) bool {
	host := addr
	if idx := strings.LastIndex(addr, ":"); idx >= 0 {
		host = addr[:idx]
	}
	return host == "localhost" || host == "127.0.0.1" || host == "::1" || host == ""
}

func newClient(globals *globalFlags) (pb.FarmTableServiceClient, io.Closer, error) {
	server := resolveServer(globals.server)

	if server != "" {
		conn, err := dialServer(server)
		if err != nil {
			return nil, nil, err
		}
		return pb.NewFarmTableServiceClient(conn), conn, nil
	}

	return startEmbedded()
}

func startEmbedded() (pb.FarmTableServiceClient, io.Closer, error) {
	dbPath := resolveDBPath()

	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, nil, fmt.Errorf("creating data directory: %w", err)
	}

	ctx := context.Background()
	s, err := store.NewEntStore(ctx, store.StoreOptions{
		Dialect: "sqlite3",
		DSN:     fmt.Sprintf("file:%s?_fk=1", dbPath),
		Migrate: true,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("opening embedded database: %w", err)
	}

	lis := bufconn.Listen(1 << 20)
	srv := grpc.NewServer()
	pb.RegisterFarmTableServiceServer(srv, server.NewFarmTableService(s, "embedded"))
	go srv.Serve(lis)

	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		srv.Stop()
		s.Close()
		return nil, nil, fmt.Errorf("dialing embedded server: %w", err)
	}

	client := pb.NewFarmTableServiceClient(conn)
	closer := &embeddedCloser{conn: conn, srv: srv, store: s}

	if err := ensureDefaultCollection(context.Background(), client); err != nil {
		closer.Close()
		return nil, nil, fmt.Errorf("ensuring default collection: %w", err)
	}

	return client, closer, nil
}

func ensureDefaultCollection(ctx context.Context, client pb.FarmTableServiceClient) error {
	resp, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{})
	if err != nil {
		return err
	}
	if resp.GetTotalCount() > 0 {
		return nil
	}
	_, err = client.CreateCollection(ctx, &pb.CreateCollectionRequest{
		Name: "default",
	})
	return err
}

type embeddedCloser struct {
	conn  *grpc.ClientConn
	srv   *grpc.Server
	store *store.EntStore
}

func (c *embeddedCloser) Close() error {
	connErr := c.conn.Close()
	c.srv.GracefulStop()
	storeErr := c.store.Close()
	return errors.Join(connErr, storeErr)
}

func authCtx(ctx context.Context, token string) context.Context {
	if token == "" {
		return ctx
	}
	md := metadata.Pairs("authorization", "Bearer "+token)
	return metadata.NewOutgoingContext(ctx, md)
}
