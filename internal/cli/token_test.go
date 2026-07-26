package cli

import (
	"reflect"
	"testing"
)

func TestMergeScopes(t *testing.T) {
	tests := []struct {
		name    string
		current []string
		add     []string
		remove  []string
		set     []string
		want    []string
		wantErr string
	}{
		{
			name:    "add scope to existing set",
			current: []string{"task:read", "task:write"},
			add:     []string{"task:close"},
			want:    []string{"task:close", "task:read", "task:write"},
		},
		{
			name:    "remove scope from existing set",
			current: []string{"task:read", "task:write", "task:claim"},
			remove:  []string{"task:claim"},
			want:    []string{"task:read", "task:write"},
		},
		{
			name:    "combined add and remove",
			current: []string{"task:read", "task:write"},
			add:     []string{"task:close"},
			remove:  []string{"task:write"},
			want:    []string{"task:close", "task:read"},
		},
		{
			name:    "set replaces all scopes",
			current: []string{"task:read", "task:write"},
			set:     []string{"task:claim", "collection:read"},
			want:    []string{"collection:read", "task:claim"},
		},
		{
			name:    "add duplicate is idempotent",
			current: []string{"task:read", "task:write"},
			add:     []string{"task:read"},
			want:    []string{"task:read", "task:write"},
		},
		{
			name:    "remove nonexistent is silent",
			current: []string{"task:read", "task:write"},
			remove:  []string{"task:claim"},
			want:    []string{"task:read", "task:write"},
		},

		// C1: removing all scopes must error (would escalate to wildcard)
		{
			name:    "C1: remove all scopes errors instead of escalating to wildcard",
			current: []string{"task:read"},
			remove:  []string{"task:read"},
			wantErr: "refusing to write an empty scope set",
		},
		{
			name:    "C1: remove all from multi-scope token",
			current: []string{"task:read", "task:write"},
			remove:  []string{"task:read", "task:write"},
			wantErr: "refusing to write an empty scope set",
		},

		// H1: add/remove on nil-scope (wildcard) token must error
		{
			name:    "H1: add on nil-scope token errors",
			current: nil,
			add:     []string{"task:close"},
			wantErr: "token has no stored scopes",
		},
		{
			name:    "H1: add on empty-scope token errors",
			current: []string{},
			add:     []string{"task:close"},
			wantErr: "token has no stored scopes",
		},
		{
			name:    "H1: remove on nil-scope token errors",
			current: nil,
			remove:  []string{"task:read"},
			wantErr: "token has no stored scopes",
		},

		// H2: remove on wildcard ["*"] token must error
		{
			name:    "H2: remove on wildcard token errors",
			current: []string{"*"},
			remove:  []string{"task:close"},
			wantErr: "token holds the wildcard scope",
		},
		{
			name:    "H2: add on wildcard token without remove is still silently demoting",
			current: []string{"*"},
			add:     []string{"task:close"},
			// This SHOULD succeed — adding to ["*"] yields ["*", "task:close"],
			// which is still wildcard (RequireScope checks for "*" in the list).
			want: []string{"*", "task:close"},
		},

		// set-scopes on nil/empty/wildcard is fine — it's explicit intent
		{
			name:    "set on nil-scope token works",
			current: nil,
			set:     []string{"task:read", "task:write"},
			want:    []string{"task:read", "task:write"},
		},
		{
			name:    "set on wildcard token works",
			current: []string{"*"},
			set:     []string{"task:read"},
			want:    []string{"task:read"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := mergeScopes(tt.current, tt.add, tt.remove, tt.set)
			if tt.wantErr != "" {
				if err == nil {
					t.Fatalf("mergeScopes() = %v, want error containing %q", got, tt.wantErr)
				}
				if !containsSubstr(err.Error(), tt.wantErr) {
					t.Fatalf("mergeScopes() error = %q, want error containing %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("mergeScopes() unexpected error: %v", err)
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("mergeScopes() = %v, want %v", got, tt.want)
			}
		})
	}
}

func containsSubstr(s, substr string) bool {
	return len(s) >= len(substr) && searchSubstr(s, substr)
}

func searchSubstr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
