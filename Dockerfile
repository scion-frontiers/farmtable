FROM node:22-bookworm AS frontend
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ .
# WARNING: AS OF THIS COMMIT `RUN npm test` BELOW DOES NOT EXECUTE THE
# URL-BINDING GUARD, so this step CANNOT fail the image on a red guard.
# web/package.json's `test` script names one compiled file
# (.tmp-test/utils/task-ready.test.js), so 1 of the 5 tracked web test files
# runs; safe-url.test.ts and url-binding-scan.test.ts are compiled and skipped.
# The gap is the runner invocation, not the environment -- `npm ci` above does
# install devDependencies, so tsc and jsdom are present at this stage.
# This image builds `ft` and runs `ft dashboard`. Dockerfile.server is the
# image the live service is deployed from; it carries the same gap.
# See Makefile: suite-manifest, which reports enumerated=5 executed=1 missing=4.
RUN npm test
RUN npm run build

FROM golang:1.26-bookworm AS builder
RUN apt-get update && apt-get install -y gcc libc6-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/web/dist ./web/dist
RUN CGO_ENABLED=1 go build -o /ft ./cmd/ft

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /ft /ft
EXPOSE 8080
CMD ["/ft", "dashboard", "--port", "8080"]
