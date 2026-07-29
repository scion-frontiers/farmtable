package server

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"maps"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"strconv"
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

// baseDependenceNegators are the ways a note can say a case is NOT
// base-dependent. Matched as whole words, immediately before the term.
var baseDependenceNegation = regexp.MustCompile(
	`(?:\bnot\b|\bnever\b|\bno longer\b|\bnon-?\b|\bneither\b|\bnor\b|\bwithout\b|n't\b)[^.;:!?]{0,24}$`)

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
//
// The version after that stripped the literal string "not base-dependent" and
// then looked for the term. That handles ONE spelling of the negation. Review
// found three more that invert it -- "never base-dependent", "isn't
// base-dependent", "no longer base-dependent" -- each of which leaves the term
// standing after the strip and so reads as a positive declaration. For a case
// that IS marked base_dependent, a note reading "never base-dependent" then
// contradicts the marker and passes.
//
// So: find every occurrence of the term and look for a negator in the words
// immediately preceding it, stopping at a sentence boundary. A note that
// contains both a negated and an unnegated occurrence declares base-dependence,
// because one of its sentences does.
func noteDeclaresBaseDependence(lower string) bool {
	const term = "base-dependent"
	for i := 0; ; {
		j := strings.Index(lower[i:], term)
		if j < 0 {
			return false
		}
		at := i + j
		start := max(at-64, 0)
		if !baseDependenceNegation.MatchString(lower[start:at]) {
			return true
		}
		i = at + len(term)
	}
}

