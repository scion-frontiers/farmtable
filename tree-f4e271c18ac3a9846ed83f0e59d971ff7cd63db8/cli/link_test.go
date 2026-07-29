package cli

import (
	"os"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
)

func TestResolveLinkToken(t *testing.T) {
	tests := []struct {
		name     string
		flagVal  string
		envVal   string
		wantTok  string
		wantDesc string
	}{
		{
			name:     "flag takes precedence",
			flagVal:  "flag-token",
			envVal:   "env-token",
			wantTok:  "flag-token",
			wantDesc: "flag value should win over env",
		},
		{
			name:     "env var used when no flag",
			flagVal:  "",
			envVal:   "env-token",
			wantTok:  "env-token",
			wantDesc: "env var should be used when flag is empty",
		},
		{
			name:     "empty when no flag or env",
			flagVal:  "",
			envVal:   "",
			wantTok:  "",
			wantDesc: "should return empty when no sources available",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("FARMTABLE_LINK_TOKEN", tt.envVal)

			got := resolveLinkToken(tt.flagVal)
			if got != tt.wantTok {
				t.Fatalf("resolveLinkToken(%q) = %q, want %q (%s)", tt.flagVal, got, tt.wantTok, tt.wantDesc)
			}
		})
	}
}

func TestInferAuthMethod(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		platform pb.Platform
		want     pb.AuthMethod
	}{
		{
			name:     "GitHub defaults to PAT",
			platform: pb.Platform_PLATFORM_GITHUB,
			want:     pb.AuthMethod_AUTH_METHOD_PAT,
		},
		{
			name:     "Linear defaults to API_KEY",
			platform: pb.Platform_PLATFORM_LINEAR,
			want:     pb.AuthMethod_AUTH_METHOD_API_KEY,
		},
		{
			name:     "Jira defaults to API_KEY",
			platform: pb.Platform_PLATFORM_JIRA,
			want:     pb.AuthMethod_AUTH_METHOD_API_KEY,
		},
		{
			name:     "Asana defaults to PAT",
			platform: pb.Platform_PLATFORM_ASANA,
			want:     pb.AuthMethod_AUTH_METHOD_PAT,
		},
		{
			name:     "Farmtable defaults to PAT",
			platform: pb.Platform_PLATFORM_FARMTABLE,
			want:     pb.AuthMethod_AUTH_METHOD_PAT,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := inferAuthMethod(tt.platform)
			if got != tt.want {
				t.Fatalf("inferAuthMethod(%v) = %v, want %v", tt.platform, got, tt.want)
			}
		})
	}
}

func TestInferScopes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		platform pb.Platform
		wantLen  int
	}{
		{
			name:     "GitHub has default scopes",
			platform: pb.Platform_PLATFORM_GITHUB,
			wantLen:  2,
		},
		{
			name:     "Linear has no default scopes",
			platform: pb.Platform_PLATFORM_LINEAR,
			wantLen:  0,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := inferScopes(tt.platform)
			if len(got) != tt.wantLen {
				t.Fatalf("inferScopes(%v) returned %d scopes, want %d", tt.platform, len(got), tt.wantLen)
			}
		})
	}
}

func TestLinkedAccountToMap(t *testing.T) {
	t.Parallel()

	la := &pb.LinkedAccount{
		Id:           "test-uuid",
		CollectionId: "coll-uuid",
		Platform:     pb.Platform_PLATFORM_GITHUB,
		AuthMethod:   pb.AuthMethod_AUTH_METHOD_PAT,
		Scopes:       []string{"repo"},
		Status:       pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_ACTIVE,
	}

	m := linkedAccountToMap(la)

	if m["id"] != "test-uuid" {
		t.Errorf("id = %v, want %q", m["id"], "test-uuid")
	}
	if m["collection_id"] != "coll-uuid" {
		t.Errorf("collection_id = %v, want %q", m["collection_id"], "coll-uuid")
	}
	if m["platform"] != "github" {
		t.Errorf("platform = %v, want %q", m["platform"], "github")
	}
	if m["auth_method"] != "pat" {
		t.Errorf("auth_method = %v, want %q", m["auth_method"], "pat")
	}
	if m["status"] != "ACTIVE" {
		t.Errorf("status = %v, want %q", m["status"], "ACTIVE")
	}
	scopes, ok := m["scopes"].([]string)
	if !ok || len(scopes) != 1 || scopes[0] != "repo" {
		t.Errorf("scopes = %v, want [repo]", m["scopes"])
	}
}

func TestIsTerminal(t *testing.T) {
	t.Parallel()

	// A pipe is not a terminal.
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("os.Pipe() error: %v", err)
	}
	defer r.Close()
	defer w.Close()

	if isTerminal(r) {
		t.Error("expected pipe read-end to NOT be a terminal")
	}
}

func TestLinkedAccountStatusNames(t *testing.T) {
	t.Parallel()

	// Ensure all non-unspecified statuses have display names
	statuses := []pb.LinkedAccountStatus{
		pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_ACTIVE,
		pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_EXPIRED,
		pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_REVOKED,
	}
	for _, s := range statuses {
		if name, ok := linkedAccountStatusNames[s]; !ok || name == "" {
			t.Errorf("linkedAccountStatusNames[%v] = %q, want non-empty", s, name)
		}
	}
}

func TestAuthMethodNames(t *testing.T) {
	t.Parallel()

	// Ensure key auth methods have display names
	methods := []pb.AuthMethod{
		pb.AuthMethod_AUTH_METHOD_PAT,
		pb.AuthMethod_AUTH_METHOD_API_KEY,
		pb.AuthMethod_AUTH_METHOD_GITHUB_APP,
	}
	for _, m := range methods {
		if name, ok := authMethodNames[m]; !ok || name == "" {
			t.Errorf("authMethodNames[%v] = %q, want non-empty", m, name)
		}
	}
}
