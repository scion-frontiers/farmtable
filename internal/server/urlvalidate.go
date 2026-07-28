package server

import (
	"fmt"
	"maps"
	"net/url"
	"slices"
	"strings"
	"unicode"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// allowedURLSchemes is the set of URL schemes accepted for caller-supplied URL
// fields that the dashboard renders into an href.
//
// This is deliberately an allow-list rather than a denylist. The set of
// script-bearing schemes (javascript:, data:, vbscript:, blob:, filesystem:,
// ...) is open-ended and browser-specific, so enumerating the dangerous ones is
// unbounded work that fails open on whatever is missed. Enumerating the two we
// actually want fails closed instead.
//
// Note that the proto declares `(buf.validate.field).string.uri = true` on these
// fields, but nothing invokes protovalidate, and `uri = true` would not be
// sufficient regardless: `javascript:alert(1)` is a well-formed URI under
// RFC 3986. The scheme has to be constrained explicitly.
var allowedURLSchemes = map[string]bool{
	"http":  true,
	"https": true,
}

// validateURLField reports whether a caller-supplied URL is safe to persist and
// to render into an href attribute.
//
// An empty value is accepted and means "unset"; it lets callers clear the field,
// and an empty href cannot execute script.
//
// This is called from the service method bodies rather than from a gRPC
// interceptor on purpose. The CLI pass-through server registers the service with
// no interceptors (internal/cli/connect.go), while the standalone server, the
// embedded server and the dashboard server all install auth interceptors. A
// check wired as an interceptor would therefore cover three paths and silently
// miss the fourth. Every path constructs the same FarmTableService, so a check
// inside the method body is reached by all of them.
func validateURLField(field, raw string) error {
	if raw == "" {
		return nil
	}

	// Reject whitespace and control characters before parsing. Browsers strip
	// tabs and newlines out of a URL before acting on it, so "java\tscript:x"
	// navigates as "javascript:x" in a browser even though it is not a valid
	// URI. net/url happens to reject these too, but relying on that would leave
	// the guarantee dependent on a parser implementation detail.
	for _, r := range raw {
		if r <= ' ' || r == 0x7f {
			return status.Errorf(codes.InvalidArgument,
				"invalid %s: URL must not contain whitespace or control characters", field)
		}
	}

	u, err := url.Parse(raw)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid %s: %v", field, err)
	}

	// net/url already lowercases the scheme it returns, so "JaVaScRiPt:x" parses
	// with Scheme=="javascript". Fold again anyway so the comparison does not
	// depend on that behaviour.
	if !allowedURLSchemes[strings.ToLower(u.Scheme)] {
		return status.Errorf(codes.InvalidArgument,
			"invalid %s: URL scheme %q is not allowed; only http and https are accepted", field, u.Scheme)
	}

	// An http(s) URL with no host is either malformed or a scheme-relative
	// oddity such as `http:/\/\evil.com`, which browsers normalise into a
	// navigation to another origin.
	if u.Host == "" {
		return status.Errorf(codes.InvalidArgument,
			"invalid %s: URL must include a host", field)
	}

	return nil
}

