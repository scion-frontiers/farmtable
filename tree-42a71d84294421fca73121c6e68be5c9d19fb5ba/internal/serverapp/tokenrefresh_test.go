package serverapp

import (
	"testing"
	"time"

	"github.com/farmtable-io/farmtable/internal/store/ent/linkedaccount"
	"golang.org/x/oauth2"
)

func TestTokenRefresher_New(t *testing.T) {
	tr := NewTokenRefresher(nil, PlatformRefreshConfigs{})
	if tr == nil {
		t.Fatal("expected non-nil TokenRefresher")
	}
	if tr.interval != defaultRefreshInterval {
		t.Errorf("expected interval %v, got %v", defaultRefreshInterval, tr.interval)
	}
}

func TestTokenRefresher_ConfigForPlatform(t *testing.T) {
	ghCfg := &oauth2.Config{ClientID: "gh"}
	jiraCfg := &oauth2.Config{ClientID: "jira"}
	linearCfg := &oauth2.Config{ClientID: "linear"}

	tr := NewTokenRefresher(nil, PlatformRefreshConfigs{
		GitHub: ghCfg,
		Jira:   jiraCfg,
		Linear: linearCfg,
	})

	tests := []struct {
		platform linkedaccount.Platform
		wantNil  bool
		wantID   string
	}{
		{linkedaccount.PlatformGithub, false, "gh"},
		{linkedaccount.PlatformJira, false, "jira"},
		{linkedaccount.PlatformLinear, false, "linear"},
		{linkedaccount.PlatformAsana, true, ""},
		{linkedaccount.PlatformBeads, true, ""},
	}

	for _, tt := range tests {
		t.Run(string(tt.platform), func(t *testing.T) {
			cfg := tr.configForPlatform(tt.platform)
			if tt.wantNil && cfg != nil {
				t.Error("expected nil config")
			}
			if !tt.wantNil {
				if cfg == nil {
					t.Fatal("expected non-nil config")
				}
				if cfg.ClientID != tt.wantID {
					t.Errorf("expected ClientID %q, got %q", tt.wantID, cfg.ClientID)
				}
			}
		})
	}
}

func TestTokenRefresher_RefreshWindowConstants(t *testing.T) {
	if defaultRefreshInterval != 30*time.Minute {
		t.Errorf("expected 30m interval, got %v", defaultRefreshInterval)
	}
	if refreshWindow != 15*time.Minute {
		t.Errorf("expected 15m refresh window, got %v", refreshWindow)
	}
}