// TestNoteDeclaresBaseDependence pins the negation handling.
//
// Every row marked false is a spelling that the previous implementation read as
// a POSITIVE declaration, because it stripped one literal phrase and then looked
// for the term. On a fixture marked base_dependent, a note reading "never
// base-dependent" therefore contradicted the marker and passed.
//
// The rows marked true are the anti-vacuity half: a rule that returns false for
// everything would satisfy all the negatives and prove nothing.
func TestNoteDeclaresBaseDependence(t *testing.T) {
	cases := []struct {
		note string
		want bool
	}{
		// Declares base-dependence.
		{"base-dependent: resolves against the document base", true},
		{"this one is base-dependent", true},
		{"measured base-dependent under two bases", true},
		{"not a scheme issue; this case is base-dependent", true},
		{"not base-dependent on the client, but base-dependent on the server", true},

		// Denies it. Each of the middle three used to invert.
		{"not base-dependent -- measured evil.com under both bases", false},
		{"never base-dependent; the host is absolute", false},
		{"isn't base-dependent, the parse is the same either way", false},
		{"no longer base-dependent after the safeHref change", false},
		{"non-base-dependent by construction", false},
		{"resolves without base-dependent behaviour", false},

		// Says nothing about it.
		{"server rejects the scheme; client is more permissive", false},
		{"", false},
	}

	for _, tc := range cases {
		if got := noteDeclaresBaseDependence(tc.note); got != tc.want {
			t.Errorf("noteDeclaresBaseDependence(%q) = %v, want %v", tc.note, got, tc.want)
		}
	}

	// Anti-vacuity: both outcomes must occur in the table, or a constant
	// function passes half of it by construction.
	var trues, falses int
	for _, tc := range cases {
		if tc.want {
			trues++
		} else {
			falses++
		}
	}
	if trues == 0 || falses == 0 {
		t.Fatalf("the table proves nothing: %d true rows, %d false rows", trues, falses)
	}
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
			"TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident)",
	}

	// Nested keys are held to a stricter rule than top-level ones: they may not
	// be URL-bearing AT ALL. THE REASON THAT USED TO BE GIVEN HERE -- "because
	// sanitizeRemoteData walks only the top level" -- IS FALSE ON THIS TREE; it
	// recurses. The rule is kept and its actual justification, which is adapter
	// classification and not wire safety, is on classifyRemoteDataKeys below.
	// There is still no reasons-map here on purpose: an unclassified nested key
	// is a gap in this test's knowledge, not something to document away.

	// The adapters that synthesise remote_data. These are the writers; the
	// serialisation in convert.go is the reader and it reads everything.
	adapters := []string{
		filepath.Join("internal", "platform", "github", "graphql_queries.go"),
		filepath.Join("internal", "platform", "github", "github.go"),
		filepath.Join("internal", "platform", "beads", "beads.go"),
		// Not an adapter. UpdateTask builds remote_data straight from an RPC
		// request, so it is a writer on equal footing with the three above --
		// and the previous name-keyed scanner never looked at it, because the
		// function is not called buildRemoteData. Review found it; it is in the
		// list rather than in a comment about the list.
		filepath.Join("internal", "server", "server.go"),
	}

	var found, nested []string
	for _, rel := range adapters {
		path := filepath.Join(repoRoot(t), rel)
		src, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("reading %s: %v", rel, err)
		}
		fileTop, fileNested, err := remoteDataLiteralKeysIn(string(src))
		if err != nil {
			t.Fatalf("scanning %s: %v", rel, err)
		}
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

	// Logging pass. It reports what was seen and reaches no verdict; every
	// verdict below comes from classifyRemoteDataKeys, which a fixture drives.
	// The "validated on both boundaries" line is the subject of a separate
	// finding owned by another leg and is reproduced here UNCHANGED on purpose.
	for _, key := range found {
		if urlBearingRemoteDataKey(key) {
			t.Logf("remote_data[%q]: URL-bearing, validated on both boundaries", key)
			continue
		}
		if reason, ok := nonURLKeys[key]; ok {
			t.Logf("remote_data[%q]: not URL-bearing (%s)", key, reason)
		}
	}
	t.Logf("nested remote_data keys checked: %v", nested)

	for _, issue := range classifyRemoteDataKeys(found, nested, nonURLKeys) {
		switch issue.kind {
		case remoteDataKeyUnclassified:
			t.Errorf("an adapter writes remote_data[%q], but urlBearingRemoteDataKey says it is "+
				"not URL-bearing and this test has no reason on file for that. If the value can "+
				"reach an href in the dashboard, teach urlBearingRemoteDataKey about it in "+
				"urlvalidate.go -- it is currently unvalidated on both the import boundary and "+
				"the read path. If it cannot, add it to nonURLKeys here with the reason.", issue.key)
		case remoteDataKeyNestedURL:
			t.Errorf("an adapter writes a NESTED remote_data key %q that is URL-bearing. "+
				"sanitizeRemoteData DOES validate it (it recurses -- see the reason on "+
				"classifyRemoteDataKeys), so this is not a live exposure; it is an "+
				"UNCLASSIFIED adapter change. nonURLKeys documents top-level keys only and "+
				"there is no reasons-map for nested ones, so nothing here records what this "+
				"key is or whether it should be a URL. Classify it, then decide.", issue.key)
		case remoteDataKeyStaleExemption:
			t.Errorf("nonURLKeys documents %q as a non-URL adapter key, but no adapter writes "+
				"it any more. Remove the entry rather than leaving it to suggest coverage "+
				"that is not there.", issue.key)
		default:
			t.Errorf("classifyRemoteDataKeys returned an issue kind %q that this test does "+
				"not know how to report, for key %q. A new rule was added to the classifier "+
				"and its consequence was never wired up -- which is the exact defect the "+
				"extraction exists to prevent.", issue.kind, issue.key)
		}
	}
}

// The three verdicts classifyRemoteDataKeys can reach.
const (
	remoteDataKeyUnclassified   = "unclassified-top-level"
	remoteDataKeyNestedURL      = "nested-url-bearing"
	remoteDataKeyStaleExemption = "stale-exemption"
)

// remoteDataKeyIssue is one verdict, separated from its message so a fixture
// can reach it.
type remoteDataKeyIssue struct {
	kind string
	key  string
}

