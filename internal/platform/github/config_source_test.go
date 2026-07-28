package github

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ── #194 round 8, item 7: R-1, the silent config load ──
//
// DefaultConfigPath is relative. A server started from an unexpected working
// directory finds no file, gets DefaultConfig — which is correct behaviour for
// a genuinely absent config — and says nothing. Since B6 the push_prefix in
// that file decides which labels may feed an authorization answer, so this is
// M-1 disarmed again by the working directory alone, with no diagnostic
// distinguishing it from a deployment that meant to use the defaults.
//
// The fix is a diagnostic, not an error: making a missing file fatal would
// break every default deployment. What these tests pin is that the diagnostic
// carries the three facts an operator needs — the ABSOLUTE path searched,
// whether a file was found, and the EFFECTIVE push prefix — because a message
// that says "using defaults" without saying where it looked does not answer the
// question R-1 is about.

func TestLoadConfigWithSource_ReportsWhereItLooked(t *testing.T) {
	t.Setenv("FARMTABLE_GITHUB_CONFIG", "")

	dir := t.TempDir()
	restore := chdir(t, dir)
	defer restore()

	cfg, src, err := LoadConfigWithSource(DefaultConfigPath)
	if err != nil {
		t.Fatalf("LoadConfigWithSource: %v", err)
	}

	if src.Found {
		t.Fatal("PREREQUISITE BROKEN: a file was found in an empty temp dir")
	}
	if !filepath.IsAbs(src.AbsolutePath) {
		t.Errorf("AbsolutePath = %q, which is not absolute. The relative path is the whole "+
			"failure mode: it is what makes the answer depend on the working directory, so "+
			"reporting it back unresolved tells the operator nothing they did not supply",
			src.AbsolutePath)
	}
	if want := filepath.Join(dir, DefaultConfigPath); src.AbsolutePath != want {
		t.Errorf("AbsolutePath = %q, want %q", src.AbsolutePath, want)
	}

	msg := src.Describe(cfg)
	for _, want := range []string{src.AbsolutePath, "defaults", cfg.EffectivePushPrefix()} {
		if !strings.Contains(msg, want) {
			t.Errorf("the diagnostic does not mention %q: %s", want, msg)
		}
	}
}

func TestLoadConfigWithSource_ReportsAFileItFound(t *testing.T) {
	t.Setenv("FARMTABLE_GITHUB_CONFIG", "")

	dir := t.TempDir()
	restore := chdir(t, dir)
	defer restore()

	if err := os.MkdirAll(filepath.Dir(DefaultConfigPath), 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	body := "github:\n  owner: acme\n  repo: widgets\n  labels:\n    push_prefix: \"acme:\"\n"
	if err := os.WriteFile(DefaultConfigPath, []byte(body), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	cfg, src, err := LoadConfigWithSource(DefaultConfigPath)
	if err != nil {
		t.Fatalf("LoadConfigWithSource: %v", err)
	}
	if !src.Found {
		t.Fatal("Found = false for a file that exists at the default path")
	}
	if src.FromEnv {
		t.Error("FromEnv = true with the env var unset")
	}
	if got := cfg.EffectivePushPrefix(); got != "acme:" {
		t.Errorf("EffectivePushPrefix() = %q, want acme:; the file was reported as found "+
			"but its contents did not reach the config", got)
	}

	msg := src.Describe(cfg)
	if !strings.Contains(msg, "loaded") || !strings.Contains(msg, src.AbsolutePath) {
		t.Errorf("the diagnostic does not say what it loaded: %s", msg)
	}
	if !strings.Contains(msg, "acme:") {
		t.Errorf("the diagnostic does not report the effective push prefix, which is the "+
			"security parameter an operator is checking this line for: %s", msg)
	}
	// The not-found wording must not be reachable here, or the two states are
	// indistinguishable in the log and the diagnostic is worthless.
	if strings.Contains(msg, "no file at") {
		t.Errorf("a loaded config is described with the not-found wording: %s", msg)
	}
}

// TestLoadConfigWithSource_ReportsTheEnvOverride covers the other way an
// operator ends up on a config they did not expect.
func TestLoadConfigWithSource_ReportsTheEnvOverride(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "elsewhere.yaml")
	body := "github:\n  owner: acme\n  repo: widgets\n"
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	t.Setenv("FARMTABLE_GITHUB_CONFIG", path)

	cfg, src, err := LoadConfigWithSource(DefaultConfigPath)
	if err != nil {
		t.Fatalf("LoadConfigWithSource: %v", err)
	}
	if !src.FromEnv {
		t.Error("FromEnv = false although FARMTABLE_GITHUB_CONFIG was set")
	}
	if src.Path != path {
		t.Errorf("Path = %q, want the env-var path %q", src.Path, path)
	}
	if !strings.Contains(src.Describe(cfg), "FARMTABLE_GITHUB_CONFIG") {
		t.Errorf("the diagnostic names neither the env var nor the override: %s",
			src.Describe(cfg))
	}
}

// TestLoadConfigWithSource_DescribesADefaultedPrefix covers A-2's shape: the
// operator wrote a push_prefix, it was unusable, and the deployment is running
// on a different one. Reporting only the EFFECTIVE value would leave that
// operator reading a prefix they never configured with no hint why.
func TestLoadConfigWithSource_DescribesADefaultedPrefix(t *testing.T) {
	cfg := DefaultConfig()
	cfg.GitHub.Labels.PushPrefix = ""

	src := ConfigSource{AbsolutePath: "/etc/farmtable/github.yaml", Found: true}
	msg := src.Describe(cfg)
	if !strings.Contains(msg, defaultPushPrefix) {
		t.Errorf("the diagnostic does not name the effective prefix: %s", msg)
	}
	// An EMPTY configured prefix is the documented spelling of "use the
	// default" and must not be reported as a problem.
	if strings.Contains(msg, "not usable") {
		t.Errorf("an omitted push_prefix is reported as a fault: %s", msg)
	}
}

// TestLoadConfig_StillBehavesIdentically is the compatibility control. The
// two-value LoadConfig is now a wrapper, and the CLI still calls it.
func TestLoadConfig_StillBehavesIdentically(t *testing.T) {
	t.Setenv("FARMTABLE_GITHUB_CONFIG", "")

	dir := t.TempDir()
	restore := chdir(t, dir)
	defer restore()

	cfg, err := LoadConfig(DefaultConfigPath)
	if err != nil {
		t.Fatalf("LoadConfig on a missing file must return the defaults, got: %v", err)
	}
	if cfg == nil || !cfg.GitHub.Labels.Enabled || cfg.EffectivePushPrefix() != defaultPushPrefix {
		t.Fatalf("LoadConfig did not return DefaultConfig for a missing file: %+v", cfg)
	}

	// And an invalid file must still be an error through the old signature.
	if err := os.MkdirAll(filepath.Dir(DefaultConfigPath), 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	bad := "github:\n  labels:\n    types:\n      duplicate: chore\n"
	if err := os.WriteFile(DefaultConfigPath, []byte(bad), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if _, err := LoadConfig(DefaultConfigPath); err == nil {
		t.Fatal("LoadConfig accepted an invalid config; the wrapper dropped Validate")
	}
}

// chdir moves the process into dir for the duration of a test. Package tests
// run in one process, so the restore is not optional.
func chdir(t *testing.T, dir string) func() {
	t.Helper()
	prev, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatalf("Chdir(%s): %v", dir, err)
	}
	return func() {
		if err := os.Chdir(prev); err != nil {
			t.Fatalf("restoring cwd: %v", err)
		}
	}
}
