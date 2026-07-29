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

// remoteDataIdent matches the field name as a whole identifier. `\b` on both
// sides is what separates `p.RemoteData[k] =` from `const maxRemoteDataDepth =`.
var remoteDataIdent = regexp.MustCompile(`\bRemoteData\b`)

// maskGoLiterals blanks the INTERIOR of string, rune and raw-string literals,
// preserving the delimiters and the overall length so byte offsets computed on
// the masked copy stay valid in the original line.
//
// Without this, a struct tag is indistinguishable from an assignment: the field
// declaration
//
//	RemoteData  map[string]any `json:"remote_data,omitempty"`
//
// has its first colon INSIDE the tag, so a scanner that splits on the first
// colon reads it as a write of the value `"remote_data,omitempty"` and reports
// a clean tree as unsanitized. Measured: without masking, the two declarations
// in export_import.go both fire. That failure is in the safe direction, but a
// guard that is red on a clean tree gets "fixed" by the next person who hits
// it, and the cheapest fix is to narrow the pattern -- which is how the
// enumeration this scanner exists to kill grows back.
func maskGoLiterals(s string) string {
	b := []byte(s)
	for i := 0; i < len(b); {
		q := b[i]
		if q != '"' && q != '\'' && q != '`' {
			i++
			continue
		}
		j := i + 1
		for j < len(b) && b[j] != q {
			if b[j] == '\\' && q != '`' {
				if j+1 < len(b) {
					b[j+1] = ' '
				}
				j += 2
				continue
			}
			b[j] = ' '
			j++
		}
		i = j + 1
	}
	return string(b)
}

// remoteDataAssignment reports whether a line ASSIGNS a RemoteData field, and
// returns the right-hand side if so.
//
// IT DOES NOT ENUMERATE LEFT-HAND-SIDE SHAPES, AND THAT IS THE WHOLE POINT.
//
// Its predecessor was a regex whose target admitted `RemoteData` followed by an
// optional `, _`. The ordinary way to start logging a discarded error -- giving
// that blank identifier a name -- did not make a site FAIL the scan, it made the
// site DISAPPEAR from it, silently, for both of convert.go's gRPC wire-path
// sites at once. They are the only two RemoteData writes that reach a browser.
//
// The tempting repair is to admit `, \w+` too. That was tried and rejected:
// `\w+` matches an identifier but not a selector, an index, or a blank, so a
// site assigning the error into a struct field or a slice element is STILL
// absent, still not a violation, still green. ENLARGING THE ADMISSIBLE SET IS
// NOT CHANGING THE QUESTION -- it leaves the class alive at a larger radius,
// with a fresh off-by-one waiting.
//
// So the question asked here is not "what does the left-hand side look like"
// but "does this assignment route RemoteData through the sanitizer". The line is
// split at its first top-level assignment or field separator, and if ANYTHING at
// all to the left of it mentions RemoteData, it is a site -- whatever its shape.
// `x, err =`, `x, _ =`, `s.f[i].RemoteData =`, `a.b.C.RemoteData, ok =` and
// shapes nobody has thought of are all visible without being predicted.
//
// The `:` arm is not optional: FOUR of the six write sites in this package are
// composite-literal fields, not statements.
func remoteDataAssignment(line string) (rhs string, ok bool) {
	masked := maskGoLiterals(line)
	if c := strings.Index(masked, "//"); c >= 0 {
		masked = masked[:c] // offsets before the comment stay valid
	}
	i, width := firstTopLevelSeparator(masked)
	// Tested on the MASKED left-hand side, so that a map key that merely spells
	// the field name -- `map[string]any{"RemoteData": v}` -- is not read as a
	// write to it. Word-bounded, so that an identifier merely CONTAINING the
	// field name is not either: `const maxRemoteDataDepth = 32` is a declaration,
	// and an unbounded substring test reports it as an unsanitized write.
	if i < 0 || !remoteDataIdent.MatchString(masked[:i]) {
		return "", false
	}
	return strings.TrimSpace(line[i+width:]), true
}

