.PHONY: generate build test lint web web-dev dashboard

generate:
	buf generate

build: generate
	go build ./...

test:
	go test ./...

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
