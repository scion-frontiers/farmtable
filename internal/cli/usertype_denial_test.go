package cli

import (
	"context"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
)

// These are end-to-end oracles for the two operator-facing commands that can
// put an unrecognised user type into the system, or mint a token from one.
// They drive the real cobra commands against a real SQLite store, because the
// bug being fixed lives in what those commands decide to write, not in a helper.
//
// Deliberately written against only long-standing API, so the same test text
// compiles and runs at faf1c8c as well as on this branch. The RED evidence is
// therefore behavioural, not a compile error.

// shippedUserTypes is the vocabulary spelled out literally rather than read
// from server.KnownUserTypes(), for two reasons: the test then compiles against
// the unfixed tree, and a silent removal from the scope table becomes a
// failure here instead of a test that quietly checks less than it used to.
var shippedUserTypes = []string{
	"admin", "agent", "human", "orchestrator", "reviewer", "service_account", "viewer",
}

// unrecognisedTypes are the shapes operator error actually takes.
var unrecognisedTypes = []string{"reviewr", "superuser", "Admin", ""}

// withTempDB points the CLI's direct-store commands at a scratch database.
func withTempDB(t *testing.T) {
	t.Helper()
	t.Setenv("FARMTABLE_DB_PATH", t.TempDir()+"/farmtable.db")
}

func runUserCreate(t *testing.T, name, userType string) error {
	t.Helper()
	cmd := newUserCreateCmd(&globalFlags{output: "quiet"})
	cmd.SetArgs([]string{name, "--type", userType})
	cmd.SilenceUsage, cmd.SilenceErrors = true, true
	return cmd.Execute()
}

// ── R5: `ft user create` must reject an unrecognised --type ──

// TestDenyUserCreateRejectsUnrecognisedType is the R5 oracle. The `type` column
// is a free-form string with no enum constraint at the schema level, so this
// command is the only gate between a typo and a stored account that no token
// can ever be issued for.
func TestDenyUserCreateRejectsUnrecognisedType(t *testing.T) {
	for _, ut := range unrecognisedTypes {
		t.Run("type="+ut, func(t *testing.T) {
			withTempDB(t)

			err := runUserCreate(t, "victim", ut)
			if err == nil {
				t.Fatalf("ft user create --type %q was accepted; an unrecognised type "+
					"must be rejected at creation", ut)
			}
			// Criterion (d): the operator must be told what to type instead.
			if msg := err.Error(); !strings.Contains(msg, "agent") {
				t.Errorf("rejection must list the recognised types so the operator can "+
					"correct the typo; got: %s", msg)
			}

			// And nothing may have been written.
			s, cleanup, oerr := openDirectStore()
			if oerr != nil {
				t.Fatalf("opening store: %v", oerr)
			}
			defer cleanup()
			n, qerr := s.Client().User.Query().Count(context.Background())
			if qerr != nil {
				t.Fatalf("counting users: %v", qerr)
			}
			if n != 0 {
				t.Errorf("a rejected create must not persist a user, found %d", n)
			}
		})
	}
}

// TestAllowUserCreateAcceptsEveryShippedType is the Item D guard on R5. A gate
// that rejects the typo but also rejects "reviewer" is not a fix.
func TestAllowUserCreateAcceptsEveryShippedType(t *testing.T) {
	for _, ut := range shippedUserTypes {
		t.Run(ut, func(t *testing.T) {
			withTempDB(t)
			if err := runUserCreate(t, "legit-"+ut, ut); err != nil {
				t.Fatalf("ft user create --type %q must still work, got: %v", ut, err)
			}
		})
	}
}

// ── R3: `ft token create` must refuse an unrecognised user type ──

// TestDenyTokenCreateRefusesUnrecognisedType is the R3 oracle, and it is the
// site the escalation actually travels through: token.go asks the scope table
// for defaults and mints whatever it gets back.
//
// The user is inserted through the store directly, bypassing `ft user create`,
// because that is exactly how such an account exists in the wild — it predates
// the R5 gate, or was written by another client.
func TestDenyTokenCreateRefusesUnrecognisedType(t *testing.T) {
	for _, ut := range unrecognisedTypes {
		t.Run("type="+ut, func(t *testing.T) {
			withTempDB(t)
			ctx := context.Background()

			s, cleanup, err := openDirectStore()
			if err != nil {
				t.Fatalf("opening store: %v", err)
			}
			u, err := s.CreateUser(ctx, store.CreateUserParams{
				DisplayName: "legacy", Type: ut, Status: "active",
			})
			if err != nil {
				t.Fatalf("seeding user: %v", err)
			}
			cleanup()

			cmd := newTokenCreateCmd(&globalFlags{output: "quiet"})
			cmd.SetArgs([]string{u.ID.String(), "--name", "t"})
			cmd.SilenceUsage, cmd.SilenceErrors = true, true
			cerr := cmd.Execute()

			s2, cleanup2, err := openDirectStore()
			if err != nil {
				t.Fatalf("reopening store: %v", err)
			}
			defer cleanup2()
			toks, err := s2.Client().ApiToken.Query().All(ctx)
			if err != nil {
				t.Fatalf("querying tokens: %v", err)
			}

			if cerr == nil {
				var got [][]string
				for _, tk := range toks {
					got = append(got, tk.Scopes)
				}
				t.Fatalf("ft token create minted a token for unrecognised type %q "+
					"(scopes=%v); an unrecognised type has no permission set", ut, got)
			}
			if len(toks) != 0 {
				t.Errorf("a refused mint must not persist a token row, found %d", len(toks))
			}
		})
	}
}

// TestAllowTokenCreateForEveryShippedType is the Item D guard on R3, and the
// most important one in this file: for each recognised type, `ft token create`
// with no explicit --scope must still produce a token that carries a NON-EMPTY
// scope set. An empty one would now be a token that is denied on every call.
func TestAllowTokenCreateForEveryShippedType(t *testing.T) {
	for _, ut := range shippedUserTypes {
		t.Run(ut, func(t *testing.T) {
			withTempDB(t)
			ctx := context.Background()

			s, cleanup, err := openDirectStore()
			if err != nil {
				t.Fatalf("opening store: %v", err)
			}
			u, err := s.CreateUser(ctx, store.CreateUserParams{
				DisplayName: "legit", Type: ut, Status: "active",
			})
			if err != nil {
				t.Fatalf("seeding user: %v", err)
			}
			cleanup()

			cmd := newTokenCreateCmd(&globalFlags{output: "quiet"})
			cmd.SetArgs([]string{u.ID.String(), "--name", "t"})
			cmd.SilenceUsage, cmd.SilenceErrors = true, true
			if err := cmd.Execute(); err != nil {
				t.Fatalf("ft token create for recognised type %q must still work, got: %v", ut, err)
			}

			s2, cleanup2, err := openDirectStore()
			if err != nil {
				t.Fatalf("reopening store: %v", err)
			}
			defer cleanup2()
			toks, err := s2.Client().ApiToken.Query().All(ctx)
			if err != nil {
				t.Fatalf("querying tokens: %v", err)
			}
			if len(toks) != 1 {
				t.Fatalf("expected exactly one token, got %d", len(toks))
			}
			if len(toks[0].Scopes) == 0 {
				t.Fatalf("token for recognised type %q was minted with an empty scope set; "+
					"after the empty-grants-nothing rule that token is denied on every call", ut)
			}
		})
	}
}
