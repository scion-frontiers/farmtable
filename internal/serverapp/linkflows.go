package serverapp

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
)

// PlatformOAuthConfig holds per-platform OAuth2 configuration.
type PlatformOAuthConfig struct {
	GitHub *oauth2.Config
	Jira   *oauth2.Config
	Linear *oauth2.Config
}

// LinkFlowManager handles OAuth link flows for external platforms.
type LinkFlowManager struct {
	store        store.Store
	oauthConfigs PlatformOAuthConfig
	baseURL      string // e.g. "https://app.farmtable.io"
	// In-memory state map for CSRF protection. In production, use a
	// proper session/redis-backed store. Maps state → collectionID.
	pendingStates map[string]linkState
}

type linkState struct {
	CollectionID uuid.UUID
	Platform     string
	CreatedAt    time.Time
}

// NewLinkFlowManager creates a LinkFlowManager from environment variables.
func NewLinkFlowManager(s store.Store, baseURL string) *LinkFlowManager {
	lm := &LinkFlowManager{
		store:         s,
		baseURL:       baseURL,
		pendingStates: make(map[string]linkState),
	}

	// GitHub App / OAuth App
	if clientID := os.Getenv("FARMTABLE_GITHUB_CLIENT_ID"); clientID != "" {
		lm.oauthConfigs.GitHub = &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: os.Getenv("FARMTABLE_GITHUB_CLIENT_SECRET"),
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://github.com/login/oauth/authorize",
				TokenURL: "https://github.com/login/oauth/access_token",
			},
			RedirectURL: baseURL + "/api/link/github/callback",
			Scopes:      []string{"repo", "read:org"},
		}
	}

	// Jira (OAuth 2.0 3LO)
	if clientID := os.Getenv("FARMTABLE_JIRA_CLIENT_ID"); clientID != "" {
		lm.oauthConfigs.Jira = &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: os.Getenv("FARMTABLE_JIRA_CLIENT_SECRET"),
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://auth.atlassian.com/authorize",
				TokenURL: "https://auth.atlassian.com/oauth/token",
			},
			RedirectURL: baseURL + "/api/link/jira/callback",
			Scopes:      []string{"read:jira-work", "write:jira-work", "offline_access"},
		}
	}

	// Linear
	if clientID := os.Getenv("FARMTABLE_LINEAR_CLIENT_ID"); clientID != "" {
		lm.oauthConfigs.Linear = &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: os.Getenv("FARMTABLE_LINEAR_CLIENT_SECRET"),
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://linear.app/oauth/authorize",
				TokenURL: "https://api.linear.app/oauth/token",
			},
			RedirectURL: baseURL + "/api/link/linear/callback",
			Scopes:      []string{"read", "write"},
		}
	}

	return lm
}

// RegisterRoutes registers the OAuth link flow routes on the given mux.
func (lm *LinkFlowManager) RegisterRoutes(mux *http.ServeMux) {
	// GitHub
	mux.HandleFunc("/api/link/github/install", lm.handleGitHubInstall)
	mux.HandleFunc("/api/link/github/callback", lm.handleGitHubCallback)

	// Jira
	mux.HandleFunc("/api/link/jira/connect", lm.handleJiraConnect)
	mux.HandleFunc("/api/link/jira/callback", lm.handleJiraCallback)

	// Linear
	mux.HandleFunc("/api/link/linear/connect", lm.handleLinearConnect)
	mux.HandleFunc("/api/link/linear/callback", lm.handleLinearCallback)
}

// generateState creates a random state string for CSRF protection.
func generateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// ── GitHub ──

