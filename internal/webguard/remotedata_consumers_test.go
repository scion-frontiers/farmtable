package webguard

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// WHAT GOES RED WHEN SOMEONE ADDS A remote_data CONSUMER IN THE WEB TREE.
//
// That question is this file's entire reason to exist, and the answer is
// TestWebRemoteDataConsumersAreDeclared below.
//
// ============================================================================
// WHY THIS IS NOT A RENDER-SINK SCANNER
// ============================================================================
//
// Three independent review legs went looking for places the dashboard RENDERS
// remote_data. All three found none, and all three were right. The dashboard
// does read it -- in two places -- and it does not print, interpolate or bind
// it into a template anywhere. IT BRANCHES ON IT, to decide whether write
// operations are permitted.
//
// A search for render sinks is STRUCTURALLY INCAPABLE of finding a capability
// sink. The enumeration of sink KINDS is what failed, so this guard does not
// enumerate sink kinds. It keys on the field being MENTIONED AT ALL. Rendering
// is one consumption class; authorization branching is another; serialisation,
// cache keys, comparison and logging are more, and the honest position is that
// neither the author of this file nor anyone who reviewed it can enumerate the
// rest.
//
// ============================================================================
// WHY remote_data IS TREATED AS A SECURITY BOUNDARY AT ALL -- RULED, NOT MEASURED
// ============================================================================
//
// This is a POLICY CALL and not a finding, and it is recorded as such so nobody
// later goes looking for the measurement that justifies it.
//
// The reason is NOT that the sink set is empty. It is not empty, and believing
// it was is what cost this axis several rounds. The reason is that the bytes are
// ATTACKER-AUTHORED -- they come from an upstream issue tracker, via a
// passthrough path with no round-trip and no schema -- and THE SINK SET IS OPEN
// AND UNOWNED. Nobody owns the question of what may consume this field, so the
// default has to be that nothing may, silently.
//
// ============================================================================
// WHY A CENSUS AND NOT A PARSER, WHICH IS THE UNCOMFORTABLE PART
// ============================================================================
//
// This project has five hand-written source scanners and a ruling that there
// must not be a sixth. That ruling is right, and the reason it is right is that
// every one of those scanners tried to UNDERSTAND STRUCTURE -- which assignment
// shapes count, which lines are comments -- and each of them got it wrong
// silently, reporting clean when it was blind.
//
// So this is not that. It does not parse TypeScript, does not classify
// statements, does not decide what a line MEANS. It is an occurrence census over
// two fixed identifiers, and its correctness argument is that it
// OVER-APPROXIMATES: it counts mentions in comments, in strings, in generated
// code, everywhere. Over-approximating cannot produce the failure mode that
// killed the other five, because there is no shape it can fail to recognise. A
// census's errors are all in the noisy direction, and noisy is the direction
// that fails closed.
//
// The cost is real and is not hidden: this guard goes red for a renamed
// variable, a reworded comment or a proto regeneration, none of which are
// security events. That is the price of not having a parser, and it is
// deliberately paid. Every red demands a human decision, which is the point --
// see the allowlist below, where each entry carries the reason it was allowed.
//
// WHAT IT COVERS: any occurrence of the literal strings "remoteData" or
// "remote_data" anywhere under web/, in any file, of any type.
//
// WHAT IT DOES NOT COVER, stated plainly because an unstated limit is how a
// guard becomes a false assurance:
//   - Aliasing. `const rd = coll.remoteData` is caught at that line, but every
//     later use of `rd` is invisible. A consumer that receives the value as a
//     function parameter named something else is invisible.
//   - Dynamic access. `coll['remote' + 'Data']` is invisible.
//   - Anything outside web/. Other clients of this API are not in this tree.
//   - node_modules, dist and build output, which are skipped as non-source.
//
// The first limit is the significant one. This guard bounds where the field is
// REACHED, not where the value ultimately flows. That is a weaker property than
// taint tracking and a stronger one than nothing, and it is chosen because it is
// the strongest property that can be checked without a TypeScript parse.

