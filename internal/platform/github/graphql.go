package github

import (
	"context"

	githubv4 "github.com/shurcooL/githubv4"
	"golang.org/x/oauth2"
)

// graphqlClient wraps the GitHub GraphQL (v4) API client.
type graphqlClient struct {
	v4     *githubv4.Client
	owner  string
	repo   string
	config *GitHubConfig
}

// newGraphQLClient creates a graphqlClient with oauth2 authentication
// and rate-limit-aware transport.
func newGraphQLClient(token, owner, repo string, cfg *GitHubConfig) *graphqlClient {
	ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
	httpClient := oauth2.NewClient(context.Background(), ts)
	httpClient.Transport = newRateLimitTransport(httpClient.Transport)

	return &graphqlClient{
		v4:     githubv4.NewClient(httpClient),
		owner:  owner,
		repo:   repo,
		config: cfg,
	}
}
