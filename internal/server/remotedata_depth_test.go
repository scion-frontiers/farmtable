package server

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"testing"

	"google.golang.org/protobuf/types/known/structpb"
)

// The bad URL used throughout. It is rejected by validateURLField on the scheme
// arm, which is the arm this whole branch exists to add.
const badURL = "javascript:alert(1)"

const goodURL = "https://example.com/x"

// ---------------------------------------------------------------------------
// 1. The gap this file was written for, pinned at the wire.
// ---------------------------------------------------------------------------

// TestNestedURLReachesTheWireWithoutRecursion is the failing-test-first record
// of the defect. It does not test our code -- it tests structpb, because the
// claim that used to justify the top-level-only sanitizer was a claim about
// structpb ("nested carriers do not serialise").
//
// MEASURED: a nested map[string]any serialises fine, javascript: URL intact. So
// the top-level-only sanitizer was not backed by a serialisation limit; it was
// simply short. Both halves are asserted, because "the nested value survives"
// is only alarming next to "and the top-level one does not".
func TestNestedURLReachesTheWireWithoutRecursion(t *testing.T) {
	raw := map[string]any{
		"remote_url": badURL,
		"parent":     map[string]any{"html_url": badURL},
	}

	st, err := structpb.NewStruct(raw)
	if err != nil {
		t.Fatalf("structpb rejected a nested map, which would have made the "+
			"old comment right: %v", err)
	}
	if got := st.AsMap()["parent"].(map[string]any)["html_url"]; got != badURL {
		t.Fatalf("nested html_url = %q, want it to have survived structpb as %q",
			got, badURL)
	}

	// Now the same map through the sanitizer that ships today.
	clean, err := structpb.NewStruct(sanitizeRemoteData(raw))
	if err != nil {
		t.Fatalf("structpb rejected the sanitized map: %v", err)
	}
	m := clean.AsMap()
	if _, ok := m["remote_url"]; ok {
		t.Errorf("top-level remote_url survived sanitization: %v", m["remote_url"])
	}
	parent, ok := m["parent"].(map[string]any)
	if !ok {
		t.Fatalf("parent = %#v, want a map (the key itself is not URL-bearing "+
			"and must not be dropped wholesale)", m["parent"])
	}
	if v, ok := parent["html_url"]; ok {
		t.Errorf("nested parent.html_url survived sanitization as %v; this is the "+
			"defect X3 exists to close", v)
	}
}

// ---------------------------------------------------------------------------
// 2. Depth and shape coverage.
// ---------------------------------------------------------------------------

func TestSanitizeRemoteDataRecursesThroughEveryCarrier(t *testing.T) {
	cases := []struct {
		name string
		in   map[string]any
		want map[string]any
	}{
		{
			name: "top level, the case that already worked",
			in:   map[string]any{"remote_url": badURL, "title": "t"},
			want: map[string]any{"title": "t"},
		},
		{
			name: "one map deep",
			in:   map[string]any{"parent": map[string]any{"html_url": badURL, "id": 7}},
			want: map[string]any{"parent": map[string]any{"id": 7}},
		},
		{
			name: "four maps deep",
			in: map[string]any{"a": map[string]any{"b": map[string]any{
				"c": map[string]any{"d": map[string]any{"link": badURL, "k": "v"}}}}},
			want: map[string]any{"a": map[string]any{"b": map[string]any{
				"c": map[string]any{"d": map[string]any{"k": "v"}}}}},
		},
		{
			name: "inside a []any of maps, which is how sub_issues decodes from JSON",
			in: map[string]any{"sub_issues": []any{
				map[string]any{"html_url": goodURL},
				map[string]any{"html_url": badURL},
			}},
			want: map[string]any{"sub_issues": []any{
				map[string]any{"html_url": goodURL},
				map[string]any{},
			}},
		},
		{
			name: "inside a []map[string]any, which is how an adapter builds it in Go",
			in: map[string]any{"sub_issues": []map[string]any{
				{"url": badURL, "n": 1},
			}},
			want: map[string]any{"sub_issues": []map[string]any{{"n": 1}}},
		},
		{
			name: "a list of URLs under a URL-bearing key: bad elements only",
			in:   map[string]any{"urls": []any{goodURL, badURL, goodURL}},
			want: map[string]any{"urls": []any{goodURL, goodURL}},
		},
		{
			name: "a []string of URLs under a URL-bearing key",
			in:   map[string]any{"links": []string{badURL, goodURL}},
			want: map[string]any{"links": []string{goodURL}},
		},
		{
			name: "a []string under a NON-URL key is passed through untouched",
			in:   map[string]any{"labels": []string{"bug", "javascript:x"}},
			want: map[string]any{"labels": []string{"bug", "javascript:x"}},
		},
		{
			name: "a URL-bearing key holding an unvalidatable type is dropped",
			in:   map[string]any{"url": 42, "n": 42},
			want: map[string]any{"n": 42},
		},
		{
			name: "a good nested URL is preserved, not merely dropped-along-with",
			in:   map[string]any{"parent": map[string]any{"html_url": goodURL}},
			want: map[string]any{"parent": map[string]any{"html_url": goodURL}},
		},
		{
			name: "nil slices keep their identity",
			in:   map[string]any{"xs": []any(nil)},
			want: map[string]any{"xs": []any(nil)},
		},
	}

	// Anti-vacuity: the table must contain rows where sanitization CHANGES the
	// map and rows where it does not. A table of only-changed rows would pass
	// against a sanitizer that deleted everything.
	changed, unchanged := 0, 0

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := sanitizeRemoteData(tc.in)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("sanitizeRemoteData:\n got %#v\nwant %#v", got, tc.want)
			}
			if reflect.DeepEqual(tc.in, tc.want) {
				unchanged++
			} else {
				changed++
			}
		})
	}

	if changed < 5 || unchanged < 3 {
		t.Fatalf("anti-vacuity: %d changed / %d unchanged rows, want at least 5 / 3",
			changed, unchanged)
	}
}

