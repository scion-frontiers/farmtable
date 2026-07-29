package serverapp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/sessions"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// GoogleOAuthManager handles Google OAuth 2.0 login flows for user
// authentication (as opposed to LinkFlowManager which handles external
// platform account linking). On successful login, a session cookie is
// created with the provisioned user's identity.
type GoogleOAuthManager struct {
	oauthConfig   *oauth2.Config
	sessionStore  sessions.Store
	provisioner   *UserProvisioner

	mu            sync.Mutex
	pendingStates map[string]oauthState
}

type oauthState struct {
	CreatedAt    time.Time
	Redirect     string // post-login redirect URL
	CodeVerifier string // PKCE code verifier
}

// GoogleUserInfo is the response from Google's userinfo endpoint.
type GoogleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	HD            string `json:"hd"` // hosted domain
}

// GoogleOAuthConfig holds configuration for Google OAuth.
type GoogleOAuthConfig struct {
	ClientID     string
	ClientSecret string
	BaseURL      string // e.g. "https://app.farmtable.io"
}

// GoogleOAuthConfigFromEnv reads Google OAuth configuration from environment
// variables. Returns nil if FARMTABLE_GOOGLE_CLIENT_ID is not set.
func GoogleOAuthConfigFromEnv(baseURL string) *GoogleOAuthConfig {
	clientID := os.Getenv("FARMTABLE_GOOGLE_CLIENT_ID")
	if clientID == "" {
		return nil
	}
	return &GoogleOAuthConfig{
		ClientID:     clientID,
		ClientSecret: os.Getenv("FARMTABLE_GOOGLE_CLIENT_SECRET"),
		BaseURL:      baseURL,
	}
}

// NewGoogleOAuthManager creates a new GoogleOAuthManager.
// The sessionStore should be the same store used by SessionManager so
// sessions are shared. If config is nil, the manager is non-functional
// and will return 503 for all requests.
func NewGoogleOAuthManager(config *GoogleOAuthConfig, sessionStore sessions.Store, provisioner *UserProvisioner) *GoogleOAuthManager {
	m := &GoogleOAuthManager{
		sessionStore:  sessionStore,
		provisioner:   provisioner,
		pendingStates: make(map[string]oauthState),
	}

	if config != nil {
		m.oauthConfig = &oauth2.Config{
			ClientID:     config.ClientID,
			ClientSecret: config.ClientSecret,
			Endpoint:     google.Endpoint,
			RedirectURL:  config.BaseURL + "/api/auth/oauth/google/callback",
			Scopes:       []string{"openid", "email", "profile"},
		}
	}

	return m
}

// RegisterRoutes registers the Google OAuth endpoints on the given mux.
func (m *GoogleOAuthManager) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/auth/oauth/google/login", m.handleLogin)
	mux.HandleFunc("/api/auth/oauth/google/callback", m.handleCallback)
}

// isValidRedirect checks that a redirect URI is a relative path and not
// an open-redirect target (e.g. //evil.com or https://evil.com).
func isValidRedirect(uri string) bool {
	return uri != "" &&
		strings.HasPrefix(uri, "/") &&
		!strings.HasPrefix(uri, "//") &&
		!strings.Contains(uri, "://")
}

// handleLogin initiates the OAuth flow by redirecting to Google.
func (m *GoogleOAuthManager) handleLogin(w http.ResponseWriter, r *http.Request) {
	if m.oauthConfig == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "Google OAuth not configured")
		return
	}

	// Clean expired states before adding new ones to prevent unbounded growth.
	m.CleanExpiredOAuthStates()

	state, err := generateState()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to generate state")
		return
	}

	// Optional redirect_uri query param for post-login redirect.
	// Validate to prevent open-redirect attacks.
	redirect := r.URL.Query().Get("redirect_uri")
	if !isValidRedirect(redirect) {
		redirect = "/"
	}

	// Generate PKCE code verifier for defense-in-depth.
	verifier := oauth2.GenerateVerifier()

	m.mu.Lock()
	m.pendingStates[state] = oauthState{
		CreatedAt:    time.Now(),
		Redirect:     redirect,
		CodeVerifier: verifier,
	}
	m.mu.Unlock()

	url := m.oauthConfig.AuthCodeURL(state,
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("prompt", "select_account"),
		oauth2.S256ChallengeOption(verifier),
	)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

