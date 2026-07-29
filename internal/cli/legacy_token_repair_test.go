package cli

import (
	"context"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/apitoken"
	"github.com/farmtable-io/farmtable/internal/testutil"
)

// Item D, the lockout direction, at its sharpest point.
//
// At faf1c8c both CLI mint paths wrote token rows with NO scopes and relied on
// RequireScope reading empty as wildcard. Measured at faf1c8c, ROOT=/tmp/wt2:
//
//	token name="local-embedded" scopes=[] len=0
//	token name="dashboard-env"  scopes=[] len=0
//
// So empty-scope tokens are not hypothetical: every developer who has ever run
// `ft connect` or `ft dashboard` has two of them sitting in their database.
// Flipping empty from "everything" to "nothing" dead-keys all of them at once.
//
// Minting fresh tokens with an explicit grant fixes only NEW databases. Both
// ensure* functions return early when the row already exists, so an existing
// scope-less row is never revisited. These tests pin the repair that closes
// that gap.

// countScopeless reports how many token rows would be denied on every call.
func countScopeless(t *testing.T, s *store.EntStore) (total, scopeless int) {
	t.Helper()
	toks, err := s.Client().ApiToken.Query().All(context.Background())
	if err != nil {
		t.Fatalf("querying tokens: %v", err)
	}
	for _, tk := range toks {
		if len(tk.Scopes) == 0 {
			scopeless++
			t.Logf("scope-less token: name=%q id=%v", tk.Name, tk.ID)
		}
	}
	return len(toks), scopeless
}

// seedLegacyDatabase reproduces the state faf1c8c leaves behind: a local user
// whose two CLI-owned tokens carry no scopes at all.
func seedLegacyDatabase(t *testing.T, s *store.EntStore, dashboardToken string) {
	t.Helper()
	ctx := context.Background()

	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "local", Type: "agent", Status: "active",
	})
	if err != nil {
		t.Fatalf("seeding local user: %v", err)
	}
	// Exactly what faf1c8c wrote: no SetScopes call at all.
	if _, _, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID, Name: "local-embedded",
	}); err != nil {
		t.Fatalf("seeding local-embedded token: %v", err)
	}
	if _, err := s.Client().ApiToken.Create().
		SetTokenHash(store.HashToken(dashboardToken)).
		SetName("dashboard-env").
		SetUserID(u.ID).
		Save(ctx); err != nil {
		t.Fatalf("seeding dashboard-env token: %v", err)
	}
}

// TestLegacyScopelessTokensAreRepaired is the Item D oracle. Against a branch
// that only fixes the fresh-mint path, the seeded tokens stay empty and the
// operator's next command fails with a permission error on a database that
// worked five minutes earlier.
func TestLegacyScopelessTokensAreRepaired(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	const dashToken = "ft_legacy_dashboard_token"
	seedLegacyDatabase(t, s, dashToken)

	if total, scopeless := countScopeless(t, s); scopeless != 2 || total != 2 {
		t.Fatalf("precondition: want 2 scope-less tokens, got %d scope-less of %d", scopeless, total)
	}

	// The upgrade path: the operator simply runs the CLI again.
	if err := ensureLocalUser(ctx, s, dashToken); err != nil {
		t.Fatalf("ensureLocalUser on an existing database: %v", err)
	}

	total, scopeless := countScopeless(t, s)
	if scopeless != 0 {
		t.Fatalf("%d of %d CLI-owned tokens still hold no scopes after re-running the CLI; "+
			"under the empty-grants-nothing rule each is denied on every call, so a "+
			"database that worked before the upgrade is now locked out", scopeless, total)
	}
}

// TestLegacyRepairIsIdempotent guards against the repair re-minting or
// duplicating rows: the operator's saved token must keep working.
func TestLegacyRepairIsIdempotent(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	const dashToken = "ft_legacy_dashboard_token"
	seedLegacyDatabase(t, s, dashToken)

	for i := 0; i < 3; i++ {
		if err := ensureLocalUser(ctx, s, dashToken); err != nil {
			t.Fatalf("pass %d: %v", i, err)
		}
	}

	total, scopeless := countScopeless(t, s)
	if total != 2 {
		t.Errorf("repair must not create extra token rows, got %d", total)
	}
	if scopeless != 0 {
		t.Errorf("%d tokens still hold no scopes", scopeless)
	}

	// The dashboard token the operator already has in their environment must
	// still resolve — repairing it must not rotate the secret.
	n, err := s.Client().ApiToken.Query().
		Where(apitoken.TokenHashEQ(store.HashToken(dashToken))).
		Count(ctx)
	if err != nil {
		t.Fatalf("querying dashboard token: %v", err)
	}
	if n != 1 {
		t.Errorf("the operator's existing dashboard token must survive repair, found %d rows", n)
	}
}

// TestRepairLeavesUserTokensAlone bounds the blast radius. The repair is only
// entitled to the two tokens the CLI itself owns by name. A token an operator
// deliberately scoped, or any other application's token, must not be touched —
// silently widening a user's grant would be the original bug in a new place.
func TestRepairLeavesUserTokensAlone(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	const dashToken = "ft_legacy_dashboard_token"
	seedLegacyDatabase(t, s, dashToken)

	u, err := s.GetUserByName(ctx, "local")
	if err != nil {
		t.Fatalf("getting local user: %v", err)
	}
	// A deliberately narrow token, and a foreign scope-less one.
	if _, _, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID, Name: "ci-readonly", Scopes: []string{"task:read"},
	}); err != nil {
		t.Fatalf("seeding narrow token: %v", err)
	}
	if _, _, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID, Name: "someone-elses-token",
	}); err != nil {
		t.Fatalf("seeding foreign token: %v", err)
	}

	if err := ensureLocalUser(ctx, s, dashToken); err != nil {
		t.Fatalf("ensureLocalUser: %v", err)
	}

	toks, err := s.Client().ApiToken.Query().All(ctx)
	if err != nil {
		t.Fatalf("querying: %v", err)
	}
	for _, tk := range toks {
		switch tk.Name {
		case "ci-readonly":
			if len(tk.Scopes) != 1 || tk.Scopes[0] != "task:read" {
				t.Errorf("a deliberately scoped token must not be widened, got %v", tk.Scopes)
			}
		case "someone-elses-token":
			if len(tk.Scopes) != 0 {
				t.Errorf("a token the CLI does not own must not be granted scopes, got %v", tk.Scopes)
			}
		}
	}
}
