package serverapp

import (
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"regexp"
	"strings"
	"testing"
	"testing/fstest"

	farmtable "github.com/farmtable-io/farmtable"
	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"google.golang.org/grpc"
)

func newTestUnifiedHandler(t *testing.T) http.Handler {
	t.Helper()
	grpcServer := grpc.NewServer()
	pb.RegisterFarmTableServiceServer(grpcServer, testFarmTableService{})
	return UnifiedHandler(grpcServer, http.FS(fstest.MapFS{
		"index.html": {Data: []byte("<!doctype html><title>Farm Table</title>")},
	}))
}

// The dashboard SPA is served from the same origin as the gRPC-web API and that
// origin holds a long-lived API token in localStorage, so script execution in
// this document is credential theft rather than defacement.
func TestSecurityHeadersOnDashboardSPA(t *testing.T) {
	resp := mustDo(t, newTestUnifiedHandler(t), mustRequest(t, http.MethodGet, "/", nil))
	defer resp.Body.Close()

	if got := resp.Header.Get("Content-Security-Policy"); got != cspPolicy {
		t.Errorf("Content-Security-Policy =\n  %q\nwant\n  %q", got, cspPolicy)
	}
	if got := resp.Header.Get("X-Content-Type-Options"); got != "nosniff" {
		t.Errorf("X-Content-Type-Options = %q, want %q", got, "nosniff")
	}
	if got := resp.Header.Get("Referrer-Policy"); got != "no-referrer" {
		t.Errorf("Referrer-Policy = %q, want %q", got, "no-referrer")
	}
}

// The directives that make this policy worth having. Asserted individually so a
// future edit that quietly drops one fails with a specific name.
func TestCSPPinsCredentialTheftDirectives(t *testing.T) {
	for _, directive := range []string{
		"default-src 'self'",
		"object-src 'none'",
		"base-uri 'none'",
		"frame-ancestors 'none'",
		"form-action 'none'",
		"connect-src 'self'",
	} {
		if !strings.Contains(cspPolicy, directive) {
			t.Errorf("cspPolicy is missing %q", directive)
		}
	}
	// 'unsafe-inline' in script-src would silently discard the entire benefit.
	scriptSrc := cspDirective(t, "script-src")
	if strings.Contains(scriptSrc, "'unsafe-inline'") {
		t.Errorf("script-src must not contain 'unsafe-inline', got %q", scriptSrc)
	}
	if !strings.Contains(scriptSrc, "'self'") {
		t.Errorf("script-src must contain 'self', got %q", scriptSrc)
	}
}

// nosniff is worth having on API responses even though a CSP there is not.
// Driven through a real listener rather than the package's responseRecorder:
// the grpc-web transport requires an http.Flusher and panics without one.
func TestSecurityHeadersOnGRPCWebAPI(t *testing.T) {
	server, addr := startHTTPServer(t, newTestUnifiedHandler(t))
	defer server.Close()

	req := mustRequest(t, http.MethodPost,
		"http://"+addr+"/farmtable.v1.FarmTableService/GetVersion", strings.NewReader(""))
	req.Header.Set("Content-Type", "application/grpc-web+proto")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST gRPC-web route: %v", err)
	}
	defer resp.Body.Close()

	if got := resp.Header.Get("X-Content-Type-Options"); got != "nosniff" {
		t.Errorf("X-Content-Type-Options on API = %q, want %q", got, "nosniff")
	}
	// A CSP on an API response is harmless but pointless; assert the scoping
	// decision explicitly so it is not changed by accident.
	if got := resp.Header.Get("Content-Security-Policy"); got != "" {
		t.Errorf("Content-Security-Policy on API = %q, want it scoped to the SPA only", got)
	}
}

var inlineScriptRE = regexp.MustCompile(`(?s)<script([^>]*)>(.*?)</script>`)

// The anti-rot guard. web/index.html carries one hand-written inline bootstrap
// script (it applies the stored theme before first paint) which script-src
// covers by sha256 hash rather than 'unsafe-inline'. A hash is invisible
// coupling: editing that script by one byte would leave the CSP syntactically
// valid but silently block the script in the browser. This recomputes every
// inline hash from the actually-embedded index.html so that edit fails here.
func TestCSPCoversInlineScriptsInEmbeddedIndex(t *testing.T) {
	index, err := farmtable.WebAssets.ReadFile("web/dist/index.html")
	if err != nil {
		t.Fatalf("read embedded web/dist/index.html: %v", err)
	}

	scriptSrc := cspDirective(t, "script-src")
	found := 0
	for _, m := range inlineScriptRE.FindAllStringSubmatch(string(index), -1) {
		attrs, body := m[1], m[2]
		if strings.Contains(attrs, "src=") {
			continue // external script, covered by 'self'
		}
		found++
		sum := sha256.Sum256([]byte(body))
		hash := "'sha256-" + base64.StdEncoding.EncodeToString(sum[:]) + "'"
		if !strings.Contains(scriptSrc, hash) {
			t.Errorf("inline script in web/dist/index.html is not covered by script-src.\n"+
				"  need: %s\n  have: %s\n"+
				"If you edited the inline bootstrap script in web/index.html, update\n"+
				"cspPolicy in unified.go with the hash above.", hash, scriptSrc)
		}
	}
	if found == 0 {
		t.Fatal("no inline scripts found in embedded index.html; this guard would pass vacuously")
	}
}

// Every script the dashboard loads must be same-origin, otherwise script-src
// 'self' plus hashes is not actually a complete allow-list.
func TestEmbeddedIndexLoadsNoCrossOriginScripts(t *testing.T) {
	index, err := farmtable.WebAssets.ReadFile("web/dist/index.html")
	if err != nil {
		t.Fatalf("read embedded web/dist/index.html: %v", err)
	}

	srcRE := regexp.MustCompile(`<script[^>]*\ssrc="([^"]*)"`)
	for _, m := range srcRE.FindAllStringSubmatch(string(index), -1) {
		src := m[1]
		if strings.HasPrefix(src, "//") || strings.Contains(src, "://") {
			t.Errorf("cross-origin script in embedded index.html: %q "+
				"(script-src 'self' would block it)", src)
		}
	}
}

func cspDirective(t *testing.T, name string) string {
	t.Helper()
	for _, d := range strings.Split(cspPolicy, ";") {
		d = strings.TrimSpace(d)
		if strings.HasPrefix(d, name+" ") {
			return d
		}
	}
	t.Fatalf("cspPolicy has no %q directive: %q", name, cspPolicy)
	return ""
}
