// Package webguard holds Go tests that assert properties of the web/ tree.
//
// It contains no production code and is imported by nothing. It exists because
// of an executor problem rather than a design preference.
//
// THE EXECUTOR TRADE, MEASURED RATHER THAN ASSUMED, AND RE-MEASURED AFTER IT
// CHANGED UNDER THIS BRANCH. Tests in this package are run by `go test ./...`,
// which is `make test-go`, which is half of `make test`. They are NOT run by
// the container builds: Dockerfile:9 and Dockerfile.server:9 each run
// `npm test` and neither runs `go test`. That half is unchanged and still true.
//
// WHAT CHANGED, AND WHY THE PREVIOUS TEXT HERE IS NOW FALSE. An earlier version
// of this comment said there was "no CI configuration in this repository at
// all" and therefore "nothing here is enforced by a pipeline, because there is
// no pipeline." That was TRUE when written, at c108acb, and it is FALSE at
// cc92735, the commit this branch merges into, which adds
// .github/workflows/ci.yml. The correction is recorded rather than the
// paragraph deleted, because the paragraph's JOB -- name who actually executes
// this, do not assume -- is the only reason the error was findable.
//
// The general form is worth more than the instance: A CLAIM ABOUT WHAT RUNS
// YOUR TEST IS A CLAIM ABOUT A DIFFERENT FILE, AND IT GOES STALE WITHOUT
// TOUCHING YOURS. Nothing in this package can fail when this paragraph becomes
// wrong.
//
// At cc92735 the workflow triggers on `pull_request` and on `push` to
// `branches: ['**']` -- every branch, not just the default one -- and it
// invokes `go test ./... -v` DIRECTLY as its own step rather than through
// `make test`, which it runs afterwards as a separate Makefile self-check. So
// this package IS now gated, on every push, by the most direct route
// available. These tests moved from "enforced by developer reflex" to
// "enforced by a gate", which is a materially different claim from the one
// this file used to make.
//
// THE PLACEMENT ARGUMENT SURVIVES, and it is worth saying why it is not simply
// obsolete now that CI runs both suites. The gate no longer misses either
// placement, so the executor trade does not decide this any more. What still
// decides it is WHO TRIPS THE WIRE FIRST, LOCALLY, BEFORE THE GATE. A guard in
// web/ is missed entirely by a Go-only local workflow, and CLAUDE.md warns
// about exactly that, telling agents not to substitute a bare `go test ./...`
// because the URL-scheme guards in web/src/util are executed only by
// `npm test`. A guard here is the mirror image. This one is here because the
// reader it most needs to stop is a Go developer changing the server-side shape
// of remote_data, and that developer's reflex is `go test ./...`. A judgement
// about who trips the wire, not a claim that this location is strictly safer.
//
// The trade is stated rather than hidden: a Go test cannot parse TypeScript, so
// anything in here must be a property that survives being checked without a
// type-aware parse. See remotedata_consumers_test.go for how that constraint
// shapes the one guard currently living here.
//
// TWO LIMITS ON THE CENSUS, stated here because the guard's whole correctness
// argument is that it over-approximates and that its errors therefore run in
// the noisy direction. Both of these run the other way.
//
// IT IS A LINE CENSUS, NOT AN OCCURRENCE CENSUS. censusRemoteDataMentions
// breaks after the first identifier match on a line, so a line naming the field
// three times -- the generated grpc-client line does -- counts as one. The
// allowlist stays correct because its declared counts are counts of the same
// unit, and the practical impact is nil. Named exactly anyway: a guard that
// argues from over-approximation should not be vague about its unit.
//
// IT CANNOT SEE THE BYTES THE SERVER ACTUALLY SHIPS. skipDirs excludes web/dist
// while assets.go:5 is `//go:embed all:web/dist`, so the compiled bundle served
// to every browser sits outside the population this guard reads. The exclusion
// is still right -- dist is generated from src by vite, so a consumer there
// either has a source antecedent the census does see, or was hand-edited into
// build output -- but right is not complete, and a hand-edit to dist is
// invisible here. At cc92735 the CI workflow asserts web/dist is ABSENT on
// checkout and produced by the run, which constrains that gap from a different
// direction without closing it.
package webguard