// firstTopLevelSeparator finds the first `:=`, `=` or `:` that is not nested
// inside brackets and is not part of a comparison or compound-assignment
// operator, returning its byte offset and width. Returns -1 when the line
// contains no separator at all, which is how declarations and bare calls are
// rejected without naming their shapes.
func firstTopLevelSeparator(s string) (idx, width int) {
	depth := 0
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '(', '[', '{':
			depth++
		case ')', ']', '}':
			depth--
		case ':':
			if depth != 0 {
				continue
			}
			if i+1 < len(s) && s[i+1] == '=' {
				return i, 2
			}
			return i, 1
		case '=':
			if depth != 0 {
				continue
			}
			if i+1 < len(s) && s[i+1] == '=' {
				i++ // `==`
				continue
			}
			if i > 0 && strings.IndexByte("=!<>+-*/%&|^", s[i-1]) >= 0 {
				continue
			}
			return i, 1
		}
	}
	return -1, 0
}

// remoteDataEnclosingFunc matches a top-level func declaration, with or without
// a receiver, capturing the name. Tracking the most recent one gives each write
// site an IDENTITY, which is what lets the registry name sites instead of
// counting them. It is a lexical approximation and would mis-attribute a write
// inside a func literal to the enclosing declaration; that is acceptable here
// because the registry only has to be stable and specific, not a parser. When
// the AST scanner lands it should take this over.
var remoteDataEnclosingFunc = regexp.MustCompile(`^func\s+(?:\([^)]*\)\s*)?(\w+)`)

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

// TestRemoteDataAssignmentSeesEveryShape is the regression test for the blinding
// that motivated this scanner's rewrite, and it is deliberately a table of
// SHAPES rather than of counts.
//
// The starred rows are the ones the predecessor regex could not see. It admitted
// `RemoteData` followed by at most a literal `, _`, so every one of them
// returned "not a site" -- not a violation, an ABSENCE -- and a tree containing
// only those shapes scanned clean. They must stay green here.
//
// The reject rows matter just as much: a splitter that called everything a site
// would also make the suite pass on a clean tree, since on a clean tree every
// real site IS sanitized. Reads, comparisons and declarations must be rejected.
func TestRemoteDataAssignmentSeesEveryShape(t *testing.T) {
	cases := []struct {
		name string
		line string
		site bool
		rhs  string
	}{
		{"plain assignment", `	pt.RemoteData = sanitizeRemoteData(x)`, true, "sanitizeRemoteData(x)"},
		{"composite literal field", `		RemoteData:  sanitizeRemoteData(c.RemoteData),`, true, "sanitizeRemoteData(c.RemoteData),"},
		{"* named error target", `	pt.RemoteData, err = structpb.NewStruct(x)`, true, "structpb.NewStruct(x)"},
		{"* blank second target", `	pt.RemoteData, _ = structpb.NewStruct(x)`, true, "structpb.NewStruct(x)"},
		{"* comma-ok target", `	a.b.C.RemoteData, ok = m[k]`, true, "m[k]"},
		{"* selector target", `	s.inner.RemoteData = raw`, true, "raw"},
		{"* index target", `	items[i].RemoteData = raw`, true, "raw"},
		{"* short declaration", `	RemoteData := sanitizeRemoteData(x)`, true, "sanitizeRemoteData(x)"},

		{"read into a local is not a write", `	rd := p.RemoteData`, false, ""},
		{"comparison is not a write", `	if p.RemoteData == nil {`, false, ""},
		{"range over it is not a write", `	for k, v := range p.RemoteData {`, false, ""},
		{"struct field declaration with a json tag", "\tRemoteData  map[string]any `json:\"remote_data,omitempty\"`", false, ""},
		{"a string key that merely names it", `	m := map[string]any{"RemoteData": v}`, false, ""},
		{"commented-out write", `	// pt.RemoteData = raw`, false, ""},
		{"bare call mentioning it", `	use(p.RemoteData)`, false, ""},
	}

	var sites, rejects, starred int
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rhs, ok := remoteDataAssignment(tc.line)
			if ok != tc.site {
				t.Fatalf("remoteDataAssignment(%q) site = %v, want %v", tc.line, ok, tc.site)
			}
			if ok && rhs != tc.rhs {
				t.Errorf("rhs = %q, want %q", rhs, tc.rhs)
			}
		})
		if tc.site {
			sites++
			if strings.HasPrefix(tc.name, "* ") {
				starred++
			}
		} else {
			rejects++
		}
	}

	// Anti-vacuity, and it is about this table rather than the tree: the rows
	// that justify the rewrite are the ones the old pattern missed, so if they
	// were ever deleted the table would still pass while testing nothing that
	// motivated it.
	if starred < 5 {
		t.Errorf("only %d rows cover shapes the previous regex could not see; "+
			"those rows ARE the regression test for the blinding", starred)
	}
	if sites < 6 || rejects < 5 {
		t.Errorf("anti-vacuity: %d site / %d reject rows", sites, rejects)
	}
}

