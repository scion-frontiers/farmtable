package main

import (
	"testing"

	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/testutil"
)

func TestServerPortPrefersCloudRunPort(t *testing.T) {
	t.Setenv("PORT", "9090")
	t.Setenv("FARMTABLE_PORT", "50051")

	if got := serverPort(); got != "9090" {
		t.Fatalf("serverPort() = %q, want 9090", got)
	}
}

func TestServerPortFallsBackToFarmTablePort(t *testing.T) {
	t.Setenv("PORT", "")
	t.Setenv("FARMTABLE_PORT", "50051")

	if got := serverPort(); got != "50051" {
		t.Fatalf("serverPort() = %q, want 50051", got)
	}
}

func TestServerPortDefaultsTo8080(t *testing.T) {
	t.Setenv("PORT", "")
	t.Setenv("FARMTABLE_PORT", "")

	if got := serverPort(); got != "8080" {
		t.Fatalf("serverPort() = %q, want 8080", got)
	}
}

func TestMultiStoreWrapsEntStore(t *testing.T) {
	entStore, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	// This mirrors the server startup wiring: wrap EntStore with MultiStore.
	ms := store.NewMultiStore(entStore)
	defer ms.Close()

	// Verify the MultiStore satisfies the Store interface.
	var _ store.Store = ms

	// Verify basic operations pass through to the underlying EntStore.
	ctx := t.Context()
	coll, err := ms.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "test-passthrough",
		Platform: "farmtable",
	})
	if err != nil {
		t.Fatalf("CreateCollection via MultiStore: %v", err)
	}

	got, err := entStore.GetCollection(ctx, coll.ID)
	if err != nil {
		t.Fatalf("GetCollection from EntStore: %v", err)
	}
	if got.Name != "test-passthrough" {
		t.Errorf("name = %q, want %q", got.Name, "test-passthrough")
	}
}

func TestServerStoreOptionsAppendsSecretPassword(t *testing.T) {
	t.Setenv("FARMTABLE_DB_URL", "host=/cloudsql/project:region:instance dbname=farmtable user=farmtable sslmode=disable")
	t.Setenv("FARMTABLE_DB_DIALECT", "")
	t.Setenv("FARMTABLE_DB_PASSWORD", "secret-password")

	opts, err := serverStoreOptions()
	if err != nil {
		t.Fatalf("serverStoreOptions: %v", err)
	}
	if opts.Dialect != "postgres" {
		t.Fatalf("Dialect = %q, want postgres", opts.Dialect)
	}
	want := "host=/cloudsql/project:region:instance dbname=farmtable user=farmtable sslmode=disable password=secret-password"
	if opts.DSN != want {
		t.Fatalf("DSN = %q, want %q", opts.DSN, want)
	}
	if !opts.Migrate {
		t.Fatal("Migrate = false, want true")
	}
}

// TestOpenAccessCauseForMapsEveryConfiguration pins the env-to-cause mapping
// that decides both the auth mode and the wording of the unattributable-import
// refusal. An operator who hits that refusal is told which variable to change,
// so a wrong mapping here sends them to the wrong knob.
//
// The unspecified case is the load-bearing one: main treats it as "token auth
// is on", so a mapping that returned it for an open-access configuration would
// silently enable a token lookup that has no token.
func TestOpenAccessCauseForMapsEveryConfiguration(t *testing.T) {
	cases := []struct {
		name       string
		openAccess string
		token      string
		want       server.OpenAccessCause
	}{
		{"explicit open access", "1", "", server.OpenAccessCauseDeliberate},
		{"explicit open access outranks a set token", "1", "secret", server.OpenAccessCauseDeliberate},
		{"no token configured", "", "", server.OpenAccessCauseMissingToken},
		{"token configured", "", "secret", server.OpenAccessCauseUnspecified},
		// Only the exact string "1" enables open access; anything else must not
		// be read as truthy, or a typo would silently disable auth.
		{"non-canonical truthy value is not open access", "true", "secret", server.OpenAccessCauseUnspecified},
		{"non-canonical truthy value without a token is still missing-token", "true", "", server.OpenAccessCauseMissingToken},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := openAccessCauseFor(tc.openAccess, tc.token); got != tc.want {
				t.Fatalf("openAccessCauseFor(%q, %q) = %q, want %q", tc.openAccess, tc.token, got, tc.want)
			}
		})
	}
}
