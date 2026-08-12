package mcp

import (
	"context"
	"testing"

	"google.golang.org/grpc/metadata"
)

func TestContextWithAuthUsesFarmtableTokenInBothHeadersWithoutIAP(t *testing.T) {
	ctx := contextWithAuth(context.Background(), "farmtable-token", "")
	md, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		t.Fatal("contextWithAuth did not attach outgoing metadata")
	}

	if got := singleMetadataValue(t, md, "authorization"); got != "Bearer farmtable-token" {
		t.Fatalf("authorization = %q, want %q", got, "Bearer farmtable-token")
	}
	if got := singleMetadataValue(t, md, "x-farmtable-token"); got != "farmtable-token" {
		t.Fatalf("x-farmtable-token = %q, want %q", got, "farmtable-token")
	}
}

func TestContextWithAuthUsesSeparateIAPAuthorizationToken(t *testing.T) {
	ctx := contextWithAuth(context.Background(), "farmtable-token", "iap-identity-token")
	md, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		t.Fatal("contextWithAuth did not attach outgoing metadata")
	}

	if got := singleMetadataValue(t, md, "authorization"); got != "Bearer iap-identity-token" {
		t.Fatalf("authorization = %q, want %q", got, "Bearer iap-identity-token")
	}
	if got := singleMetadataValue(t, md, "x-farmtable-token"); got != "farmtable-token" {
		t.Fatalf("x-farmtable-token = %q, want %q", got, "farmtable-token")
	}
}

func singleMetadataValue(t *testing.T, md metadata.MD, key string) string {
	t.Helper()
	values := md.Get(key)
	if len(values) != 1 {
		t.Fatalf("metadata %q has %d values, want 1: %v", key, len(values), values)
	}
	return values[0]
}
