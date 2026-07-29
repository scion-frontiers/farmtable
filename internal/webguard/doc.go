// Package webguard holds Go tests that assert properties of the web/ tree.
//
// It contains no production code and is imported by nothing. It exists because
// of an executor problem rather than a design preference: the web tree's own
// guards are run by `npm test`, and this repository has demonstrated that a
// guard whose executor is not `go test` can sit red or unrun without anyone
// noticing. Putting a web-tree assertion here buys it the one runner that is
// invoked by every build, every CI job and every developer reflex in this
// project.
//
// The trade is stated rather than hidden: a Go test cannot parse TypeScript, so
// anything in here must be a property that survives being checked without a
// type-aware parse. See remotedata_consumers_test.go for how that constraint
// shapes the one guard currently living here.
package webguard