// handleCallback handles the OAuth callback from Google.
func (m *GoogleOAuthManager) handleCallback(w http.ResponseWriter, r *http.Request) {
	if m.oauthConfig == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "Google OAuth not configured")
		return
	}

	// Validate state.
	state := r.URL.Query().Get("state")
	m.mu.Lock()
	pending, ok := m.pendingStates[state]
	if ok {
		delete(m.pendingStates, state)
	}
	m.mu.Unlock()
	if !ok {
		writeJSONError(w, http.StatusBadRequest, "invalid or expired state")
		return
	}
	// Reject expired states (10 minute window).
	if time.Since(pending.CreatedAt) > 10*time.Minute {
		writeJSONError(w, http.StatusBadRequest, "state expired")
		return
	}

	// Check for OAuth error response.
	if errParam := r.URL.Query().Get("error"); errParam != "" {
		log.Printf("Google OAuth error: %s — %s", errParam, r.URL.Query().Get("error_description"))
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("OAuth error: %s", errParam))
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		writeJSONError(w, http.StatusBadRequest, "missing code")
		return
	}

	// Exchange code for token with PKCE verifier.
	token, err := m.oauthConfig.Exchange(r.Context(), code, oauth2.VerifierOption(pending.CodeVerifier))
	if err != nil {
		log.Printf("Google OAuth exchange error: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "OAuth exchange failed")
		return
	}

	// Fetch user info from Google.
	userInfo, err := m.fetchUserInfo(r.Context(), token)
	if err != nil {
		log.Printf("Google userinfo fetch error: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "failed to fetch user info")
		return
	}

	if !userInfo.EmailVerified {
		writeJSONError(w, http.StatusForbidden, "email not verified")
		return
	}

	// Provision or find the user.
	result, err := m.provisioner.FindOrCreateByEmail(r.Context(), userInfo.Email, userInfo.Name)
	if err != nil {
		if _, ok := err.(*ErrDomainNotAllowed); ok {
			writeJSONError(w, http.StatusForbidden, err.Error())
			return
		}
		log.Printf("user provisioning error: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "failed to provision user")
		return
	}

	// Create session.
	session, err := m.sessionStore.Get(r, sessionCookieName)
	if err != nil {
		session, _ = m.sessionStore.New(r, sessionCookieName)
	}

	session.Values[sessKeyUserID] = result.User.ID.String()
	session.Values[sessKeyUserName] = result.User.DisplayName
	session.Values[sessKeyUserEmail] = userInfo.Email
	session.Values[sessKeyUserType] = result.User.Type

	// Bridge OAuth session to gRPC auth: create a short-lived API token so
	// SessionToBearerMiddleware can inject a Bearer header for gRPC requests.
	if rawToken, err := m.provisioner.CreateSessionToken(r.Context(), result.User.ID, result.User.Type); err == nil {
		session.Values[sessKeyToken] = rawToken
	} else {
		log.Printf("failed to create session token for OAuth user %s: %v", result.User.ID, err)
	}

	session.Options.Secure = isSecureRequest(r)

	if err := session.Save(r, w); err != nil {
		log.Printf("session save error: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	// Redirect to the original destination.
	redirect := pending.Redirect
	if redirect == "" {
		redirect = "/"
	}
	http.Redirect(w, r, redirect, http.StatusTemporaryRedirect)
}

// fetchUserInfo calls Google's userinfo endpoint to get the user's profile.
func (m *GoogleOAuthManager) fetchUserInfo(ctx context.Context, token *oauth2.Token) (*GoogleUserInfo, error) {
	client := m.oauthConfig.Client(ctx, token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		return nil, fmt.Errorf("userinfo request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("userinfo returned %d: %s", resp.StatusCode, body)
	}

	var info GoogleUserInfo
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&info); err != nil {
		return nil, fmt.Errorf("userinfo decode: %w", err)
	}

	return &info, nil
}

// CleanExpiredOAuthStates removes OAuth states older than 10 minutes.
func (m *GoogleOAuthManager) CleanExpiredOAuthStates() {
	cutoff := time.Now().Add(-10 * time.Minute)
	m.mu.Lock()
	defer m.mu.Unlock()
	for state, st := range m.pendingStates {
		if st.CreatedAt.Before(cutoff) {
			delete(m.pendingStates, state)
		}
	}
}
