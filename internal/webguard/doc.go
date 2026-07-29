// Package webguard holds Go tests that assert properties of the web/ tree.
//
// It contains no production code and is imported by nothing. It exists because
// of an executor problem rather than a design preference.
//
// THE EXECUTOR TRADE, MEASURED RATHER THAN ASSUMED. Tests in this package are
// run by `go test ./...`, which is `make test-go`, which is half of `make
// test`. They are NOT run by the container builds: Dockerfile and
// Dockerfile.server each run `npm test` and neither runs `go test`. There is no
// CI configuration in this repository at all -- .github contains only issue and
// PR templates, and there is no workflows directory. So nothing here is
// enforced by a pipeline, because there is no pipeline.
//
// That cuts both ways and the honest summary is that NEITHER PLACEMENT
// DOMINATES. A guard in web/ is enforced by both image builds and missed
// entirely by a Go-only workflow; CLAUDE.md warns about precisely that failure,
// telling agents not to substitute a bare `go test ./...` because the
// URL-scheme guards in web/src/util are executed only by `npm test`. A guard
// here is the mirror image: caught by the Go-only workflow that CLAUDE.md says
// agents actually use, missed by the image builds.
//
// This one is here because the reader it most needs to stop is a Go developer
// changing the server-side shape of remote_data, and that developer's reflex is
// `go test ./...`. That is a judgement about who trips the wire, not a claim
// that this location is strictly safer.
//
// The trade is stated rather than hidden: a Go test cannot parse TypeScript, so
// anything in here must be a property that survives being checked without a
// type-aware parse. See remotedata_consumers_test.go for how that constraint
// shapes the one guard currently living here.
package webguard
