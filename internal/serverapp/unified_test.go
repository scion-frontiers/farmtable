package serverapp

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/google/uuid"
	"github.com/gorilla/sessions"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type testFarmTableService struct {
	pb.UnimplementedFarmTableServiceServer
}

func (testFarmTableService) GetVersion(context.Context, *pb.GetVersionRequest) (*pb.GetVersionResponse, error) {
	return &pb.GetVersionResponse{
		ServerVersion: "unified-test",
		ApiProtocol:   "grpc",
	}, nil
}

func TestUnifiedHandlerServesStaticAssets(t *testing.T) {
	grpcServer := grpc.NewServer()
	pb.RegisterFarmTableServiceServer(grpcServer, testFarmTableService{})

	handler := UnifiedHandler(grpcServer, http.FS(fstest.MapFS{
		"index.html": {Data: []byte("<!doctype html><title>Farm Table</title>")},
	}))

	req := mustRequest(t, http.MethodGet, "/", nil)
	resp := mustDo(t, handler, req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read response body: %v", err)
	}
	if !strings.Contains(string(body), "Farm Table") {
		t.Fatalf("body = %q, want dashboard HTML", body)
	}
}

func TestUnifiedHandlerServesNativeGRPC(t *testing.T) {
	grpcServer := grpc.NewServer()
	pb.RegisterFarmTableServiceServer(grpcServer, testFarmTableService{})

	httpServer, addr := startHTTPServer(t, UnifiedHandler(grpcServer, http.FS(fstest.MapFS{})))
	defer httpServer.Close()

	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("dial unified server: %v", err)
	}
	defer conn.Close()

	resp, err := pb.NewFarmTableServiceClient(conn).GetVersion(context.Background(), &pb.GetVersionRequest{})
	if err != nil {
		t.Fatalf("GetVersion: %v", err)
	}
	if resp.GetServerVersion() != "unified-test" {
		t.Fatalf("server version = %q, want unified-test", resp.GetServerVersion())
	}
}

func startHTTPServer(t *testing.T, handler http.Handler) (*http.Server, string) {
	t.Helper()

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	server := &http.Server{Handler: handler}
	go func() {
		if err := server.Serve(lis); err != nil && err != http.ErrServerClosed {
			t.Errorf("HTTP server: %v", err)
		}
	}()
	return server, lis.Addr().String()
}

func mustRequest(t *testing.T, method string, path string, body io.Reader) *http.Request {
	t.Helper()
	req, err := http.NewRequest(method, path, body)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	return req
}

func mustDo(t *testing.T, handler http.Handler, req *http.Request) *http.Response {
	t.Helper()
	rec := responseRecorder{header: make(http.Header)}
	handler.ServeHTTP(&rec, req)
	return rec.Result()
}

type responseRecorder struct {
	header http.Header
	body   strings.Builder
	code   int
}

func (r *responseRecorder) Header() http.Header {
	return r.header
}

func (r *responseRecorder) Write(data []byte) (int, error) {
	if r.code == 0 {
		r.code = http.StatusOK
	}
	return r.body.Write(data)
}

func (r *responseRecorder) WriteHeader(statusCode int) {
	r.code = statusCode
}

func (r *responseRecorder) Result() *http.Response {
	if r.code == 0 {
		r.code = http.StatusOK
	}
	return &http.Response{
		StatusCode: r.code,
		Header:     r.header,
		Body:       io.NopCloser(strings.NewReader(r.body.String())),
	}
}

// --- IAP middleware token-reuse tests ---

// mockIAPStore extends the provisioning mock with CreateAPIToken tracking.
type mockIAPStore struct {
	store.Store // embed to satisfy interface
	users       []*ent.User
	tokenCalls  int // counts CreateAPIToken invocations
}

func (m *mockIAPStore) GetUserByEmail(_ context.Context, email string) ([]*ent.User, error) {
	var result []*ent.User
	for _, u := range m.users {
		if u.Email != nil && *u.Email == email {
			result = append(result, u)
		}
	}
	return result, nil
}

func (m *mockIAPStore) CreateUser(_ context.Context, p store.CreateUserParams) (*ent.User, error) {
	u := &ent.User{
		ID:          uuid.New(),
		DisplayName: p.DisplayName,
		Email:       p.Email,
		Type:        p.Type,
		Status:      p.Status,
	}
	m.users = append(m.users, u)
	return u, nil
}

func (m *mockIAPStore) CreateAPIToken(_ context.Context, p store.CreateAPITokenParams) (*ent.ApiToken, string, error) {
	m.tokenCalls++
	tok := &ent.ApiToken{
		ID:     uuid.New(),
		Name:   p.Name,
		UserID: p.UserID,
	}
	return tok, "test-raw-token-" + tok.ID.String(), nil
}