// TestSanitizeRemoteDataDoesNotMutateItsInput matters because the map it is
// handed belongs to the ent entity and is reused for the rest of the request.
// A sanitizer that cleaned in place would be correct at the wire and wrong
// everywhere else.
func TestSanitizeRemoteDataDoesNotMutateItsInput(t *testing.T) {
	in := map[string]any{
		"remote_url": badURL,
		"parent":     map[string]any{"html_url": badURL},
		"sub":        []any{map[string]any{"url": badURL}},
	}
	before := fmt.Sprintf("%#v", in)

	got := sanitizeRemoteData(in)
	if len(got) == len(in) {
		t.Fatalf("nothing was dropped, so this test proves nothing: %#v", got)
	}
	if after := fmt.Sprintf("%#v", in); after != before {
		t.Errorf("input mutated:\nbefore %s\nafter  %s", before, after)
	}
}

func TestSanitizeRemoteDataStopsAtTheDepthBound(t *testing.T) {
	// Build a chain one level deeper than the bound, ending in a bad URL.
	leaf := map[string]any{"html_url": badURL}
	cur := leaf
	for i := 0; i < maxRemoteDataDepth+1; i++ {
		cur = map[string]any{"n": cur}
	}

	got := sanitizeRemoteData(cur)

	// Walk down and assert the chain is truncated rather than carrying the leaf.
	depth := 0
	for {
		next, ok := got["n"].(map[string]any)
		if !ok {
			break
		}
		got = next
		depth++
	}
	// depth==0 is the first nested VALUE, not the root map, so the walk reaches
	// one more map level than the bound's numeric value.
	if depth > maxRemoteDataDepth+1 {
		t.Errorf("walked %d map levels, bound admits at most %d",
			depth, maxRemoteDataDepth+1)
	}
	if _, ok := got["html_url"]; ok {
		t.Errorf("the over-deep leaf survived at depth %d", depth)
	}

	// Control: the same chain one level SHALLOWER must be walked all the way
	// down and its leaf cleaned -- otherwise the bound could be 0 and this test
	// would still pass.
	cur = leaf
	for i := 0; i < maxRemoteDataDepth-2; i++ {
		cur = map[string]any{"n": cur}
	}
	shallow := sanitizeRemoteData(cur)
	for {
		next, ok := shallow["n"].(map[string]any)
		if !ok {
			break
		}
		shallow = next
	}
	if _, ok := shallow["html_url"]; ok {
		t.Errorf("a leaf INSIDE the bound was not cleaned; the recursion is not "+
			"reaching depth %d", maxRemoteDataDepth-2)
	}
}