// remoteDataIdentifiers are the two spellings the field takes in the web tree:
// camelCase in TypeScript, snake_case in the proto JSON descriptor.
var remoteDataIdentifiers = []string{"remoteData", "remote_data"}

// skipDirs are directories that are not source.
var skipDirs = map[string]bool{
	"node_modules": true,
	"dist":         true,
	"build":        true,
	".vite":        true,
	"coverage":     true,
}

// declaredConsumer is one allowed mention of the field.
//
// It is keyed on the EXACT trimmed source text rather than a line number,
// because line numbers move for unrelated reasons and a guard that cries wolf
// on every insertion above it gets disabled. The text is exact: no substring
// matching, no normalisation beyond trimming surrounding whitespace.
type declaredConsumer struct {
	file   string
	text   string
	count  int
	reason string
}

// webRemoteDataConsumers IS AN ALLOWLIST OF NAMED SITES, NOT A PERMITTED
// CATEGORY.
//
// It deliberately does not say "the web tree may read collection remote_data".
// A category grants the next one for free, and granting the next one for free
// is precisely how a capability sink sat unnoticed through five review rounds.
// Each site is listed individually with the reason it is allowed. Adding a
// consumer means adding a line here, which means a human wrote down why.
//
// The counts are EXACT MULTIPLICITIES, not floors. `count: 2` means exactly two
// occurrences of that exact text in that file -- a third is a failure. This is
// the opposite of the count floors that this round removed elsewhere: a floor
// can absorb a deletion via a compensating addition, an exact multiset cannot
// absorb anything in either direction.
var webRemoteDataConsumers = []declaredConsumer{
	// ---- THE TWO REAL CONSUMERS. Both collection-side, both capability gates.
	{
		file:  "src/capabilities.ts",
		text:  "const rd = collection.remoteData;",
		count: 1,
		reason: "getCapabilities: reads the collection's remote_data on the GITHUB branch " +
			"to decide between GITHUB_CAPABILITIES and ALL_DISABLED. A WRITE-AUTHORIZATION " +
			"GATE, not a render sink -- the value is branched on, never displayed. " +
			"FARMTABLE collections return ALL_ENABLED before reaching this line.",
	},
	{
		file:  "src/components/ft-app.ts",
		text:  "const rd = coll.remoteData;",
		count: 1,
		reason: "isCollectionWritable: reads the collection's remote_data and returns " +
			"rd.writable === true, defaulting to false. The second write-authorization " +
			"gate. Both of its callers return early on FARMTABLE before reaching it.",
	},

	// ---- COMMENTS. Allowed individually, not as a class. A comment mentioning
	// the field is not a consumer, but it is also not free: comments are how the
	// false reachability claims that this round spent most of its time undoing
	// got into the tree in the first place.
	{
		file:   "src/components/ft-app.ts",
		text:   "// Check remote_data for explicit writable flag",
		count:  1,
		reason: "Comment on the isCollectionWritable read directly below it.",
	},
	{
		file:   "src/store/task-store.ts",
		text:   "// because proto map fields (e.g. remoteData from google.protobuf.Struct)",
		count:  1,
		reason: "Comment explaining proto map handling in general. No read of the field here.",
	},

	// ---- GENERATED TRANSPORT CODE. Listed line by line rather than excluded by
	// directory, on purpose. These are not consumers -- they are the wire
	// decode -- but a proto regeneration that changes the SHAPE of this field is
	// exactly the sort of quiet event this guard should surface to a human.
	{
		file:   "src/gen/types.ts",
		text:   "remoteData?: Record<string, unknown>;",
		count:  2,
		reason: "Generated type declarations for Task.remoteData and Collection.remoteData.",
	},
	{
		file:  "src/gen/grpc-client.ts",
		text:  "remoteData: record.remoteData ? structToRecord(asRecord(record.remoteData)) : undefined,",
		count: 2,
		reason: "Generated wire decode for the two messages carrying the field. Transport, " +
			"not consumption: it converts the struct and hands it on without inspecting it.",
	},
	{
		file:   "src/gen/farmtable.json",
		text:   "\"remoteData\": {",
		count:  2,
		reason: "Generated proto descriptor: the field entries for Task and Collection.",
	},
	{
		file:   "src/gen/farmtable.json",
		text:   "\"protoName\": \"remote_data\"",
		count:  2,
		reason: "Generated proto descriptor: the wire names for the same two fields.",
	},
}

