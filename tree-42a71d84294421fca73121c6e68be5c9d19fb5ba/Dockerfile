FROM node:22-bookworm AS frontend
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ .
# `npm test` runs web/scripts/run-node-tests.mjs, which DISCOVERS every
# src/**/*.{test,spec}.{ts,tsx} rather than running a hardcoded list, so the
# URL-binding guard does execute here and a red guard does fail this image.
# `npm ci` above installs devDependencies, so tsc and jsdom are present.
#
# THIS LINE HAS BEEN A NO-OP GUARD BEFORE. When the test script named a single
# compiled file, this step passed without evaluating safe-url.test.ts or
# url-binding-scan.test.ts while this comment promised it could not. If you
# change the test script, `make suite-manifest` is what catches the regression;
# it fails on any tracked test file that compiles without executing.
#
# ARTEFACT: this image builds `ft` and runs `ft dashboard`. It is NOT the
# deployed service -- Dockerfile.server builds farmtable-server, which is what
# production runs.
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
