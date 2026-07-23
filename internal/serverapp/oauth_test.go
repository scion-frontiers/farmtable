package serverapp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/google/uuid"
	"github.com/gorilla/sessions"
)

func TestGoogleOAuthManager_LoginRedirects(t *testing.T) {
	s := &mockProvisioningStore{}
	prov := NewUserProvisioner(s, "")
	sessStore := sessions.NewCookieStore([]byte("test-auth-key-32bytes-long-xx!!"), []byte("test-enc-key-32bytes-long-xxx!!"))

	m := NewGoogleOAuthManager(&GoogleOAuthConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		BaseURL:      "http://localhost:8080",
	}, sessStore, prov)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/login?redirect_uri=/dashboard", nil)
	rec := httptest.NewRecorder()

	m.handleLogin(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusTemporaryRedirect {
		t.Fatalf("login redirect: status = %d, want %d", resp.StatusCode, http.StatusTemporaryRedirect)
	}

	location := resp.Header.Get("Location")
	if location == "" {
		t.Fatal("login redirect: no Location header")
	}

	// Should redirect to Google's auth endpoint.
	if got := location; got == "" {
		t.Error("expected Location header to be set")
	}

	// Should have stored a pending state.
	if len(m.pendingStates) != 1 {
		t.Errorf("pending states = %d, want 1", len(m.pendingStates))
	}

	// Check that the redirect_uri was stored in the state.
	for _, os := range m.pendingStates {
		if os.Redirect != "/dashboard" {
			t.Errorf("state redirect = %q, want %q", os.Redirect, "/dashboard")
		}
	}
}

func TestGoogleOAuthManager_LoginNotConfigured(t *testing.T) {
	s := &mockProvisioningStore{}
	prov := NewUserProvisioner(s, "")
	sessStore := sessions.NewCookieStore([]byte("test-auth-key-32bytes-long-xx!!"), []byte("test-enc-key-32bytes-long-xxx!!"))

	// nil config = not configured
	m := NewGoogleOAuthManager(nil, sessStore, prov)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/login", nil)
	rec := httptest.NewRecorder()

	m.handleLogin(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("login not configured: status = %d, want %d", resp.StatusCode, http.StatusServiceUnavailable)
	}
}

