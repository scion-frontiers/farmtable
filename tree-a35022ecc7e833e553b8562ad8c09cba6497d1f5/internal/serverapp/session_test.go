package serverapp

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc"

	"github.com/farmtable-io/farmtable/internal/server"
)

// mockTokenLookup implements server.TokenLookup for testing.
type mockTokenLookup struct {
	results    map[string]*server.TokenLookupResult
	usageCalls []uuid.UUID
}

func newMockLookup() *mockTokenLookup {
	return &mockTokenLookup{
		results: make(map[string]*server.TokenLookupResult),
	}
}

func (m *mockTokenLookup) AddToken(rawToken string, result *server.TokenLookupResult) {
	h := sha256.Sum256([]byte(rawToken))
	hash := hex.EncodeToString(h[:])
	m.results[hash] = result
}

func (m *mockTokenLookup) LookupByHash(_ context.Context, hash string) (*server.TokenLookupResult, error) {
	if result, ok := m.results[hash]; ok {
		return result, nil
	}
	return nil, fmt.Errorf("token not found")
}

func (m *mockTokenLookup) RecordUsage(_ context.Context, tokenID uuid.UUID) {
	m.usageCalls = append(m.usageCalls, tokenID)
}

func TestSessionLogin_ValidToken(t *testing.T) {
	lookup := newMockLookup()
	userID := uuid.New()
	tokenID := uuid.New()
	lookup.AddToken("ft_validtoken123", &server.TokenLookupResult{
		UserID:  userID,
		TokenID: tokenID,
	})

	sm := NewSessionManager(lookup)

	body := `{"token":"ft_validtoken123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	sm.handleSession(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("POST login: status = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var info SessionInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if info.UserID != userID.String() {
		t.Errorf("userId = %q, want %q", info.UserID, userID.String())
	}

	// Should have set a session cookie.
	cookies := resp.Cookies()
	found := false
	for _, c := range cookies {
		if c.Name == sessionCookieName {
			found = true
			if !c.HttpOnly {
				t.Error("session cookie should be HttpOnly")
			}
		}
	}
	if !found {
		t.Error("session cookie not set")
	}

	// Token usage should have been recorded.
	if len(lookup.usageCalls) != 1 || lookup.usageCalls[0] != tokenID {
		t.Errorf("usage calls = %v, want [%s]", lookup.usageCalls, tokenID)
	}
}

func TestSessionLogin_InvalidToken(t *testing.T) {
	lookup := newMockLookup()
	sm := NewSessionManager(lookup)

	body := `{"token":"ft_wrongtoken"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	sm.handleSession(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("POST invalid token: status = %d, want %d", resp.StatusCode, http.StatusUnauthorized)
	}

	data, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(data), "invalid token") {
		t.Errorf("body = %s, want error about invalid token", data)
	}
}

func TestSessionLogin_ExpiredToken(t *testing.T) {
	lookup := newMockLookup()
	expired := time.Now().Add(-time.Hour)
	lookup.AddToken("ft_expiredtoken", &server.TokenLookupResult{
		UserID:    uuid.New(),
		TokenID:   uuid.New(),
		ExpiresAt: &expired,
	})

	sm := NewSessionManager(lookup)

	body := `{"token":"ft_expiredtoken"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	sm.handleSession(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("POST expired token: status = %d, want %d", resp.StatusCode, http.StatusUnauthorized)
	}
}

func TestSessionLogin_EmptyToken(t *testing.T) {
	lookup := newMockLookup()
	sm := NewSessionManager(lookup)

	body := `{"token":""}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	sm.handleSession(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("POST empty token: status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func TestSessionLogin_InvalidBody(t *testing.T) {
	lookup := newMockLookup()
	sm := NewSessionManager(lookup)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	sm.handleSession(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("POST invalid body: status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func TestSessionGet_ValidSession(t *testing.T) {
	lookup := newMockLookup()
	userID := uuid.New()
	lookup.AddToken("ft_validtoken123", &server.TokenLookupResult{
		UserID:  userID,
		TokenID: uuid.New(),
	})
	sm := NewSessionManager(lookup)

	// First, log in to get a session cookie.
	loginBody := `{"token":"ft_validtoken123"}`
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()
	sm.handleSession(loginRec, loginReq)

	loginResp := loginRec.Result()
	if loginResp.StatusCode != http.StatusOK {
		t.Fatalf("login failed: status = %d", loginResp.StatusCode)
	}

	// Now GET with the session cookie.
	getReq := httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)
	for _, c := range loginResp.Cookies() {
		getReq.AddCookie(c)
	}
	getRec := httptest.NewRecorder()
	sm.handleSession(getRec, getReq)

	getResp := getRec.Result()
	defer getResp.Body.Close()

	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("GET session: status = %d, want %d", getResp.StatusCode, http.StatusOK)
	}

	var info SessionInfo
	if err := json.NewDecoder(getResp.Body).Decode(&info); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if info.UserID != userID.String() {
		t.Errorf("userId = %q, want %q", info.UserID, userID.String())
	}
}

func TestSessionGet_NoSession(t *testing.T) {
	lookup := newMockLookup()
	sm := NewSessionManager(lookup)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)
	rec := httptest.NewRecorder()
	sm.handleSession(rec, req)

	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("GET without session: status = %d, want %d", resp.StatusCode, http.StatusUnauthorized)
	}
}

