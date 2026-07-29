.PHONY: generate build test test-go test-web lint web web-dev dashboard decomposer

generate:
	buf generate

build: generate
	go build ./...

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
test: test-go test-web

test-go:
	go test ./...

test-web:
	cd web && npm test

lint:
	buf lint proto
	go vet ./...

web:
	cd web && npm ci && npm run build

web-dev:
	cd web && npm run dev

dashboard: web
	go build -o bin/ft ./cmd/ft
	./bin/ft dashboard

decomposer:
	go build -o bin/decomposer ./cmd/decomposer
