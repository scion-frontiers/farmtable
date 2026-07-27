package github

import "strings"

// The GitHub GraphQL API returns issue state as an uppercase enum ("OPEN" /
// "CLOSED"), but it is untrusted remote data: GitHub Enterprise, a caching,
// replay or mocking proxy in front of the API, or a future schema change can
// all deliver a different casing. Availability, lifecycle and tree-walk
// decisions all key off this one field, so they must all read it the same way.
// These two helpers are that single reading — do not compare issue state
// strings directly anywhere else in the package.
//
// Both helpers are deliberately positive tests, and issueStateClosed is
// deliberately not defined as !issueStateOpen. An empty or unrecognised state
// must not be treated as closed: that would stamp ClosedAt on live work and
// report open issues as terminal, which is a denial-of-work failure that is
// harder to notice than the reverse. Failing open on an unrecognised state is
// what IssueToPhaseStage does, and agreement between the two is the property
// that matters.

// issueStateClosed reports whether a raw GitHub issue state means CLOSED.
func issueStateClosed(state string) bool {
	return strings.EqualFold(state, "closed")
}

// issueStateOpen reports whether a raw GitHub issue state means OPEN.
func issueStateOpen(state string) bool {
	return strings.EqualFold(state, "open")
}