// urlBearingRemoteDataKey reports whether a key inside a task's untyped
// RemoteData map names a value that could be rendered into an href.
//
// WHY THIS IS A PREDICATE AND NOT A LIST. It used to be
// `var urlBearingRemoteDataKeys = []string{"remote_url"}`, documented "keep this
// in sync with the RemoteData reads in convert.go". That instruction is not
// satisfiable: convert.go serialises the WHOLE map into pb.Task.remote_data, so
// it "reads" every key there will ever be. A sync comment against an unbounded
// set cannot be kept, and the list was already out of date -- both GitHub
// adapters write the issue URL a second time under "html_url"
// (platform/github/graphql_queries.go:482, platform/github/github.go:261), which
// the list never mentioned and no validator ever looked at.
//
// So the classification is by NAME and it fails closed: anything whose key looks
// like it holds a URL is treated as holding one. RemoteData is a documented
// escape hatch for arbitrary platform payload, so we cannot enumerate its
// contents -- but we can insist that a key which SOUNDS like a URL is validated
// like one, and that any key which carries a URL without saying so in its name
// is added here deliberately.
//
// The partial, enforceable half of the invariant lives in
// TestRemoteDataKeysWrittenByAdaptersAreClassified: it recovers the keys the
// in-tree adapters write as STRING LITERALS in a map literal or an index write,
// and requires every one to be either URL-bearing by this predicate or listed
// there as non-URL with a reason.
//
// What that test produces is a LOWER BOUND, not the set. It cannot see a key
// built at runtime (`"field_"+name`), a key held in a variable or a constant, a
// map copied in wholesale from a decoded payload, or any key written by an
// out-of-tree adapter -- and an out-of-tree adapter is the normal case, since
// remote_data is the documented escape hatch for arbitrary platform payload.
// The bound is useful because it catches the failure that actually happened
// (an adapter adding "html_url" with nobody noticing), not because it closes
// the set. Nothing closes the set; that is why the predicate above fails closed
// and why sanitizeRemoteData recurses over values it has never seen.
// urlBearingKeyWords are the word-segments that mark a key as holding a URL.
// Matching is on whole segments, not substrings: "curl" must not be classified
// as URL-bearing just because it ends in "url".
var urlBearingKeyWords = map[string]bool{
	"url": true, "urls": true,
	"uri": true, "uris": true,
	"href": true, "hrefs": true,
	"link": true, "links": true,
	"permalink": true, "permalinks": true,
}

func urlBearingRemoteDataKey(key string) bool {
	for _, seg := range keySegments(key) {
		if urlBearingKeyWords[strings.ToLower(seg)] {
			return true
		}
		// An all-caps segment carries no internal word boundary to split on, so
		// fall back to a suffix test for it. "HTMLURL" classifies as URL-bearing;
		// so does "CURL", which is a false positive in the fail-closed direction
		// and costs one wasted validation.
		if seg == strings.ToUpper(seg) && seg != strings.ToLower(seg) {
			low := strings.ToLower(seg)
			for word := range urlBearingKeyWords {
				if strings.HasSuffix(low, word) {
					return true
				}
			}
		}
	}
	return false
}

// keySegments splits a RemoteData key into word segments, handling both the
// snake_case the current adapters emit and the camelCase a future one might, so
// that "html_url", "html-url" and "htmlUrl" all decompose to ["html", "url"].
//
// The camel rules are the usual two: split before an uppercase letter that
// follows a lowercase letter or a digit, and split before the last uppercase of
// an uppercase run that is followed by a lowercase letter ("HTMLUrl" ->
// ["HTML", "Url"]). Segments keep their original case so the caller can tell an
// all-caps run apart from an ordinary word.
func keySegments(key string) []string {
	var segs []string
	var cur strings.Builder
	flush := func() {
		if cur.Len() > 0 {
			segs = append(segs, cur.String())
			cur.Reset()
		}
	}
	runes := []rune(key)
	for i, r := range runes {
		switch {
		case r == '_' || r == '-' || r == '.' || r == '/' || r == ' ':
			flush()
		case unicode.IsUpper(r):
			prevIsLowerOrDigit := i > 0 && (unicode.IsLower(runes[i-1]) || unicode.IsDigit(runes[i-1]))
			nextIsLower := i+1 < len(runes) && unicode.IsLower(runes[i+1])
			prevIsUpper := i > 0 && unicode.IsUpper(runes[i-1])
			if prevIsLowerOrDigit || (prevIsUpper && nextIsLower) {
				flush()
			}
			cur.WriteRune(r)
		default:
			cur.WriteRune(r)
		}
	}
	flush()
	return segs
}

// maxRemoteDataDepth bounds the recursion below. remote_data is decoded from
// JSON or built by an adapter, so it cannot contain a cycle; this is a bound on
// pathological input rather than a correctness requirement, and a value nested
// deeper than this is dropped rather than shipped unexamined.
const maxRemoteDataDepth = 32

