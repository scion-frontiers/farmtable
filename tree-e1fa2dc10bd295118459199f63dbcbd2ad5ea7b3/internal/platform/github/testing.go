package github

import (
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
// The unused test-handle parameter is the next best thing: it makes the
// test-only contract explicit in the signature. It is a SPEED BUMP, NOT A
// BARRIER, and the docblock used to overstate it -- review measured that a
// production caller can write `var tb testing.TB = &testing.T{}` and call
// Helper() on it without panicking, so the parameter stops nobody who means it.
// Doing this properly means relocating both callers into package github, which
// is a larger change than the one it belongs to.
//
// The parameter is typed as a local interface rather than testing.TB so that
// this non-test file does not drag package `testing` into the shipped binary
// (`go list -deps ./cmd/ft` used to list it). *testing.T and *testing.B satisfy
// it; essentially nothing a production caller already holds does.
//
// HOW MUCH THIS MATTERS FOR THE URL PROPERTY. An earlier version of this
// paragraph claimed it no longer mattered at all, "since convert.go::taskToProto
// validates remote_url on the way out, a repointed endpoint cannot get a
// non-http(s) URL to the client". That was false when written: taskToProto
// dropped the typed field and then serialised the whole RemoteData map, bad
// remote_url and never-validated html_url included. It is true as of the
// sanitizeRemoteData change in internal/server/urlvalidate.go, which covers both
// carriers -- but it is a claim about a different package's behaviour, so treat
// it as defence in depth rather than as the reason this function is acceptable.
type testHandle interface{ Helper() }

func SetTestGraphQLClient(tb testHandle, s *GitHubPassThroughStore, client *githubv4.Client) {
	tb.Helper()
	s.gql.v4 = client
}
