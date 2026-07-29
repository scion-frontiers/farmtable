package server

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"reflect"
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

// ===========================================================================
// WHY THIS IS AN AST WALK NOW, having been a line scanner. THE SECOND ONE IN
// THIS PACKAGE TO MAKE THIS EXACT TRIP.
// ===========================================================================
//
// The predecessor was ~150 lines of hand-rolled lexing: maskGoLiterals, which
// blanked string-literal interiors so a struct tag's colon would not read as an
// assignment; remoteDataAssignment, which split a line at its first top-level
// separator and asked whether anything to the LEFT mentioned RemoteData; and
// firstTopLevelSeparator, which tracked bracket depth one line at a time.
//
// It carried a doc comment claiming `x, err =`, `x, _ =`, `s.f[i].RemoteData =`
// and "SHAPES NOBODY HAS THOUGHT OF ARE ALL VISIBLE WITHOUT BEING PREDICTED."
// ** THAT SENTENCE WAS MEASURED FALSE. ** Four ordinary, gofmt-stable Go shapes
// were SILENT MISSES -- not reported violations, invisible:
//
//	p := store.CreateTaskParams{RemoteData: rd}
//	use(&pb.Task{RemoteData: raw})
//	return store.ImportTask{RemoteData: t.RemoteData}
//	}, RemoteData: raw})                       (line begins with a closer)
//
// Two mechanisms, both inherent to reading Go one line at a time. Splitting at
// the FIRST top-level separator sends a single-line composite to `:=`, so the
// inspected left side is just `p`. And per-line depth tracking sends a
// closer-first line to depth -1, where the `:` arm's `if depth != 0 { continue }`
// skips it.
//
// THE POINT IS NOT THAT FOUR SHAPES WERE MISSED. It is that this file's
// neighbour, urlvalidate_differential_test.go, already carried a section headed
// "WHY THIS IS AN AST WALK NOW, having been a line scanner", listing three
// measured failure modes and concluding "A TEXT-SCAN OF GO SOURCE WAS THE WRONG
// TOOL". `go/ast` and `go/parser` were already imported there. The line scanner
// below reproduced failure mode two off that very list, in the same package, in
// the round whose entire theme was correct code with a wrong explanation
// attached.
//
// This was the FIFTH hand-written scanner in this project, and no fail-open in
// any of them was ever caught by anything except a human reading source. The
// parser has no such failure modes and is in the standard library.
//
// WHAT THE REWRITE DELETES RATHER THAN FIXES, which is the real measure of it:
//
//	maskGoLiterals         -- the lexer knows what a string literal is.
//	firstTopLevelSeparator -- the parser knows what an assignment is.
//	the `//` comment strip -- comments are not statements.
//	the struct-tag special case -- a field declaration is an *ast.Field.
//
// Every one of those was a special case standing in for a fact the parser has
// for free. DO NOT ADD A SIXTH SCANNER. If you need to inspect Go source here,
// extend this walk.

// goSource pairs a parsed file's position information with the bytes it came
// from, so a node can be rendered back to its EXACT original source text.
// Rendering via go/printer would normalise spacing, and the registry's exempt
// map is keyed on verbatim source, so offsets are the right tool.
type goSource struct {
	fset *token.FileSet
	src  string
}

func (g goSource) text(n ast.Node) string {
	lo := g.fset.Position(n.Pos()).Offset
	hi := g.fset.Position(n.End()).Offset
	if lo < 0 || hi > len(g.src) || lo > hi {
		return ""
	}
	return g.src[lo:hi]
}

func (g goSource) line(n ast.Node) int { return g.fset.Position(n.Pos()).Line }

// remoteDataSite is one place a RemoteData FIELD is written, with the identity
// the registry keys on.
type remoteDataSite struct {
	fn   string // registry key: `taskToProto`, or `(*FarmTableService).taskToProto`
	line int
	text string // verbatim source of the whole assignment or literal element
	rhs  string // verbatim source of the value being assigned
}