// remoteDataWriteExpectation is one file's entry in the write-site registry:
// which FUNCTIONS in it assign RemoteData -- each of which must route through
// sanitizeRemoteData -- and which exact source lines are exempt because they
// read rather than write.
//
// The function lists are SETS OF NAMES, not counts, and that distinction is the
// whole point of this type. A declared `file -> count` map, which is what was
// originally prescribed, still fails to COMPENSATING SUBSTITUTION one grain
// below the file: delete taskToProto's write and add an unrelated sanitized
// write elsewhere in convert.go, and the file's count is still 2 and the suite
// is still green while the wire path sanitizes nothing. Measured, GREEN, before
// this field was a set. Names cannot be traded off against each other.
//
// ================= AND THE NAMES ARE SPLIT BY DIRECTION. TWO SETS. =============
// OUTBOUND and INBOUND ARE TWO DIFFERENT SECURITY PROPERTIES AND MUST NOT SHARE
// A COUNTER.
//
//	OUTBOUND -- ent -> pb / ent -> export. Stops attacker-controlled data from
//	            reaching a client. This is the property the XSS round is about.
//	INBOUND  -- untrusted bytes -> store. Defence at the persistence boundary.
//	            Reachable from caller-supplied input on the ImportCollection RPC,
//	            which parses untrusted JSONL.
//
// WHAT A SHARED COUNTER DID TO US, AND IT IS EXACT. The shipped floor was 4. The
// tree held 6 sanitized sites: 4 outbound, 2 inbound. THE FLOOR EQUALLED THE
// OUTBOUND COUNT, AND THE SLACK WAS EXACTLY, ENTIRELY, THE INBOUND SET. Both
// inbound sites could lose their sanitizer -- inbound coverage to ZERO, not
// merely degraded -- and `4 < 4` is still false. Green.
//
// Three independent characterisations name the same two lines: the floor's
// slack, the set reachable from caller-supplied bytes, and the inbound
// direction. That is not intent, and the truth is worse than intent would be.
// The floor's own failure text read "expected at least 4 (convert.go x2,
// export_import.go x2)" while export_import.go had FOUR sites. THE AUTHOR
// BELIEVED 4 WAS THE TOTAL, SO IT WAS NEVER A FLOOR AT ALL -- IT WAS AN EXACT
// COUNT OF A MISCOUNTED POPULATION WEARING THE WORD "FLOOR", and the slack that
// concealed tonight's regression is an artefact of the miscount.
//
// A single flat list of six names would reproduce that at higher fidelity and
// with better documentation. Two lists cannot: losing every inbound site leaves
// the outbound set intact and fails the inbound set by name, and vice versa.
// Each direction is fail-closed in BOTH directions independently -- a missing
// name and an undeclared name are separate failures per set.
//
// If you add a function here, decide which list it belongs in. If it is
// genuinely both, it is probably two functions.
// ================================================================================
type remoteDataWriteExpectation struct {
	// outbound: writes that leave the system -- ent -> pb, ent -> export file.
	outbound []string
	// inbound: writes that enter the store from untrusted input.
	inbound []string
	// exempt: exact trimmed source line -> why it is not a write.
	exempt map[string]string
}

