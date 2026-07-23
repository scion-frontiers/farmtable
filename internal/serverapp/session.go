package serverapp

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/sessions"

	"github.com/farmtable-io/farmtable/internal/server"
)

const (
	sessionCookieName = "farmtable_session"
	sessKeyToken      = "token"
	sessKeyUserID     = "user_id"
	sessKeyUserName   = "user_name"
	sessKeyUserEmail  = "user_email"
	sessKeyUserType   = "user_type"
)

// SessionInfo is the JSON response returned by session endpoints.
type SessionInfo struct {
	UserID   string `json:"userId"`
	UserName string `json:"userName"`
	Email    string `json:"email,omitempty"`
	UserType string `json:"userType,omitempty"`
}

// SessionManager manages HTTP session endpoints and the
// session-to-bearer middleware bridge.
type SessionManager struct {
	store  sessions.Store
	lookup server.TokenLookup
}

// NewSessionManager creates a SessionManager with an encrypted cookie store.
// The session key is derived from FARMTABLE_SESSION_KEY env var. If not set,
// a random key is generated and logged (suitable for development).
func NewSessionManager(lookup server.TokenLookup) *SessionManager {
	keys := deriveSessionKeys()
	cookieStore := sessions.NewCookieStore(keys.authKey, keys.encKey)
	cookieStore.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 30, // 30 days
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		// Secure is set dynamically per-request in the handlers.
	}
	return &SessionManager{
		store:  cookieStore,
		lookup: lookup,
	}
}

// sessionKeyPair holds separate keys for HMAC authentication and AES encryption.
type sessionKeyPair struct {
	authKey []byte // HMAC-SHA256 authentication key
	encKey  []byte // AES-256 encryption key
}

// deriveSessionKeys reads FARMTABLE_SESSION_KEY or generates random keys.
// Returns separate keys for HMAC auth and AES encryption to avoid key
// separation failures from using the same key material for both primitives.
func deriveSessionKeys() sessionKeyPair {
	if envKey := os.Getenv("FARMTABLE_SESSION_KEY"); envKey != "" {
		authKey := sha256.Sum256(append([]byte("auth:"), []byte(envKey)...))
		encKey := sha256.Sum256(append([]byte("enc:"), []byte(envKey)...))
		return sessionKeyPair{authKey: authKey[:], encKey: encKey[:]}
	}
	key := make([]byte, 64)
	if _, err := rand.Read(key); err != nil {
		panic(fmt.Sprintf("failed to generate session key: %v", err))
	}
	log.Println("No FARMTABLE_SESSION_KEY set — generated random session key (sessions will not survive restart)")
	return sessionKeyPair{authKey: key[:32], encKey: key[32:]}
}

// isSecureRequest returns true when the request arrived over HTTPS
// (directly or behind a reverse proxy).
func isSecureRequest(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	if strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		return true
	}
	return false
}

// RegisterRoutes registers the /api/auth/session endpoints on the given mux.
func (sm *SessionManager) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/auth/session", sm.handleSession)
}

func (sm *SessionManager) handleSession(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		sm.handleLogin(w, r)
	case http.MethodGet:
		sm.handleGetSession(w, r)
	case http.MethodDelete:
		sm.handleLogout(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleLogin validates a token and creates a session cookie.
func (sm *SessionManager) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token string `json:"token"`
	}
	// Limit request body size to prevent denial-of-service via large payloads.
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Token == "" {
		writeJSONError(w, http.StatusBadRequest, "token is required")
		return
	}

	if sm.lookup == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "authentication not configured")
		return
	}

	// Validate the token against the store.
	h := sha256.Sum256([]byte(body.Token))
	hash := hex.EncodeToString(h[:])

	result, err := sm.lookup.LookupByHash(r.Context(), hash)
	if err != nil {
		writeJSONError(w, http.StatusUnauthorized, "invalid token")
		return
	}

	if result.ExpiresAt != nil && result.ExpiresAt.Before(time.Now()) {
		writeJSONError(w, http.StatusUnauthorized, "token expired")
		return
	}

	// Record usage.
	sm.lookup.RecordUsage(r.Context(), result.TokenID)

	// Look up the user to get display info. We use the store's User edge
	// loaded by LookupByHash. Since TokenLookup doesn't expose the user
	// details directly, we'll store the UserID and let the GET endpoint
	// return what we have. For the session we store the token itself so
	// the session-to-bearer middleware can inject it.
	session, err := sm.store.Get(r, sessionCookieName)
	if err != nil {
		// Corrupted session — create a new one.
		session, _ = sm.store.New(r, sessionCookieName)
	}

	session.Values[sessKeyToken] = body.Token
	session.Values[sessKeyUserID] = result.UserID.String()

	// Set secure flag based on the request.
	session.Options.Secure = isSecureRequest(r)

	if err := session.Save(r, w); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	info := SessionInfo{
		UserID: result.UserID.String(),
	}
	writeJSON(w, http.StatusOK, info)
}