// TestRemoteDataTraversalsTerminateOnACycle is why the depth bound exists.
//
// A map decoded from JSON cannot contain a cycle, and the first version of this
// test suite leaned on that: it checked only that an over-deep leaf was dropped,
// which stays true if the bound is deleted outright. But remote_data is
// map[string]any, an in-process Go caller can hand us a cycle, and both
// traversals are unguarded recursion. Without the bound this test does not fail
// -- it crashes the test binary with a stack overflow, which is still RED, and
// is the honest outcome to pin.
func TestRemoteDataTraversalsTerminateOnACycle(t *testing.T) {
	// No bad URL in the fixture: a scheme rejection would end the walk early and
	// the test would pass without the bound ever firing.
	cyclic := map[string]any{"html_url": goodURL}
	cyclic["self_ref"] = cyclic

	// A cycle through a slice as well, since the slice arms recurse separately.
	viaSlice := map[string]any{"kids": []any{}}
	viaSlice["kids"] = []any{viaSlice}

	for _, tc := range []struct {
		name string
		in   map[string]any
	}{
		{"cycle through a map", cyclic},
		{"cycle through a []any", viaSlice},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := sanitizeRemoteData(tc.in)
			if got == nil {
				t.Errorf("sanitizeRemoteData returned nil for a non-nil input")
			}

			err := validateRemoteDataURLs("rd", tc.in, 0)
			if err == nil {
				t.Errorf("validateRemoteDataURLs accepted a cyclic map; the depth " +
					"bound did not fire, so the only thing stopping the recursion " +
					"is the stack")
			} else if !strings.Contains(err.Error(), "levels deep") {
				t.Errorf("error = %v, want the depth-bound message", err)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// 3. The two traversals agree. This is what makes the enumeration true.
// ---------------------------------------------------------------------------

// TestSanitizeAndImportAgreeAtEveryDepth drives sanitizeRemoteData and
// validateRemoteDataURLs over the same generated maps and requires that the
// import check errors exactly when the sanitizer drops something.
//
// They diverged before this round: the import check walked the top level only,
// so a collection carrying a javascript: URL under remote_data.parent.html_url
// imported cleanly and was then dropped on the way back out -- accepted by one
// half of the property and rejected by the other.
//
// WHAT THE SWEEP HOLDS FIXED. One bad value at a time; one carrier path at a
// time; a single scheme (javascript:) on the reject side and a single https URL
// on the accept side; no unrepresentable Go types. It varies only the CARRIER
// SHAPE and the DEPTH. It is a test of traversal agreement, not of
// validateURLField -- that has its own table elsewhere.
func TestSanitizeAndImportAgreeAtEveryDepth(t *testing.T) {
	// wrap[i] places a value at a distinct carrier shape.
	wrappers := []struct {
		name string
		wrap func(inner map[string]any) map[string]any
	}{
		{"top level", func(in map[string]any) map[string]any { return in }},
		{"under a plain map", func(in map[string]any) map[string]any {
			return map[string]any{"parent": in}
		}},
		{"under two plain maps", func(in map[string]any) map[string]any {
			return map[string]any{"a": map[string]any{"b": in}}
		}},
		{"inside a []any", func(in map[string]any) map[string]any {
			return map[string]any{"sub_issues": []any{in}}
		}},
		{"inside a []map[string]any", func(in map[string]any) map[string]any {
			return map[string]any{"sub_issues": []map[string]any{in}}
		}},
		{"inside a []any inside a map", func(in map[string]any) map[string]any {
			return map[string]any{"tree": map[string]any{"kids": []any{in}}}
		}},
		{"under a key that merely looks structural", func(in map[string]any) map[string]any {
			return map[string]any{"links_summary": in}
		}},
	}

	leaves := []struct {
		name  string
		leaf  map[string]any
		dirty bool // the sanitizer must drop something / the import must error
		// asym marks the one documented disagreement: a URL-bearing key holding
		// an unvalidatable scalar is dropped by the sanitizer and accepted by the
		// import. Pinned here so it cannot silently become two disagreements.
		asym bool
	}{
		{"bad URL under url", map[string]any{"url": badURL}, true, false},
		{"bad URL under html_url", map[string]any{"html_url": badURL}, true, false},
		{"bad URL in a list under urls", map[string]any{"urls": []any{badURL}}, true, false},
		{"good URL under html_url", map[string]any{"html_url": goodURL}, false, false},
		{"bad-looking value under a non-URL key", map[string]any{"title": badURL}, false, false},
		{"no URL at all", map[string]any{"n": "x"}, false, false},
		{"unvalidatable scalar under url (the documented asymmetry)",
			map[string]any{"url": 42}, true, true},
		{"a map under a URL-bearing key is walked, not dropped",
			map[string]any{"links": map[string]any{"html_url": goodURL}}, false, false},
		{"a bad URL inside a map under a URL-bearing key",
			map[string]any{"links": map[string]any{"html_url": badURL}}, true, false},
	}

	agreed, dirtyRows, cleanRows := 0, 0, 0

	for _, w := range wrappers {
		for _, l := range leaves {
			name := w.name + " / " + l.name
			t.Run(name, func(t *testing.T) {
				// Fresh copy per row: wrappers alias the leaf map.
				leaf := map[string]any{}
				for k, v := range l.leaf {
					leaf[k] = v
				}
				in := w.wrap(leaf)

				before := fmt.Sprintf("%#v", in)
				dropped := !reflect.DeepEqual(sanitizeRemoteData(in), in)
				if after := fmt.Sprintf("%#v", in); after != before {
					t.Fatalf("the sanitizer mutated its input, so the comparison " +
						"against the import check is meaningless")
				}

				errored := validateRemoteDataURLs("rd", in, 0) != nil

				if l.asym {
					if !dropped || errored {
						t.Errorf("the documented asymmetry changed shape: "+
							"dropped=%v errored=%v, want dropped=true errored=false",
							dropped, errored)
					}
					agreed++
					dirtyRows++
					return
				}
				if dropped != errored {
					t.Errorf("disagreement: sanitizer dropped=%v, import errored=%v "+
						"(want both %v)", dropped, errored, l.dirty)
					return
				}
				if dropped != l.dirty {
					t.Errorf("both traversals agreed on %v, but the row expects %v",
						dropped, l.dirty)
					return
				}
				agreed++
				if l.dirty {
					dirtyRows++
				} else {
					cleanRows++
				}
			})
		}
	}

	// Anti-vacuity with a POSITIVE outcome on both sides. Agreement is trivially
	// satisfiable by two traversals that both do nothing, so the sweep is only
	// meaningful if some rows actually fired.
	if want := len(wrappers) * len(leaves); agreed != want {
		t.Fatalf("%d/%d rows agreed", agreed, want)
	}
	if dirtyRows != len(wrappers)*5 {
		t.Errorf("only %d rows exercised the rejecting path; the sweep is not "+
			"reaching the carriers", dirtyRows)
	}
	if cleanRows != len(wrappers)*4 {
		t.Errorf("only %d rows exercised the accepting path; a sanitizer that "+
			"deleted everything would pass this sweep", cleanRows)
	}
}

// TestValidateImportedTaskURLsReachesNestedCarriers is the import-side half
// stated directly, in the terms the caller sees, so the property does not rest
// on the agreement sweep alone.
func TestValidateImportedTaskURLsReachesNestedCarriers(t *testing.T) {
	task := exportTask{
		ID:         "t1",
		RemoteData: map[string]any{"parent": map[string]any{"html_url": badURL}},
	}
	err := validateImportedTaskURLs(task)
	if err == nil {
		t.Fatalf("a javascript: URL at remote_data.parent.html_url imported cleanly")
	}
	if !strings.Contains(err.Error(), "parent.html_url") {
		t.Errorf("error names %q, want it to name the nested path so the operator "+
			"can find the value", err)
	}

	// Green control at equal weight.
	task.RemoteData = map[string]any{"parent": map[string]any{"html_url": goodURL}}
	if err := validateImportedTaskURLs(task); err != nil {
		t.Errorf("a good nested URL was rejected: %v", err)
	}
}

// ---------------------------------------------------------------------------
// 4. The enumeration itself: every proto/export site sanitizes.
// ---------------------------------------------------------------------------

// remoteDataWriteSite matches an assignment of a RemoteData field in Go source.
var remoteDataWriteSite = regexp.MustCompile(`(?m)^.*\bRemoteData(?:,\s*_)?\s*[:=]=?\s*(.+)$`)

// remoteDataWriteIsSanitized decides whether the right-hand side of a
// RemoteData assignment routes through the sanitizer.
//
// It is a separate function, not an inline strings.Contains, so that
// TestRemoteDataWriteIsSanitized can drive it with both outcomes. Inline, the
// check was unkillable: widening it to `Contains(rhs, "RemoteData")` -- which
// matches every assignment, sanitized or not -- left the whole suite green,
// because on a clean tree every site IS sanitized and a vacuous scanner and a
// working scanner agree on a clean tree.
func remoteDataWriteIsSanitized(rhs string) bool {
	return strings.Contains(rhs, "sanitizeRemoteData(")
}

func TestRemoteDataWriteIsSanitized(t *testing.T) {
	cases := []struct {
		rhs  string
		want bool
	}{
		{"sanitizeRemoteData(t.RemoteData),", true},
		{"structpb.NewStruct(sanitizeRemoteData(t.RemoteData))", true},
		{"t.RemoteData,", false},
		{"doc.Collection.RemoteData,", false},
		{"structpb.NewStruct(c.RemoteData)", false},
		{"map[string]any{}", false},
		// Named for the near-miss: a helper whose name merely starts the same way
		// is not the sanitizer.
		{"sanitizeRemoteDataKeys(t.RemoteData),", false},
	}
	yes, no := 0, 0
	for _, tc := range cases {
		got := remoteDataWriteIsSanitized(tc.rhs)
		if got != tc.want {
			t.Errorf("remoteDataWriteIsSanitized(%q) = %v, want %v", tc.rhs, got, tc.want)
		}
		if tc.want {
			yes++
		} else {
			no++
		}
	}
	if yes < 2 || no < 3 {
		t.Fatalf("anti-vacuity: %d accept / %d reject rows", yes, no)
	}
}

// TestEveryRemoteDataWriteSiteSanitizes replaces the sentence "we patched four
// sites" with a measurement, because the sentence was already false once: the
// first version of this work sanitized pb.Task.remote_data and left
// pb.Collection.remote_data and both export paths writing the map raw.
//
// This reads the non-test sources, finds every place a RemoteData FIELD is
// assigned, and requires the right-hand side to route through
// sanitizeRemoteData. A new call site added later fails here rather than
// silently becoming the fifth unsanitized path.
//
// It is a lower bound on write sites in the same way the adapter-key scanner is
// a lower bound on keys -- a write through a reflected field or an aliased
// struct is invisible to it. Its value is that the shape that HAS been added
// four times so far is now caught.
func TestEveryRemoteDataWriteSiteSanitizes(t *testing.T) {
	// Assignments that read remote data rather than writing it out to a client,
	// keyed by the syntactic form, with the reason each is exempt.
	exempt := map[string]string{
		"p.RemoteData = map[string]any{}": "constructs an empty map; the two keys " +
			"written into it on the following lines come from validated request fields",
	}

	root := filepath.Join("..", "..", "internal", "server")
	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatalf("read %s: %v", root, err)
	}

	var unsanitized []string
	sites := 0
	sanitized := 0

	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			continue
		}
		src, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		for i, line := range strings.Split(string(src), "\n") {
			m := remoteDataWriteSite.FindStringSubmatch(line)
			if m == nil {
				continue
			}
			trimmed := strings.TrimSpace(line)
			// Skip struct-type declarations and comments.
			if strings.HasPrefix(trimmed, "//") || strings.HasPrefix(trimmed, "*") {
				continue
			}
			if _, ok := exempt[strings.TrimSuffix(trimmed, ",")]; ok {
				continue
			}
			sites++
			if remoteDataWriteIsSanitized(m[1]) {
				sanitized++
				continue
			}
			unsanitized = append(unsanitized,
				fmt.Sprintf("%s:%d: %s", name, i+1, trimmed))
		}
	}

	// Enumerate what survived; do not grep for what we expected to find.
	if len(unsanitized) > 0 {
		sort.Strings(unsanitized)
		t.Errorf("%d RemoteData write site(s) do not route through "+
			"sanitizeRemoteData:\n  %s\n\nEither sanitize the site or add its exact "+
			"source line to the `exempt` map above with the reason it reads rather "+
			"than writes.", len(unsanitized), strings.Join(unsanitized, "\n  "))
	}

	// Anti-vacuity: a scanner that matched nothing would report zero violations.
	// The count is a floor, not the answer -- raise it when a site is added.
	if sanitized < 4 {
		t.Errorf("found only %d sanitized RemoteData write site(s) across %d total; "+
			"expected at least 4 (convert.go x2, export_import.go x2). The scanner "+
			"is not matching.", sanitized, sites)
	}
}