// sanitizeRemoteData returns a copy of a task's RemoteData with every
// URL-bearing entry that fails validateURLField removed, AT EVERY DEPTH.
//
// This exists because dropping the bad value from the typed pb.Task.remote_url
// field is not enough on its own: the same map is serialised wholesale into
// pb.Task.remote_data one step later, so the rejected string used to ride out to
// the client anyway, one field away from the field that had just been cleaned.
//
// WHY IT RECURSES NOW. The first version walked the top level only, and the
// comment beside it said nested carriers were out of scope. Measured at the
// wire, not inferred:
//
//	structpb.NewStruct(map[string]any{
//	    "remote_url": "https://a",
//	    "parent":     map[string]any{"html_url": "javascript:alert(1)"},
//	})
//
// returns a *structpb.Struct and a nil error, with the javascript: URL intact.
// Nested maps are exactly what structpb DOES support, so "it will not
// serialise" -- true of json.RawMessage and of []string -- is not true here.
// The GitHub adapter writes "parent" and "sub_issues_summary" as nested maps
// today, and TestRemoteDataKeysWrittenByAdaptersAreClassified holds nested keys
// to a stricter rule precisely because this function could not see them. It can
// now, so the two agree.
//
// Drop rather than error, matching the typed field: a bad URL from upstream must
// not fail the whole read. A URL-bearing key whose value is not a string (or a
// list of strings) is also dropped -- it cannot be validated, so it is not
// shipped.
//
// The input map is never mutated; it belongs to the ent entity.
func sanitizeRemoteData(rd map[string]any) map[string]any {
	if rd == nil {
		return nil
	}
	clean := make(map[string]any, len(rd))
	for k, v := range rd {
		if nv, keep := sanitizeRemoteValue(k, v, 0); keep {
			clean[k] = nv
		}
	}
	return clean
}

// sanitizeRemoteValue sanitizes one value found under `key`, returning the
// replacement and whether to keep it at all.
//
// The key governs: under a URL-bearing key nothing survives that cannot be
// validated as a URL, and under any other key containers are walked so that a
// URL-bearing key deeper down is still reached.
func sanitizeRemoteValue(key string, v any, depth int) (any, bool) {
	if depth > maxRemoteDataDepth {
		return nil, false
	}

	if urlBearingRemoteDataKey(key) {
		switch tv := v.(type) {
		case string:
			if err := validateURLField(key, tv); err != nil {
				return nil, false
			}
			return tv, true
		case []any:
			out := make([]any, 0, len(tv))
			for _, e := range tv {
				s, ok := e.(string)
				if !ok || validateURLField(key, s) != nil {
					continue
				}
				out = append(out, s)
			}
			return out, true
		case []string:
			out := make([]string, 0, len(tv))
			for _, s := range tv {
				if validateURLField(key, s) == nil {
					out = append(out, s)
				}
			}
			return out, true
		case map[string]any, []map[string]any:
			// A URL-bearing key holding a CONTAINER ("links": {...}) is not a URL
			// and cannot be validated as one, but the container may hold URLs
			// further down. Fall through to the generic walk below so its own keys
			// are classified, rather than dropping a subtree on the strength of
			// its parent's name.
		default:
			// Any other type under a URL-bearing key cannot be validated, so it is
			// not shipped. NOTE: this is the one place the sanitizer drops
			// something the import check does not reject -- see the asymmetry row
			// in TestSanitizeAndImportAgreeAtEveryDepth, which pins it rather than
			// letting it drift.
			return nil, false
		}
	}

	switch tv := v.(type) {
	case map[string]any:
		clean := make(map[string]any, len(tv))
		for k, e := range tv {
			if ne, keep := sanitizeRemoteValue(k, e, depth+1); keep {
				clean[k] = ne
			}
		}
		return clean, true
	case []any:
		if tv == nil {
			return v, true
		}
		out := make([]any, 0, len(tv))
		for _, e := range tv {
			// The elements of a list have no key of their own; a map among them
			// is walked so ITS keys are classified.
			if ne, keep := sanitizeRemoteValue("", e, depth+1); keep {
				out = append(out, ne)
			}
		}
		return out, true
	case []map[string]any:
		if tv == nil {
			return v, true
		}
		out := make([]map[string]any, 0, len(tv))
		for _, e := range tv {
			ne, keep := sanitizeRemoteValue("", e, depth+1)
			if !keep {
				continue
			}
			m, ok := ne.(map[string]any)
			if !ok {
				continue
			}
			out = append(out, m)
		}
		return out, true
	default:
		return v, true
	}
}

