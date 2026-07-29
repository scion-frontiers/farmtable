package server_test

import (
	"strings"
	"testing"

	"context"

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
