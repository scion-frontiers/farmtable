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
// The bounded, enforceable half of the invariant lives in
// TestRemoteDataKeysWrittenByAdaptersAreClassified: the set of keys the in-tree
// platform adapters write IS finite, and every one of them must be either
// URL-bearing by this predicate or listed there as non-URL with a reason.
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

// sanitizeRemoteData returns a copy of a task's RemoteData with every
// URL-bearing entry that fails validateURLField removed.
//
// This exists because dropping the bad value from the typed pb.Task.remote_url
// field is not enough on its own: the same map is serialised wholesale into
// pb.Task.remote_data one step later, so the rejected string used to ride out to
// the client anyway, one field away from the field that had just been cleaned.
//
// Drop rather than error, matching the typed field: a bad URL from upstream must
// not fail the whole read. A URL-bearing key whose value is not a string is also
// dropped -- it cannot be validated, and nothing in this tree writes one.
//
// The input map is never mutated; it belongs to the ent entity.
func sanitizeRemoteData(rd map[string]any) map[string]any {
	if rd == nil {
		return nil
	}
	clean := make(map[string]any, len(rd))
	for k, v := range rd {
		if urlBearingRemoteDataKey(k) {
			s, ok := v.(string)
			if !ok {
				continue
			}
			if err := validateURLField(k, s); err != nil {
				continue
			}
		}
		clean[k] = v
	}
	return clean
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
	for _, key := range slices.Sorted(maps.Keys(t.RemoteData)) {
		if !urlBearingRemoteDataKey(key) {
			continue
		}
		s, ok := t.RemoteData[key].(string)
		if !ok {
			continue
		}
		if err := validateURLField(
			fmt.Sprintf("tasks[%s].remote_data.%s", t.ID, key), s); err != nil {
			return err
		}
	}
	return nil
}