// wantFuncs is the union of both directions, for the checks that do not care
// which one a name came from. Membership is still asserted PER DIRECTION; this
// exists so a name in either list is not reported as undeclared.
func (e remoteDataWriteExpectation) wantFuncs() []string {
	all := make([]string, 0, len(e.outbound)+len(e.inbound))
	all = append(all, e.outbound...)
	all = append(all, e.inbound...)
	return all
}

// internalServerRemoteDataWriteRegistry is the SINGLE declared source of truth
// for which non-test files UNDER internal/server may assign a RemoteData field.
//
// ================== READ THE SCOPE BEFORE YOU TRUST THE RESULT ==================
// THIS REGISTRY COVERS ONE DIRECTORY: internal/server. IT IS NOT A TREE-WIDE
// CENSUS OF RemoteData WRITES. Other packages assign RemoteData too, and this
// scanner does one os.ReadDir of one directory, so it never reads them.
//
// A GREEN RESULT HERE MEANS "internal/server IS CLEAN". IT DOES NOT MEAN "THE
// TREE IS CLEAN", AND IT IS NOT EVIDENCE EITHER WAY ABOUT ANY OTHER PACKAGE --
// not that they are safe, not that they are unsafe. Whether writes elsewhere
// need sanitizing is an open architectural question owned outside this file;
// nothing here has adjudicated it, and a reader must not infer that silence is
// a clearance.
//
// This is spelled out because the guard got STRONGER in this commit, and a
// stronger guard is trusted further. A membership set that enumerates one
// package while carrying an unqualified name would convert a scope limitation
// that is merely PRESENT into one that is actively CERTIFIED -- a more precise
// instrument making a wider false claim. The same defect as the blinding one
// level up: that scanner was blind to a write SHAPE, and this one is blind to a
// write LOCATION. If you widen the walk, widen the name and this comment with it.
// ================================================================================
//
// ONE registry, deliberately, consumed by every assertion that needs this set.
// Two enumerations of the same set drift apart, and two sources of truth for
// "which files write RemoteData" is the defect class this scanner exists to
// eliminate -- reproducing it here would be self-defeating.
//
// It replaces an AGGREGATE FLOOR (`sanitized < 4`) that stood in for a
// membership claim. A count cannot express membership: a disjoint set of the
// right size passes any floor, so raising the number would have made the same
// mistake harder to hit rather than impossible.
//
// The floor read 4 while the tree held 6, and its own failure text named the
// composition "convert.go x2, export_import.go x2" -- FALSE ABOUT THE TREE, as
// export_import.go has four. Two sites had been added and the floor was never
// raised, three lines below a comment instructing exactly that maintenance. So
// there were two units of slack, and the shapes that vanish from the scanner
// were convert.go's two: the only sites on the gRPC wire path, the only ones
// that reach a browser. 6 - 2 = 4 against `4 < 4`, which is false. The suite
// would have gone green while the failure text still named a composition the
// counted set shared NOT ONE MEMBER with, undetectably, because it compared an
// integer.
//
// THE MARGIN ABSORBED THE LOSS EXACTLY. A FLOOR OF 5 WOULD HAVE FAILED LOUDLY.
// WE WERE SAVED FROM NOTHING; WE WERE MISSED BY A UNIT.
//
// (The vanishing itself is fixed at its root in remoteDataAssignment, which no
// longer constrains the left-hand side at all. This registry is the independent
// guard: the splitter stops sites from going missing, and membership detects it
// if they ever do again by some shape nobody predicted.)
//
// So the expectation is a SET OF FUNCTION NAMES per file, and any count falls
// out of that list rather than standing in for it. Losing convert.go's wire-path
// write now fails BY NAME: "no sanitized RemoteData write found in taskToProto".
//
// Exemptions are keyed by FILE + EXACT SOURCE TEXT and never by line number: a
// line number is a pointer into mutable state, not an identity, and it silently
// re-points at an unrelated line the next time anything above it moves. Scoping
// them per-file also keeps a generic string like `p.RemoteData = s` from
// exempting a line in a different file that happens to read the same.
//
// UNKNOWN FILES FAIL CLOSED, and so do unknown FUNCTIONS inside known files. A
// new writer is an error here even when it is correctly sanitized, because the
// point is that the set is DECLARED rather than discovered. Add the function to
// the right direction list and say what it writes.
//
// This is the fail-closed direction on purpose: a membership set goes stale
// LOUDLY and BLOCKS, where a count floor goes stale silently and in the
// EXONERATING direction. Both need maintenance; only one punishes skipping it.
//
// ---------------------------------------------------------------------------
// DO NOT ADD A TEST ASSERTING THAT THE BEADS CONVERTER EMITS NO RemoteData.
// ---------------------------------------------------------------------------
// It is TRUE and it is NOT WHY THE SYSTEM IS SAFE, which makes it worse than no
// test. Safety comes from the JOIN: both import arms converge on `doc` in
// ImportCollection before any sanitizer runs, and sanitizeRemoteData takes a
// bare map and cannot tell the arms apart, so COVERAGE IS ARM-INVARIANT. An
// emptiness test would stay green if someone added a third arm that called the
// store directly, hoisted a sanitizer above the join, or let an arm build an
// ImportTask itself -- all three of which break the actual property. A TEST THAT
// PINS A PROPERTY THE SAFETY ARGUMENT DOES NOT REST ON IS NOT DEFENCE IN DEPTH;
// IT IS A FUTURE READER'S EVIDENCE THAT THE WRONG THING IS LOAD-BEARING. The
// right guard -- no import arm writes task data anywhere but into `doc` -- is
// queued as separate work and is deliberately not written here.
var internalServerRemoteDataWriteRegistry = map[string]remoteDataWriteExpectation{
	"convert.go": {
		// The two gRPC wire-path sites: the only RemoteData writes that reach a
		// browser, and so the only two where a miss is a live XSS rather than a
		// stored one. Both read from ent and write to pb.
		outbound: []string{"taskToProto", "collectionToProto"},
	},
	"export_import.go": {
		// Both directions live in this file, which is exactly why the split
		// matters -- a per-file count cannot tell them apart, and neither could
		// the floor.
		//
		// ent -> export document.
		outbound: []string{"ExportCollection", "taskExport"},
		// Untrusted request bytes -> store. Verified by reading the source, not
		// taken on report: both of these read from `doc`, and `doc` is built in
		// ImportCollection from req.GetData() by either the beads arm or the
		// farmtable JSON arm. These are PERSISTED -- they feed store params
		// through to entstore.go SetRemoteData.
		inbound: []string{"ImportCollection", "importedTask"},
	},
	"server.go": {
		// UpdateTask builds a two-key map from request fields instead of copying
		// a remote map, so there is nothing for sanitizeRemoteData to walk. It is
		// guarded at ENTRY instead, which is the stronger position -- the bad
		// value never enters the store.
		//
		// All three lines were INVISIBLE to the previous scanner: it could not
		// see a map-index assignment target at all. They are adjudicated here
		// rather than silently unseen, which is the difference this rewrite buys.
		// Neither direction: nothing here is a sanitized write at all.
		exempt: map[string]string{
			`p.RemoteData = map[string]any{}`: "constructs an empty map, then writes " +
				"the two keys below into it",
			`p.RemoteData["remote_id"] = req.GetRemoteId()`: "a remote ID, not a URL " +
				"carrier; urlBearingRemoteDataKey does not admit remote_id",
			`p.RemoteData["remote_url"] = req.GetRemoteUrl()`: "guarded at entry: " +
				"validateURLField(\"remote_url\", req.GetRemoteUrl()) runs three lines " +
				"above and returns before this executes. NOTE THE JUSTIFICATION IS " +
				"NON-LOCAL -- delete that call and this exemption still matches by " +
				"text and the scanner stays green. What actually pins it is " +
				"TestRPC_UpdateTask_RejectsScriptURLInRemoteURL " +
				"(urlvalidate_rpc_test.go:102), which drives the RPC and requires " +
				"InvalidArgument. This entry records the reasoning; that test is the " +
				"guard.",
		},
	},
}

