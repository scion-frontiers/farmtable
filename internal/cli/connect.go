package cli

import (
	"context"
	"crypto/tls"
	"os"
	"strings"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

const defaultServer = "localhost:50051"

func resolveServer(flagVal string) string {
	if flagVal != "" {
		return flagVal
	}
	if v := os.Getenv("FARMTABLE_SERVER"); v != "" {
		return v
	}
	cfg := LoadConfig()
	if cfg.Server != "" {
		return cfg.Server
	}
	return defaultServer
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

func newClient(server, token string) (pb.FarmTableServiceClient, *grpc.ClientConn, error) {
	conn, err := dialServer(server)
	if err != nil {
		return nil, nil, err
	}
	return pb.NewFarmTableServiceClient(conn), conn, nil
}

func authCtx(ctx context.Context, token string) context.Context {
	if token == "" {
		return ctx
	}
	md := metadata.Pairs("authorization", "Bearer "+token)
	return metadata.NewOutgoingContext(ctx, md)
}