// classifyRemoteDataKeys holds the three classification rules that used to be
// inline t.Errorf arms inside TestRemoteDataKeysWrittenByAdaptersAreClassified.
//
// WHY IT IS A FUNCTION NOW. All three arms were VACUOUS on a clean tree --
// measured, not suspected: replace any one condition with a constant that never
// fires and the suite stays green, because on this tree every top-level key is
// classified, no nested key is URL-bearing, and no nonURLKeys entry is stale.
// Only the two t.Fatalf positive controls were live, and they prove the
// EXTRACTOR works, not that the CLASSIFICATION works. A rule whose error arm
// nothing can reach may be deleted, inverted, or refactored away at any time and
// every run stays green the whole way. Extracted, TestRemoteDataKeyClassification
// drives all three to both outcomes.
//
// This is the same remedy the web side applied to checkViaSafeHref and the Go
// side applied to remoteDataWriteIsSanitized, both in this diff's own history.
// The lesson had been carried to the code that DECIDES and not to the code that
// ACTS on the decision; this is the acting half.
//
// ---------------------------------------------------------------------------
// AND THE NESTED RULE'S STATED REASON WAS FALSE. IT IS CORRECTED HERE, NOT
// SOFTENED.
// ---------------------------------------------------------------------------
// It read: "none may be URL-bearing, because sanitizeRemoteData only walks the
// top level ... a URL under remote_data[parent][html_url] would reach the wire
// unvalidated." THAT IS NOT TRUE OF THIS TREE. sanitizeRemoteData recurses:
// sanitizeRemoteValue re-classifies every key it descends to, so a nested
// html_url is validated exactly like a top-level one. Measured in-tree, not
// inferred -- remotedata_depth_test.go pins BOTH directions:
// {"parent": {"html_url": javascript:...}} loses the key, and
// {"parent": {"html_url": https://...}} keeps it.
//
// So this rule is NOT what keeps a nested URL off the wire; the sanitizer is.
// What it still does is fire when an adapter starts writing a nested key that
// LOOKS like a URL carrier, which is an adapter change nobody has classified --
// nonURLKeys covers top-level keys only and there is no reasons-map for nested
// ones. IT IS A CHANGE DETECTOR OVER THE ADAPTERS, NOT A SAFETY GUARD, and it is
// documented as one so the next reader does not treat a green run here as
// evidence that nested URLs are being stopped somewhere.
//
// NOT ADJUDICATED, AND DELIBERATELY LEFT OPEN: whether a change detector should
// be a t.Errorf at all. Keeping it is not a ruling that it should be kept; it is
// a refusal to retire a rule in the same commit that discovered its reason was
// wrong.
func classifyRemoteDataKeys(found, nested []string, nonURLKeys map[string]string) []remoteDataKeyIssue {
	var issues []remoteDataKeyIssue

	for _, key := range found {
		if urlBearingRemoteDataKey(key) {
			continue
		}
		if _, ok := nonURLKeys[key]; ok {
			continue
		}
		issues = append(issues, remoteDataKeyIssue{remoteDataKeyUnclassified, key})
	}

	for _, key := range nested {
		if urlBearingRemoteDataKey(key) {
			issues = append(issues, remoteDataKeyIssue{remoteDataKeyNestedURL, key})
		}
	}

	// The reverse direction: a key classified as URL-bearing that no adapter
	// writes is not an error (the predicate is a naming rule, not a list), but a
	// nonURLKeys entry for a key nobody writes is stale documentation.
	for key := range nonURLKeys {
		if !slices.Contains(found, key) {
			issues = append(issues, remoteDataKeyIssue{remoteDataKeyStaleExemption, key})
		}
	}

	// Map iteration is random; a fixture comparing slices needs an order.
	slices.SortFunc(issues, func(a, b remoteDataKeyIssue) int {
		if a.kind != b.kind {
			return strings.Compare(a.kind, b.kind)
		}
		return strings.Compare(a.key, b.key)
	})
	return issues
}