// isRemoteDataFieldWrite reports whether an assignment target NAMES a
// RemoteData field.
//
// It asks a question about the parsed target, not about text to the left of a
// separator, and that is the whole difference. A read (`rd := p.RemoteData`)
// puts `p.RemoteData` on the RIGHT of an AssignStmt and is structurally
// distinct from a write, where the line scanner could only tell them apart by
// where a byte happened to fall.
func isRemoteDataFieldWrite(lhs ast.Expr) bool {
	switch e := lhs.(type) {
	case *ast.SelectorExpr:
		// pt.RemoteData, a.b.C.RemoteData, items[i].RemoteData.
		return e.Sel.Name == "RemoteData"
	case *ast.IndexExpr:
		// p.RemoteData["remote_id"] -- a write THROUGH the field.
		return isRemoteDataFieldWrite(e.X)
	case *ast.Ident:
		// A local declared with the field's own name. Admitted deliberately: it
		// is cheap, it is fail-closed, and the shape was in the predecessor's
		// regression table.
		return e.Name == "RemoteData"
	case *ast.StarExpr:
		return isRemoteDataFieldWrite(e.X)
	case *ast.ParenExpr:
		return isRemoteDataFieldWrite(e.X)
	}
	return false
}

// remoteDataWriteSites parses one Go source file and returns every place a
// RemoteData field is written, each tagged with its enclosing function.
//
// Two node kinds are sites, and the second is the one the line scanner could
// not see reliably:
//
//	*ast.AssignStmt    -- any target satisfying isRemoteDataFieldWrite.
//	*ast.KeyValueExpr  -- `RemoteData: v` inside a composite literal, WHEREVER
//	                      that literal sits: a short declaration, a call
//	                      argument, a return, or spread across lines in any
//	                      arrangement gofmt permits. Layout is not a variable
//	                      the parser has.
//
// A composite-literal KEY must be an *ast.Ident. That is what keeps
// `map[string]any{"RemoteData": v}` -- a string key that merely spells the
// field name -- from reading as a write, and it costs no special case, because
// the parser has already told us which one it is.
func remoteDataWriteSites(filename, src string) ([]remoteDataSite, error) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, filename, src, 0)
	if err != nil {
		return nil, fmt.Errorf("parsing %s: %w", filename, err)
	}
	g := goSource{fset: fset, src: src}

	var sites []remoteDataSite
	walk := func(enclosing string, n ast.Node) {
		ast.Inspect(n, func(n ast.Node) bool {
			switch node := n.(type) {
			case *ast.AssignStmt:
				for i, lhs := range node.Lhs {
					if !isRemoteDataFieldWrite(lhs) {
						continue
					}
					// `x, err = f()` has one RHS for two targets; `a, b = c, d`
					// has two. Take the positional value when the arities match
					// and the single call otherwise.
					val := node.Rhs[0]
					if len(node.Rhs) == len(node.Lhs) {
						val = node.Rhs[i]
					}
					sites = append(sites, remoteDataSite{
						fn: enclosing, line: g.line(node),
						text: g.text(node), rhs: g.text(val),
					})
					break // one statement is one site
				}
			case *ast.KeyValueExpr:
				if id, ok := node.Key.(*ast.Ident); ok && id.Name == "RemoteData" {
					sites = append(sites, remoteDataSite{
						fn: enclosing, line: g.line(node),
						text: g.text(node), rhs: g.text(node.Value),
					})
				}
			}
			return true
		})
	}

	for _, decl := range file.Decls {
		if fn, ok := decl.(*ast.FuncDecl); ok && fn.Body != nil {
			walk(remoteDataFuncIdent(g, fn), fn.Body)
			continue
		}
		// Package-level var/const/type declarations still get walked, so a write
		// in a package-level initialiser is not invisible just because it is not
		// inside a function.
		walk("<file scope>", decl)
	}
	return sites, nil
}

