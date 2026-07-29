package server_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/server"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// The tests in this file are the oracles for "an unrecognised user type must be
// REJECTED, never silently allowed and never silently dropped", and for its
// mirror image, "a recognised user type must still work". They are grouped in
// one file so the whole invariant can be run as a unit:
//
//	go test ./internal/server/ -run 'TestDeny|TestAllow'
//
// Each Deny test fails against unfixed code by ALLOWING what it asserts must be
// denied. Each Allow test guards the opposite failure: a fix that denies
// everything would pass every Deny test and is not a fix.

// ── R1: an empty scope set grants nothing ──

// TestDenyEmptyScopeSetGrantsNothing is the load-bearing oracle. Against
// unfixed code RequireScope returns nil here, i.e. a principal holding no
// scopes at all is granted every scope in the vocabulary.
func TestDenyEmptyScopeSetGrantsNothing(t *testing.T) {
	for _, tc := range []struct {
		name   string
		scopes []string
	}{
		{"nil scope set", nil},
		{"empty scope set", []string{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := server.ContextWithAuthEnforced(context.Background())
			ctx = server.ContextWithScopes(ctx, tc.scopes)

			// Every scope in the vocabulary must be denied, not merely one.
			for _, scope := range server.AllScopes {
				err := server.RequireScope(ctx, scope)
				if err == nil {
					t.Fatalf("RequireScope(%q) allowed a principal holding no scopes; "+
						"an empty scope set must grant nothing", scope)
				}
				if got := status.Code(err); got != codes.PermissionDenied {
					t.Fatalf("RequireScope(%q) = code %v, want PermissionDenied", scope, got)
				}
			}
		})
	}
}

// TestDenyEmptyScopeSetExplainsItself covers criterion (d): rejecting is a fix,
// rejecting inscrutably is a support incident. An operator who reads only this
// error must learn that the token grants nothing and that reminting is the
// remedy — a bare "missing required scope" would not tell them that.
func TestDenyEmptyScopeSetExplainsItself(t *testing.T) {
	ctx := server.ContextWithAuthEnforced(context.Background())
	ctx = server.ContextWithScopes(ctx, nil)

	err := server.RequireScope(ctx, server.ScopeTaskRead)
	if err == nil {
		t.Fatal("expected denial for a principal holding no scopes")
	}
	msg := status.Convert(err).Message()
	for _, want := range []string{"no scopes", "re-issue"} {
		if !strings.Contains(msg, want) {
			t.Errorf("denial message must mention %q so the operator knows the remedy; got: %s", want, msg)
		}
	}
}

// ── R2: an unrecognised user type yields no authority ──

// unrecognisedUserTypes are the shapes an operator error actually takes: a
// typo, a plausible-but-undefined role, a case difference, and the empty
// string. Empty is the most dangerous of them, because an unset type is what a
// caller that never set one produces.
var unrecognisedUserTypes = []string{"reviewr", "superuser", "Admin", "", "  ", "admin\n"}

// TestDenyUnrecognisedUserTypeYieldsNoAuthority is the R2 oracle. Against
// unfixed code DefaultScopesForUserType returns nil for these, and nil is
// exactly the value RequireScope grants everything for — so the type the
// operator misspelled receives strictly more privilege than the one they meant.
func TestDenyUnrecognisedUserTypeYieldsNoAuthority(t *testing.T) {
	for _, ut := range unrecognisedUserTypes {
		t.Run("type="+ut, func(t *testing.T) {
			scopes, err := server.DefaultScopesForUserType(ut)
			if err == nil {
				t.Fatalf("DefaultScopesForUserType(%q) returned scopes %v and no error; "+
					"an unrecognised type must be refused, not given a default", ut, scopes)
			}
			if len(scopes) != 0 {
				t.Errorf("a refused type must yield no scopes, got %v", scopes)
			}

			// The refusal must be typed, so callers can distinguish "unknown
			// type" from an infrastructure error and report it accurately.
			var unknown *server.ErrUnknownUserType
			if !errors.As(err, &unknown) {
				t.Fatalf("error must be *ErrUnknownUserType so callers can tell it apart, got %T", err)
			}
			if unknown.UserType != ut {
				t.Errorf("error should name the offending type %q, got %q", ut, unknown.UserType)
			}
			// Criterion (d): the refusal has to teach the operator the vocabulary.
			if msg := err.Error(); !strings.Contains(msg, "agent") {
				t.Errorf("refusal should list the recognised types; got: %s", msg)
			}
		})
	}
}

// TestValidateUserTypeRejectsUnrecognised pins the creation-side gate. The
// database column is a free-form string with no enum constraint, so this
// function is the only thing standing between a typo and a stored account.
func TestValidateUserTypeRejectsUnrecognised(t *testing.T) {
	for _, ut := range unrecognisedUserTypes {
		if err := server.ValidateUserType(ut); err == nil {
			t.Errorf("ValidateUserType(%q) accepted an unrecognised type", ut)
		}
	}
}