func TestSessionGet_RevokedToken(t *testing.T) {
	lookup := newMockLookup()
	userID := uuid.New()
	lookup.AddToken("ft_revoketest", &server.TokenLookupResult{
		UserID:  userID,
		TokenID: uuid.New(),
	})
	sm := NewSessionManager(lookup)

	// Login.
	loginBody := `{"token":"ft_revoketest"}`
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()
	sm.handleSession(loginRec, loginReq)
	loginResp := loginRec.Result()

	// Now remove the token from the lookup (simulating revocation).
	h := sha256.Sum256([]byte("ft_revoketest"))
	delete(lookup.results, hex.EncodeToString(h[:]))

	// GET should return 401 because the token is no longer valid.
	getReq := httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)
	for _, c := range loginResp.Cookies() {
		getReq.AddCookie(c)
	}
	getRec := httptest.NewRecorder()
	sm.handleSession(getRec, getReq)

	getResp := getRec.Result()
	defer getResp.Body.Close()

	if getResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("GET with revoked token: status = %d, want %d", getResp.StatusCode, http.StatusUnauthorized)
	}
}

func TestSessionDelete_ClearsSession(t *testing.T) {
	lookup := newMockLookup()
	lookup.AddToken("ft_logouttest", &server.TokenLookupResult{
		UserID:  uuid.New(),
		TokenID: uuid.New(),
	})
	sm := NewSessionManager(lookup)

	// Login first.
	loginBody := `{"token":"ft_logouttest"}`
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()
	sm.handleSession(loginRec, loginReq)
	loginResp := loginRec.Result()

	if loginResp.StatusCode != http.StatusOK {
		t.Fatalf("login failed: status = %d", loginResp.StatusCode)
	}

	// Logout.
	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/auth/session", nil)
	for _, c := range loginResp.Cookies() {
		deleteReq.AddCookie(c)
	}
	deleteRec := httptest.NewRecorder()
	sm.handleSession(deleteRec, deleteReq)

	deleteResp := deleteRec.Result()
	defer deleteResp.Body.Close()

	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("DELETE session: status = %d, want %d", deleteResp.StatusCode, http.StatusOK)
	}

	// Session cookie should be cleared (MaxAge < 0).
	for _, c := range deleteResp.Cookies() {
		if c.Name == sessionCookieName && c.MaxAge >= 0 {
			t.Error("session cookie should be expired after DELETE")
		}
	}
}