// remoteDataFuncIdent renders a func declaration as the registry's key form:
// `name` for a free function, `(*Recv).name` for a method.
//
// ** THE RECEIVER IS PART OF THE KEY BECAUSE A BARE NAME IS NOT AN IDENTITY. **
// Package server declares taskToProto TWICE:
//
//	convert.go: func taskToProto(t *ent.Task) *pb.Task            <- writes
//	server.go:  func (s *FarmTableService) taskToProto(ctx, t)    <- wrapper
//
// The registry is keyed by file first, so those two are already distinguished --
// but a bare name cannot separate two methods with the SAME name on DIFFERENT
// receivers in the SAME file, which Go permits, and that would reintroduce
// exactly the compensating substitution the name-keying exists to defeat, one
// level up at the key.
//
// THIS USED TO BE A REGEX OVER THE DECLARATION LINE, and its own comment said
// "when the AST scanner lands it should take this over." It has. Two things
// improved that are worth naming, because "we moved it to the AST" is otherwise
// just an assertion:
//
//   - The regex was a LEXICAL APPROXIMATION that mis-attributed a write inside
//     a func literal to the enclosing declaration. ast.Inspect walks the real
//     body, so a nested func literal's writes are attributed to the function
//     that lexically contains them -- which is the same answer here, but now it
//     is the answer the compiler would give rather than one that happens to
//     agree.
//   - The receiver is rendered from the type NODE, so a qualified, generic or
//     pointer-to-generic receiver renders exactly as written instead of being
//     truncated to `\*?\w+`.
//
// LIMIT 3 ON THE REGISTRY STILL STANDS AND IS NOT WEAKENED BY THIS. The key is
// still TEXT: this renders the receiver's source spelling, not its resolved
// type. A type alias, a dot-import, or the same type name in two packages can
// still produce one key for two declarations. Rendering from the AST removes
// the PARSING error, not the IDENTITY error. Only a type-checked walk
// (go/types) would close that, and this is not one.
func remoteDataFuncIdent(g goSource, fn *ast.FuncDecl) string {
	if fn.Recv == nil || len(fn.Recv.List) == 0 {
		return fn.Name.Name
	}
	return "(" + g.text(fn.Recv.List[0].Type) + ")." + fn.Name.Name
}

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
	seen := map[string]bool{}
	for _, tc := range cases {
		got := remoteDataWriteIsSanitized(tc.rhs)
		if got != tc.want {
			t.Errorf("remoteDataWriteIsSanitized(%q) = %v, want %v", tc.rhs, got, tc.want)
		}
		seen[tc.rhs] = true
	}

	// Anti-vacuity by MEMBERSHIP, not by a count of accept/reject rows. The
	// floor here was `yes < 2 || no < 3` against a population of 2 and 5 -- the
	// accept side had ZERO slack, which reads as tight but only means it will
	// start absorbing losses the moment anyone adds an accept row. And a floor
	// on either side is blind to a row being swapped for a duplicate of another,
	// which is how the sibling table in this file was defeated (see
	// TestRemoteDataWriteSitesSeesEveryShape).
	//
	// These two rows are the ones that make this predicate non-vacuous, so they
	// are named rather than counted. The second is the whole reason this is a
	// function and not an inline strings.Contains.
	for _, required := range []string{
		"structpb.NewStruct(sanitizeRemoteData(t.RemoteData))", // sanitizer nested in a call
		"sanitizeRemoteDataKeys(t.RemoteData),",                // near-miss: a prefix is not the sanitizer
		"structpb.NewStruct(c.RemoteData)",                     // an UNsanitized wire write
	} {
		if !seen[required] {
			t.Errorf("the row %q is gone. Without it this table stops "+
				"distinguishing a working predicate from one that answers the same "+
				"way for every input.", required)
		}
	}
}