// handleGetSession returns the current session info.
func (sm *SessionManager) handleGetSession(w http.ResponseWriter, r *http.Request) {
	session, err := sm.store.Get(r, sessionCookieName)
	if err != nil || session.IsNew {
		writeJSONError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	token, _ := session.Values[sessKeyToken].(string)
	if token == "" {
		writeJSONError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	// Re-validate the token to ensure it hasn't been revoked.
	if sm.lookup != nil {
		h := sha256.Sum256([]byte(token))
		hash := hex.EncodeToString(h[:])
		result, err := sm.lookup.LookupByHash(r.Context(), hash)
		if err != nil || (result.ExpiresAt != nil && result.ExpiresAt.Before(time.Now())) {
			// Token revoked or expired — clear the session.
			session.Options.MaxAge = -1
			session.Options.Secure = isSecureRequest(r)
			if saveErr := session.Save(r, w); saveErr != nil {
				log.Printf("warning: failed to clear revoked session: %v", saveErr)
			}
			writeJSONError(w, http.StatusUnauthorized, "session expired")
			return
		}
	}

	info := SessionInfo{
		UserID:   stringVal(session.Values[sessKeyUserID]),
		UserName: stringVal(session.Values[sessKeyUserName]),
		Email:    stringVal(session.Values[sessKeyUserEmail]),
		UserType: stringVal(session.Values[sessKeyUserType]),
	}
	writeJSON(w, http.StatusOK, info)
}

// handleLogout clears the session cookie.
func (sm *SessionManager) handleLogout(w http.ResponseWriter, r *http.Request) {
	session, err := sm.store.Get(r, sessionCookieName)
	if err != nil {
		// Even if the session is corrupt, clear the cookie.
		session, _ = sm.store.New(r, sessionCookieName)
	}

	session.Options.MaxAge = -1
	session.Options.Secure = isSecureRequest(r)
	if err := session.Save(r, w); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to clear session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// SessionStore returns the underlying gorilla sessions.Store, allowing other
// components (e.g. GoogleOAuthManager) to share the same session backend.
func (sm *SessionManager) SessionStore() sessions.Store {
	return sm.store
}

// SessionToBearerMiddleware wraps an HTTP handler and injects Authorization
// and X-Farmtable-Token headers from the session cookie when no Authorization
// header is already present. This bridges cookie-based web sessions to the
// Bearer-token authentication expected by the gRPC auth interceptor.
func (sm *SessionManager) SessionToBearerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// If the caller already supplied an Authorization header, pass through.
		if r.Header.Get("Authorization") != "" {
			next.ServeHTTP(w, r)
			return
		}

		session, err := sm.store.Get(r, sessionCookieName)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}

		token, _ := session.Values[sessKeyToken].(string)
		if token == "" {
			next.ServeHTTP(w, r)
			return
		}

		// Clone the request to avoid mutating the original.
		r2 := r.Clone(r.Context())
		r2.Header.Set("Authorization", "Bearer "+token)
		r2.Header.Set("X-Farmtable-Token", token)

		next.ServeHTTP(w, r2)
	})
}

func stringVal(v interface{}) string {
	s, _ := v.(string)
	return s
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
