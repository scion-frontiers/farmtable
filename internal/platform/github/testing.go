package github

import (
	"testing"

	githubv4 "github.com/shurcooL/githubv4"
)

// SetTestGraphQLClient replaces the internal GraphQL client of a
// GitHubPassThroughStore so tests can inject a mock GraphQL endpoint.
//
// WHY THIS IS NOT IN AN export_test.go. That would be the right home -- this is
// test-only surface that otherwise compiles into the production binary, and
// being able to repoint the GraphQL endpoint weakens the "the value came from
// GitHub's own API over TLS" argument the platform-sync exclusion rests on.
// But s.gql.v4 is unexported and the callers
// (internal/server/passthrough_e2e_test.go and passthrough_url_test.go) are in
// package server_test, not package github. An export_test.go is compiled only
// into this package's own test binary, so the move does not build. Measured:
//
//	vet: internal/server/passthrough_e2e_test.go:111:13:
//	     undefined: ghplatform.SetTestGraphQLClient
//
// The unused testing.TB parameter is the next best thing: it makes the
// test-only contract explicit in the signature, and a production caller would
// have to manufacture a testing.TB to compile. Doing this properly means
// relocating both callers into package github, which is a larger change than
// the one it belongs to.
//
// This is no longer load-bearing for the URL property in any case: since
// convert.go::taskToProto validates remote_url on the way out, a repointed
// endpoint cannot get a non-http(s) URL to the client.
func SetTestGraphQLClient(tb testing.TB, s *GitHubPassThroughStore, client *githubv4.Client) {
	tb.Helper()
	s.gql.v4 = client
}