func (lm *LinkFlowManager) handleGitHubInstall(w http.ResponseWriter, r *http.Request) {
	if lm.oauthConfigs.GitHub == nil {
		http.Error(w, "GitHub OAuth not configured", http.StatusServiceUnavailable)
		return
	}

	collectionID, err := uuid.Parse(r.URL.Query().Get("collection_id"))
	if err != nil {
		http.Error(w, "missing or invalid collection_id", http.StatusBadRequest)
		return
	}

	state, err := generateState()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	lm.pendingStates[state] = linkState{
		CollectionID: collectionID,
		Platform:     "github",
		CreatedAt:    time.Now(),
	}

	url := lm.oauthConfigs.GitHub.AuthCodeURL(state, oauth2.AccessTypeOffline)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (lm *LinkFlowManager) handleGitHubCallback(w http.ResponseWriter, r *http.Request) {
	if lm.oauthConfigs.GitHub == nil {
		http.Error(w, "GitHub OAuth not configured", http.StatusServiceUnavailable)
		return
	}

	state := r.URL.Query().Get("state")
	ls, ok := lm.pendingStates[state]
	if !ok {
		http.Error(w, "invalid or expired state", http.StatusBadRequest)
		return
	}
	delete(lm.pendingStates, state)

	if ls.Platform != "github" {
		http.Error(w, "state/platform mismatch", http.StatusBadRequest)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	token, err := lm.oauthConfigs.GitHub.Exchange(context.Background(), code)
	if err != nil {
		log.Printf("GitHub OAuth exchange error: %v", err)
		http.Error(w, "OAuth exchange failed", http.StatusInternalServerError)
		return
	}

	params := store.CreateLinkedAccountParams{
		CollectionID:  ls.CollectionID,
		Platform:      "github",
		AuthToken:     token.AccessToken,
		AuthMethod:    "oauth",
		ScopesGranted: lm.oauthConfigs.GitHub.Scopes,
	}
	if token.RefreshToken != "" {
		params.RefreshToken = token.RefreshToken
	}
	if !token.Expiry.IsZero() {
		params.TokenExpiry = &token.Expiry
	}

	la, err := lm.store.CreateLinkedAccount(context.Background(), params)
	if err != nil {
		log.Printf("creating GitHub linked account: %v", err)
		http.Error(w, "failed to create linked account", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"id":       la.ID.String(),
		"platform": "github",
		"status":   "active",
	})
}

// ── Jira ──

func (lm *LinkFlowManager) handleJiraConnect(w http.ResponseWriter, r *http.Request) {
	if lm.oauthConfigs.Jira == nil {
		http.Error(w, "Jira OAuth not configured", http.StatusServiceUnavailable)
		return
	}

	collectionID, err := uuid.Parse(r.URL.Query().Get("collection_id"))
	if err != nil {
		http.Error(w, "missing or invalid collection_id", http.StatusBadRequest)
		return
	}

	state, err := generateState()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	lm.pendingStates[state] = linkState{
		CollectionID: collectionID,
		Platform:     "jira",
		CreatedAt:    time.Now(),
	}

	// Jira 3LO requires audience parameter
	url := lm.oauthConfigs.Jira.AuthCodeURL(state,
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("audience", "api.atlassian.com"),
		oauth2.SetAuthURLParam("prompt", "consent"),
	)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (lm *LinkFlowManager) handleJiraCallback(w http.ResponseWriter, r *http.Request) {
	if lm.oauthConfigs.Jira == nil {
		http.Error(w, "Jira OAuth not configured", http.StatusServiceUnavailable)
		return
	}

	state := r.URL.Query().Get("state")
	ls, ok := lm.pendingStates[state]
	if !ok {
		http.Error(w, "invalid or expired state", http.StatusBadRequest)
		return
	}
	delete(lm.pendingStates, state)

	if ls.Platform != "jira" {
		http.Error(w, "state/platform mismatch", http.StatusBadRequest)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	token, err := lm.oauthConfigs.Jira.Exchange(context.Background(), code)
	if err != nil {
		log.Printf("Jira OAuth exchange error: %v", err)
		http.Error(w, "OAuth exchange failed", http.StatusInternalServerError)
		return
	}

	params := store.CreateLinkedAccountParams{
		CollectionID:  ls.CollectionID,
		Platform:      "jira",
		AuthToken:     token.AccessToken,
		AuthMethod:    "oauth",
		ScopesGranted: lm.oauthConfigs.Jira.Scopes,
	}
	if token.RefreshToken != "" {
		params.RefreshToken = token.RefreshToken
	}
	if !token.Expiry.IsZero() {
		params.TokenExpiry = &token.Expiry
	}

	la, err := lm.store.CreateLinkedAccount(context.Background(), params)
	if err != nil {
		log.Printf("creating Jira linked account: %v", err)
		http.Error(w, "failed to create linked account", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"id":       la.ID.String(),
		"platform": "jira",
		"status":   "active",
	})
}

// ── Linear ──

func (lm *LinkFlowManager) handleLinearConnect(w http.ResponseWriter, r *http.Request) {
	if lm.oauthConfigs.Linear == nil {
		http.Error(w, "Linear OAuth not configured", http.StatusServiceUnavailable)
		return
	}

	collectionID, err := uuid.Parse(r.URL.Query().Get("collection_id"))
	if err != nil {
		http.Error(w, "missing or invalid collection_id", http.StatusBadRequest)
		return
	}

	state, err := generateState()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	lm.pendingStates[state] = linkState{
		CollectionID: collectionID,
		Platform:     "linear",
		CreatedAt:    time.Now(),
	}

	url := lm.oauthConfigs.Linear.AuthCodeURL(state, oauth2.AccessTypeOffline)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (lm *LinkFlowManager) handleLinearCallback(w http.ResponseWriter, r *http.Request) {
	if lm.oauthConfigs.Linear == nil {
		http.Error(w, "Linear OAuth not configured", http.StatusServiceUnavailable)
		return
	}

	state := r.URL.Query().Get("state")
	ls, ok := lm.pendingStates[state]
	if !ok {
		http.Error(w, "invalid or expired state", http.StatusBadRequest)
		return
	}
	delete(lm.pendingStates, state)

	if ls.Platform != "linear" {
		http.Error(w, "state/platform mismatch", http.StatusBadRequest)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	token, err := lm.oauthConfigs.Linear.Exchange(context.Background(), code)
	if err != nil {
		log.Printf("Linear OAuth exchange error: %v", err)
		http.Error(w, "OAuth exchange failed", http.StatusInternalServerError)
		return
	}

	params := store.CreateLinkedAccountParams{
		CollectionID:  ls.CollectionID,
		Platform:      "linear",
		AuthToken:     token.AccessToken,
		AuthMethod:    "oauth",
		ScopesGranted: lm.oauthConfigs.Linear.Scopes,
	}
	if token.RefreshToken != "" {
		params.RefreshToken = token.RefreshToken
	}
	if !token.Expiry.IsZero() {
		params.TokenExpiry = &token.Expiry
	}

	la, err := lm.store.CreateLinkedAccount(context.Background(), params)
	if err != nil {
		log.Printf("creating Linear linked account: %v", err)
		http.Error(w, "failed to create linked account", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"id":       la.ID.String(),
		"platform": "linear",
		"status":   "active",
	})
}

// CleanExpiredStates removes link states older than 10 minutes.
// Should be called periodically to prevent memory leaks.
func (lm *LinkFlowManager) CleanExpiredStates() {
	cutoff := time.Now().Add(-10 * time.Minute)
	for state, ls := range lm.pendingStates {
		if ls.CreatedAt.Before(cutoff) {
			delete(lm.pendingStates, state)
		}
	}
}

// LinkFlowResult provides result info for programmatic callers.
type LinkFlowResult struct {
	AccountID uuid.UUID `json:"account_id"`
	Platform  string    `json:"platform"`
	Status    string    `json:"status"`
	Message   string    `json:"message,omitempty"`
}

// FormatPlatformAuthURL generates the URL a user should visit to begin linking.
func (lm *LinkFlowManager) FormatPlatformAuthURL(platform string, collectionID uuid.UUID) (string, error) {
	switch platform {
	case "github":
		return fmt.Sprintf("%s/api/link/github/install?collection_id=%s", lm.baseURL, collectionID), nil
	case "jira":
		return fmt.Sprintf("%s/api/link/jira/connect?collection_id=%s", lm.baseURL, collectionID), nil
	case "linear":
		return fmt.Sprintf("%s/api/link/linear/connect?collection_id=%s", lm.baseURL, collectionID), nil
	default:
		return "", fmt.Errorf("unsupported platform: %s", platform)
	}
}