// webRoot locates the web/ directory by walking up for go.mod.
//
// Not a relative path from the test's directory: a review nit in this same
// round was about exactly that, where filepath.Join("..","..","internal",
// "server") happened to resolve correctly only by accident of the working
// directory. Anchoring on the module root is stable wherever the test is run
// from.
func webRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			web := filepath.Join(dir, "web")
			if _, err := os.Stat(web); err != nil {
				t.Fatalf("found the module root at %s but no web/ directory beside it: %v\n"+
					"If the web tree moved, this guard is not scanning it and is silently "+
					"passing. Point it at the new location rather than deleting it.", dir, err)
			}
			return web
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("walked to the filesystem root without finding go.mod; cannot locate the web tree")
		}
		dir = parent
	}
}

type mention struct {
	file string // slash-separated, relative to web/
	line int
	text string
}

// censusRemoteDataMentions returns every occurrence of either identifier
// anywhere under web/, excluding non-source directories.
func censusRemoteDataMentions(t *testing.T, root string) []mention {
	t.Helper()
	var found []mention
	var filesScanned int

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if skipDirs[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("reading %s: %w", path, err)
		}
		filesScanned++
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)

		for i, line := range strings.Split(string(data), "\n") {
			for _, id := range remoteDataIdentifiers {
				if strings.Contains(line, id) {
					found = append(found, mention{file: rel, line: i + 1, text: strings.TrimSpace(line)})
					break // one line is one mention, even if it names both spellings
				}
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walking the web tree: %v", err)
	}

	// A walk that reads nothing reports a clean tree. This is the §10.20 case:
	// an unproven zero looks exactly like a good result.
	if filesScanned == 0 {
		t.Fatalf("scanned 0 files under %s. The guard found nothing because it LOOKED at "+
			"nothing, which is not the same as the tree being clean.", root)
	}
	return found
}