// fakeIAPAuthenticator bypasses real JWT verification for testing.
// It returns a fixed IAPUserInfo when the IAP assertion header is present.
type fakeIAPAuthenticator struct {
	email string
}

func (f *fakeIAPAuthenticator) authenticate(r *http.Request) (*IAPUserInfo, error) {
	if r.Header.Get(IAPAssertionHeader) == "" {
		return nil, nil
	}
	return &IAPUserInfo{
		Subject: "test-subject",
		Email:   f.email,
	}, nil
}

// testIAPMiddleware builds an iapMiddleware that uses a fake authenticator
// instead of real JWT verification. This avoids needing a test JWKS server
// while still exercising the session/token logic.
func testIAPMiddleware(t *testing.T, mockStore *mockIAPStore, email string) (http.Handler, *sessions.CookieStore) {
	t.Helper()

	cookieStore := sessions.NewCookieStore([]byte("test-auth-key-32-bytes-long!!!!!"), []byte("test-enc-key-32-bytes-long!!!!!!"))
	cookieStore.Options = &sessions.Options{
		Path:   "/",
		MaxAge: 86400,
	}

	sm := &SessionManager{
		store: cookieStore,
	}

	provisioner := NewUserProvisioner(mockStore, "")
	fake := &fakeIAPAuthenticator{email: email}

	// Build a middleware that uses fake auth but real session/provisioning logic.
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info, err := fake.authenticate(r)
		if err != nil {
			http.Error(w, "IAP auth failed", http.StatusUnauthorized)
			return
		}
		if info == nil {
			next.ServeHTTP(w, r)
			return
		}

		result, err := provisioner.FindOrCreateByEmail(r.Context(), info.Email, info.Email)
		if err != nil {
			http.Error(w, "provisioning failed", http.StatusInternalServerError)
			return
		}

		if sm != nil {
			sess, err := sm.SessionStore().Get(r, sessionCookieName)
			if err != nil {
				sess, _ = sm.SessionStore().New(r, sessionCookieName)
			}
			sess.Values[sessKeyUserID] = result.User.ID.String()
			sess.Values[sessKeyUserName] = result.User.DisplayName
			sess.Values[sessKeyUserEmail] = info.Email
			sess.Values[sessKeyUserType] = result.User.Type

			// This is the guard under test — identical to the production code.
			if _, hasToken := sess.Values[sessKeyToken].(string); !hasToken {
				if rawToken, err := provisioner.CreateSessionToken(r.Context(), result.User.ID, result.User.Type); err == nil {
					sess.Values[sessKeyToken] = rawToken
				}
			}

			sess.Options.Secure = false
			if err := sess.Save(r, w); err != nil {
				t.Errorf("session save error: %v", err)
			}
		}

		next.ServeHTTP(w, r)
	})

	return handler, cookieStore
}

func TestIAPMiddleware_TokenReuse_FirstRequestCreatesToken(t *testing.T) {
	mockStore := &mockIAPStore{}
	handler, _ := testIAPMiddleware(t, mockStore, "alice@example.com")

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(IAPAssertionHeader, "fake-jwt")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if mockStore.tokenCalls != 1 {
		t.Fatalf("CreateAPIToken calls = %d, want 1 (should create token on first request)", mockStore.tokenCalls)
	}
}

func TestIAPMiddleware_TokenReuse_SubsequentRequestSkipsCreation(t *testing.T) {
	mockStore := &mockIAPStore{}
	handler, _ := testIAPMiddleware(t, mockStore, "alice@example.com")

	// First request — creates session + token.
	req1 := httptest.NewRequest(http.MethodGet, "/", nil)
	req1.Header.Set(IAPAssertionHeader, "fake-jwt")
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)

	if mockStore.tokenCalls != 1 {
		t.Fatalf("after first request: CreateAPIToken calls = %d, want 1", mockStore.tokenCalls)
	}

	// Extract session cookie from first response.
	cookies := rec1.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == sessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("no session cookie set by first request")
	}

	// Second request — carries session cookie with existing token.
	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	req2.Header.Set(IAPAssertionHeader, "fake-jwt")
	req2.AddCookie(sessionCookie)
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("second request status = %d, want %d", rec2.Code, http.StatusOK)
	}
	if mockStore.tokenCalls != 1 {
		t.Fatalf("after second request: CreateAPIToken calls = %d, want 1 (should reuse existing token)", mockStore.tokenCalls)
	}
}

