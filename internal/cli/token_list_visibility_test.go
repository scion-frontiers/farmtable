package cli

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
)

// captureStdout runs fn with os.Stdout redirected and returns what it wrote.
// The CLI's print helpers write to os.Stdout directly, so this is the only way
// to assert on what an operator actually sees.
func captureStdout(t *testing.T, fn func()) string {
	t.Helper()
	orig := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	os.Stdout = w

	done := make(chan string, 1)
	go func() {
		b, _ := io.ReadAll(r)
		done <- string(b)
	}()

	fn()

	w.Close()
	os.Stdout = orig
	return <-done
}

// TestTokenListShowsScopelessTokens is the diagnosability oracle, and it is the
// one the migration question rests on.
//
// The empty-grants-nothing rule turns every scope-less token into a token that
// is denied on every call. An operator upgrading into that rule needs to answer
// one question before anything else: WHICH of my tokens are affected? The only
// tool for that is `ft token list`.
//
// At faf1c8c that command omits the scopes field entirely when the set is empty
// (token.go: `if len(t.Scopes) > 0`). Omission was harmless while empty meant
// wildcard, because an unscoped token worked. Under the new rule the one class
// of token the operator most needs to find is the one class the listing refuses
// to distinguish — a dead token and a healthy one render identically.
//
// A branch that denies correctly but cannot tell the operator what it denied is
// the "rejection without a reason" failure in criterion (d), displaced from the
// error path onto the diagnostic path.
func TestTokenListShowsScopelessTokens(t *testing.T) {
	withTempDB(t)
	ctx := context.Background()

	s, cleanup, err := openDirectStore()
	if err != nil {
		t.Fatalf("opening store: %v", err)
	}
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "legacy-op", Type: "agent", Status: "active",
	})
	if err != nil {
		t.Fatalf("seeding user: %v", err)
	}
	// A token exactly as the pre-scopes code wrote it: no scopes at all.
	if _, _, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID, Name: "legacy-dead",
	}); err != nil {
		t.Fatalf("seeding scope-less token: %v", err)
	}
	// And a healthy one, so the test proves the two are DISTINGUISHABLE rather
	// than merely that some text was printed.
	if _, _, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID, Name: "healthy", Scopes: []string{"task:read"},
	}); err != nil {
		t.Fatalf("seeding healthy token: %v", err)
	}
	cleanup()

	out := captureStdout(t, func() {
		cmd := newTokenListCmd(&globalFlags{output: "json"})
		cmd.SetArgs(nil)
		cmd.SilenceUsage, cmd.SilenceErrors = true, true
		if err := cmd.Execute(); err != nil {
			t.Errorf("ft token list: %v", err)
		}
	})

	var env struct {
		Items []map[string]interface{} `json:"items"`
	}
	if err := json.Unmarshal([]byte(out), &env); err != nil {
		t.Fatalf("parsing list output %q: %v", out, err)
	}
	if len(env.Items) != 2 {
		t.Fatalf("expected 2 tokens in listing, got %d: %s", len(env.Items), out)
	}

	for _, item := range env.Items {
		name, _ := item["name"].(string)
		scopes, present := item["scopes"]
		if !present {
			t.Errorf("token %q was listed with no scopes field at all. An operator "+
				"auditing which tokens are denied under the empty-grants-nothing rule "+
				"cannot tell this token from a working one.", name)
			continue
		}
		if name == "legacy-dead" {
			list, _ := scopes.([]interface{})
			if len(list) != 0 {
				t.Errorf("scope-less token should list an empty scope set, got %v", scopes)
			}
		}
	}
}

// TestTokenListStillShowsGrantedScopes is the counterpart guard: making empty
// sets visible must not change how a normal token renders.
func TestTokenListStillShowsGrantedScopes(t *testing.T) {
	withTempDB(t)
	ctx := context.Background()

	s, cleanup, err := openDirectStore()
	if err != nil {
		t.Fatalf("opening store: %v", err)
	}
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "op", Type: "agent", Status: "active",
	})
	if err != nil {
		t.Fatalf("seeding user: %v", err)
	}
	if _, _, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID, Name: "scoped", Scopes: []string{"task:read", "task:write"},
	}); err != nil {
		t.Fatalf("seeding token: %v", err)
	}
	cleanup()

	out := captureStdout(t, func() {
		cmd := newTokenListCmd(&globalFlags{output: "json"})
		cmd.SetArgs(nil)
		cmd.SilenceUsage, cmd.SilenceErrors = true, true
		if err := cmd.Execute(); err != nil {
			t.Errorf("ft token list: %v", err)
		}
	})

	for _, want := range []string{"task:read", "task:write"} {
		if !strings.Contains(out, want) {
			t.Errorf("granted scope %q missing from listing: %s", want, out)
		}
	}
}
