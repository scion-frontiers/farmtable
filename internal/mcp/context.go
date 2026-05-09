package mcp

import (
	"context"
	"time"

	"google.golang.org/grpc/metadata"
)

func contextWithToken(ctx context.Context, token string) context.Context {
	md := metadata.Pairs("authorization", "Bearer "+token)
	return metadata.NewOutgoingContext(ctx, md)
}

func parseTime(layout, value string) (time.Time, error) {
	return time.Parse(layout, value)
}
