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

# The `touch` is load-bearing and it is a PARTIAL MITIGATION, not a fix.
#
# web/dist/.gitkeep is tracked, and assets.go embeds `all:web/dist`; with no
# tracked file under web/dist the Go module does not compile from a clean clone
# at all. But `build.outDir` in web/vite.config.ts sits inside the vite root, so
# `emptyOutDir` defaults to true and EVERY `npm run build` DELETES that marker.
# `.gitignore` hides the ~4108 files a build ADDS. It cannot hide the one file a
# build REMOVES, so a developer who builds and then stages broadly commits the
# marker's deletion. Measured: canary/c1-gitkeep-untracked (f410023) is exactly
# that commit, `go list ./...` on a clean clone of it returns 0 packages, and it
# passed every arm of CI before the "Assert the COMMITTED tree compiles" step
# existed (run 30463794909, green).
#
# Restoring it here keeps `make web` and `make build` from leaving a
# commit-ready deletion behind. IT IS PARTIAL: IT DOES NOT COVER A DEVELOPER
# RUNNING `npm run build` DIRECTLY INSIDE web/. The real fix is to stop vite
# deleting the marker (either `emptyOutDir: false`, which then never purges
# stale output, or a small `closeBundle` plugin that rewrites the marker, which
# does purge and is strictly better). That change is frontend build config and
# is under a scope freeze; when the freeze lifts, do it there and this line
# becomes redundant rather than necessary.
#
# WARNING FOR WHOEVER ADDS A POST-BUILD CLEANLINESS ASSERTION. A
# `git status --porcelain` check after the build is the obvious next hardening
# step on this track. Before this line existed, every CI run ended with the
# marker deleted, so that check WOULD HAVE RED ON EVERY RUN with
# ` D web/dist/.gitkeep` and looked like a new defect. It is this deletion.
# This line is what makes such a check viable: CI builds via `make build`, which
# depends on `web`, so the marker is restored before anything inspects the tree.
# The assertion therefore depends on THIS TOUCH rather than on vite behaving.
# Do not remove it without removing the assertion in the same change.
web: web-deps
	cd web && npm run build
	@touch web/dist/.gitkeep

web-dev: web-deps
	cd web && npm run dev

# `test` must fail if EITHER suite fails.
#
# These are prerequisites rather than chained shell commands on purpose: make
# stops at the first failing prerequisite, so a Go failure can never be masked
# by a later command's exit status. Do not collapse this into a single recipe.
test: test-go test-web

test-go:
	echo "Running go test suite..."

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