// TestRemoteDataWriteSitesSeesEveryShape is the regression test for the two
// blindings this scanner has now had, and it is deliberately a table of SHAPES.
//
// EACH ROW IS A COMPILABLE SNIPPET, NOT A LINE. That change is the point of the
// rewrite and not incidental to it: three of the four shapes the line scanner
// missed CANNOT BE EXPRESSED as a single line, because what defeated it was
// where the line boundaries fell. A table of lines could not have caught them
// and could not now prove they are caught. This follows
// TestRemoteDataLiteralKeysIn in the neighbouring file, which made the same
// trip for the same reason.
//
// The starred rows are shapes a predecessor could not see -- eight from the
// regex era (it admitted `RemoteData` followed by at most a literal `, _`) and
// four measured against the line scanner in the r5 review. Every one of them
// returned "not a site": not a violation, an ABSENCE, so a tree containing only
// those shapes scanned clean.
//
// The reject rows matter just as much: a scanner that called everything a site
// would also pass on a clean tree, since on a clean tree every real site IS
// sanitized. Reads, comparisons, ranges, declarations and comments must be
// rejected.
func TestRemoteDataWriteSitesSeesEveryShape(t *testing.T) {
	cases := []struct {
		name string
		src  string
		site bool
		rhs  string
	}{
		{"plain assignment", `package p
func f() { pt.RemoteData = sanitizeRemoteData(x) }`, true, "sanitizeRemoteData(x)"},

		{"composite literal field on its own line", `package p
func f() any {
	return exportCollection{
		RemoteData:  sanitizeRemoteData(c.RemoteData),
	}
}`, true, "sanitizeRemoteData(c.RemoteData)"},

		{"* named error target", `package p
func f() { pt.RemoteData, err = structpb.NewStruct(x) }`, true, "structpb.NewStruct(x)"},

		{"* blank second target", `package p
func f() { pt.RemoteData, _ = structpb.NewStruct(x) }`, true, "structpb.NewStruct(x)"},

		{"* comma-ok target", `package p
func f() { a.b.C.RemoteData, ok = m[k] }`, true, "m[k]"},

		{"* selector target", `package p
func f() { s.inner.RemoteData = raw }`, true, "raw"},

		{"* index target", `package p
func f() { items[i].RemoteData = raw }`, true, "raw"},

		{"* short declaration", `package p
func f() { RemoteData := sanitizeRemoteData(x) }`, true, "sanitizeRemoteData(x)"},

		{"* write through the field by key", `package p
func f() { p.RemoteData["remote_url"] = req.GetRemoteUrl() }`, true, "req.GetRemoteUrl()"},

		// ------------------------------------------------------------------
		// THE FOUR THE LINE SCANNER MISSED SILENTLY. Measured red against it
		// before this rewrite; the transcript is in reports/_run-queue-log.md
		// under R6-2. These four are the red this rewrite went green against.
		// ------------------------------------------------------------------
		{"* single-line composite", `package p
func f() { p := store.CreateTaskParams{RemoteData: rd} }`, true, "rd"},

		{"* composite in a call argument", `package p
func f() { use(&pb.Task{RemoteData: raw}) }`, true, "raw"},

		{"* composite in a return", `package p
func f() any { return store.ImportTask{RemoteData: t.RemoteData} }`, true, "t.RemoteData"},

		// The shape whose defeat was PURELY a line-boundary artefact: the line
		// holding the field begins with a closer, so per-line depth tracking went
		// to -1 and the `:` arm skipped it. There is no single line to write
		// here, which is exactly the finding.
		{"* line begins with a closer", `package p
func f() {
	use(&pb.Task{
		Meta: map[string]any{
			"k": v,
		}, RemoteData: raw})
}`, true, "raw"},

		{"read into a local is not a write", `package p
func f() { rd := p.RemoteData }`, false, ""},

		{"comparison is not a write", `package p
func f() { if p.RemoteData == nil { return } }`, false, ""},

		{"range over it is not a write", `package p
func f() { for k, v := range p.RemoteData { _ = k } }`, false, ""},

		{"struct field declaration with a json tag", "package p\n" +
			"type exportTask struct {\n" +
			"\tRemoteData  map[string]any `json:\"remote_data,omitempty\"`\n" +
			"}", false, ""},

		{"a string key that merely names it", `package p
func f() { m := map[string]any{"RemoteData": v} }`, false, ""},

		{"commented-out write", `package p
func f() {
	// pt.RemoteData = raw
}`, false, ""},

		{"bare call mentioning it", `package p
func f() { use(p.RemoteData) }`, false, ""},

		{"a local merely CONTAINING the name is not a write", `package p
const maxRemoteDataDepth = 32`, false, ""},
	}

	seenSrc := map[string]string{}
	seenName := map[string]bool{}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sites, err := remoteDataWriteSites("shape.go", tc.src)
			if err != nil {
				t.Fatalf("remoteDataWriteSites did not parse the snippet: %v\n%s", err, tc.src)
			}
			if got := len(sites) > 0; got != tc.site {
				t.Fatalf("site = %v, want %v, for:\n%s\n(scanner returned %d site(s))",
					got, tc.site, tc.src, len(sites))
			}
			if tc.site && sites[0].rhs != tc.rhs {
				t.Errorf("rhs = %q, want %q, for:\n%s", sites[0].rhs, tc.rhs, tc.src)
			}
		})

		// ------------------------------------------------------------------
		// ANTI-VACUITY BY MEMBERSHIP, NOT BY COUNT. This replaces three count
		// floors (`starred < 5` against a population of 6, `sites < 6` against
		// 8, `rejects < 5` against 7).
		//
		// The floors were measured defeated TWICE in the r5 test leg, and the
		// second way is the one that matters:
		//
		//   M3 deleted the "* index target" row.       6 -> 5.  GREEN.
		//   M4 left the count ALONE and replaced that
		//      row's BODY with a duplicate of another
		//      row's body, name intact.  6 -> 6.       GREEN.
		//
		// M4 is why raising the floors would not have been a fix. A count is
		// blind to count-NEUTRAL corruption by construction, and this file
		// already argues that at length for the write registry -- "THE MARGIN
		// ABSORBED THE LOSS EXACTLY... WE WERE SAVED FROM NOTHING; WE WERE
		// MISSED BY A UNIT" -- and then, one screen up, used a floor anyway.
		//
		// So: required names must be PRESENT, and every row's source must be
		// DISTINCT. Membership kills M3. Distinctness kills M4. Neither can be
		// traded off against the other, and no number here needs maintaining
		// when a row is added.
		// ------------------------------------------------------------------
		if prev, dup := seenSrc[tc.src]; dup {
			t.Errorf("DUPLICATE ROW BODY: %q and %q assert the same snippet.\n"+
				"A table of shapes whose bodies collide covers fewer shapes than it "+
				"has rows, and the row count does not move when it happens -- which "+
				"is exactly how a count-neutral swap went green here before. If you "+
				"are copying a row, change what it tests.", prev, tc.name)
		}
		seenSrc[tc.src] = tc.name
		seenName[tc.name] = true
	}

	// The shapes that JUSTIFY this scanner's two rewrites. A row may be
	// reworded, but if one of these disappears the table has stopped being the
	// regression test for the blinding it was written for.
	for _, required := range []string{
		// Defeated the original regex.
		"* named error target", "* blank second target", "* comma-ok target",
		"* selector target", "* index target", "* short declaration",
		// Defeated the line scanner. Measured, r5 review R4.
		"* single-line composite", "* composite in a call argument",
		"* composite in a return", "* line begins with a closer",
		// Rejects that keep the scanner from calling everything a site.
		"read into a local is not a write", "comparison is not a write",
		"struct field declaration with a json tag",
		"a string key that merely names it", "commented-out write",
	} {
		if !seenName[required] {
			t.Errorf("the row %q is gone. It is not one row among many: it is a "+
				"shape a previous version of this scanner MISSED SILENTLY, and this "+
				"table is the only thing that says it is seen now. Removing it does "+
				"not weaken a margin, it deletes the evidence. Do not replace this "+
				"check with a count -- a count was here, and a count-neutral swap "+
				"went green through it.", required)
		}
	}
}

