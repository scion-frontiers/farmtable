package server

import (
	"net/url"
	"strings"

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
