.PHONY: generate build test test-go test-web lint web web-deps web-dev dashboard decomposer

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
# `build` DOES depend on `web`: assets.go embeds `all:web/dist`, and web/dist is
# gitignored, so on a fresh clone that directory does not exist and the embed
# fails to compile. Producing the assets first is what makes a fresh clone
# buildable.
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

test-web: web-deps
	cd web && npm test

lint:
	buf lint proto
	go vet ./...

dashboard: web
	go build -o bin/ft ./cmd/ft
	./bin/ft dashboard

decomposer:
	go build -o bin/decomposer ./cmd/decomposer