// TestRemoteDataFuncIdentSeparatesMethodsFromFunctions pins the REGISTRY KEY,
// which is a different thing from the write pattern and fails differently.
//
// A bare function name is not an identity. Package server declares taskToProto
// twice -- the free function in convert.go that holds the wire-path write, and a
// method on *FarmTableService in server.go that wraps it. The wrapper is the
// enrichment seam: it takes ctx and the store and already mutates the proto
// after conversion, so it is by convention exactly where store-dependent field
// population lands. If the RemoteData write ever moves from the free function
// into the wrapper, it leaves an audited function for an unaudited one, and a
// registry keyed on the bare name would stay green through the move -- the same
// compensating substitution that name-keying exists to defeat, reintroduced one
// level up at the key.
//
// File-keying already separates that particular pair. This test covers the case
// file-keying CANNOT: Go permits two methods with the same name on different
// receivers in the SAME file. That is not hypothetical here, and the rows below
// are copied from real declarations rather than invented:
//
//	internal/cli/connect.go        Close, :251 *embeddedCloser / :334
//	                               *passThroughCloser -- hand-written
//	api/farmtable/v1/farmtable.pb.go  GetRemoteData, :2034 *Task / :2212
//	                               *Collection -- this field's own accessor
//
// Both at e6bda71. Neither is in the scanned directory, which is the point:
// they establish that file:function is not unique IN THIS REPOSITORY, so the
// receiver is load-bearing rather than defensive. It is still only an instance
// fix -- see LIMIT 3 on the registry.
func TestRemoteDataFuncIdentSeparatesMethodsFromFunctions(t *testing.T) {
	cases := []struct {
		decl string
		want string
	}{
		{"func taskToProto(t *ent.Task) *pb.Task {", "taskToProto"},
		{"func (s *FarmTableService) taskToProto(ctx context.Context, t *ent.Task) *pb.Task {",
			"(*FarmTableService).taskToProto"},
		{"func (s FarmTableService) taskToProto(t *ent.Task) *pb.Task {",
			"(FarmTableService).taskToProto"},
		// Real same-file, same-name, different-receiver pairs from this tree.
		{"func (c *embeddedCloser) Close() error {", "(*embeddedCloser).Close"},
		{"func (c *passThroughCloser) Close() error {", "(*passThroughCloser).Close"},
		{"func (x *Task) GetRemoteData() *structpb.Struct {", "(*Task).GetRemoteData"},
		{"func (x *Collection) GetRemoteData() *structpb.Struct {", "(*Collection).GetRemoteData"},
		{"func write() {", "write"},
	}

	seen := map[string]string{}
	for _, tc := range cases {
		fset := token.NewFileSet()
		file, err := parser.ParseFile(fset, "decl.go", "package p\n"+tc.decl+"\n}", 0)
		if err != nil {
			t.Errorf("could not parse a declaration: %s: %v", tc.decl, err)
			continue
		}
		fn, ok := file.Decls[0].(*ast.FuncDecl)
		if !ok {
			t.Errorf("not a func declaration: %s", tc.decl)
			continue
		}
		got := remoteDataFuncIdent(goSource{fset: fset, src: "package p\n" + tc.decl + "\n}"}, fn)
		if got != tc.want {
			t.Errorf("remoteDataFuncIdent(%q) = %q, want %q", tc.decl, got, tc.want)
		}
		if prev, dup := seen[got]; dup {
			t.Errorf("KEY COLLISION: %q is produced by both\n  %s\n  %s\n"+
				"Two distinct declarations sharing a registry key means one can be "+
				"substituted for the other without the membership set moving.",
				got, prev, tc.decl)
		}
		seen[got] = tc.decl
	}

	// Anti-vacuity: the table must actually contain a same-name pair, or the
	// collision check above is asserting nothing. Both the free/method pair and
	// the two-receivers pair have to be present.
	if len(seen) != len(cases) {
		t.Errorf("expected %d distinct keys from %d declarations, got %d",
			len(cases), len(cases), len(seen))
	}
	for _, pair := range [][2]string{
		{"taskToProto", "(*FarmTableService).taskToProto"},
		{"(*embeddedCloser).Close", "(*passThroughCloser).Close"},
		{"(*Task).GetRemoteData", "(*Collection).GetRemoteData"},
	} {
		if _, ok := seen[pair[0]]; !ok {
			t.Errorf("anti-vacuity: the table no longer contains %q, so the "+
				"collision it guards against is untested", pair[0])
		}
		if _, ok := seen[pair[1]]; !ok {
			t.Errorf("anti-vacuity: the table no longer contains %q, so the "+
				"collision it guards against is untested", pair[1])
		}
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
// THREE LIMITS. THE SECOND WILL SURPRISE YOU; THE THIRD HAS NO FIX.
//
// LIMIT 1, LOCATION: THIS REGISTRY COVERS ONE DIRECTORY, internal/server. It is
// not a tree-wide census. Other packages assign RemoteData too, and this scanner
// does one os.ReadDir of one directory, so it never reads them.
//
// LIMIT 2, FORM: THIS SCANNER MATCHES ASSIGNMENT AND INDEX FORMS ONLY. IT DOES
// NOT MATCH BUILDER-SUFFIX FORMS SUCH AS SetRemoteData, AND SIX OF THOSE EXIST
// IN internal/store/entstore.go. The reason is worth understanding rather than
// patching: the anchor is `\bRemoteData\b`, and THERE IS NO WORD BOUNDARY
// BETWEEN "Set" AND "RemoteData". Verified:
//
//	printf 'x.SetRemoteData(m)' | grep -cE '\bRemoteData'   ->   0
//
// Ent's mutation builders carry the identifier as a SUFFIX of a different
// identifier, so every census taken during this round -- three of them, by three
// legs, independently -- excluded the persistence layer BY THE SHAPE OF THE
// ANCHOR rather than by anyone's choice. Those six are tracked separately. DO
// NOT fix this by adding SetRemoteData as a seventh form: adding a form is the
// move that produced every blind spot in this file's history, and the sound
// bound is compiler-resolved (an AST walk, or a type that makes raw assignment
// unrepresentable), which is separate work.
//
// AND THE ARGUMENT THAT ENDS THE COUNTING RATHER THAN WINNING IT: RemoteData is
// map[string]any, a REFERENCE type. `create.SetRemoteData(p.RemoteData)` hands
// the store the map itself, so ANY LATER MUTATION THROUGH ANY ALIAS IS A WRITE
// TO PERSISTED STATE IN WHICH THE TOKEN "RemoteData" DOES NOT APPEAR AT ALL. A
// census keyed on the identifier cannot in principle enumerate those. ** THE
// POPULATION IS OPEN. ** That is why this test's name says what it WALKS and not
// what it covers -- a universal over a set nobody can enumerate is not a claim
// anyone can honour.
//
// A GREEN RESULT HERE MEANS "THE SITES THIS SCANNER WALKS ARE CLEAN". IT DOES
// NOT MEAN "THE TREE IS CLEAN", AND IT IS NOT EVIDENCE EITHER WAY ABOUT ANY
// OTHER PACKAGE OR ANY OTHER FORM -- not that they are safe, not that they are
// unsafe. Whether writes elsewhere need sanitizing is an open architectural
// question owned outside this file; nothing here has adjudicated it, and a
// reader must not infer that silence is a clearance.
//
// LIMIT 3, KEY: THE REGISTRY KEY IS TEXT, NOT AN IDENTITY. Entries key on
// file + receiver + function (`export_import.go` ->
// `(*FarmTableService).ImportCollection`). That is AN INSTANCE FIX, LABELLED AS
// ONE. It closes the collisions that have actually been demonstrated and it
// does not close the class. Both of these are real and were verified in this
// tree at e6bda71 rather than taken on report:
//
//	bare `Close`         internal/cli/connect.go declares it TWICE, :251 on
//	                     *embeddedCloser and :334 on *passThroughCloser. Hand
//	                     -written, same file, both keying to "connect.go:Close".
//	bare `GetRemoteData` api/farmtable/v1/farmtable.pb.go declares it TWICE,
//	                     :2034 on *Task and :2212 on *Collection. THE COLLIDING
//	                     NAME IS THIS FIELD'S OWN ACCESSOR.
//
// So file:function admits compensating substitution one scope narrower than the
// version that killed the count map, and the receiver closes that one scope.
// Now look at the shape of the repair history before you extend it. The regex
// was widened to admit a form. The census was widened to admit a form. The key
// was widened to admit a qualifier. Then the qualifier was widened again. EACH
// FIX RESOLVED THE INSTANCE THAT HAD JUST BEEN DEMONSTRATED AND LEFT THE CLASS
// INTACT -- and several were proposed by people who had, the same hour, ruled
// that adding a form MOVES a blind spot rather than closing it.
//
// ** EVERY KEY SHORT OF A COMPILER-RESOLVED IDENTITY IS A HEURISTIC WITH AN
// UNKNOWN MARGIN. THE ONLY SOUND BOUND IS AST- OR TYPE-RESOLVED, AND THIS
// REGISTRY IS NOT THAT. **
//
// Unknown, note, is not zero and is not measured. A receiver rendered as text
// is still text: a type alias, a generic instantiation, a dot-import, or the
// same type name in two packages can each produce one key for two declarations,
// and nothing here would notice. If your next move is to add a fourth
// qualifier, this paragraph is the thing it has to answer first.
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
		outbound: []string{"(*FarmTableService).ExportCollection", "taskExport"},
		// Untrusted request bytes -> store. Verified by reading the source, not
		// taken on report: both of these read from `doc`, and `doc` is built in
		// ImportCollection from req.GetData() by either the beads arm or the
		// farmtable JSON arm. These are PERSISTED -- they feed store params
		// through to entstore.go SetRemoteData.
		inbound: []string{"(*FarmTableService).ImportCollection", "importedTask"},
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
			`p.RemoteData = map[string]any{}`: "constructs an EMPTY map -- and read " +
				"the rest of this before you reuse the pattern. In isolation the " +
				"line is unimpeachable: it assigns an empty literal, so there is " +
				"nothing to sanitize. In context it is the INITIALISER OF A " +
				"THREE-LINE SEQUENCE whose next two lines put caller-supplied bytes " +
				"into the very map it just created. AN EXACT-TEXT EXEMPTION CAN " +
				"EXPRESS 'THIS WRITE IS EMPTY'. IT CANNOT EXPRESS 'AND NOTHING " +
				"POPULATES IT AFTERWARDS.' So exempting this line is only safe " +
				"because the two below it are visible and adjudicated in their own " +
				"right -- which they are, in this map, and were not before this " +
				"rewrite. A STRONGER CLAIM WAS DRAFTED HERE AND RETRACTED BEFORE IT " +
				"SHIPPED, and it is left on the record because the error is more " +
				"useful than the sentence was: that the AST scanner in " +
				"urlvalidate_differential_test.go also had no representation for " +
				"those two lines, so exemption and blind spot concealed each other. " +
				"FALSE. buildsRemoteData admits them through its *ast.IndexExpr arm " +
				"via isRemoteDataTarget, and remoteDataLiteralKeysIn's AssignStmt " +
				"arm extracts their keys. That claim was true of a PRE-4e58242 tree " +
				"and 4e58242 is an ancestor of HEAD -- a file:line read at the " +
				"current SHA was joined to a measurement taken at an older one. THE " +
				"BRANCH IS NOT AN IDENTIFIER; THE SHA IS, AND EVERY file:line CARRIES " +
				"ITS SHA.",
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

// TestScannedServerPackageRemoteDataWriteSitesSanitize replaces the sentence "we
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
func TestScannedServerPackageRemoteDataWriteSitesSanitize(t *testing.T) {
	// "." and not filepath.Join("..", "..", "internal", "server"): this test is
	// COMPILED INTO the package it walks, so the package's own directory is the
	// working directory. The relative climb re-derived a path it already had and
	// would break silently under a directory move -- os.ReadDir would fail and
	// t.Fatalf below would at least be loud, but the correct spelling cannot
	// break at all.
	root := "."
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
		found, err := remoteDataWriteSites(name, string(src))
		if err != nil {
			// A parse failure is a HARD failure, not a skip. The line scanner
			// this replaced had no way to fail at all -- unparseable input just
			// produced no matches, which is indistinguishable from a clean file.
			t.Fatalf("scanning %s: %v", name, err)
		}
		for _, site := range found {
			if _, ok := want.exempt[site.text]; ok {
				continue
			}
			where := fmt.Sprintf("%s:%d in %s: %s", name, site.line, site.fn, site.text)
			if !declared {
				undeclared = append(undeclared, where)
				continue
			}
			sites++
			if remoteDataWriteIsSanitized(site.rhs) {
				sanitized++
				if sanitizedFuncs[name] == nil {
					sanitizedFuncs[name] = map[string]bool{}
				}
				sanitizedFuncs[name][site.fn] = true
				continue
			}
			unsanitized = append(unsanitized, where)
		}
	}

	// Enumerate what survived; do not grep for what we expected to find.
	if len(unsanitized) > 0 {
		sort.Strings(unsanitized)
		t.Errorf("%d RemoteData write site(s) UNDER internal/server do not route "+
			"through sanitizeRemoteData:\n  %s\n\nEither sanitize the site or add its "+
			"exact source line to that FILE's `exempt` map in "+
			"internalServerRemoteDataWriteRegistry, with the reason it reads rather "+
			"than writes.\n"+
			"SCOPE OF THIS SCANNER: internal/server only; assignment and index "+
			"forms only; builder-suffix forms such as SetRemoteData are NOT "+
			"matched, and six exist in internal/store/entstore.go. A green run "+
			"here is not a statement about the tree.",
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
				"wire-path sites once before, silently. In particular check whether "+
				"it became a BUILDER-SUFFIX call such as SetRemoteData, which this "+
				"scanner does not match at all (no word boundary between \"Set\" and "+
				"\"RemoteData\"). Do not delete the expectation to make this pass, and "+
				"do not paper over it by adding one more admissible form. If the "+
				"function was genuinely renamed or removed, update the registry "+
				"deliberately and say why in the commit message.\n"+
				"SCOPE OF THIS SCANNER: internal/server only; assignment and index "+
				"forms only; builder-suffix forms such as SetRemoteData are NOT "+
				"matched, and six exist in internal/store/entstore.go.",
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
