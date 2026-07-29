package cli

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/platform/github"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/streaming"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/test/bufconn"
)

const grpcMaxMessageSize = 64 << 20

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
	return grpc.NewClient(server,
		creds,
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(grpcMaxMessageSize),
			grpc.MaxCallSendMsgSize(grpcMaxMessageSize),
		),
	)
}

func isLocalhost(addr string) bool {
	host := addr
	if splitHost, _, err := net.SplitHostPort(addr); err == nil {
		host = splitHost
	}
	host = strings.Trim(host, "[]")
	return host == "localhost" || host == "127.0.0.1" || host == "::1" || host == ""
}

func newClient(globals *globalFlags) (pb.FarmTableServiceClient, io.Closer, error) {
	if repo := os.Getenv("FARMTABLE_GITHUB_REPO"); repo != "" {
		return startGitHubPassThrough(repo)
	}

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

	if err := ensureLocalUser(ctx, s, resolveToken("")); err != nil {
		s.Close()
		return nil, nil, fmt.Errorf("ensuring local user: %w", err)
	}

	lookup := server.NewStoreTokenLookup(s)
	eventBus := streaming.NewEventBus()
	lis := bufconn.Listen(1 << 20)
	srv := grpc.NewServer(
		grpc.MaxRecvMsgSize(grpcMaxMessageSize),
		grpc.MaxSendMsgSize(grpcMaxMessageSize),
		grpc.UnaryInterceptor(server.TokenAuthInterceptor(lookup)),
		grpc.StreamInterceptor(server.TokenAuthStreamInterceptor(lookup)),
	)
	pb.RegisterFarmTableServiceServer(srv, server.NewFarmTableService(s, "embedded", server.WithEventBus(eventBus)))
	go srv.Serve(lis)

	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(grpcMaxMessageSize),
			grpc.MaxCallSendMsgSize(grpcMaxMessageSize),
		),
	)
	if err != nil {
		srv.Stop()
		s.Close()
		return nil, nil, fmt.Errorf("dialing embedded server: %w", err)
	}

	token := resolveToken("")
	client := pb.NewFarmTableServiceClient(conn)
	closer := &embeddedCloser{conn: conn, srv: srv, store: s, token: token}

	if err := ensureDefaultCollection(authCtx(ctx, token), client); err != nil {
		closer.Close()
		return nil, nil, fmt.Errorf("ensuring default collection: %w", err)
	}

	return client, closer, nil
}

func ensureLocalUser(ctx context.Context, s *store.EntStore, token string) error {
	u, err := s.GetUserByName(ctx, "local")
	if err == nil {
		return ensureDashboardToken(ctx, s, u.ID, token)
	}

	u, err = s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "local",
		Type:        "agent",
		Status:      "active",
	})
	if err != nil {
		return fmt.Errorf("creating local user: %w", err)
	}

	_, rawToken, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "local-embedded",
	})
	if err != nil {
		return fmt.Errorf("creating local token: %w", err)
	}

	if err := SaveConfigValue("token", rawToken); err != nil {
		return fmt.Errorf("saving token to config: %w", err)
	}

	return ensureDashboardToken(ctx, s, u.ID, token)
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
	token string
}

func (c *embeddedCloser) Close() error {
	connErr := c.conn.Close()
	c.srv.GracefulStop()
	storeErr := c.store.Close()
	return errors.Join(connErr, storeErr)
}

func openDirectStore() (*store.EntStore, func(), error) {
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
		return nil, nil, fmt.Errorf("opening database: %w", err)
	}
	return s, func() { s.Close() }, nil
}

func startGitHubPassThrough(repo string) (pb.FarmTableServiceClient, io.Closer, error) {
	parts := strings.SplitN(repo, "/", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return nil, nil, fmt.Errorf("FARMTABLE_GITHUB_REPO must be owner/repo, got %q", repo)
	}
	owner, repoName := parts[0], parts[1]

	token := resolveGitHubToken()
	if token == "" {
		return nil, nil, fmt.Errorf("no GitHub token found: set GITHUB_TOKEN or configure git credential helper")
	}

	var cfg *github.GitHubConfig
	cfgPath := ".farmtable/github.yaml"
	if envCfg := os.Getenv("FARMTABLE_GITHUB_CONFIG"); envCfg != "" {
		cfgPath = envCfg
	}
	loaded, err := github.LoadConfig(cfgPath)
	if err == nil {
		cfg = loaded
	} else {
		cfg = github.DefaultConfig()
	}

	s := github.NewPassThroughStore(token, owner, repoName, cfg, nil)

	lis := bufconn.Listen(1 << 20)
	srv := grpc.NewServer(
		grpc.MaxRecvMsgSize(grpcMaxMessageSize),
		grpc.MaxSendMsgSize(grpcMaxMessageSize),
	)
	pb.RegisterFarmTableServiceServer(srv, server.NewFarmTableService(s, "passthrough"))
	go srv.Serve(lis)

	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(grpcMaxMessageSize),
			grpc.MaxCallSendMsgSize(grpcMaxMessageSize),
		),
	)
	if err != nil {
		srv.Stop()
		return nil, nil, fmt.Errorf("dialing pass-through server: %w", err)
	}

	client := pb.NewFarmTableServiceClient(conn)
	closer := &passThroughCloser{conn: conn, srv: srv}
	return client, closer, nil
}

type passThroughCloser struct {
	conn *grpc.ClientConn
	srv  *grpc.Server
}

func (c *passThroughCloser) Close() error {
	connErr := c.conn.Close()
	c.srv.GracefulStop()
	return connErr
}

func resolveGitHubToken() string {
	if tok := os.Getenv("GITHUB_TOKEN"); tok != "" {
		return tok
	}
	cmd := exec.Command("git", "credential", "fill")
	cmd.Stdin = strings.NewReader("protocol=https\nhost=github.com\n")
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(out), "\n") {
		if strings.HasPrefix(line, "password=") {
			return strings.TrimPrefix(line, "password=")
		}
	}
	return ""
}

func authCtx(ctx context.Context, token string) context.Context {
	if token == "" {
		return ctx
	}
	md := metadata.Pairs("authorization", "Bearer "+token)
	return metadata.NewOutgoingContext(ctx, md)
}