// TestRemoteDataWriteSitesUnderInternalServerSanitize replaces the sentence "we
// patched four sites" with a measurement, because the sentence was already false
// once: the first version of this work sanitized pb.Task.remote_data and left
// pb.Collection.remote_data and both export paths writing the map raw.
//
// ** THE NAME STATES THE SCOPE, AND THE SCOPE IS ONE DIRECTORY. ** This walk is
// a single os.ReadDir of internal/server. It was previously called
// TestEveryRemoteDataWriteSiteSanitizes, and "every" was false: RemoteData is
// assigned in other packages this test never opens. The rename is not cosmetic.
// A scanner that is blind to a write LOCATION while claiming "every" is the same
// defect as one blind to a write SHAPE, and this commit fixed the second while
// nearly certifying the first -- a more precise instrument making a wider claim.
// See the scope banner on internalServerRemoteDataWriteRegistry. NOTHING HERE
// SAYS ANYTHING ABOUT WRITES IN OTHER PACKAGES, IN EITHER DIRECTION.
//
// Within that scope it reads the non-test sources, finds each place a RemoteData
// FIELD is assigned, and requires the right-hand side to route through
// sanitizeRemoteData. A call site added later fails here rather than silently
// becoming one more unsanitized path.
//
// It is a lower bound on write sites in this package in the same way the
// adapter-key scanner is a lower bound on keys -- a write through a reflected
// field or an aliased struct is invisible to it. Its value is that the shape
// this package actually keeps growing, a plain assignment to the field, is
// caught.
//
// It asserts four separable things, because one integer was previously doing
// all four jobs and doing them badly:
//
//  1. each site found IN THIS PACKAGE routes through sanitizeRemoteData;
//  2. no file in this package outside internalServerRemoteDataWriteRegistry
//     writes the field at all;
//  3. MEMBERSHIP: each declared file holds sanitized writes in exactly the
//     functions declared for it, reported in both directions by name;
//  4. a DIAGNOSTIC, not a guard: the scanner matched something at all.
//
// (3) and (1) do not subsume each other, and both were measured against the
// same fixtures. A site that VANISHES leaves both sides of any equality, so
// only (3) sees it. An unsanitized site ADDED to an already-declared function
// leaves the declared set untouched, so only (1) and the sanitized==sites
// relation see it.
//
// (4) is strictly weaker than (3) -- total vacuity yields an empty set, which
// (3) already fails on -- and it is labelled a diagnostic deliberately. THE
// FLOOR THIS REPLACED ROTTED PRECISELY BECAUSE IT WAS MAINTAINED AS THOUGH IT
// WERE LOAD-BEARING WHEN IT NEVER WAS.
//
// NO TOTAL IS PINNED ANYWHERE. A floor fails by margin absorption; an exact
// total fails by compensating substitution. Only names resist both.
func TestRemoteDataWriteSitesUnderInternalServerSanitize(t *testing.T) {
	root := filepath.Join("..", "..", "internal", "server")
	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatalf("read %s: %v", root, err)
	}

	var unsanitized []string
	var undeclared []string
	sites := 0
	sanitized := 0
	// file -> set of enclosing functions holding a sanitized write.
	sanitizedFuncs := map[string]map[string]bool{}

	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			continue
		}
		src, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		want, declared := internalServerRemoteDataWriteRegistry[name]
		enclosing := "<file scope>"
		for i, line := range strings.Split(string(src), "\n") {
			if fn := remoteDataEnclosingFunc.FindStringSubmatch(line); fn != nil {
				enclosing = fn[1]
			}
			rhs, isSite := remoteDataAssignment(line)
			if !isSite {
				continue
			}
			trimmed := strings.TrimSpace(line)
			if _, ok := want.exempt[strings.TrimSuffix(trimmed, ",")]; ok {
				continue
			}
			if !declared {
				undeclared = append(undeclared,
					fmt.Sprintf("%s:%d in %s: %s", name, i+1, enclosing, trimmed))
				continue
			}
			sites++
			if remoteDataWriteIsSanitized(rhs) {
				sanitized++
				if sanitizedFuncs[name] == nil {
					sanitizedFuncs[name] = map[string]bool{}
				}
				sanitizedFuncs[name][enclosing] = true
				continue
			}
			unsanitized = append(unsanitized,
				fmt.Sprintf("%s:%d in %s: %s", name, i+1, enclosing, trimmed))
		}
	}

	// Enumerate what survived; do not grep for what we expected to find.
	if len(unsanitized) > 0 {
		sort.Strings(unsanitized)
		t.Errorf("%d RemoteData write site(s) UNDER internal/server do not route "+
			"through sanitizeRemoteData:\n  %s\n\nEither sanitize the site or add its "+
			"exact source line to that FILE's `exempt` map in "+
			"internalServerRemoteDataWriteRegistry, with the reason it reads rather "+
			"than writes.",
			len(unsanitized), strings.Join(unsanitized, "\n  "))
	}

	// Fail closed on a file nobody declared. A new writer is an error here even
	// if it is sanitized, because the value of this scanner is that the set is
	// DECLARED -- an undeclared file is a site no one has decided about.
	if len(undeclared) > 0 {
		sort.Strings(undeclared)
		t.Errorf("%d RemoteData write site(s) UNDER internal/server in file(s) "+
			"absent from internalServerRemoteDataWriteRegistry:\n  %s\n\nAdd the file "+
			"to the registry with the functions expected to sanitize and a note on "+
			"what it writes. Do not delete this check to make it pass.",
			len(undeclared), strings.Join(undeclared, "\n  "))
	}

	// MEMBERSHIP BY NAME, not arithmetic, and not an exact count either.
	//
	// A floor fails by MARGIN ABSORPTION: a disjoint set of the right size
	// passes it. An exact total fails by COMPENSATING SUBSTITUTION: lose a site
	// here, gain one there, and the total never moves. A per-file count fails
	// the same way one grain down -- measured green while taskToProto's write
	// was deleted and an unrelated sanitized write took its place in the same
	// file. Only names resist both, because names cannot be traded off against
	// each other.
	//
	// Reported in BOTH directions. A missing name is a site that vanished, which
	// is the failure this exists for. An unexpected name is a new writer nobody
	// declared -- sanitized today, but undeclared, and the point is that the set
	// is decided rather than discovered.
	//
	// AND ASSERTED PER SECURITY DIRECTION, SEPARATELY. Outbound and inbound are
	// two different properties, and the shipped floor of 4 proved what happens
	// when they share one number: it equalled the outbound count exactly, so the
	// entire inbound set was slack and could go to zero coverage while green.
	// Losing all of one direction must fail by the NAME OF THAT DIRECTION, and it
	// must be legible in the failure text which property just lost its guard.
	declaredFiles := make([]string, 0, len(internalServerRemoteDataWriteRegistry))
	for name := range internalServerRemoteDataWriteRegistry {
		declaredFiles = append(declaredFiles, name)
	}
	sort.Strings(declaredFiles)
	for _, name := range declaredFiles {
		want := internalServerRemoteDataWriteRegistry[name]
		got := sanitizedFuncs[name]

		// Each direction is checked on its own, so a loss cannot be masked by
		// coverage in the other one.
		for _, dir := range []struct {
			label string
			why   string
			funcs []string
		}{
			{"OUTBOUND", "data leaving the system toward a client; a miss here is a " +
				"live XSS", want.outbound},
			{"INBOUND", "untrusted input entering the store; these are the sites " +
				"reachable from caller-supplied bytes on ImportCollection", want.inbound},
		} {
			var missing []string
			for _, fn := range dir.funcs {
				if !got[fn] {
					missing = append(missing, fn)
				}
			}
			if len(missing) == 0 {
				continue
			}
			sort.Strings(missing)
			t.Errorf("internal/server/%s: %s coverage lost -- no sanitized "+
				"RemoteData write found in %s (%s).\n"+
				"The site did not merely fail -- it went MISSING, and a count would "+
				"have absorbed that; a count SHARED WITH THE OTHER DIRECTION would "+
				"have absorbed the whole set. Before editing this registry, check "+
				"whether the write is still there but has changed SHAPE and fallen "+
				"out of remoteDataAssignment: that is how this scanner lost both "+
				"wire-path sites once before, silently. Widen the pattern to cover "+
				"the new shape rather than deleting the expectation. If the function "+
				"was genuinely renamed or removed, update the registry deliberately "+
				"and say why in the commit message.",
				name, dir.label, strings.Join(missing, ", "), dir.why)
		}

		// Undeclared names are direction-agnostic: the complaint is that nobody
		// decided, and deciding means picking a direction.
		wantSet := map[string]bool{}
		for _, fn := range want.wantFuncs() {
			wantSet[fn] = true
		}
		var unexpected []string
		for fn := range got {
			if !wantSet[fn] {
				unexpected = append(unexpected, fn)
			}
		}
		if len(unexpected) > 0 {
			sort.Strings(unexpected)
			t.Errorf("internal/server/%s: sanitized RemoteData write(s) in "+
				"undeclared function(s) %s.\n"+
				"These are sanitized, so this is not a vulnerability -- it is an "+
				"undeclared one. Add each to the `outbound` or `inbound` list in "+
				"internalServerRemoteDataWriteRegistry so the set stays decided "+
				"rather than discovered. Choosing the direction is the point of the "+
				"exercise: if a write is genuinely both, it is probably two "+
				"functions. Also check that a declared site did not just move here "+
				"under a new name.",
				name, strings.Join(unexpected, ", "))
		}
	}

	// One number was previously doing two jobs badly. They are separated here,
	// and neither is a hard-coded count of today's tree.
	//
	// Job 1, "is the scanner matching at all?" -- a minimal anti-vacuity floor.
	// A scanner that matched nothing would report no violations and look clean.
	//
	// THIS IS A DIAGNOSTIC, NOT A GUARD. It tells you the instrument is plugged
	// in. It says nothing about whether the tree is safe, and it must never be
	// raised to a real total: a floor of N is satisfied by ANY N sites, so the
	// moment it carries a number bigger than "more than none" it starts silently
	// absorbing losses. The guard is the membership check below.
	if sites == 0 {
		t.Error("the scanner matched no RemoteData write sites at all under " +
			"internal/server; it is not matching. Check remoteDataAssignment " +
			"against the current source.")
	}

	// Job 2, "is THIS PACKAGE clean?" -- and note that it is this package and not
	// the tree; see the scope banner on the registry. Every site found is
	// sanitized, whatever the count. This one cannot go stale: it has no number in
	// it to maintain. The enumeration above already names offenders, so this is
	// the bookkeeping invariant rather than the diagnostic -- it also catches the
	// scanner miscounting itself, which the enumeration cannot.
	if sanitized != sites {
		t.Errorf("%d of %d RemoteData write site(s) under internal/server are "+
			"sanitized; each site in this package must route through "+
			"sanitizeRemoteData or be exempt in the registry.",
			sanitized, sites)
	}
}
