package serverapp

import (
	"testing"
)

func TestParseAuthMode(t *testing.T) {
	tests := []struct {
		input   string
		want    AuthMode
		wantErr bool
	}{
		{"token", AuthModeToken, false},
		{"TOKEN", AuthModeToken, false},
		{"Token", AuthModeToken, false},
		{"", AuthModeToken, false}, // default
		{"oauth", AuthModeOAuth, false},
		{"OAuth", AuthModeOAuth, false},
		{"OAUTH", AuthModeOAuth, false},
		{"proxy", AuthModeProxy, false},
		{"Proxy", AuthModeProxy, false},
		{"PROXY", AuthModeProxy, false},
		{" oauth ", AuthModeOAuth, false}, // whitespace trimmed
		{"invalid", AuthModeToken, true},
		{"basic", AuthModeToken, true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, err := ParseAuthMode(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseAuthMode(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("ParseAuthMode(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestAuthMode_String(t *testing.T) {
	tests := []struct {
		mode AuthMode
		want string
	}{
		{AuthModeToken, "token"},
		{AuthModeOAuth, "oauth"},
		{AuthModeProxy, "proxy"},
		{AuthMode(99), "AuthMode(99)"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			if got := tt.mode.String(); got != tt.want {
				t.Errorf("AuthMode(%d).String() = %q, want %q", tt.mode, got, tt.want)
			}
		})
	}
}

func TestAuthMode_Roundtrip(t *testing.T) {
	// Every named mode should roundtrip through String → Parse.
	for _, mode := range []AuthMode{AuthModeToken, AuthModeOAuth, AuthModeProxy} {
		s := mode.String()
		got, err := ParseAuthMode(s)
		if err != nil {
			t.Errorf("roundtrip failed for %v: %v", mode, err)
		}
		if got != mode {
			t.Errorf("roundtrip: ParseAuthMode(%q) = %v, want %v", s, got, mode)
		}
	}
}
