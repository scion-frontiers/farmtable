package cli

import (
	"context"
	"testing"

	"google.golang.org/grpc/metadata"
)

func TestIsLocalhost(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		addr string
		want bool
	}{
		{name: "empty address is embedded local", addr: "", want: true},
		{name: "localhost without port", addr: "localhost", want: true},
		{name: "localhost with port", addr: "localhost:50051", want: true},
		{name: "ipv4 loopback with port", addr: "127.0.0.1:50051", want: true},
		{name: "ipv6 loopback without port", addr: "::1", want: true},
		{name: "bracketed ipv6 loopback with port", addr: "[::1]:50051", want: true},
		{name: "remote host with port", addr: "farmtable.example.com:443", want: false},
		{name: "remote ipv4 with port", addr: "192.0.2.1:50051", want: false},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := isLocalhost(tt.addr); got != tt.want {
				t.Fatalf("isLocalhost(%q) = %v, want %v", tt.addr, got, tt.want)
			}
		})
	}
}

func TestAuthCtxUsesFarmtableTokenInBothHeadersWithoutIAP(t *testing.T) {
	resetIAPAuthForTest(t)

	ctx := authCtx(context.Background(), "farmtable-token")
	md, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		t.Fatal("authCtx did not attach outgoing metadata")
	}

	if got := singleMetadataValue(t, md, "authorization"); got != "Bearer farmtable-token" {
		t.Fatalf("authorization = %q, want %q", got, "Bearer farmtable-token")
	}
	if got := singleMetadataValue(t, md, "x-farmtable-token"); got != "farmtable-token" {
		t.Fatalf("x-farmtable-token = %q, want %q", got, "farmtable-token")
	}
}

func TestAuthCtxUsesSeparateIAPAuthorizationToken(t *testing.T) {
	resetIAPAuthForTest(t)
	setIAPAuthToken("iap-identity-token")

	ctx := authCtx(context.Background(), "farmtable-token")
	md, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		t.Fatal("authCtx did not attach outgoing metadata")
	}

	if got := singleMetadataValue(t, md, "authorization"); got != "Bearer iap-identity-token" {
		t.Fatalf("authorization = %q, want %q", got, "Bearer iap-identity-token")
	}
	if got := singleMetadataValue(t, md, "x-farmtable-token"); got != "farmtable-token" {
		t.Fatalf("x-farmtable-token = %q, want %q", got, "farmtable-token")
	}
}

func TestConfigureIAPAuthUsesFlagAudienceBeforeEnv(t *testing.T) {
	resetIAPAuthForTest(t)
	t.Setenv("IAP_AUDIENCE", "env-audience")

	var gotAudience string
	mintIAPTokenFunc = func(audience string) (string, error) {
		gotAudience = audience
		return "minted-iap-token", nil
	}

	if err := configureIAPAuth("flag-audience", "farmtable.example.com:443"); err != nil {
		t.Fatalf("configureIAPAuth returned error: %v", err)
	}
	if gotAudience != "flag-audience" {
		t.Fatalf("mint audience = %q, want %q", gotAudience, "flag-audience")
	}
	if got := currentIAPAuthToken(); got != "minted-iap-token" {
		t.Fatalf("current IAP token = %q, want %q", got, "minted-iap-token")
	}
}

func TestConfigureIAPAuthUsesEnvAudience(t *testing.T) {
	resetIAPAuthForTest(t)
	t.Setenv("IAP_AUDIENCE", "env-audience")

	var gotAudience string
	mintIAPTokenFunc = func(audience string) (string, error) {
		gotAudience = audience
		return "minted-iap-token", nil
	}

	if err := configureIAPAuth("", "farmtable.example.com:443"); err != nil {
		t.Fatalf("configureIAPAuth returned error: %v", err)
	}
	if gotAudience != "env-audience" {
		t.Fatalf("mint audience = %q, want %q", gotAudience, "env-audience")
	}
}

func TestConfigureIAPAuthClearsTokenWhenDisabled(t *testing.T) {
	resetIAPAuthForTest(t)
	setIAPAuthToken("stale-iap-token")

	if err := configureIAPAuth("", "farmtable.example.com:443"); err != nil {
		t.Fatalf("configureIAPAuth returned error: %v", err)
	}
	if got := currentIAPAuthToken(); got != "" {
		t.Fatalf("current IAP token = %q, want empty", got)
	}
}

func resetIAPAuthForTest(t *testing.T) {
	t.Helper()
	originalMint := mintIAPTokenFunc
	setIAPAuthToken("")
	t.Cleanup(func() {
		mintIAPTokenFunc = originalMint
		setIAPAuthToken("")
	})
}

func singleMetadataValue(t *testing.T, md metadata.MD, key string) string {
	t.Helper()
	values := md.Get(key)
	if len(values) != 1 {
		t.Fatalf("metadata %q has %d values, want 1: %v", key, len(values), values)
	}
	return values[0]
}
