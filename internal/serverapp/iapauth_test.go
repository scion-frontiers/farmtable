package serverapp

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

// testIAPKeyPair creates an ECDSA P-256 key pair and a JWKS server for testing.
func testIAPKeyPair(t *testing.T) (*ecdsa.PrivateKey, string, *httptest.Server) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	kid := "test-kid-1"

	jwks := jose.JSONWebKeySet{
		Keys: []jose.JSONWebKey{
			{Key: &key.PublicKey, KeyID: kid, Algorithm: string(jose.ES256), Use: "sig"},
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(jwks)
	}))
	t.Cleanup(srv.Close)

	return key, kid, srv
}

// signIAPToken creates a signed IAP JWT.
func signIAPToken(t *testing.T, key *ecdsa.PrivateKey, kid string, claims map[string]interface{}) string {
	t.Helper()
	signer, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.ES256, Key: key},
		(&jose.SignerOptions{}).WithHeader(jose.HeaderKey("kid"), kid),
	)
	if err != nil {
		t.Fatalf("create signer: %v", err)
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		t.Fatalf("marshal claims: %v", err)
	}

	jws, err := signer.Sign(payload)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	compact, err := jws.CompactSerialize()
	if err != nil {
		t.Fatalf("compact serialize: %v", err)
	}

	return compact
}

