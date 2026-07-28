package server

import (
	"encoding/json"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/structpb"
)

// urlSchemeCase is one row of testdata/url-scheme-cases.json.
type urlSchemeCase struct {
	Name          string `json:"name"`
	Input         string `json:"input"`
	Server        string `json:"server"`
	Client        string `json:"client"`
	BaseDependent bool   `json:"base_dependent"`
	Note          string `json:"note"`
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

// Vocabulary a divergence note has to draw on. A note that explains a
// DISAGREEMENT has to say something about both sides of it; naming only one
// implementation describes a decision, not a divergence.
//
// These are deliberately implementation names rather than a keyword soup: they
// are the terms that appear when someone has actually looked at why the two
// parsers differ.
var (
	serverMechanismTerms = []string{"net/url", "validateURLField", "control-character"}
	clientMechanismTerms = []string{"WHATWG", "new URL("}
)

// minDivergenceNoteLen is a floor, not a target. Measured: the shortest note in
// the file at the time of writing is 187 characters.
const minDivergenceNoteLen = 80

// divergenceNoteProblems returns the reasons tc's note fails to describe tc's
// divergence, or nil if it is acceptable. Callers pass only divergent cases.
//
// Every rule here is derived from the case's own columns and marker, so this is
// not a checklist of expected note texts that would have to be maintained in
// lockstep with the file.
func divergenceNoteProblems(tc urlSchemeCase) []string {
	var problems []string
	note := tc.Note

	if strings.TrimSpace(note) == "" {
		return []string{"has no \"note\" at all"}
	}
	if len(note) < minDivergenceNoteLen {
		problems = append(problems, fmt.Sprintf(
			"note is %d characters; a description of a parser divergence needs at least %d",
			len(note), minDivergenceNoteLen))
	}

	// The direction is derivable from the columns, so it can be CHECKED rather
	// than trusted. This is the rule that catches a note swapped onto the wrong
	// case, and a note rewritten to prose that says nothing.
	lower := strings.ToLower(note)
	const serverDir = "server is more permissive"
	const clientDir = "client is more permissive"
	wantDir, otherDir := clientDir, serverDir
	if tc.Server == "accept" {
		wantDir, otherDir = serverDir, clientDir
	}
	if !strings.Contains(lower, wantDir) {
		problems = append(problems, fmt.Sprintf(
			"server=%s client=%s, so the note must say %q; it does not",
			tc.Server, tc.Client, wantDir))
	}
	if strings.Contains(lower, otherDir) {
		problems = append(problems, fmt.Sprintf(
			"the note claims %q, which contradicts server=%s client=%s",
			otherDir, tc.Server, tc.Client))
	}

	if !containsAny(note, serverMechanismTerms) {
		problems = append(problems, fmt.Sprintf(
			"the note names no server-side mechanism (one of %v); a divergence note has to say "+
				"what the SERVER did", serverMechanismTerms))
	}
	if !containsAny(note, clientMechanismTerms) {
		problems = append(problems, fmt.Sprintf(
			"the note names no client-side mechanism (one of %v); a divergence note has to say "+
				"what the CLIENT did", clientMechanismTerms))
	}

	// A base-dependent case states a host that the browser may not use. The
	// marker is checked against a real anchor on the client side
	// (testBaseDependenceMarkersAreAccurate); this makes the note carry it too,
	// so a reader who only ever sees the note is not misled. Both directions,
	// because a note that claims base-dependence for an unmarked case is just as
	// wrong as a marked case that stays silent.
	switch declares := noteDeclaresBaseDependence(lower); {
	case tc.BaseDependent && !declares:
		problems = append(problems, "the fixture is marked \"base_dependent\" but the note does "+
			"not say so; any host it quotes is safeHref's base-less parse, not necessarily the "+
			"browser's")
	case !tc.BaseDependent && declares:
		problems = append(problems, "the note declares this case base-dependent but the fixture "+
			"is not marked \"base_dependent\". The marker is the measured one -- "+
			"testBaseDependenceMarkersAreAccurate() resolves every input at two document bases -- "+
			"so the note is what is wrong")
	}

	return problems
}

// noteDeclaresBaseDependence reports whether a lowercased note asserts that its
// case IS base-dependent.
//
// "Not base-dependent" is a useful thing for a note to say, and a plain
// Contains("base-dependent") reads it as the opposite. Measured, and it was not
// a hypothetical: the first version of this rule used Contains, and the
// mutation that moves a marker onto "backslash host confusion" -- whose note
// reads "Not base-dependent -- measured evil.com under both bases" -- survived
// on the Go side. The client-side marker test still killed it, but a rule that
// only fires when another test would have caught it anyway is not a rule.
func noteDeclaresBaseDependence(lower string) bool {
	return strings.Contains(strings.ReplaceAll(lower, "not base-dependent", ""), "base-dependent")
}

func containsAny(s string, terms []string) bool {
	for _, term := range terms {
		if strings.Contains(s, term) {
			return true
		}
	}
	return false
}

// TestSharedFixturesRecordRealDivergences is the anti-vacuity control for the
// pair of differential tests.
//
// Without it, both halves would stay green if someone "resolved" the
// disagreement by rewriting every client column to match the server column.
// The disagreement is the finding; erasing it on paper must not be silent.
//
// WHAT CHANGED AND WHY. This used to check `Note != ""`, which is a check on the
// existence of a note rather than on its content: rewriting all nine notes to
// "Bananas." left it GREEN. That is the same defect as a declared constraint
// nothing invokes -- the file looked documented and was not. The rules now
// applied are in divergenceNoteProblems, and each is derived from the case's own
// columns rather than from a table of expected texts. Notably the direction rule
// is identity-reactive: swapping two notes between cases that diverge in
// opposite directions fails, with the note count and every note's text unchanged.
func TestSharedFixturesRecordRealDivergences(t *testing.T) {
	cases := loadURLSchemeCases(t)

	var divergent, agreeing int
	noteOwner := map[string]string{}
	for _, tc := range cases {
		if tc.Client != "accept" && tc.Client != "reject" {
			t.Errorf("fixture %q has an invalid \"client\" value %q; want accept or reject", tc.Name, tc.Client)
			continue
		}
		if tc.Server == tc.Client {
			if tc.Note != "" {
				t.Errorf("fixture %q agrees on both sides (server=client=%s) but carries a "+
					"divergence note. Either the columns are wrong or the note is.", tc.Name, tc.Server)
			}
			agreeing++
			continue
		}
		divergent++
		for _, problem := range divergenceNoteProblems(tc) {
			t.Errorf("fixture %q (server=%s client=%s): %s\nnote: %q",
				tc.Name, tc.Server, tc.Client, problem, tc.Note)
		}
		// Nine notes that are all the same string satisfy every per-note rule
		// above while telling the reader nothing about any individual case.
		if prev, dup := noteOwner[tc.Note]; dup {
			t.Errorf("fixtures %q and %q share the same note verbatim; a divergence note has to "+
				"describe ITS divergence", prev, tc.Name)
		} else {
			noteOwner[tc.Note] = tc.Name
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

// TestDivergenceNoteRuleRejectsANoteThatDescribesNothing is the control for the
// control.
//
// divergenceNoteProblems is only worth having if it actually rejects the note
// that provoked it. The previous `Note != ""` check would have passed every
// negative case below. Both directions are exercised: a real note from the file
// must be accepted, or the rule is merely strict rather than correct.
func TestDivergenceNoteRuleRejectsANoteThatDescribesNothing(t *testing.T) {
	// A real, unmodified fixture: the rule must not simply reject everything.
	var real urlSchemeCase
	for _, tc := range loadURLSchemeCases(t) {
		if tc.Server != tc.Client {
			real = tc
			break
		}
	}
	if real.Name == "" {
		t.Fatal("no divergent fixture found; this control cannot run")
	}
	if problems := divergenceNoteProblems(real); len(problems) != 0 {
		t.Fatalf("positive control: the rule rejects the real fixture %q: %v", real.Name, problems)
	}

	good := urlSchemeCase{
		Name: "synthetic", Input: "http:/example.com", Server: "reject", Client: "accept",
		Note: "Client is MORE permissive: WHATWG's new URL() yields a host here, while net/url " +
			"treats the input as a rootless path with Host == \"\" and the server rejects it.",
	}
	if problems := divergenceNoteProblems(good); len(problems) != 0 {
		t.Errorf("a well-formed synthetic note was rejected: %v", problems)
	}

	// Every negative holds the note COUNT fixed at one and corrupts only its
	// identity, which is the mutation class the old check could not see.
	negatives := []struct {
		name string
		tc   urlSchemeCase
	}{
		{
			"the mutation the old check survived: prose that says nothing",
			mutateNote(good, "Bananas. Bananas bananas bananas bananas bananas bananas bananas bananas bananas."),
		},
		{
			"empty",
			mutateNote(good, ""),
		},
		{
			"too short to be a description",
			mutateNote(good, "Client is MORE permissive: WHATWG, net/url."),
		},
		{
			"the wrong direction, everything else intact",
			mutateNote(good, strings.Replace(good.Note, "Client is MORE", "Server is MORE", 1)),
		},
		{
			"names only the client's mechanism",
			mutateNote(good, "Client is MORE permissive: WHATWG's new URL() accepts this input, and the "+
				"server does not accept it, which is the whole of the difference between them here."),
		},
		{
			"names only the server's mechanism",
			mutateNote(good, "Client is MORE permissive: net/url treats the input as a rootless path with "+
				"an empty Host, so validateURLField rejects it, and the client does not reject it."),
		},
		{
			"base-dependent but the note does not say so",
			func() urlSchemeCase { c := good; c.BaseDependent = true; return c }(),
		},
		{
			// The mutation that survived the first version of this rule.
			"base-dependent, and the note says the exact opposite",
			func() urlSchemeCase {
				c := good
				c.BaseDependent = true
				c.Note += " Not base-dependent -- measured the same host under both document bases."
				return c
			}(),
		},
		{
			"not base-dependent, but the note claims it is",
			mutateNote(good, good.Note+" BASE-DEPENDENT: the browser may resolve this elsewhere."),
		},
	}
	for _, neg := range negatives {
		if problems := divergenceNoteProblems(neg.tc); len(problems) == 0 {
			t.Errorf("%s: divergenceNoteProblems accepted a note it must reject.\nnote: %q",
				neg.name, neg.tc.Note)
		}
	}
}

func mutateNote(tc urlSchemeCase, note string) urlSchemeCase {
	tc.Note = note
	return tc
}

// TestRemoteDataKeysWrittenByAdaptersAreClassified replaces
// TestURLBearingRemoteDataKeysCoversConvertReads, which asked an unanswerable
// question.
//
// The old test read convert.go and required every RemoteData key convert.go
// READS to be classified. That invariant is not satisfiable, because
// convert.go's last act is `structpb.NewStruct(RemoteData)` -- a read of every
// key that will ever exist. The list it checked against was already wrong:
// "html_url" carries the same GitHub issue URL as "remote_url" and appeared in
// neither the list nor this test's failure surface.
//
// Turn it around. The set of keys the tree's platform adapters WRITE is finite
// and enumerable, so that is the set to classify. Every key written into a
// remote_data map by any adapter must be either URL-bearing by
// urlBearingRemoteDataKey -- and therefore validated on both the write and the
// read boundary -- or listed below as non-URL with a reason.
//
// A key that carries a URL but is not NAMED like one (say "permalink_target")
// is the gap this cannot close by itself; that is what the explicit reason on
// each nonURLKeys entry is for.
func TestRemoteDataKeysWrittenByAdaptersAreClassified(t *testing.T) {
	// Keys the adapters write that do NOT hold a URL, each with the reason.
	// Adding to this list is a deliberate, reviewable act.
	nonURLKeys := map[string]string{
		"platform": "a closed platform discriminator; convert.go maps it onto the pb.Platform " +
			"enum, so an unrecognised value becomes PLATFORM_UNSPECIFIED",
		"remote_id":          "opaque platform identifier (\"owner/repo#1\"), rendered as text",
		"node_id":            "opaque GitHub GraphQL node identifier, rendered as text",
		"number":             "an int issue number",
		"created_at":         "an RFC3339 timestamp string",
		"updated_at":         "an RFC3339 timestamp string",
		"closed_at":          "an RFC3339 timestamp string",
		"due_at":             "an RFC3339 timestamp string",
		"defer_until":        "an RFC3339 timestamp string",
		"started_at":         "an RFC3339 timestamp string",
		"labels":             "a slice of label names",
		"milestone":          "a milestone title, free text",
		"state_reason":       "a GitHub state-reason enum string",
		"parent":             "a nested map of the parent issue's node_id and number; its own keys are checked separately below",
		"sub_issues":         "a slice of nested maps (number/title/state); their keys are checked separately below",
		"sub_issues_summary": "a nested map of three int counters; its keys are checked separately below",
		"dependencies":       "a slice of nested beads dependency maps; their keys are checked separately below",
		"priority":           "a beads priority value",
		"status":             "a beads status string",
		"issue_type":         "a beads issue-type string",
		"design":             "beads free text",
		"notes":              "beads free text",
		"owner":              "a beads owner name, rendered as text",
		"created_by":         "a beads actor name, rendered as text",
		"source_system":      "a beads source-system discriminator, rendered as text",
		"external_ref": "a beads cross-system reference. NOT a URL by construction -- beads " +
			"writes an opaque \"system:id\" token -- but this is the closest call in the " +
			"list, and if a beads deployment ever puts a URL there the name will not say so",
		"metadata": "an opaque json.RawMessage blob of platform payload. Not walked by " +
			"sanitizeRemoteData: structpb.NewStruct cannot represent json.RawMessage " +
			"either, so it never reaches the wire at all (same mechanism as " +
			"TestGitHubPassthroughRemoteDataNeverSerialises)",
	}

	// Nested keys are held to a stricter rule than top-level ones: they may not
	// be URL-bearing AT ALL, because sanitizeRemoteData walks only the top level.
	// There is no reasons-map here on purpose -- a nested URL carrier is a gap,
	// not something to document away.

	// The adapters that synthesise remote_data. These are the writers; the
	// serialisation in convert.go is the reader and it reads everything.
	adapters := []string{
		filepath.Join("internal", "platform", "github", "graphql_queries.go"),
		filepath.Join("internal", "platform", "github", "github.go"),
		filepath.Join("internal", "platform", "beads", "beads.go"),
	}

	var found, nested []string
	for _, rel := range adapters {
		path := filepath.Join(repoRoot(t), rel)
		src, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("reading %s: %v", rel, err)
		}
		fileTop, fileNested := remoteDataLiteralKeysIn(string(src))
		for _, key := range fileTop {
			if !slices.Contains(found, key) {
				found = append(found, key)
			}
		}
		for _, key := range fileNested {
			if !slices.Contains(nested, key) {
				nested = append(nested, key)
			}
		}
	}
	slices.Sort(found)
	slices.Sort(nested)

	// Positive control. If the extractor stops matching -- because an adapter
	// was reformatted, or the map literal moved behind a builder -- every
	// assertion below passes vacuously. Pin the two keys we know are there and
	// are URL-bearing. "html_url" specifically: it is the key the previous
	// mechanism could not see, so if this test can no longer see it either, the
	// test has regressed to the state it was written to fix.
	for _, want := range []string{"remote_url", "html_url"} {
		if !slices.Contains(found, want) {
			t.Fatalf("positive control: the extractor found no top-level %q key in any "+
				"adapter. It found %v. This test can no longer see the adapters' "+
				"remote_data writes, so it is not checking anything -- fix the extractor "+
				"before trusting a green run.", want, found)
		}
	}
	// Second positive control, for the nesting split specifically. If the stack
	// in remoteDataLiteralKeysIn collapses, every nested key lands in `found`
	// instead and the nested rule below goes vacuous. "percent_completed" is
	// only ever written inside sub_issues_summary.
	if !slices.Contains(nested, "percent_completed") {
		t.Fatalf("positive control: %q should have been found as a NESTED key "+
			"(issueBuildRemoteData writes it inside sub_issues_summary). Nested keys "+
			"found: %v; top-level: %v. The nesting split has stopped working.",
			"percent_completed", nested, found)
	}
	if slices.Contains(found, "percent_completed") {
		t.Errorf("%q was classified as a TOP-LEVEL remote_data key; it is written inside "+
			"sub_issues_summary. The nesting split is misattributing keys.", "percent_completed")
	}

	for _, key := range found {
		if urlBearingRemoteDataKey(key) {
			t.Logf("remote_data[%q]: URL-bearing, validated on both boundaries", key)
			continue
		}
		if reason, ok := nonURLKeys[key]; ok {
			t.Logf("remote_data[%q]: not URL-bearing (%s)", key, reason)
			continue
		}
		t.Errorf("an adapter writes remote_data[%q], but urlBearingRemoteDataKey says it is "+
			"not URL-bearing and this test has no reason on file for that. If the value can "+
			"reach an href in the dashboard, teach urlBearingRemoteDataKey about it in "+
			"urlvalidate.go -- it is currently unvalidated on both the import boundary and "+
			"the read path. If it cannot, add it to nonURLKeys here with the reason.", key)
	}

	// Nested keys: none may be URL-bearing, because sanitizeRemoteData only walks
	// the top level. This is a real invariant, not bookkeeping -- a URL under
	// remote_data["parent"]["html_url"] would reach the wire unvalidated.
	for _, key := range nested {
		if urlBearingRemoteDataKey(key) {
			t.Errorf("an adapter writes a NESTED remote_data key %q that is URL-bearing. "+
				"sanitizeRemoteData walks only the top level of the map, so this value "+
				"is serialised into pb.Task.remote_data without ever being validated. "+
				"Either flatten it to a top-level key or teach sanitizeRemoteData to "+
				"recurse.", key)
		}
	}
	t.Logf("nested remote_data keys checked: %v", nested)

	// The reverse direction: a key classified as URL-bearing that no adapter
	// writes is not an error (the predicate is a naming rule, not a list), but a
	// nonURLKeys entry for a key nobody writes is stale documentation.
	for key := range nonURLKeys {
		if !slices.Contains(found, key) {
			t.Errorf("nonURLKeys documents %q as a non-URL adapter key, but no adapter writes "+
				"it any more. Remove the entry rather than leaving it to suggest coverage "+
				"that is not there.", key)
		}
	}
}

// TestSanitizeRemoteDataScrubsEveryURLCarrier pins the map-level scrub directly,
// at the unit level, so the property does not depend on the GraphQL mock in
// passthrough_url_test.go continuing to emit both carriers.
func TestSanitizeRemoteDataScrubsEveryURLCarrier(t *testing.T) {
	const bad = "javascript:alert(1)"
	const good = "https://github.com/acme/widgets/issues/1"

	in := map[string]any{
		"remote_url": bad,
		"html_url":   bad,
		"remote_id":  "acme/widgets#1",
		"number":     1,
	}
	out := sanitizeRemoteData(in)

	for _, key := range []string{"remote_url", "html_url"} {
		if v, ok := out[key]; ok {
			t.Errorf("sanitizeRemoteData kept %q = %v; every URL-bearing carrier must be "+
				"dropped, not just the one the typed field reads", key, v)
		}
	}

	// Anti-vacuity, by identity rather than by count: the non-URL keys must
	// survive with their values intact. A sanitizer that returned an empty map,
	// or that dropped the wrong keys, would satisfy the assertions above.
	if got := out["remote_id"]; got != "acme/widgets#1" {
		t.Errorf("non-URL key remote_id should survive unchanged, got %v", got)
	}
	if got := out["number"]; got != 1 {
		t.Errorf("non-URL key number should survive unchanged, got %v", got)
	}

	// Positive control: a legitimate URL must survive on both carriers,
	// otherwise the drops above prove nothing.
	okOut := sanitizeRemoteData(map[string]any{"remote_url": good, "html_url": good})
	for _, key := range []string{"remote_url", "html_url"} {
		if okOut[key] != good {
			t.Errorf("positive control: %q = %v should have survived sanitizing; "+
				"if it did not, the drop assertions above are vacuous", key, okOut[key])
		}
	}

	// The input map belongs to the ent entity and must not be touched.
	if in["remote_url"] != bad {
		t.Errorf("sanitizeRemoteData mutated its input: remote_url is now %v", in["remote_url"])
	}
}

// TestTaskToProtoScrubsRemoteDataURLCarriers pins that sanitizeRemoteData is
// actually WIRED IN, not merely correct in isolation.
//
// It uses a RemoteData map whose values are all structpb-representable, which
// is the shape an ent-stored or collection-imported task has (a JSON round-trip
// yields []any, not []string). That matters: the GitHub passthrough path cannot
// exercise this at all -- see
// TestGitHubPassthroughRemoteDataNeverSerialises.
func TestTaskToProtoScrubsRemoteDataURLCarriers(t *testing.T) {
	const bad = "javascript:alert(1)"
	id := uuid.New()

	pt := taskToProto(&ent.Task{
		ID:    id,
		Title: "poisoned",
		RemoteData: map[string]any{
			"platform":   "github",
			"remote_id":  "acme/widgets#1",
			"remote_url": bad,
			"html_url":   bad,
			"labels":     []any{"bug"}, // []any, as a JSON round-trip produces
		},
	})

	if got := pt.GetRemoteUrl(); got != "" {
		t.Errorf("typed remote_url = %q, want it dropped", got)
	}
	fields := pt.GetRemoteData().GetFields()
	for _, key := range []string{"remote_url", "html_url"} {
		if v, present := fields[key]; present {
			t.Errorf("remote_data[%q] = %q reached the wire; taskToProto must run "+
				"RemoteData through sanitizeRemoteData, not serialise it raw",
				key, v.GetStringValue())
		}
	}

	// Anti-vacuity by identity: the map must have serialised and kept its
	// non-URL keys. Without this the absence checks pass on a nil struct --
	// which is exactly the trap the passthrough path falls into.
	if got := fields["remote_id"].GetStringValue(); got != "acme/widgets#1" {
		t.Errorf("remote_data[remote_id] = %q, want it preserved. If this is empty the "+
			"struct did not serialise and the assertions above are vacuous. "+
			"Present keys: %v", got, slices.Sorted(maps.Keys(fields)))
	}
}

// TestGitHubPassthroughRemoteDataNeverSerialises pins a silent behaviour that
// nothing recorded before, and that materially changes how the remote_data
// finding should be read.
//
// convert.go writes `pt.RemoteData, _ = structpb.NewStruct(t.RemoteData)` and
// discards the error. structpb.NewStruct rejects []string outright, and
// platform/github/graphql_queries.go::issueBuildRemoteData always sets
// "labels" to a []string. So for every task from the live GitHub passthrough
// store, remote_data is silently nil on the wire -- not because anything chose
// to drop it, but because the whole struct failed to build and nobody looked.
//
// Consequences worth stating, since a reader will otherwise draw the wrong one:
//   - The remote_data re-emission gap is REAL, but on the ent-stored and
//     collection-imported paths, not on this one.
//   - Any test asserting "remote_url is absent from remote_data" on the
//     passthrough path is vacuous, and would stay green against a taskToProto
//     with no sanitizing at all.
//
// Left as-is rather than fixed: making remote_data serialise here would be a
// visible behaviour change (a field that is empty today starts being populated)
// and belongs in its own change, not in a security round.
func TestGitHubPassthroughRemoteDataNeverSerialises(t *testing.T) {
	labels := []string{"bug"}

	if _, err := structpb.NewStruct(map[string]any{"labels": labels}); err == nil {
		t.Fatal("structpb.NewStruct now accepts []string. The passthrough path can " +
			"therefore ship remote_data, and TestPassthroughReadDropsUnsafeRemoteURL " +
			"must be upgraded to assert absence of remote_url and html_url there.")
	}

	// Positive control: the identical map with a structpb-representable slice
	// builds fine, so the failure above is about the value type and not about
	// NewStruct being broken.
	if _, err := structpb.NewStruct(map[string]any{"labels": []any{"bug"}}); err != nil {
		t.Fatalf("positive control: []any should serialise, got %v", err)
	}
}

// TestURLBearingRemoteDataKeyClassification pins the predicate itself. Without
// it, the classification test above could go green on a predicate that returned
// true for everything (every key "URL-bearing", nothing ever checked against
// nonURLKeys) or false for everything (caught only by the two-key control).
func TestURLBearingRemoteDataKeyClassification(t *testing.T) {
	urlBearing := []string{"url", "remote_url", "html_url", "URL", "Html_URL",
		"avatar_url", "uri", "canonical_uri", "href", "permalink", "issue-url"}
	notURLBearing := []string{"remote_id", "node_id", "number", "created_at",
		"labels", "milestone", "platform", "urlish", "curl", "state_reason"}

	for _, k := range urlBearing {
		if !urlBearingRemoteDataKey(k) {
			t.Errorf("urlBearingRemoteDataKey(%q) = false, want true", k)
		}
	}
	for _, k := range notURLBearing {
		if urlBearingRemoteDataKey(k) {
			t.Errorf("urlBearingRemoteDataKey(%q) = true, want false", k)
		}
	}
}

// remoteDataBuilderFuncs are the functions that construct a task's RemoteData
// map. Scanning whole adapter files instead would sweep up the GraphQL variable
// maps that live beside them ("repo", "states", "title", ...), which are not
// remote_data at all.
var remoteDataBuilderFuncs = []string{
	"func issueBuildRemoteData(",
	"func buildRemoteData(",
}

// remoteDataLiteralKeysIn extracts the keys written into a remote_data map by
// any of remoteDataBuilderFuncs, split by nesting.
//
// TOP is the set of keys at the top level of the map that becomes
// Task.RemoteData. NESTED is every key of a map literal underneath one of those
// (issueBuildRemoteData's "parent" and "sub_issues_summary",
// beads' "dependencies", ...). The split is load-bearing rather than cosmetic:
// sanitizeRemoteData walks only the top level, so a URL under a nested key would
// be shipped unvalidated. Merging the two sets would let a nested key inherit a
// top-level key's "validated on both boundaries" verdict, which is exactly the
// kind of true-measurement-false-sentence this round exists to remove.
//
// Within a builder body it matches two shapes:
//
//	"key": value          inside a map literal
//	rd["key"] = value     conditional additions after it
//
// Nesting is tracked by a stack rather than by counting braces, because `if`
// blocks and `append(deps, map[string]any{...})` both open braces that have
// nothing to do with map depth. Only the map literal assigned to `rd :=` is
// top-level; every other literal pushes a nested frame.
//
// Deliberately dumb, like remoteDataKeysIn: a false positive costs one line in
// nonURLKeys, a false negative costs coverage, and the positive control in the
// caller is what catches a scan that has stopped working entirely.
func remoteDataLiteralKeysIn(src string) (top, nested []string) {
	add := func(dst *[]string, k string) {
		if k != "" && !slices.Contains(*dst, k) {
			*dst = append(*dst, k)
		}
	}

	for _, marker := range remoteDataBuilderFuncs {
		start := strings.Index(src, marker)
		if start < 0 {
			continue
		}
		body := src[start:]
		// The function body ends at the first line that is a closing brace at
		// column 0, which gofmt guarantees for a top-level declaration.
		if end := strings.Index(body, "\n}\n"); end >= 0 {
			body = body[:end]
		}

		// stack[i] reports whether the i'th enclosing map literal is the
		// top-level remote_data map.
		var stack []bool
		for _, line := range strings.Split(body, "\n") {
			line = strings.TrimSpace(line)

			if len(stack) > 0 && strings.HasPrefix(line, "}") {
				stack = stack[:len(stack)-1]
				continue
			}

			// Shape 1: "key": value, attributed to the innermost open literal.
			if len(stack) > 0 && strings.HasPrefix(line, `"`) {
				if end := strings.Index(line[1:], `"`); end >= 0 &&
					strings.HasPrefix(strings.TrimSpace(line[end+2:]), ":") {
					if stack[len(stack)-1] {
						add(&top, line[1:1+end])
					} else {
						add(&nested, line[1:1+end])
					}
				}
			}

			// Shape 2: rd["key"] = value, only meaningful outside any literal.
			if len(stack) == 0 {
				for _, recv := range []string{`rd["`, `remoteData["`} {
					if !strings.HasPrefix(line, recv) {
						continue
					}
					tail := line[len(recv):]
					end := strings.IndexByte(tail, '"')
					if end < 0 {
						continue
					}
					if strings.HasPrefix(strings.TrimSpace(tail[end+2:]), "=") {
						add(&top, tail[:end])
					}
				}
			}

			if strings.HasSuffix(line, "map[string]any{") {
				isTop := strings.HasPrefix(line, "rd := ") ||
					strings.HasPrefix(line, "remoteData := ")
				stack = append(stack, isTop)
			}
		}
	}

	return top, nested
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
