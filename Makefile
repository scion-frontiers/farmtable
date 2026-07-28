.PHONY: generate build test web-test lint web web-dev dashboard decomposer

generate:
	buf generate

build: generate
	go build ./...

test:
	go test ./...
	$(MAKE) web-test

# Web unit tests. Deliberately does NOT run `npm ci`: it reuses the node_modules
# already in the tree so that `make test` stays runnable without network access.
# `make web` does the clean install for release builds.
web-test:
	cd web && npm test

lint:
	buf lint proto
	go vet ./...

# Release build of the web assets. Tests run before `npm run build` so a failing
# web test blocks production of the artifact that gets embedded via //go:embed.
web:
	cd web && npm ci && npm test && npm run build

web-dev:
	cd web && npm run dev

dashboard: web
	go build -o bin/ft ./cmd/ft
	./bin/ft dashboard

decomposer:
	go build -o bin/decomposer ./cmd/decomposer