func TestIAPAuthenticator_ValidToken(t *testing.T) {
	key, kid, jwksSrv := testIAPKeyPair(t)
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	token := signIAPToken(t, key, kid, map[string]interface{}{
		"iss":   DefaultIAPIssuer,
		"aud":   "/projects/123/apps/test",
		"sub":   "accounts.google.com:123456",
		"email": "accounts.google.com:alice@example.com",
		"hd":    "example.com",
		"iat":   jwt.NewNumericDate(now.Add(-time.Minute)),
		"exp":   jwt.NewNumericDate(now.Add(time.Hour)),
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	info, err := auth.Authenticate(req)
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	if info == nil {
		t.Fatal("expected non-nil IAPUserInfo")
	}
	if info.Subject != "123456" {
		t.Errorf("Subject = %q, want %q (IdP prefix stripped)", info.Subject, "123456")
	}
	if info.Email != "alice@example.com" {
		t.Errorf("Email = %q, want %q (IdP prefix stripped, lowercased)", info.Email, "alice@example.com")
	}
	if info.Domain != "example.com" {
		t.Errorf("Domain = %q, want %q", info.Domain, "example.com")
	}
}

func TestIAPAuthenticator_NoHeader(t *testing.T) {
	auth := &IAPAuthenticator{Audience: "test"}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	info, err := auth.Authenticate(req)
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	if info != nil {
		t.Error("expected nil IAPUserInfo when no header is present")
	}
}

func TestIAPAuthenticator_ExpiredToken(t *testing.T) {
	key, kid, jwksSrv := testIAPKeyPair(t)
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	token := signIAPToken(t, key, kid, map[string]interface{}{
		"iss":   DefaultIAPIssuer,
		"aud":   "/projects/123/apps/test",
		"sub":   "123456",
		"email": "alice@example.com",
		"iat":   jwt.NewNumericDate(now.Add(-2 * time.Hour)),
		"exp":   jwt.NewNumericDate(now.Add(-time.Hour)), // expired
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	_, err := auth.Authenticate(req)
	if err == nil {
		t.Fatal("expected error for expired token")
	}
	if got := err.Error(); got == "" {
		t.Error("expected non-empty error message")
	}
}

func TestIAPAuthenticator_WrongAudience(t *testing.T) {
	key, kid, jwksSrv := testIAPKeyPair(t)
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	token := signIAPToken(t, key, kid, map[string]interface{}{
		"iss":   DefaultIAPIssuer,
		"aud":   "/projects/999/apps/wrong", // wrong audience
		"sub":   "123456",
		"email": "alice@example.com",
		"iat":   jwt.NewNumericDate(now.Add(-time.Minute)),
		"exp":   jwt.NewNumericDate(now.Add(time.Hour)),
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	_, err := auth.Authenticate(req)
	if err == nil {
		t.Fatal("expected error for wrong audience")
	}
}

func TestIAPAuthenticator_WrongIssuer(t *testing.T) {
	key, kid, jwksSrv := testIAPKeyPair(t)
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	token := signIAPToken(t, key, kid, map[string]interface{}{
		"iss":   "https://evil.example.com", // wrong issuer
		"aud":   "/projects/123/apps/test",
		"sub":   "123456",
		"email": "alice@example.com",
		"iat":   jwt.NewNumericDate(now.Add(-time.Minute)),
		"exp":   jwt.NewNumericDate(now.Add(time.Hour)),
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	_, err := auth.Authenticate(req)
	if err == nil {
		t.Fatal("expected error for wrong issuer")
	}
}

func TestIAPAuthenticator_MissingSub(t *testing.T) {
	key, kid, jwksSrv := testIAPKeyPair(t)
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	token := signIAPToken(t, key, kid, map[string]interface{}{
		"iss":   DefaultIAPIssuer,
		"aud":   "/projects/123/apps/test",
		"sub":   "", // missing
		"email": "alice@example.com",
		"iat":   jwt.NewNumericDate(now.Add(-time.Minute)),
		"exp":   jwt.NewNumericDate(now.Add(time.Hour)),
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	_, err := auth.Authenticate(req)
	if err == nil {
		t.Fatal("expected error for missing sub")
	}
}

func TestIAPAuthenticator_MissingEmail(t *testing.T) {
	key, kid, jwksSrv := testIAPKeyPair(t)
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	token := signIAPToken(t, key, kid, map[string]interface{}{
		"iss":   DefaultIAPIssuer,
		"aud":   "/projects/123/apps/test",
		"sub":   "123456",
		"email": "", // missing
		"iat":   jwt.NewNumericDate(now.Add(-time.Minute)),
		"exp":   jwt.NewNumericDate(now.Add(time.Hour)),
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	_, err := auth.Authenticate(req)
	if err == nil {
		t.Fatal("expected error for missing email")
	}
}

func TestIAPAuthenticator_FutureIAT(t *testing.T) {
	key, kid, jwksSrv := testIAPKeyPair(t)
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	token := signIAPToken(t, key, kid, map[string]interface{}{
		"iss":   DefaultIAPIssuer,
		"aud":   "/projects/123/apps/test",
		"sub":   "123456",
		"email": "alice@example.com",
		"iat":   jwt.NewNumericDate(now.Add(time.Hour)), // far future
		"exp":   jwt.NewNumericDate(now.Add(2 * time.Hour)),
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	_, err := auth.Authenticate(req)
	if err == nil {
		t.Fatal("expected error for future iat")
	}
}

func TestIAPAuthenticator_MissingExp(t *testing.T) {
	key, kid, jwksSrv := testIAPKeyPair(t)
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	token := signIAPToken(t, key, kid, map[string]interface{}{
		"iss":   DefaultIAPIssuer,
		"aud":   "/projects/123/apps/test",
		"sub":   "123456",
		"email": "alice@example.com",
		"iat":   jwt.NewNumericDate(now.Add(-time.Minute)),
		// no exp claim
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	_, err := auth.Authenticate(req)
	if err == nil {
		t.Fatal("expected error for missing exp")
	}
}

func TestIAPAuthenticator_InvalidJWT(t *testing.T) {
	auth := &IAPAuthenticator{Audience: "test"}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, "not.a.jwt")

	_, err := auth.Authenticate(req)
	if err == nil {
		t.Fatal("expected error for invalid JWT")
	}
}

func TestIAPAuthenticator_UnknownKid(t *testing.T) {
	key, _, jwksSrv := testIAPKeyPair(t) // kid = "test-kid-1" in JWKS
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	// Sign with a different kid that's not in the JWKS.
	token := signIAPToken(t, key, "unknown-kid", map[string]interface{}{
		"iss":   DefaultIAPIssuer,
		"aud":   "/projects/123/apps/test",
		"sub":   "123456",
		"email": "alice@example.com",
		"iat":   jwt.NewNumericDate(now.Add(-time.Minute)),
		"exp":   jwt.NewNumericDate(now.Add(time.Hour)),
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	_, err := auth.Authenticate(req)
	if err == nil {
		t.Fatal("expected error for unknown kid")
	}
}

func TestIAPAuthenticator_WrongSignatureKey(t *testing.T) {
	_, _, jwksSrv := testIAPKeyPair(t) // JWKS has test-kid-1
	now := time.Now()

	// Generate a DIFFERENT key to sign with (signature won't verify).
	otherKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	token := signIAPToken(t, otherKey, "test-kid-1", map[string]interface{}{
		"iss":   DefaultIAPIssuer,
		"aud":   "/projects/123/apps/test",
		"sub":   "123456",
		"email": "alice@example.com",
		"iat":   jwt.NewNumericDate(now.Add(-time.Minute)),
		"exp":   jwt.NewNumericDate(now.Add(time.Hour)),
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	_, err = auth.Authenticate(req)
	if err == nil {
		t.Fatal("expected error for signature verification failure")
	}
}

func TestIAPAuthenticator_CustomIssuer(t *testing.T) {
	key, kid, jwksSrv := testIAPKeyPair(t)
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		Issuer:   "https://custom-issuer.example.com",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	token := signIAPToken(t, key, kid, map[string]interface{}{
		"iss":   "https://custom-issuer.example.com",
		"aud":   "/projects/123/apps/test",
		"sub":   "123456",
		"email": "alice@example.com",
		"iat":   jwt.NewNumericDate(now.Add(-time.Minute)),
		"exp":   jwt.NewNumericDate(now.Add(time.Hour)),
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	info, err := auth.Authenticate(req)
	if err != nil {
		t.Fatalf("Authenticate with custom issuer: %v", err)
	}
	if info == nil {
		t.Fatal("expected non-nil IAPUserInfo")
	}
}

func TestIAPAuthenticator_ClockSkewAllowed(t *testing.T) {
	key, kid, jwksSrv := testIAPKeyPair(t)
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	// Token expired 20 seconds ago — within 30s clock skew.
	token := signIAPToken(t, key, kid, map[string]interface{}{
		"iss":   DefaultIAPIssuer,
		"aud":   "/projects/123/apps/test",
		"sub":   "123456",
		"email": "alice@example.com",
		"iat":   jwt.NewNumericDate(now.Add(-time.Hour)),
		"exp":   jwt.NewNumericDate(now.Add(-20 * time.Second)),
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	info, err := auth.Authenticate(req)
	if err != nil {
		t.Fatalf("expected clock skew to be tolerated: %v", err)
	}
	if info == nil {
		t.Fatal("expected non-nil IAPUserInfo")
	}
}

func TestIAPAuthenticator_EmailLowercased(t *testing.T) {
	key, kid, jwksSrv := testIAPKeyPair(t)
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  jwksSrv.URL,
		NowFunc:  func() time.Time { return now },
	}

	token := signIAPToken(t, key, kid, map[string]interface{}{
		"iss":   DefaultIAPIssuer,
		"aud":   "/projects/123/apps/test",
		"sub":   "123456",
		"email": "Alice@Example.COM",
		"iat":   jwt.NewNumericDate(now.Add(-time.Minute)),
		"exp":   jwt.NewNumericDate(now.Add(time.Hour)),
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	info, err := auth.Authenticate(req)
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	if info.Email != "alice@example.com" {
		t.Errorf("Email = %q, want lowercased %q", info.Email, "alice@example.com")
	}
}

func TestStripIAPPrefix(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"accounts.google.com:123456", "123456"},
		{"accounts.google.com:alice@example.com", "alice@example.com"},
		{"123456", "123456"},
		{"alice@example.com", "alice@example.com"},
		{"", ""},
	}

	for _, tt := range tests {
		if got := stripIAPPrefix(tt.input); got != tt.want {
			t.Errorf("stripIAPPrefix(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestIAPAuthenticator_JWKSServerDown(t *testing.T) {
	// Create a server that returns errors.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()

	auth := &IAPAuthenticator{
		Audience: "/projects/123/apps/test",
		JWKSURL:  srv.URL,
		NowFunc:  func() time.Time { return now },
	}

	token := signIAPToken(t, key, "test-kid", map[string]interface{}{
		"iss":   DefaultIAPIssuer,
		"aud":   "/projects/123/apps/test",
		"sub":   "123456",
		"email": "alice@example.com",
		"iat":   jwt.NewNumericDate(now.Add(-time.Minute)),
		"exp":   jwt.NewNumericDate(now.Add(time.Hour)),
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, token)

	_, err = auth.Authenticate(req)
	if err == nil {
		t.Fatal("expected error when JWKS server is down")
	}
}
