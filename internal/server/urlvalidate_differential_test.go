package server

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
)

// urlSchemeCase is one row of testdata/url-scheme-cases.json.
type urlSchemeCase struct {
	Name   string `json:"name"`
	Input  string `json:"input"`
	Server string `json:"server"`
	Client string `json:"client"`
	Note   string `json:"note"`
}

// repoRoot walks up from this source file to the directory holding go.mod.
// Using runtime.Caller rather than os.Getwd keeps this working regardless of
// which directory the test binary is run from.
func repoRoot(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller(0) failed; cannot locate the repository root")
	}
	dir := filepath.Dir(thisFile)
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatalf("no go.mod found above %s", filepath.Dir(thisFile))
		}
		dir = parent
	}
}

func loadURLSchemeCases(t *testing.T) []urlSchemeCase {
	t.Helper()
	path := filepath.Join(repoRoot(t), "testdata", "url-scheme-cases.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading shared fixtures: %v", err)
	}
	var doc struct {
		Cases []urlSchemeCase `json:"cases"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("parsing %s: %v", path, err)
	}
	if len(doc.Cases) == 0 {
		t.Fatalf("%s contains no cases; this test would be vacuous", path)
	}
	return doc.Cases
}

// TestValidateURLFieldMatchesSharedFixtures is the SERVER half of the
// server/client differential pin.
//
// The other half is testSharedFixturesMatchClientColumn() in
// web/src/util/safe-url.test.ts. Both read the same
// testdata/url-scheme-cases.json; this one asserts the "server" column against
// validateURLField, that one asserts the "client" column against safeHref.
// Neither implementation can drift without turning its own half red, and a
// disagreement can only be silenced by editing the shared file, which is
// visible in review.
//
// Why this exists: safe-url.ts previously asserted that the two guards agreed,
// and concluded that "a scheme the client allows and the server rejects is
// unreachable". The scheme SETS agree; the DECISIONS do not. 9 of these 42
// inputs are decided differently, because the server applies a
// control-character pre-check and Go's net/url, while the client uses the
// browser's WHATWG parser. None of the 9 is a scheme escalation -- see the
// _README in the fixture file.
func TestValidateURLFieldMatchesSharedFixtures(t *testing.T) {
	cases := loadURLSchemeCases(t)

	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			err := validateURLField("test_field", tc.Input)
			got := "accept"
			if err != nil {
				got = "reject"
			}
			switch tc.Server {
			case "accept", "reject":
			default:
				t.Fatalf("fixture %q has an invalid \"server\" value %q; want accept or reject", tc.Name, tc.Server)
			}
			if got != tc.Server {
				t.Errorf("validateURLField(%q) = %s, but testdata/url-scheme-cases.json records %s\n"+
					"error was: %v\n"+
					"Either the server's URL policy changed (update the fixture and say why in the "+
					"report), or this is a regression.", tc.Input, got, tc.Server, err)
			}
		})
	}
}

// TestSharedFixturesRecordRealDivergences is the anti-vacuity control for the
// pair of differential tests.
//
// Without it, both halves would stay green if someone "resolved" the
// disagreement by rewriting every client column to match the server column.
// The disagreement is the finding; erasing it on paper must not be silent.
func TestSharedFixturesRecordRealDivergences(t *testing.T) {
	cases := loadURLSchemeCases(t)

	var divergent, agreeing int
	for _, tc := range cases {
		if tc.Client != "accept" && tc.Client != "reject" {
			t.Errorf("fixture %q has an invalid \"client\" value %q; want accept or reject", tc.Name, tc.Client)
			continue
		}
		if tc.Server == tc.Client {
			agreeing++
			continue
		}
		divergent++
		if tc.Note == "" {
			t.Errorf("fixture %q: server=%s client=%s is a divergence with no \"note\". "+
				"Every divergence must record the measured reason, or the next reader has to "+
				"re-derive it.", tc.Name, tc.Server, tc.Client)
		}
	}

	// Both counts, so the file cannot degenerate into "all divergent" either.
	if divergent == 0 {
		t.Error("no divergences left in testdata/url-scheme-cases.json. If the two guards were " +
			"genuinely reconciled that is good news, but it is a deliberate change: delete this " +
			"test and the claim it defends in safe-url.ts. If instead the client column was " +
			"rewritten to match the server column, that is the failure this test exists to catch.")
	}
	if agreeing == 0 {
		t.Error("every fixture diverges, which means the two guards share no behaviour at all. " +
			"That is almost certainly a broken measurement rather than a real result.")
	}
	t.Logf("shared fixtures: %d cases, %d agree, %d diverge", len(cases), agreeing, divergent)
}

// TestURLBearingRemoteDataKeysCoversConvertReads is audit finding F3.
//
// urlBearingRemoteDataKeys is a hand-maintained list whose comment says "keep
// this in sync with the RemoteData reads in convert.go". Nothing enforced that.
// If convert.go starts surfacing another RemoteData key as a URL-typed proto
// field, the import path silently stops validating it.
//
// This reads convert.go's source and requires every RemoteData key it reads to
// be either in the allow-list of keys we have inspected and judged non-URL, or
// in urlBearingRemoteDataKeys. A new key is a hard failure until someone
// classifies it.
func TestURLBearingRemoteDataKeysCoversConvertReads(t *testing.T) {
	// Keys convert.go reads out of RemoteData that do NOT reach an href, each
	// with the reason. Adding to this list is a deliberate, reviewable act.
	nonURLKeys := map[string]string{
		"remote_id": "convert.go:318 -> Task.remote_id, an opaque platform identifier rendered as text",
		"platform": "convert.go:259 -> platformStringToProto, which maps the string onto a closed " +
			"pb.Platform enum. An unrecognised value becomes PLATFORM_UNSPECIFIED, so the " +
			"caller's string never reaches the client verbatim, let alone an href.",
	}

	path := filepath.Join(repoRoot(t), "internal", "server", "convert.go")
	src, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading convert.go: %v", err)
	}

	found := remoteDataKeysIn(string(src))

	// Positive control. If the extractor stops matching anything -- because
	// convert.go was reformatted, or the map access was refactored behind a
	// helper -- every assertion below passes vacuously. Pin the one key we know
	// is there and is URL-bearing.
	if !slices.Contains(found, "remote_url") {
		t.Fatalf("positive control: the extractor found no RemoteData[\"remote_url\"] read in %s. "+
			"It found %v. This test can no longer see convert.go's RemoteData reads, so it is "+
			"not checking anything -- fix the extractor before trusting a green run.", path, found)
	}

	for _, key := range found {
		if reason, ok := nonURLKeys[key]; ok {
			t.Logf("RemoteData[%q]: not URL-bearing (%s)", key, reason)
			continue
		}
		if slices.Contains(urlBearingRemoteDataKeys, key) {
			continue
		}
		t.Errorf("convert.go reads RemoteData[%q] but it is in neither urlBearingRemoteDataKeys "+
			"nor this test's nonURLKeys list. If that value reaches an href in the dashboard, "+
			"collection import is currently writing it unvalidated: add it to "+
			"urlBearingRemoteDataKeys in urlvalidate.go. If it does not, add it to nonURLKeys "+
			"here with the reason.", key)
	}

	// The reverse direction: a key we validate but nobody reads is dead weight
	// and, worse, suggests coverage that is not there.
	for _, key := range urlBearingRemoteDataKeys {
		if !slices.Contains(found, key) {
			t.Errorf("urlBearingRemoteDataKeys contains %q but convert.go no longer reads it. "+
				"Either the read moved (point this test at its new home) or the entry is stale.", key)
		}
	}
}

// remoteDataKeysIn extracts the string literal K from every `RemoteData["K"]`
// occurrence in Go source. A deliberately dumb scan: it has to keep working
// when convert.go changes around it, and a false positive costs one line in
// nonURLKeys while a false negative costs coverage.
func remoteDataKeysIn(src string) []string {
	const marker = `RemoteData["`
	var keys []string
	for rest := src; ; {
		j := strings.Index(rest, marker)
		if j < 0 {
			break
		}
		rest = rest[j+len(marker):]
		end := strings.IndexByte(rest, '"')
		if end < 0 {
			break
		}
		if key := rest[:end]; key != "" && !slices.Contains(keys, key) {
			keys = append(keys, key)
		}
		rest = rest[end:]
	}
	return keys
}