// validateImportedTaskURLs applies the same scheme allow-list to a task arriving
// through collection import.
//
// UpdateTask is not the only writer of these fields: ImportCollection copies
// PullRequests and RemoteData verbatim out of a caller-uploaded JSON document,
// so a check placed only in UpdateTask is bypassable by importing a collection.
//
// The RemoteData half uses the same urlBearingRemoteDataKey predicate as the
// read path. The write and read boundaries classifying keys differently is how
// "html_url" came to be validated by neither. Keys are visited in sorted order
// so the reported failure is deterministic rather than map-iteration order.
func validateImportedTaskURLs(t exportTask) error {
	for i, pr := range t.PullRequests {
		if err := validateURLField(
			fmt.Sprintf("tasks[%s].pull_requests[%d].url", t.ID, i), pr["url"]); err != nil {
			return err
		}
	}
	return validateRemoteDataURLs(fmt.Sprintf("tasks[%s].remote_data", t.ID), t.RemoteData, 0)
}

// validateRemoteDataURLs is the erroring counterpart of sanitizeRemoteData: the
// same traversal, at the same depths, over the same URL-bearing-key predicate,
// but rejecting the import rather than dropping the value.
//
// The two staying in step is not left to inspection --
// TestSanitizeAndImportAgreeAtEveryDepth drives both over the same generated
// maps and requires that one errors exactly when the other drops something.
// They diverged before: the import check walked the top level only, so a
// collection carrying a javascript: URL under remote_data.parent.html_url
// imported cleanly.
//
// Keys are visited in sorted order so the reported failure is deterministic
// rather than map-iteration order.
func validateRemoteDataURLs(path string, rd map[string]any, depth int) error {
	if depth > maxRemoteDataDepth {
		return fmt.Errorf("%s: nested more than %d levels deep", path, maxRemoteDataDepth)
	}
	for _, key := range slices.Sorted(maps.Keys(rd)) {
		if err := validateRemoteDataValue(path+"."+key, key, rd[key], depth); err != nil {
			return err
		}
	}
	return nil
}

func validateRemoteDataValue(path, key string, v any, depth int) error {
	if depth > maxRemoteDataDepth {
		return fmt.Errorf("%s: nested more than %d levels deep", path, maxRemoteDataDepth)
	}

	if urlBearingRemoteDataKey(key) {
		switch tv := v.(type) {
		case string:
			return validateURLField(path, tv)
		case []any:
			for i, e := range tv {
				s, ok := e.(string)
				if !ok {
					continue
				}
				if err := validateURLField(fmt.Sprintf("%s[%d]", path, i), s); err != nil {
					return err
				}
			}
		case []string:
			for i, s := range tv {
				if err := validateURLField(fmt.Sprintf("%s[%d]", path, i), s); err != nil {
					return err
				}
			}
		case map[string]any:
			return validateRemoteDataURLs(path, tv, depth+1)
		case []map[string]any:
			for i, e := range tv {
				if err := validateRemoteDataURLs(fmt.Sprintf("%s[%d]", path, i), e, depth+1); err != nil {
					return err
				}
			}
		}
		// A URL-bearing key holding a scalar of any other type is not an import
		// error. It cannot be validated, and sanitizeRemoteData drops it on the
		// way out rather than shipping it, so nothing unvalidated reaches a
		// client either way. Rejecting a whole import over `"url": null` -- which
		// is what a JSON null decodes to -- would be a denial of service on a
		// shape that is merely useless, not dangerous.
		return nil
	}

	switch tv := v.(type) {
	case map[string]any:
		return validateRemoteDataURLs(path, tv, 0)
	case []any:
		for i, e := range tv {
			if err := validateRemoteDataValue(fmt.Sprintf("%s[%d]", path, i), "", e, depth+1); err != nil {
				return err
			}
		}
	case []map[string]any:
		for i, e := range tv {
			if err := validateRemoteDataURLs(fmt.Sprintf("%s[%d]", path, i), e, depth+1); err != nil {
				return err
			}
		}
	}
	return nil
}