// TestRemoteDataKeyClassification drives every arm of classifyRemoteDataKeys to
// BOTH outcomes, which is the thing the inline version could not do.
//
// The rows are inputs the tree does not currently produce, and that is the
// point: on a clean tree all three rules are unreachable, so a fixture that only
// fed them today's adapter keys would be exactly as vacuous as the loops it
// replaced. THE TREE'S STATE IS NOT THIS TEST'S COVERAGE.
func TestRemoteDataKeyClassification(t *testing.T) {
	reasons := func(keys ...string) map[string]string {
		m := map[string]string{}
		for _, k := range keys {
			m[k] = "documented as not URL-bearing"
		}
		return m
	}

	cases := []struct {
		name    string
		found   []string
		nested  []string
		reasons map[string]string
		want    []remoteDataKeyIssue
	}{
		{
			name:    "clean: classified top-level, benign nested, no stale entry",
			found:   []string{"remote_url", "state"},
			nested:  []string{"percent_completed"},
			reasons: reasons("state"),
			want:    nil,
		},
		{
			name:    "a top-level key that is neither URL-bearing nor documented",
			found:   []string{"remote_url", "mystery"},
			nested:  nil,
			reasons: reasons(),
			want:    []remoteDataKeyIssue{{remoteDataKeyUnclassified, "mystery"}},
		},
		{
			name:    "a nested URL-bearing key",
			found:   []string{"remote_url"},
			nested:  []string{"html_url"},
			reasons: reasons(),
			want:    []remoteDataKeyIssue{{remoteDataKeyNestedURL, "html_url"}},
		},
		{
			name:    "a nonURLKeys entry no adapter writes any more",
			found:   []string{"remote_url"},
			nested:  nil,
			reasons: reasons("retired_key"),
			want:    []remoteDataKeyIssue{{remoteDataKeyStaleExemption, "retired_key"}},
		},
		{
			name:    "all three at once, so no rule masks another",
			found:   []string{"mystery"},
			nested:  []string{"url"},
			reasons: reasons("retired_key"),
			want: []remoteDataKeyIssue{
				{remoteDataKeyNestedURL, "url"},
				{remoteDataKeyStaleExemption, "retired_key"},
				{remoteDataKeyUnclassified, "mystery"},
			},
		},
		{
			name:    "a documented top-level key is not reported, and documenting it is not stale",
			found:   []string{"state"},
			nested:  nil,
			reasons: reasons("state"),
			want:    nil,
		},
	}

	kinds := map[string]bool{}
	cleanRows := 0
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := classifyRemoteDataKeys(tc.found, tc.nested, tc.reasons)
			if !slices.Equal(got, tc.want) {
				t.Errorf("classifyRemoteDataKeys(%v, %v, %v)\n got %v\nwant %v",
					tc.found, tc.nested, slices.Sorted(maps.Keys(tc.reasons)), got, tc.want)
			}
		})
		if len(tc.want) == 0 {
			cleanRows++
		}
		for _, issue := range tc.want {
			kinds[issue.kind] = true
		}
	}

	// Anti-vacuity, in both directions. Every kind the classifier can emit must
	// be exercised by some row, or that rule is back to being unreachable and
	// this fixture is decoration; and some row must expect NO issues, or the
	// table would pass against a classifier that reports everything.
	for _, kind := range []string{
		remoteDataKeyUnclassified, remoteDataKeyNestedURL, remoteDataKeyStaleExemption,
	} {
		if !kinds[kind] {
			t.Errorf("no row expects a %q issue, so that rule is unreachable from this "+
				"fixture and can be deleted or inverted with the suite still green -- "+
				"which is the exact condition this test was written to end", kind)
		}
	}
	if cleanRows == 0 {
		t.Error("no row expects an empty result, so a classifier that flagged every key " +
			"would pass this table")
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

// TestMapStringStringStaysUnrepresentable_GuardsO1 pins a FAIL-CLOSED ACCIDENT,
// not a designed behaviour, and it exists because that accident has a scheduled
// removal date.
//
// XSS-R4-O1: sanitizeRemoteValue is TYPE-PRESERVING and its walk has no case for
// map[string]string. So
//
//	{"parent": map[string]string{"html_url": "javascript:alert(1)"}}
//
// passes the sanitizer VERBATIM -- never descended into, never validated. It
// fails to reach a browser today for exactly one reason, and it is not the
// sanitizer: structpb.NewValue has no case for map[string]string either, so
// structpb.NewStruct errors, and taskToProto drops the ENTIRE remote_data field.
// ** THE UNREPRESENTABILITY IS DOING THE SECURITY WORK, BY ACCIDENT. **
//
// That is why this is a test and not a comment. The next round will be dispatched
// to "make remote_data representable", which removes the masking correctly by its
// own lights; a comment does not survive that handoff to a leg that has not read
// this round's reports, and an alarm does. A deferral without an alarm is a
// no-action label with a longer fuse.
//
// READ THIS BEFORE YOU EDIT THE TEST TO MAKE IT PASS:
//   - If only the FIRST assertion goes red, representability normalisation has
//     landed. That is not automatically wrong -- but O1 is now unmasked, so the
//     walk must be verified to cover this shape before this test is retired.
//   - ** IF THE SECOND ASSERTION GOES RED, A javascript: URL IS REACHING THE
//     CLIENT INSIDE remote_data. THAT IS A LIVE XSS AND NOT A STALE TEST. **
//
// The fix in either case is to normalise on ENTRY, before the URL walk, so the
// walk descends into `parent`, recognises html_url as a URL-bearing key, and
// drops the value. Normalising at the EXIT converts this fail-closed accident
// into fail-open and delivers the URL. Credit: review-xss-r4.
func TestMapStringStringStaysUnrepresentable_GuardsO1(t *testing.T) {
	const bad = "javascript:alert(1)"

	// A Go-native map[string]string, as an in-memory adapter literal produces.
	// A JSON round-trip could not yield this type -- that is the reachability
	// precondition the whole finding rests on.
	raw := map[string]any{
		"platform": "github",
		"parent":   map[string]string{"html_url": bad},
	}

	// Positive control: the sanitizer leaves the poisoned value exactly where it
	// was. Without this, the assertions below would also pass if the sanitizer
	// had simply dropped `parent`, and the test would be guarding nothing.
	sanitized := sanitizeRemoteData(raw)
	parent, ok := sanitized["parent"].(map[string]string)
	if !ok {
		t.Fatalf("precondition gone: sanitizeRemoteData no longer passes "+
			"map[string]string through as-is (got %T). If the walk now HANDLES "+
			"this type, O1 is fixed at the walk and this test should be replaced "+
			"by one asserting the URL was dropped by the SANITIZER.",
			sanitized["parent"])
	}
	if parent["html_url"] != bad {
		t.Fatalf("precondition gone: the sanitizer now validates inside "+
			"map[string]string (html_url = %q). O1 is fixed at the walk; replace "+
			"this test rather than deleting it.", parent["html_url"])
	}

	// 1. THE MECHANISM. structpb cannot represent it, so the field is discarded.
	if _, err := structpb.NewStruct(sanitized); err == nil {
		t.Errorf("structpb.NewStruct now ACCEPTS a map[string]string payload. " +
			"Representability normalisation has landed. O1's masking is GONE: " +
			"verify the URL walk covers map[string]string BEFORE retiring this test.")
	}

	// 2. THE CONSEQUENCE, which is the property that actually matters.
	pt := taskToProto(&ent.Task{
		ID:         uuid.New(),
		Title:      "poisoned via unrepresentable carrier",
		RemoteData: raw,
	})
	if pt.GetRemoteData() != nil {
		if blob, err := json.Marshal(pt.GetRemoteData().AsMap()); err == nil &&
			strings.Contains(string(blob), bad) {
			t.Fatalf("LIVE XSS: %q reached the client inside remote_data. "+
				"Normalisation has been applied WITHOUT fixing O1's walk. Fix the "+
				"walk (normalise on ENTRY, before validation); do not edit this "+
				"test. Payload: %s", bad, blob)
		}
		t.Errorf("remote_data is no longer dropped for an unrepresentable map; " +
			"the javascript: URL is absent, so the walk may now cover this shape, " +
			"but confirm that before retiring this guard.")
	}
}

// TestTaskToProtoScrubsRemoteDataURLCarriers pins that sanitizeRemoteData is
// actually WIRED IN, not merely correct in isolation.
//
// It uses a RemoteData map whose values are all structpb-representable, which
// is the shape an ent-stored or collection-imported task has (a JSON round-trip
// yields []any, not []string). That matters: the passthrough-GraphQL path cannot
// exercise this at all -- see
// TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident.
//
// (This comment was previously stranded above
// TestMapStringStringStaysUnrepresentable_GuardsO1, which was inserted between
// it and this function. Two contiguous `//` blocks merge into one doc comment,
// so it silently became the opening paragraph of a DIFFERENT test's
// documentation and this function had none. Godoc reported nothing; nothing
// could. Moved back.)
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

// TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident pins a silent
// behaviour that nothing recorded before, and that materially changes how the
// remote_data finding should be read.
//
// ** RENAMED FROM TestGitHubPassthroughRemoteDataNeverSerialises, AND THE OLD
// NAME WAS WRONG IN TWO WAYS, BOTH OF WHICH THIS ROUND HAS SEEN ELSEWHERE. **
//
// (That line said "RENAMED FROM <the new name>" for three commits. A global
// rename rewrote the old name where it appeared as the SUBJECT of a sentence
// about the rename, so the record of what was renamed was destroyed by the
// rename -- a supersede-never-erase failure committed by the mechanism, not by
// a decision. Recovered from `git show e6bda71`. If you rename this again, the
// two names in this paragraph are data, not references.)
//
//	"NEVER" WAS A UNIVERSAL THIS TEST DOES NOT ESTABLISH. The body asserts one
//	thing: structpb.NewStruct rejects a []string value. "Never serialises" is an
//	inference on top of that, and it holds only while EVERY remote_data map on
//	this path contains at least one structpb-unrepresentable value. Drop
//	"labels" from the builder and remote_data serialises fine while a test
//	called ...NeverSerialises sits there green. Same defect as a write-site
//	scanner named "Every" that reads one directory.
//
//	"SERIALISES" NAMED THE SYMPTOM, NOT THE MECHANISM, AND THE MECHANISM IS AN
//	ACCIDENT. Nothing chose to drop remote_data here. A type the wire format
//	cannot carry causes the whole struct build to fail and the error is
//	discarded. The name now says "by structpb accident" so that a reader who
//	makes remote_data representable -- a perfectly reasonable change -- is told
//	in the identifier itself that they are removing something load-bearing.
//
// The scope qualifier is passthrough-GraphQL, not "the GitHub adapter": the
// sync-REST path is a different code path with a different builder, and this
// test says nothing about it.
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
func TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident(t *testing.T) {
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
// map by name. Scanning whole files instead would sweep up the GraphQL variable
// maps that live beside them ("repo", "states", "title", ...), which are not
// remote_data at all.
//
// Functions NOT in this list are still scanned if they assign to a
// `.RemoteData` selector -- see remoteDataFuncs. That is how server.go's
// UpdateTask is reached, which writes remote_data directly from a request and
// which the previous name-only scanner never looked at.
var remoteDataBuilderFuncs = []string{
	"issueBuildRemoteData",
	"buildRemoteData",
}

// remoteDataLiteralKeysIn extracts the keys written into a remote_data map,
// split by nesting.
//
// TOP is the set of keys at the top level of the map that becomes
// Task.RemoteData. NESTED is every key of a map literal underneath one of those.
// The split is load-bearing rather than cosmetic: before this round
// sanitizeRemoteData walked only the top level, so a URL under a nested key
// would be shipped unvalidated. Merging the two sets would let a nested key
// inherit a top-level key's "validated on both boundaries" verdict, which is
// exactly the kind of true-measurement-false-sentence this round exists to
// remove.
//
// WHY THIS IS AN AST WALK NOW, having been a line scanner. The line scanner
// matched the literal string "map[string]any{" at end of line and tracked depth
// by counting lines that begin with "}". Three measured consequences:
//
//   - `map[string]interface{}{` -- which is how gofmt spells it in generated
//     code, and what internal/store/ent/task.go:60 contains -- did not open a
//     frame at all. Its keys were attributed to whatever frame was open, so a
//     nested key could be reported as top-level: a nested URL carrier reading
//     as "validated on both boundaries".
//   - a one-line literal, `map[string]any{"html_url": u}`, opened a frame that
//     never closed and contributed no keys.
//   - the function body was cut at the first "\n}\n", so anything after a
//     nested func literal was silently dropped.
//
// The parser has no such failure modes and is in the standard library. A
// text-scan of Go source was the wrong tool; this says so rather than adding a
// fourth special case to it.
//
// Deliberately still generous about what counts as a key: a false positive costs
// one line in nonURLKeys, a false negative costs coverage, and the positive
// controls in the caller are what catch a scan that has stopped working.
func remoteDataLiteralKeysIn(src string) (top, nested []string, err error) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "src.go", src, 0)
	if err != nil {
		return nil, nil, fmt.Errorf("parsing: %w", err)
	}

	add := func(dst *[]string, k string) {
		if k != "" && !slices.Contains(*dst, k) {
			*dst = append(*dst, k)
		}
	}

	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Body == nil || !buildsRemoteData(fn) {
			continue
		}

		// The root literal: the map assigned to `rd`/`remoteData`, or to any
		// `.RemoteData` field. Everything else in the function that is a map
		// literal is nested by definition -- including
		// `append(deps, map[string]any{...})`, whose literal is lexically a
		// sibling of the root but semantically underneath it.
		root := rootRemoteDataLiteral(fn)

		ast.Inspect(fn.Body, func(n ast.Node) bool {
			switch node := n.(type) {
			case *ast.CompositeLit:
				dst := &nested
				if node == root {
					dst = &top
				}
				for _, elt := range node.Elts {
					kv, ok := elt.(*ast.KeyValueExpr)
					if !ok {
						continue
					}
					if k, ok := stringLit(kv.Key); ok {
						add(dst, k)
					}
				}
			case *ast.AssignStmt:
				// rd["key"] = v, remoteData["key"] = v, p.RemoteData["key"] = v.
				for _, lhs := range node.Lhs {
					idx, ok := lhs.(*ast.IndexExpr)
					if !ok || !isRemoteDataTarget(idx.X) {
						continue
					}
					if k, ok := stringLit(idx.Index); ok {
						add(&top, k)
					}
				}
			}
			return true
		})
	}
	return top, nested, nil
}