func TestGoogleOAuthManager_CallbackInvalidState(t *testing.T) {
	s := &mockProvisioningStore{}
	prov := NewUserProvisioner(s, "")
	sessStore := sessions.NewCookieStore([]byte("test-auth-key-32bytes-long-xx!!"), []byte("test-enc-key-32bytes-long-xxx!!"))

	m := NewGoogleOAuthManager(&GoogleOAuthConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		BaseURL:      "http://localhost:8080",
	}, sessStore, prov)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/callback?state=invalid&code=xxx", nil)
	rec := httptest.NewRecorder()

	m.handleCallback(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("callback invalid state: status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}

	var errResp map[string]string
	json.NewDecoder(resp.Body).Decode(&errResp)
	if errResp["error"] != "invalid or expired state" {
		t.Errorf("error = %q, want %q", errResp["error"], "invalid or expired state")
	}
}

func TestGoogleOAuthManager_CallbackOAuthError(t *testing.T) {
	s := &mockProvisioningStore{}
	prov := NewUserProvisioner(s, "")
	sessStore := sessions.NewCookieStore([]byte("test-auth-key-32bytes-long-xx!!"), []byte("test-enc-key-32bytes-long-xxx!!"))

	m := NewGoogleOAuthManager(&GoogleOAuthConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		BaseURL:      "http://localhost:8080",
	}, sessStore, prov)

	// First get a valid state.
	loginReq := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/login", nil)
	loginRec := httptest.NewRecorder()
	m.handleLogin(loginRec, loginReq)

	// Extract the state from the pending states.
	var state string
	for s := range m.pendingStates {
		state = s
		break
	}

	// Callback with OAuth error.
	req := httptest.NewRequest(http.MethodGet,
		"/api/auth/oauth/google/callback?state="+state+"&error=access_denied&error_description=User+denied+access",
		nil)
	rec := httptest.NewRecorder()

	m.handleCallback(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("callback OAuth error: status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}

	// State should have been consumed.
	if len(m.pendingStates) != 0 {
		t.Errorf("pending states = %d, want 0 (state consumed)", len(m.pendingStates))
	}
}

func TestGoogleOAuthManager_CallbackMissingCode(t *testing.T) {
	s := &mockProvisioningStore{}
	prov := NewUserProvisioner(s, "")
	sessStore := sessions.NewCookieStore([]byte("test-auth-key-32bytes-long-xx!!"), []byte("test-enc-key-32bytes-long-xxx!!"))

	m := NewGoogleOAuthManager(&GoogleOAuthConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		BaseURL:      "http://localhost:8080",
	}, sessStore, prov)

	// Get a valid state.
	loginReq := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/login", nil)
	loginRec := httptest.NewRecorder()
	m.handleLogin(loginRec, loginReq)

	var state string
	for s := range m.pendingStates {
		state = s
		break
	}

	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/callback?state="+state, nil)
	rec := httptest.NewRecorder()

	m.handleCallback(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("callback missing code: status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func TestGoogleOAuthManager_CallbackNotConfigured(t *testing.T) {
	s := &mockProvisioningStore{}
	prov := NewUserProvisioner(s, "")
	sessStore := sessions.NewCookieStore([]byte("test-auth-key-32bytes-long-xx!!"), []byte("test-enc-key-32bytes-long-xxx!!"))

	m := NewGoogleOAuthManager(nil, sessStore, prov)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/callback?state=x&code=y", nil)
	rec := httptest.NewRecorder()

	m.handleCallback(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("callback not configured: status = %d, want %d", resp.StatusCode, http.StatusServiceUnavailable)
	}
}

func TestGoogleOAuthManager_RegisterRoutes(t *testing.T) {
	s := &mockProvisioningStore{}
	prov := NewUserProvisioner(s, "")
	sessStore := sessions.NewCookieStore([]byte("test-auth-key-32bytes-long-xx!!"), []byte("test-enc-key-32bytes-long-xxx!!"))

	m := NewGoogleOAuthManager(&GoogleOAuthConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		BaseURL:      "http://localhost:8080",
	}, sessStore, prov)

	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	// Verify login endpoint is registered.
	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/login", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	resp := rec.Result()
	defer resp.Body.Close()

	// Should redirect to Google.
	if resp.StatusCode != http.StatusTemporaryRedirect {
		t.Fatalf("login route: status = %d, want %d", resp.StatusCode, http.StatusTemporaryRedirect)
	}
}

func TestGoogleOAuthManager_CleanExpiredStates(t *testing.T) {
	s := &mockProvisioningStore{}
	prov := NewUserProvisioner(s, "")
	sessStore := sessions.NewCookieStore([]byte("test-auth-key-32bytes-long-xx!!"), []byte("test-enc-key-32bytes-long-xxx!!"))

	m := NewGoogleOAuthManager(&GoogleOAuthConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		BaseURL:      "http://localhost:8080",
	}, sessStore, prov)

	// Create two login states.
	req1 := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/login", nil)
	m.handleLogin(httptest.NewRecorder(), req1)
	req2 := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/login", nil)
	m.handleLogin(httptest.NewRecorder(), req2)

	if len(m.pendingStates) != 2 {
		t.Fatalf("pending states = %d, want 2", len(m.pendingStates))
	}

	// Cleaning should not remove recent states.
	m.CleanExpiredOAuthStates()
	if len(m.pendingStates) != 2 {
		t.Fatalf("after clean: pending states = %d, want 2 (states are recent)", len(m.pendingStates))
	}
}

func TestGoogleOAuthConfigFromEnv_NotSet(t *testing.T) {
	// When env vars aren't set, should return nil.
	t.Setenv("FARMTABLE_GOOGLE_CLIENT_ID", "")
	cfg := GoogleOAuthConfigFromEnv("http://localhost")
	if cfg != nil {
		t.Error("expected nil config when FARMTABLE_GOOGLE_CLIENT_ID is not set")
	}
}

func TestGoogleOAuthConfigFromEnv_Set(t *testing.T) {
	t.Setenv("FARMTABLE_GOOGLE_CLIENT_ID", "test-id")
	t.Setenv("FARMTABLE_GOOGLE_CLIENT_SECRET", "test-secret")
	cfg := GoogleOAuthConfigFromEnv("http://localhost")
	if cfg == nil {
		t.Fatal("expected non-nil config when FARMTABLE_GOOGLE_CLIENT_ID is set")
	}
	if cfg.ClientID != "test-id" {
		t.Errorf("ClientID = %q, want %q", cfg.ClientID, "test-id")
	}
	if cfg.ClientSecret != "test-secret" {
		t.Errorf("ClientSecret = %q, want %q", cfg.ClientSecret, "test-secret")
	}
}

func TestGoogleOAuthManager_LoginDefaultRedirect(t *testing.T) {
	s := &mockProvisioningStore{}
	prov := NewUserProvisioner(s, "")
	sessStore := sessions.NewCookieStore([]byte("test-auth-key-32bytes-long-xx!!"), []byte("test-enc-key-32bytes-long-xxx!!"))

	m := NewGoogleOAuthManager(&GoogleOAuthConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		BaseURL:      "http://localhost:8080",
	}, sessStore, prov)

	// Login without redirect_uri should default to "/".
	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/login", nil)
	rec := httptest.NewRecorder()
	m.handleLogin(rec, req)

	for _, os := range m.pendingStates {
		if os.Redirect != "/" {
			t.Errorf("default redirect = %q, want %q", os.Redirect, "/")
		}
	}
}

// helper to create a user in the mock store for provisioning tests that
// reach the full callback flow. Placing it here since oauth_test.go uses
// the same mockProvisioningStore from provisioning_test.go.
func addMockUser(s *mockProvisioningStore, email, name string) *ent.User {
	u := &ent.User{
		ID:          uuid.New(),
		DisplayName: name,
		Email:       &email,
		Type:        "human",
		Status:      "active",
	}
	s.users = append(s.users, u)
	return u
}
