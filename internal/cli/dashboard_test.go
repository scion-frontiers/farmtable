package cli

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/testutil"
)

func TestDashboardStoreOptions_DefaultsToSQLite(t *testing.T) {
	t.Setenv("FARMTABLE_DB_URL", "")
	t.Setenv("FARMTABLE_DB_DIALECT", "")
	t.Setenv("FARMTABLE_DB_PATH", filepath.Join(t.TempDir(), "farmtable.db"))

	opts, err := dashboardStoreOptions()
	if err != nil {
		t.Fatalf("dashboardStoreOptions: %v", err)
	}
	if opts.Dialect != "sqlite3" {
		t.Fatalf("Dialect = %q, want sqlite3", opts.Dialect)
	}
	if opts.DSN == "" {
		t.Fatal("DSN is empty")
	}
	if !opts.Migrate {
		t.Fatal("Migrate = false, want true")
	}
}

func TestDashboardStoreOptions_UsesConfiguredDatabase(t *testing.T) {
	t.Setenv("FARMTABLE_DB_URL", "host=/cloudsql/project:region:instance dbname=farmtable user=farmtable password=secret sslmode=disable")
	t.Setenv("FARMTABLE_DB_DIALECT", "")

	opts, err := dashboardStoreOptions()
	if err != nil {
		t.Fatalf("dashboardStoreOptions: %v", err)
	}
	if opts.Dialect != "postgres" {
		t.Fatalf("Dialect = %q, want postgres", opts.Dialect)
	}
	if opts.DSN != "host=/cloudsql/project:region:instance dbname=farmtable user=farmtable password=secret sslmode=disable" {
		t.Fatalf("DSN = %q", opts.DSN)
	}
}

func TestEnsureLocalUserStoresConfiguredToken(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	ctx := context.Background()
	rawToken := "ft_test_dashboard_token"
	if err := ensureLocalUser(ctx, s, rawToken); err != nil {
		t.Fatalf("ensureLocalUser: %v", err)
	}

	tok, err := s.LookupToken(ctx, store.HashToken(rawToken))
	if err != nil {
		t.Fatalf("LookupToken: %v", err)
	}
	if tok.Name != "dashboard-env" {
		t.Fatalf("token name = %q, want dashboard-env", tok.Name)
	}

	if err := ensureLocalUser(ctx, s, rawToken); err != nil {
		t.Fatalf("second ensureLocalUser: %v", err)
	}
}
