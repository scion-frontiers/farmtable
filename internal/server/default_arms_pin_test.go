package server_test

import (
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/server"
)

// Characterisation test. This pins what each NAMED arm of
// DefaultScopesForUserType returns today. It asserts nothing about what any of
// them SHOULD return.
//
// Why it exists, and why it is deliberately not a fix:
//
// "admin", "human" and "service_account" all resolve to the wildcard, and
// provisioning.go hardcodes Type: "human" for every OAuth/IAP user — so every
// SSO user is wildcard on first login, and the restricted tiers ("reviewer",
// "orchestrator", "viewer") are close to unreachable because nothing in the
// non-test, non-generated tree ever writes them.
//
// Whether that is the intended posture is an open question with the product
// owner at the time of writing. It is not settled, so it is not this branch's
// to answer: drafting a change while the question is open would quietly make
// the draft the default answer.
//
// So the values are pinned instead. When the posture is decided, whichever way
// it goes, this test fails loudly and names the arm that moved — rather than
// the change landing silently against assertions loose enough to accept it.
// The surrounding branch changes only the DEFAULT arm; every named arm below is
// byte-for-byte what it was at faf1c8c.
func TestPinDefaultScopesForNamedUserTypes(t *testing.T) {
	// Exact expected scope set per type, in the order the implementation
	// returns them.
	pinned := map[string][]string{
		"admin": {server.ScopeWildcard},
		"agent": {
			server.ScopeTaskRead, server.ScopeTaskWrite,
			server.ScopeTaskClaim, server.ScopeCollectionRead,
		},
		"reviewer": {
			server.ScopeTaskRead, server.ScopeTaskWrite, server.ScopeTaskClaim,
			server.ScopeTaskAccept, server.ScopeTaskClose, server.ScopeCollectionRead,
		},
		"orchestrator": {
			server.ScopeTaskRead, server.ScopeTaskWrite, server.ScopeTaskClaim,
			server.ScopeTaskAccept, server.ScopeTaskClose, server.ScopeCollectionRead,
		},
		"viewer":          {server.ScopeTaskRead, server.ScopeCollectionRead},
		"human":           {server.ScopeWildcard},
		"service_account": {server.ScopeWildcard},
	}

	// The vocabulary itself is pinned too: adding or removing a type must show
	// up here, not slip through because the loop only visits what exists.
	known := server.KnownUserTypes()
	if len(known) != len(pinned) {
		t.Errorf("the user type vocabulary changed: KnownUserTypes() = %v (%d), "+
			"but %d types are pinned here. Update this test deliberately, as part "+
			"of the decision that changed it.", known, len(known), len(pinned))
	}

	for _, ut := range known {
		want, ok := pinned[ut]
		if !ok {
			t.Errorf("user type %q is in the vocabulary but not pinned here; add it "+
				"with the scope set the decision intends it to have", ut)
			continue
		}
		got, err := server.DefaultScopesForUserType(ut)
		if err != nil {
			t.Errorf("named type %q must resolve, got error: %v", ut, err)
			continue
		}
		if strings.Join(got, ",") != strings.Join(want, ",") {
			t.Errorf("default scopes for %q changed.\n  was: %v\n  now: %v\n"+
				"If this is the intended outcome of the SSO-privilege decision, update "+
				"the pin in the same commit that makes the change, so the new posture is "+
				"stated explicitly rather than inferred.", ut, want, got)
		}
	}
}

// TestPinWildcardTierMembership states the specific fact the open question is
// about, separately and by name, so it is greppable and so the blast radius of
// any answer is obvious at a glance.
func TestPinWildcardTierMembership(t *testing.T) {
	// These three currently confer unrestricted access.
	for _, ut := range []string{"admin", "human", "service_account"} {
		got, err := server.DefaultScopesForUserType(ut)
		if err != nil {
			t.Fatalf("%q must resolve: %v", ut, err)
		}
		if len(got) != 1 || got[0] != server.ScopeWildcard {
			t.Errorf("%q no longer resolves to wildcard (got %v). That is very likely "+
				"the intended privilege change — update this pin as part of it.", ut, got)
		}
	}
	// And these three currently do not.
	for _, ut := range []string{"reviewer", "orchestrator", "viewer"} {
		got, err := server.DefaultScopesForUserType(ut)
		if err != nil {
			t.Fatalf("%q must resolve: %v", ut, err)
		}
		for _, s := range got {
			if s == server.ScopeWildcard {
				t.Errorf("%q now resolves to wildcard (%v); the restricted tier has "+
					"collapsed into the unrestricted one", ut, got)
			}
		}
	}
}
