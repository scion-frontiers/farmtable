.PHONY: generate build test race lint web web-dev dashboard decomposer

generate:
	buf generate

build: generate
	go build ./...

test:
	go test ./...

# The pass-through store caches the repo ID and the label index lazily, and one
# instance serves every request for its collection, so concurrent access is the
# normal case (issue #198). The concurrency tests in this package only assert
# anything under the detector: without -race they run clean against the very
# code they exist to reject. Scoped to the package that has them rather than
# ./... because a green ./... -race run over packages with no concurrent tests
# buys nothing and costs minutes.
race:
	go test -race ./internal/platform/github/

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
