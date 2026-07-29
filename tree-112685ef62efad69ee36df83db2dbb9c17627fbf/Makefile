<<<<<<< HEAD
.PHONY: generate build test test-go test-web test-changed suite-manifest lint web web-deps web-dev dashboard decomposer

# Marker file that `npm ci` writes. Using it as a real make target keeps
# dependency installation incremental: it re-runs only when the lockfile or the
# manifest actually changes, instead of on every build and every test run.
WEB_DEPS := web/node_modules/.package-lock.json
=======
.PHONY: generate build test test-go test-web lint web web-dev dashboard decomposer
>>>>>>> 2f6500f (Make `make test` run this branch's own URL guard)

generate:
	buf generate

# `build` deliberately does NOT depend on `generate`.
#
# The generated protobuf code (api/farmtable/v1/*.pb.go) is committed, so
# compiling does not need the generator. Requiring it would make every build
# depend on the buf CLI plus protoc-gen-go and protoc-gen-go-grpc, whose
# versions are pinned nowhere in this repo (there is no tools.go and no go.mod
# tool directive). Run `make generate` explicitly when the .proto files change.
#
# `build` DOES depend on `web`: assets.go embeds `all:web/dist`, and web/dist is
# gitignored, so on a fresh clone that directory does not exist and the embed
# fails to compile. Producing the assets first is what makes a fresh clone
# buildable.
build: web
	go build ./...

<<<<<<< HEAD
$(WEB_DEPS): web/package-lock.json web/package.json
	cd web && npm ci
	@touch $(WEB_DEPS)

web-deps: $(WEB_DEPS)

web: web-deps
	cd web && npm run build

web-dev: web-deps
	cd web && npm run dev

# `test` must fail if EITHER suite fails.
#
# These are prerequisites rather than chained shell commands on purpose: make
# stops at the first failing prerequisite, so a Go failure can never be masked
# by a later command's exit status. Do not collapse this into a single recipe.
=======
# `test` runs BOTH suites. It used to be `go test ./...` alone, which meant the
# web guard -- web/src/util/url-binding-scan.test.ts and safe-url.test.ts, the
# entire client-side half of the URL-scheme property -- was executed by nothing
# in this repository. An audit measured the break here rather than at the
# absent CI: `git grep "npm test"` returned only prose in project-log markdown,
# so adding CI that ran the obvious `make lint && make test && make build`
# would still not have run the guard. Splitting the target is what closes that,
# independently of the CI item (#22).
#
# Keep `test-go` and `test-web` separately invocable: the Go suite is fast and
# the web suite needs node_modules, so a contributor without them can still run
# half. But plain `make test` must run both, because that is the name the
# project's own CLAUDE.md tells agents to use.
>>>>>>> 2f6500f (Make `make test` run this branch's own URL guard)
test: test-go test-web

test-go:
	go test ./...

<<<<<<< HEAD
test-web: web-deps
	cd web && npm test

# Run only the tests affected by the current change. Works from a dirty tree.
# scripts/test-changed.sh documents exactly what this does and does not cover;
# it is a development convenience, not a substitute for `make test`.
#   make test-changed                 compare against origin/main
#   BASE=HEAD~3 make test-changed     compare against something else
#   LIST_ONLY=1 make test-changed     print the plan, run nothing
test-changed:
	./scripts/test-changed.sh

# Report, by name, which JS/TS test files `npm test` actually executes, and fail
# if a test file exists that nothing runs.
suite-manifest:
	node scripts/ci-suite-manifest.mjs

=======
test-web:
	cd web && npm test

>>>>>>> 2f6500f (Make `make test` run this branch's own URL guard)
lint:
	buf lint proto
	go vet ./...

dashboard: web
	go build -o bin/ft ./cmd/ft
	./bin/ft dashboard

decomposer:
	go build -o bin/decomposer ./cmd/decomposer
