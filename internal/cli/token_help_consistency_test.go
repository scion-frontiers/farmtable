package cli

import (
	"strings"
	"testing"
)

// Criterion (d), applied to documentation rather than to an error path.
//
// `ft token update` shipped guard rails whose help text states the OLD rule in
// so many words: that a token with no stored scopes is a "legacy wildcard" with
// full access, and that an empty scope set "is interpreted as wildcard (full
// access)". Both sentences were true at faf1c8c. Both are false the moment
// RequireScope stops reading empty as wildcard.
//
// A stale sentence here is worse than a missing one. The operator reaching this
// text is, by definition, the operator holding a scope-less token and trying to
// work out what it can do — and the help tells them it can do everything, while
// the server denies every call. That is the support incident the brief warns
// about, arriving through the documentation instead of through an error.
//
// This oracle is deliberately about the ENFORCED rule, not about phrasing: it
// fails on any claim that an absent or empty scope set confers access.
func TestTokenUpdateHelpDoesNotPromiseWildcardForEmptyScopes(t *testing.T) {
	help := newTokenUpdateCmd(&globalFlags{}).Long

	// Each entry is a claim that contradicts the empty-grants-nothing rule.
	staleClaims := []struct {
		phrase string
		why    string
	}{
		{"legacy wildcard", "an unscoped token is no longer a wildcard; it grants nothing"},
		{"full-access token", "an unscoped token has no access, so nothing can restrict it"},
		{"interpreted as wildcard", "an empty scope set is no longer interpreted as anything but empty"},
	}
	// Normalise whitespace before matching. The help text is hand-wrapped, so a
	// naive substring search silently misses any claim that happens to straddle
	// a line break — which is how "interpreted as wildcard (full access)" slipped
	// past the first draft of this very test.
	lower := strings.Join(strings.Fields(strings.ToLower(help)), " ")
	for _, c := range staleClaims {
		if strings.Contains(lower, c.phrase) {
			t.Errorf("`ft token update --help` still says %q, but %s.\n"+
				"An operator holding a scope-less token reads this text to find out what "+
				"that token can do, and is told the opposite of what the server enforces.",
				c.phrase, c.why)
		}
	}
}

// The counterpart guard: removing the stale claims must not leave the operator
// with no explanation at all. Each guard-rail code must still be documented,
// and the text must state the rule that is actually enforced and the way out.
func TestTokenUpdateHelpExplainsTheEnforcedRule(t *testing.T) {
	help := newTokenUpdateCmd(&globalFlags{}).Long
	lower := strings.Join(strings.Fields(strings.ToLower(help)), " ")

	for _, code := range []string{"UNSCOPED_TOKEN", "WILDCARD_TOKEN", "EMPTY_SCOPES"} {
		if !strings.Contains(help, code) {
			t.Errorf("guard rail %s is no longer documented; the operator sees the code "+
				"in an error with nothing to look it up against", code)
		}
	}
	// The rule itself, and the remedy, must both be present.
	if !strings.Contains(lower, "grants nothing") {
		t.Error("help must state the enforced rule: an empty scope set grants nothing")
	}
	if !strings.Contains(help, "--set-scopes") {
		t.Error("help must name --set-scopes, the command that repairs such a token")
	}
}