// buildsRemoteData reports whether fn is one of the named builders, or assigns
// to a `.RemoteData` field anywhere in its body.
func buildsRemoteData(fn *ast.FuncDecl) bool {
	if slices.Contains(remoteDataBuilderFuncs, fn.Name.Name) {
		return true
	}
	found := false
	ast.Inspect(fn.Body, func(n ast.Node) bool {
		assign, ok := n.(*ast.AssignStmt)
		if !ok {
			return true
		}
		for _, lhs := range assign.Lhs {
			if sel, ok := lhs.(*ast.SelectorExpr); ok && sel.Sel.Name == "RemoteData" {
				found = true
			}
			if idx, ok := lhs.(*ast.IndexExpr); ok && isRemoteDataTarget(idx.X) {
				found = true
			}
		}
		return true
	})
	return found
}

// rootRemoteDataLiteral finds the composite literal that BECOMES
// Task.RemoteData, or nil if the function only writes to it by index.
func rootRemoteDataLiteral(fn *ast.FuncDecl) *ast.CompositeLit {
	var root *ast.CompositeLit
	ast.Inspect(fn.Body, func(n ast.Node) bool {
		assign, ok := n.(*ast.AssignStmt)
		if !ok || len(assign.Lhs) != 1 || len(assign.Rhs) != 1 {
			return true
		}
		if !isRemoteDataTarget(assign.Lhs[0]) {
			return true
		}
		if lit, ok := assign.Rhs[0].(*ast.CompositeLit); ok && root == nil {
			root = lit
		}
		return true
	})
	return root
}

