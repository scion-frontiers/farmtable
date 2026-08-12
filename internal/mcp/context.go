package mcp

import (
	"context"
	"time"

	"google.golang.org/grpc/metadata"
)

func contextWithToken(ctx context.Context, token string) context.Context {
	return contextWithAuth(ctx, token, "")
}

func contextWithAuth(ctx context.Context, token, iapToken string) context.Context {
	if iapToken != "" {
		md := metadata.Pairs(
			"authorization", "Bearer "+iapToken,
			"x-farmtable-token", token,
		)
		return metadata.NewOutgoingContext(ctx, md)
	}
	md := metadata.Pairs(
		"authorization", "Bearer "+token,
		"x-farmtable-token", token,
	)
	return metadata.NewOutgoingContext(ctx, md)
}

func parseTime(layout, value string) (time.Time, error) {
	return time.Parse(layout, value)
}
