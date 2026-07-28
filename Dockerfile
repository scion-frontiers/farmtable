FROM node:22-bookworm AS frontend
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ .
# The URL-binding guard runs here or nowhere. `npm ci` above installs
# devDependencies, so tsc/jsdom are present at this stage; the release path
# must not be able to ship a tree whose guard is red. See Makefile: test-web.
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
