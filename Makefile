.PHONY: generate build test test-go test-web test-changed suite-manifest lint lint-go lint-proto web web-deps web-dev dashboard decomposer

# Marker file that `npm ci` writes. Using it as a real make target keeps
# dependency installation incremental: it re-runs only when the lockfile or the
# manifest actually changes, instead of on every build and every test run.
WEB_DEPS := web/node_modules/.package-lock.json

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
# `build` DOES depend on `web`. A fresh clone now compiles without it, because
# web/dist/.gitkeep is tracked and satisfies the `all:web/dist` embed, but that
# placeholder is only a stub: a binary built from it would fail at run time with
# ErrWebAssetsNotBuilt (see assets.go). Building the frontend first is what puts
# real assets in the binary.
build: web
	go build ./...

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
test: test-go test-web

test-go:
	go test ./...

# CANARY ONLY - NEVER MERGE. Points test-web at a script that does not exist,
# so `make test` fails at the second suite. Every earlier CI step invokes the
# suites directly rather than through make, so this is invisible to all of them.
test-web: web-deps
	cd web && npm run test:canary-does-not-exist

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

# `lint` must be runnable in a clean clone with nothing but the Go toolchain.
# It previously ran `buf lint proto` first, so it could not pass without the
# buf CLI installed, and it ran `go vet ./...`, which aborted at zero packages
# before web/dist was tracked. Nothing in CI invoked it, so neither was noticed.
#
# Proto linting needs an external tool and therefore lives in its own target
# rather than blocking the default lint.
lint: lint-go

lint-go:
	go vet ./...

# Requires the buf CLI: https://buf.build/docs/installation
# Fails loudly when buf is absent rather than skipping, so a missing linter can
# never be mistaken for a passing lint.
lint-proto:
	@command -v buf >/dev/null 2>&1 || { \
		echo "make lint-proto: the buf CLI is required but was not found in PATH."; \
		echo "Install it: https://buf.build/docs/installation"; \
		exit 1; \
	}
	buf lint proto

dashboard: web
	go build -o bin/ft ./cmd/ft
	./bin/ft dashboard

decomposer:
	go build -o bin/decomposer ./cmd/decomposer
