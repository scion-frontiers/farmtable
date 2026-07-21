package github

import githubv4 "github.com/shurcooL/githubv4"

// SetTestGraphQLClient replaces the internal GraphQL client of a
// GitHubPassThroughStore. This is intended for use in tests that need
// to inject a mock GraphQL endpoint.
func SetTestGraphQLClient(s *GitHubPassThroughStore, client *githubv4.Client) {
	s.gql.v4 = client
}
