package serverapp

import (
	"fmt"
	"os"
	"strings"
)

// AuthMode determines how the server authenticates users.
type AuthMode int

const (
	// AuthModeToken uses API token authentication (default, existing behavior).
	// The server validates tokens via the store-backed TokenLookup.
	AuthModeToken AuthMode = iota

	// AuthModeOAuth uses Google OAuth 2.0 for user login.
	// Users authenticate via /api/auth/oauth/google/login and receive a
	// session cookie tied to a provisioned user account.
	AuthModeOAuth

	// AuthModeProxy trusts a reverse proxy (e.g. Google Cloud IAP) to
	// authenticate users. The proxy sets X-Goog-IAP-JWT-Assertion with a
	// signed JWT; the server verifies the JWT and provisions users by email.
	AuthModeProxy
)

// String returns the string representation of the AuthMode.
func (m AuthMode) String() string {
	switch m {
	case AuthModeToken:
		return "token"
	case AuthModeOAuth:
		return "oauth"
	case AuthModeProxy:
		return "proxy"
	default:
		return fmt.Sprintf("AuthMode(%d)", int(m))
	}
}

// ParseAuthMode parses a string into an AuthMode.
// Valid values: "token", "oauth", "proxy" (case-insensitive).
func ParseAuthMode(s string) (AuthMode, error) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "token", "":
		return AuthModeToken, nil
	case "oauth":
		return AuthModeOAuth, nil
	case "proxy":
		return AuthModeProxy, nil
	default:
		return AuthModeToken, fmt.Errorf("invalid auth mode %q: must be token, oauth, or proxy", s)
	}
}

// AuthModeFromEnv reads FARMTABLE_AUTH_MODE and returns the configured AuthMode.
// Defaults to AuthModeToken if unset.
func AuthModeFromEnv() (AuthMode, error) {
	return ParseAuthMode(os.Getenv("FARMTABLE_AUTH_MODE"))
}
