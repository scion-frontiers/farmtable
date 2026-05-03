.PHONY: generate build test lint

generate:
	buf generate

build: generate
	go build ./...

test:
	go test ./...

lint:
	buf lint proto
	go vet ./...