// ── Lockout guard for R2: every recognised type must still resolve ──

// TestAllowRecognisedUserTypesStillResolve is the Item D guard on the scope
// table. Refusing unrecognised types is only a fix if the recognised ones keep
// working, so every member of the vocabulary is asserted to resolve to a
// NON-EMPTY set — non-empty because, after R1, an empty set is a dead account.
func TestAllowRecognisedUserTypesStillResolve(t *testing.T) {
	known := server.KnownUserTypes()
	if len(known) == 0 {
		t.Fatal("KnownUserTypes returned nothing; the vocabulary cannot be empty")
	}
	// The types this project actually ships. Listed literally so that silently
	// dropping one from the table is a test failure rather than a shrug.
	want := []string{"admin", "agent", "human", "orchestrator", "reviewer", "service_account", "viewer"}
	if strings.Join(known, ",") != strings.Join(want, ",") {
		t.Errorf("KnownUserTypes() = %v, want %v", known, want)
	}

	for _, ut := range known {
		t.Run(ut, func(t *testing.T) {
			scopes, err := server.DefaultScopesForUserType(ut)
			if err != nil {
				t.Fatalf("recognised type %q must resolve, got error: %v", ut, err)
			}
			if len(scopes) == 0 {
				t.Fatalf("recognised type %q resolved to an empty scope set, which after "+
					"the empty-grants-nothing rule is an account that can do nothing", ut)
			}
			if err := server.ValidateScopes(scopes); err != nil {
				t.Errorf("default scopes for %q must all be valid: %v", ut, err)
			}
			if err := server.ValidateUserType(ut); err != nil {
				t.Errorf("recognised type %q must pass ValidateUserType: %v", ut, err)
			}
		})
	}
}

// TestDefaultScopesAreNotAliased guards a mutation bug the map form invites:
// handing callers the backing slice would let one caller's append rewrite every
// later caller's permissions.
func TestDefaultScopesAreNotAliased(t *testing.T) {
	first, err := server.DefaultScopesForUserType("agent")
	if err != nil {
		t.Fatalf("agent must resolve: %v", err)
	}
	for i := range first {
		first[i] = server.ScopeWildcard
	}
	second, err := server.DefaultScopesForUserType("agent")
	if err != nil {
		t.Fatalf("agent must resolve: %v", err)
	}
	for _, s := range second {
		if s == server.ScopeWildcard {
			t.Fatal("mutating a returned scope slice changed the scope table; " +
				"DefaultScopesForUserType must return a copy")
		}
	}
}

// ── Lockout guard: a real grant must still pass ──

// TestAllowHeldScopeStillPasses is the mirror of the Deny tests. The cheapest
// wrong way to make every Deny test pass is to deny everything, which would
// lock out every legitimate caller. This pins that door shut.
func TestAllowHeldScopeStillPasses(t *testing.T) {
	ctx := server.ContextWithAuthEnforced(context.Background())
	ctx = server.ContextWithScopes(ctx, []string{server.ScopeTaskRead, server.ScopeCollectionRead})

	if err := server.RequireScope(ctx, server.ScopeTaskRead); err != nil {
		t.Fatalf("a held scope must still pass: %v", err)
	}
	if err := server.RequireScope(ctx, server.ScopeCollectionRead); err != nil {
		t.Fatalf("a held scope must still pass: %v", err)
	}
	// ...and a scope that is genuinely absent is still denied, for the right reason.
	err := server.RequireScope(ctx, server.ScopeCollectionAdmin)
	if err == nil {
		t.Fatal("an unheld scope must be denied")
	}
	if msg := status.Convert(err).Message(); !strings.Contains(msg, "missing required scope") {
		t.Errorf("an unheld scope must report the missing scope, not the empty-set message; got: %s", msg)
	}
}

// TestAllowWildcardStillPasses guards the other legitimate caller: the wildcard
// holder. Wildcard is a non-empty set, so the empty-set denial must not catch it.
func TestAllowWildcardStillPasses(t *testing.T) {
	ctx := server.ContextWithAuthEnforced(context.Background())
	ctx = server.ContextWithScopes(ctx, []string{server.ScopeWildcard})

	for _, scope := range server.AllScopes {
		if err := server.RequireScope(ctx, scope); err != nil {
			t.Fatalf("wildcard must still allow %q: %v", scope, err)
		}
	}
}

// TestAllowOpenAccessModeUnaffected guards the deployment that runs without
// auth. Open-access mode short-circuits before the scope check, so tightening
// the scope rule must not start denying there.
func TestAllowOpenAccessModeUnaffected(t *testing.T) {
	ctx := context.Background() // no ContextWithAuthEnforced
	if err := server.RequireScope(ctx, server.ScopeTaskRead); err != nil {
		t.Fatalf("open-access mode must be unaffected by the scope rule: %v", err)
	}
}