// TestWebRemoteDataConsumersAreDeclared is the guard.
//
// It fails when the web tree mentions remote_data anywhere not named in
// webRemoteDataConsumers, and equally when a declared site stops matching.
// Both directions matter: the first catches a new consumer, the second catches
// a consumer that moved or was renamed out from under its declaration, which
// would otherwise silently reduce coverage while staying green.
func TestWebRemoteDataConsumersAreDeclared(t *testing.T) {
	root := webRoot(t)
	found := censusRemoteDataMentions(t, root)

	if len(found) == 0 {
		t.Fatal("the census found ZERO mentions of remote_data in the web tree. There are " +
			"known consumers, so zero means the census is broken -- wrong root, wrong " +
			"identifiers, or an over-eager skip list -- not that the tree is clean.")
	}

	// Index the allowlist by file+text.
	type key struct{ file, text string }
	declared := map[key]*declaredConsumer{}
	for i := range webRemoteDataConsumers {
		c := &webRemoteDataConsumers[i]
		k := key{c.file, c.text}
		if _, dup := declared[k]; dup {
			t.Fatalf("allowlist has two entries for the same file and text (%s / %q); "+
				"merge them and set count correctly rather than listing it twice", c.file, c.text)
		}
		declared[k] = c
	}

	actual := map[key]int{}
	var undeclared []string
	for _, m := range found {
		k := key{m.file, m.text}
		if _, ok := declared[k]; !ok {
			undeclared = append(undeclared, fmt.Sprintf("  %s:%d: %s", m.file, m.line, m.text))
			continue
		}
		actual[k]++
	}

	if len(undeclared) > 0 {
		sort.Strings(undeclared)
		t.Errorf("UNDECLARED remote_data MENTION(S) IN THE WEB TREE:\n%s\n\n"+
			"remote_data is attacker-authored and its sink set is OPEN AND UNOWNED, so a new "+
			"consumer is a decision that needs a human, not a default.\n\n"+
			"IF THIS IS A NEW CONSUMER: do not just add it to the allowlist. Work out what the "+
			"value is used for first. Note that the two existing consumers are CAPABILITY "+
			"gates, not render sinks -- three review legs hunted render sinks here and "+
			"correctly found none, because the question was too narrow. Your new one may be a "+
			"class nobody has named either.\n\n"+
			"IF THIS IS A RENAME, A REWORDED COMMENT OR A PROTO REGENERATION: update the "+
			"matching allowlist entry's text. That is the intended cost of a guard with no "+
			"TypeScript parser, and it is cheaper than the alternative.\n\n"+
			"DO NOT relax this to a directory exclusion or a permitted category. A category "+
			"grants the next consumer for free, which is how the capability gate went five "+
			"rounds unnoticed.", strings.Join(undeclared, "\n"))
	}

	// The other direction: declared sites that no longer match.
	var stale []string
	for i := range webRemoteDataConsumers {
		c := &webRemoteDataConsumers[i]
		got := actual[key{c.file, c.text}]
		if got == c.count {
			continue
		}
		stale = append(stale, fmt.Sprintf("  %s: want %d occurrence(s) of %q, found %d\n    (declared reason: %s)",
			c.file, c.count, c.text, got, c.reason))
	}
	if len(stale) > 0 {
		sort.Strings(stale)
		t.Errorf("DECLARED remote_data SITE(S) NO LONGER MATCH:\n%s\n\n"+
			"A declaration that matches nothing is not harmless. It means the allowlist is "+
			"describing a tree that no longer exists, and every future reader will trust it. "+
			"If the site MOVED, update the text. If it was DELETED, delete the entry and say so "+
			"in the commit -- a consumer going away is good news that should still be recorded.\n\n"+
			"These are exact multiplicities, not floors: a count that is too HIGH is as much a "+
			"failure as one that is too low, because a second copy of a consumer line is a "+
			"second consumer.", strings.Join(stale, "\n"))
	}
}

// TestWebRemoteDataCensusIsNonVacuous is the census's own positive control.
//
// Every assertion in the guard above is of the form "nothing unexpected was
// found". §10.20: an unproven zero is indistinguishable from a clean result, and
// a census that silently scans the wrong directory reports a perfectly clean
// tree forever. This test proves the census can actually SEE things, by
// requiring it to find the two known capability consumers by name.
//
// It duplicates part of the allowlist on purpose. If both were driven off the
// same data, a bug that emptied the allowlist would make both tests pass.
func TestWebRemoteDataCensusIsNonVacuous(t *testing.T) {
	root := webRoot(t)
	found := censusRemoteDataMentions(t, root)

	mustSee := map[string]string{
		"src/capabilities.ts":      "const rd = collection.remoteData;",
		"src/components/ft-app.ts": "const rd = coll.remoteData;",
	}
	seen := map[string]bool{}
	for _, m := range found {
		if want, ok := mustSee[m.file]; ok && m.text == want {
			seen[m.file] = true
		}
	}
	for file, text := range mustSee {
		if !seen[file] {
			t.Errorf("the census did NOT find the known capability consumer in %s (%q).\n"+
				"This is a live consumer of attacker-authored data. If the census cannot see "+
				"it, the guard is reporting a clean tree because it is looking at the wrong "+
				"place, not because the tree is clean. Fix the census; do not delete this "+
				"expectation.", file, text)
		}
	}
}
