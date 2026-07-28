package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

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

// TestLoadGitHubConfig_BannerNamesTheConfigurationTheServerWillUse pins review
// S2 (#194 round 9): the startup banner is produced by something callable.
//
// The three rows are the three states an operator can be in, and the third is
// the one review R-1 was about. A relative DefaultConfigPath plus an unexpected
// working directory yields the defaults with no file, which used to look
// exactly like a successful load — so the banner must say the CWD-resolved path
// it looked at, not merely "using defaults".
func TestLoadGitHubConfig_BannerNamesTheConfigurationTheServerWillUse(t *testing.T) {
	dir := t.TempDir()

	loaded := filepath.Join(dir, "loaded.yaml")
	body := "github:\n  owner: acme\n  repo: widgets\n  labels:\n    push_prefix: \"acme:\"\n"
	if err := os.WriteFile(loaded, []byte(body), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	bad := filepath.Join(dir, "bad.yaml")
	badBody := "github:\n  owner: acme\n  repo: widgets\n  labels:\n    types:\n      duplicate: chore\n"
	if err := os.WriteFile(bad, []byte(badBody), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	t.Run("a file that loads", func(t *testing.T) {
		cfg, banner, err := loadGitHubConfig(loaded)
		if err != nil {
			t.Fatalf("loadGitHubConfig: %v", err)
		}
		if cfg.EffectivePushPrefix() != "acme:" {
			t.Errorf("push prefix = %q, want acme:", cfg.EffectivePushPrefix())
		}
		for _, want := range []string{loaded, `"acme:"`} {
			if !strings.Contains(banner, want) {
				t.Errorf("banner does not mention %q: %s", want, banner)
			}
		}
	})

	t.Run("a file that does not exist", func(t *testing.T) {
		missing := filepath.Join(dir, "nope.yaml")
		cfg, banner, err := loadGitHubConfig(missing)
		if err != nil {
			t.Fatalf("a missing file is the documented way to ask for the defaults, "+
				"so it must not be an error: %v", err)
		}
		if cfg == nil {
			t.Fatal("no config returned for a missing file")
		}
		if !strings.Contains(banner, missing) {
			t.Errorf("banner does not name the path the server looked at, which is the "+
				"whole of review R-1's remedy: %s", banner)
		}
	})

	t.Run("a file that fails validation", func(t *testing.T) {
		cfg, banner, err := loadGitHubConfig(bad)
		if err == nil {
			t.Fatal("a config whose types key captures a lifecycle label must not load")
		}
		if cfg != nil || banner != "" {
			t.Errorf("on error the helper must return nothing usable, or a caller that "+
				"logs before checking err announces a configuration the server refused; "+
				"got cfg=%v banner=%q", cfg, banner)
		}
	})
}