func TestSessionToBearerMiddleware_InjectsHeaders(t *testing.T) {
	lookup := newMockLookup()
	lookup.AddToken("ft_middlewaretest", &server.TokenLookupResult{
		UserID:  uuid.New(),
		TokenID: uuid.New(),
	})
	sm := NewSessionManager(lookup)

	// Login to get a session cookie.
	loginBody := `{"token":"ft_middlewaretest"}`
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()
	sm.handleSession(loginRec, loginReq)
	loginResp := loginRec.Result()

	// Create a downstream handler that captures the injected headers.
	var capturedAuth string
	var capturedFtToken string
	downstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth = r.Header.Get("Authorization")
		capturedFtToken = r.Header.Get("X-Farmtable-Token")
		w.WriteHeader(http.StatusOK)
	})

	// Wrap with session-to-bearer middleware.
	handler := sm.SessionToBearerMiddleware(downstream)

	req := httptest.NewRequest(http.MethodPost, "/farmtable.v1.FarmTableService/ListTasks", nil)
	for _, c := range loginResp.Cookies() {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if capturedAuth != "Bearer ft_middlewaretest" {
		t.Errorf("Authorization = %q, want %q", capturedAuth, "Bearer ft_middlewaretest")
	}
	if capturedFtToken != "ft_middlewaretest" {
		t.Errorf("X-Farmtable-Token = %q, want %q", capturedFtToken, "ft_middlewaretest")
	}
}

func TestSessionToBearerMiddleware_PassthroughWithExistingAuth(t *testing.T) {
	lookup := newMockLookup()
	sm := NewSessionManager(lookup)

	var capturedAuth string
	downstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	})

	handler := sm.SessionToBearerMiddleware(downstream)

	req := httptest.NewRequest(http.MethodPost, "/farmtable.v1.FarmTableService/ListTasks", nil)
	req.Header.Set("Authorization", "Bearer existing_token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if capturedAuth != "Bearer existing_token" {
		t.Errorf("Authorization = %q, want %q (should not be overridden)", capturedAuth, "Bearer existing_token")
	}
}

func TestSessionToBearerMiddleware_NoSessionPassthrough(t *testing.T) {
	lookup := newMockLookup()
	sm := NewSessionManager(lookup)

	var capturedAuth string
	downstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	})

	handler := sm.SessionToBearerMiddleware(downstream)

	req := httptest.NewRequest(http.MethodPost, "/farmtable.v1.FarmTableService/ListTasks", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if capturedAuth != "" {
		t.Errorf("Authorization = %q, want empty (no session, no auth)", capturedAuth)
	}
}

func TestSessionMethodNotAllowed(t *testing.T) {
	lookup := newMockLookup()
	sm := NewSessionManager(lookup)

	req := httptest.NewRequest(http.MethodPut, "/api/auth/session", nil)
	rec := httptest.NewRecorder()
	sm.handleSession(rec, req)

	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("PUT: status = %d, want %d", resp.StatusCode, http.StatusMethodNotAllowed)
	}
}

func TestUnifiedHandlerWithSessionRoutes(t *testing.T) {
	lookup := newMockLookup()
	lookup.AddToken("ft_unified", &server.TokenLookupResult{
		UserID:  uuid.New(),
		TokenID: uuid.New(),
	})

	grpcServer := grpc.NewServer()
	defer grpcServer.Stop()

	handler := UnifiedHandler(grpcServer, http.FS(fstest.MapFS{}), UnifiedHandlerOptions{
		TokenLookup: lookup,
	})

	// Test POST /api/auth/session.
	body := bytes.NewBufferString(`{"token":"ft_unified"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/session", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		t.Fatalf("POST /api/auth/session: status = %d, body = %s", resp.StatusCode, bodyBytes)
	}
}

func TestUnifiedHandlerWithoutSessionRoutes(t *testing.T) {
	// When no TokenLookup is provided, session endpoints should not be registered.
	grpcServer := grpc.NewServer()
	defer grpcServer.Stop()

	handler := UnifiedHandler(grpcServer, http.FS(fstest.MapFS{
		"index.html": {Data: []byte("ok")},
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(`{"token":"x"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	resp := rec.Result()
	defer resp.Body.Close()

	// Without session routes, the request falls through to the file server,
	// which returns 404.
	if resp.StatusCode == http.StatusOK {
		t.Fatal("POST /api/auth/session should not succeed without TokenLookup")
	}
}

func TestSessionLogin_NilLookup(t *testing.T) {
	sm := NewSessionManager(nil)

	body := `{"token":"ft_test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	sm.handleSession(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("POST with nil lookup: status = %d, want %d", resp.StatusCode, http.StatusServiceUnavailable)
	}
}