// isRemoteDataTarget reports whether expr names the remote_data map itself:
// the local `rd`/`remoteData`, or any `X.RemoteData` field.
func isRemoteDataTarget(expr ast.Expr) bool {
	switch e := expr.(type) {
	case *ast.Ident:
		return e.Name == "rd" || e.Name == "remoteData"
	case *ast.SelectorExpr:
		return e.Sel.Name == "RemoteData"
	}
	return false
}

// stringLit unwraps a quoted string literal.
func stringLit(expr ast.Expr) (string, bool) {
	lit, ok := expr.(*ast.BasicLit)
	if !ok || lit.Kind != token.STRING {
		return "", false
	}
	s, err := strconv.Unquote(lit.Value)
	if err != nil {
		return "", false
	}
	return s, true
}

// TestRemoteDataLiteralKeysIn pins the extractor against the shapes the previous
// line-scanner got wrong, and against the shapes it must keep NOT matching.
//
// The caller has positive controls ("remote_url" and "html_url" must be found,
// "percent_completed" must be nested), but those only prove the scan still works
// on the tree as it is today. They cannot show it handles a spelling no adapter
// currently uses -- and every defect below is exactly that: a spelling that was
// mis-parsed silently, waiting for an adapter to adopt it.
func TestRemoteDataLiteralKeysIn(t *testing.T) {
	cases := []struct {
		name       string
		src        string
		wantTop    []string
		wantNested []string
	}{
		{
			// The ent/gofmt spelling. The line scanner matched the literal text
			// "map[string]any{" and this is not it, so the frame never opened
			// and "html_url" was attributed to the enclosing frame -- a nested
			// URL carrier reading as a validated top-level key.
			name: "map[string]interface{} spelling",
			src: `package p
func buildRemoteData() map[string]any {
	rd := map[string]any{"remote_url": u}
	rd["parent"] = map[string]interface{}{
		"html_url": p.URL,
	}
	return rd
}`,
			wantTop:    []string{"remote_url", "parent"},
			wantNested: []string{"html_url"},
		},
		{
			// A literal that opens and closes on one line. The line scanner
			// pushed a frame that no line ever popped, so everything after it
			// was misattributed, and the literal's own key was never read.
			name: "one-line nested literal",
			src: `package p
func buildRemoteData() map[string]any {
	rd := map[string]any{
		"remote_url": u,
		"parent":     map[string]any{"html_url": x},
		"number":     n,
	}
	return rd
}`,
			wantTop:    []string{"remote_url", "parent", "number"},
			wantNested: []string{"html_url"},
		},
		{
			// The line scanner cut the body at the first "\n}\n". A nested func
			// literal produces one, so everything after it was dropped.
			name: "keys after a nested func literal",
			src: `package p
func buildRemoteData() map[string]any {
	rd := map[string]any{"number": n}
	sort.Slice(xs, func(i, j int) bool {
		return xs[i] < xs[j]
	})
	rd["html_url"] = u
	return rd
}`,
			wantTop: []string{"number", "html_url"},
		},
		{
			// server.go's UpdateTask: no builder-shaped name, no root literal
			// worth reading, all the keys arriving by index write. Never
			// scanned at all before this round.
			name: "index writes to a .RemoteData field, in a function with no builder name",
			src: `package p
func (s *Server) UpdateTask(ctx context.Context, req *pb.UpdateTaskRequest) error {
	if req.RemoteId != nil || req.RemoteUrl != nil {
		p.RemoteData = map[string]any{}
		p.RemoteData["remote_id"] = req.GetRemoteId()
		p.RemoteData["remote_url"] = req.GetRemoteUrl()
	}
	return nil
}`,
			wantTop: []string{"remote_id", "remote_url"},
		},
		{
			// A map literal that is lexically a sibling of the root but ends up
			// underneath it. It must be NESTED, or its keys inherit the
			// top-level "validated on both boundaries" verdict.
			name: "literal appended into a slice that becomes a top-level value",
			src: `package p
func buildRemoteData() map[string]any {
	rd := map[string]any{"number": n}
	var deps []map[string]any
	for _, d := range ds {
		deps = append(deps, map[string]any{"html_url": d.URL})
	}
	rd["dependencies"] = deps
	return rd
}`,
			wantTop:    []string{"number", "dependencies"},
			wantNested: []string{"html_url"},
		},
		{
			// NEGATIVE. The reason the scan is keyed on builder functions at
			// all: GraphQL variable maps live in the same files and are not
			// remote_data. If this starts returning keys the nonURLKeys table
			// fills up with unrelated names and stops being read.
			name: "a map in a function that never touches remote_data",
			src: `package p
func query(ctx context.Context) error {
	vars := map[string]any{"repo": r, "states": s, "url": u}
	return gql.Run(ctx, q, vars)
}`,
		},
		{
			// NEGATIVE. A non-string key cannot be a remote_data key.
			name: "non-string keys",
			src: `package p
func buildRemoteData() map[string]any {
	rd := map[string]any{"number": n}
	byID := map[int]string{1: "a", 2: "b"}
	_ = byID
	return rd
}`,
			wantTop: []string{"number"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			top, nested, err := remoteDataLiteralKeysIn(tc.src)
			if err != nil {
				t.Fatalf("remoteDataLiteralKeysIn: %v", err)
			}
			slices.Sort(top)
			slices.Sort(nested)
			wantTop := slices.Clone(tc.wantTop)
			wantNested := slices.Clone(tc.wantNested)
			slices.Sort(wantTop)
			slices.Sort(wantNested)
			if !slices.Equal(top, wantTop) {
				t.Errorf("top keys = %v, want %v", top, wantTop)
			}
			if !slices.Equal(nested, wantNested) {
				t.Errorf("nested keys = %v, want %v", nested, wantNested)
			}
		})
	}

	// A parse error must be reported, not swallowed into an empty result. The
	// caller's positive controls would catch an empty result today, but only
	// because two keys happen to be pinned; a file that stopped parsing should
	// say so rather than quietly contributing nothing.
	if _, _, err := remoteDataLiteralKeysIn("package p\nfunc ("); err == nil {
		t.Error("unparseable source returned no error; a file that fails to parse would " +
			"contribute zero keys and read as 'this adapter writes nothing'")
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
