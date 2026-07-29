package serverapp

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/oauth2"
)

func mockOAuthConfig() oauth2.Config {
	return oauth2.Config{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://example.com/auth",
			TokenURL: "https://example.com/token",
		},
		RedirectURL: "https://example.com/callback",
		Scopes:      []string{"read"},
	}
}

func ptrOAuthConfig(c oauth2.Config) *oauth2.Config {
	return &c
}

func TestLinkFlowManager_RegisterRoutes(t *testing.T) {
	// Verify that RegisterRoutes does not panic and routes are registered.
	lm := &LinkFlowManager{
		pendingStates: make(map[string]linkState),
	}
	mux := http.NewServeMux()
	lm.RegisterRoutes(mux)
	// If we got here without a panic, routes were registered successfully.
}

func TestLinkFlowManager_GitHubInstall_NotConfigured(t *testing.T) {
	lm := &LinkFlowManager{
		pendingStates: make(map[string]linkState),
	}

	req := httptest.NewRequest("GET", "/api/link/github/install?collection_id="+uuid.New().String(), nil)
	w := httptest.NewRecorder()

	lm.handleGitHubInstall(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestLinkFlowManager_GitHubInstall_MissingCollectionID(t *testing.T) {
	lm := &LinkFlowManager{
		pendingStates: make(map[string]linkState),
		oauthConfigs: PlatformOAuthConfig{
			GitHub: ptrOAuthConfig(mockOAuthConfig()),
		},
	}

	req := httptest.NewRequest("GET", "/api/link/github/install", nil)
	w := httptest.NewRecorder()

	lm.handleGitHubInstall(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestLinkFlowManager_GitHubCallback_InvalidState(t *testing.T) {
	lm := &LinkFlowManager{
		pendingStates: make(map[string]linkState),
		oauthConfigs: PlatformOAuthConfig{
			GitHub: ptrOAuthConfig(mockOAuthConfig()),
		},
	}

	req := httptest.NewRequest("GET", "/api/link/github/callback?state=invalid&code=test", nil)
	w := httptest.NewRecorder()

	lm.handleGitHubCallback(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestLinkFlowManager_JiraConnect_NotConfigured(t *testing.T) {
	lm := &LinkFlowManager{
		pendingStates: make(map[string]linkState),
	}

	req := httptest.NewRequest("GET", "/api/link/jira/connect?collection_id="+uuid.New().String(), nil)
	w := httptest.NewRecorder()

	lm.handleJiraConnect(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestLinkFlowManager_LinearConnect_NotConfigured(t *testing.T) {
	lm := &LinkFlowManager{
		pendingStates: make(map[string]linkState),
	}

	req := httptest.NewRequest("GET", "/api/link/linear/connect?collection_id="+uuid.New().String(), nil)
	w := httptest.NewRecorder()

	lm.handleLinearConnect(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestLinkFlowManager_GitHubCallback_MissingCode(t *testing.T) {
	cid := uuid.New()
	lm := &LinkFlowManager{
		pendingStates: map[string]linkState{
			"test-state": {CollectionID: cid, Platform: "github"},
		},
		oauthConfigs: PlatformOAuthConfig{
			GitHub: ptrOAuthConfig(mockOAuthConfig()),
		},
	}

	req := httptest.NewRequest("GET", "/api/link/github/callback?state=test-state", nil)
	w := httptest.NewRecorder()

	lm.handleGitHubCallback(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestLinkFlowManager_CleanExpiredStates(t *testing.T) {
	lm := &LinkFlowManager{
		pendingStates: make(map[string]linkState),
	}

	// Add a fresh state and an old state.
	lm.pendingStates["fresh"] = linkState{
		CollectionID: uuid.New(),
		Platform:     "github",
		CreatedAt:    time.Now(),
	}
	lm.pendingStates["old"] = linkState{
		CollectionID: uuid.New(),
		Platform:     "github",
		CreatedAt:    time.Now().Add(-15 * time.Minute),
	}

	lm.CleanExpiredStates()

	if _, ok := lm.pendingStates["fresh"]; !ok {
		t.Error("fresh state should still exist")
	}
	if _, ok := lm.pendingStates["old"]; ok {
		t.Error("old state should have been cleaned")
	}
}

func TestLinkFlowManager_FormatPlatformAuthURL(t *testing.T) {
	lm := &LinkFlowManager{
		baseURL: "https://app.farmtable.io",
	}
	cid := uuid.New()

	tests := []struct {
		platform string
		wantErr  bool
		contains string
	}{
		{"github", false, "/api/link/github/install"},
		{"jira", false, "/api/link/jira/connect"},
		{"linear", false, "/api/link/linear/connect"},
		{"unknown", true, ""},
	}

	for _, tt := range tests {
		t.Run(tt.platform, func(t *testing.T) {
			url, err := lm.FormatPlatformAuthURL(tt.platform, cid)
			if (err != nil) != tt.wantErr {
				t.Errorf("error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && !contains(url, tt.contains) {
				t.Errorf("URL %q should contain %q", url, tt.contains)
			}
		})
	}
}

func TestGenerateState(t *testing.T) {
	state1, err := generateState()
	if err != nil {
		t.Fatalf("generateState: %v", err)
	}
	state2, err := generateState()
	if err != nil {
		t.Fatalf("generateState: %v", err)
	}

	if state1 == state2 {
		t.Error("expected unique states")
	}
	if len(state1) != 32 { // 16 bytes = 32 hex chars
		t.Errorf("expected 32-char state, got %d", len(state1))
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (substr == "" || indexSubstring(s, substr) >= 0)
}

func indexSubstring(s, substr string) int {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

