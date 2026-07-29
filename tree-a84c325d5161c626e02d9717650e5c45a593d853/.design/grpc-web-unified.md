# Unified gRPC API and Web Interface on Cloud Run

## Problem & Goals

Farm Table needs one Cloud Run service, on one external URL and one container port, that serves:

- Browser dashboard assets from `web/dist/`.
- Browser API calls using gRPC-Web under the existing `/farmtable.v1...` paths.
- Native `ft` CLI calls using raw gRPC over HTTP/2.

Success means `https://farmtable-486315127503.us-central1.run.app/` loads the dashboard, browser API requests reach the same `internal/server.FarmTableService` implementation, and `ft ... --server farmtable-486315127503.us-central1.run.app:443` continues to work as a native gRPC client.

## Non-Goals

- Replacing protobuf/gRPC with Connect, REST, or JSON transcoding.
- Redesigning auth beyond preserving the current token interceptor behavior.
- Implementing frontend API client generation. The current dashboard code still constructs `MockFarmTableClient`; this design only covers unified serving once a real gRPC-Web client is wired in.
- Changing persistence semantics beyond continuing to use Postgres on Cloud Run via `FARMTABLE_DB_URL`.

## Proposed Design

Use the existing `ft dashboard` serving model as the base, but factor it into a reusable unified server for Cloud Run:

1. Create one `grpc.Server` with the existing token unary and stream interceptors.
2. Register `server.NewFarmTableService(s, version, server.WithEventBus(eventBus))` once.
3. Wrap the same `grpc.Server` with `github.com/improbable-eng/grpc-web/go/grpcweb` for browser calls.
4. Serve static assets from embedded `web/dist`.
5. Put a single `http.Server` behind `h2c.NewHandler`.
6. Route requests explicitly:
   - Raw gRPC: HTTP/2 requests with `Content-Type: application/grpc...` go to `grpcServer.ServeHTTP`.
   - gRPC-Web: `/farmtable.v1/` and `/farmtable.v1.FarmTableService/` requests go to the gRPC-Web wrapper.
   - Everything else goes to the static asset handler, with SPA fallback if the dashboard needs client-side routing.

This is a small extension of the current dashboard rather than a second proxy stack. `internal/cli/dashboard.go` already uses Improbable gRPC-Web, explicit FarmTable service path prefixes, embedded `web/dist`, and `h2c.NewHandler(mux, &http2.Server{})`. The missing production capability is explicit raw gRPC routing from the same listener.

### Architecture

```text
                       Cloud Run service: farmtable
                         container port: 8080 (h2c)

 Browser
   GET /  ───────────────────────────────┐
                                         │
 Browser                                 ▼
   GET /assets/* ───────────────► unified HTTP handler ───► web/dist static files

 Browser
   POST /farmtable.v1.FarmTableService/ListTasks
   Content-Type: application/grpc-web* ─► grpcweb.WrapServer
                                         │
                                         ▼
                                  grpc.Server
                                         │
                                         ▼
                              FarmTableService + Ent store
                                         ▲
                                         │
 ft CLI                                  │
   HTTP/2 POST /farmtable.v1.FarmTableService/ListTasks
   Content-Type: application/grpc* ─────► grpcServer.ServeHTTP
```

### Request Routing Sketch

Illustrative pseudocode only:

```go
func unifiedHandler(grpcServer *grpc.Server, wrapped *grpcweb.WrappedGrpcServer, assets http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ct := r.Header.Get("Content-Type")

        if r.ProtoMajor == 2 && strings.HasPrefix(ct, "application/grpc") &&
            !strings.HasPrefix(ct, "application/grpc-web") {
            grpcServer.ServeHTTP(w, r)
            return
        }

        if strings.HasPrefix(r.URL.Path, "/farmtable.v1/") ||
            strings.HasPrefix(r.URL.Path, "/farmtable.v1.FarmTableService/") {
            wrapped.ServeHTTP(w, r)
            return
        }

        assets.ServeHTTP(w, r)
    })
}
```

Then:

```go
httpServer := &http.Server{
    Handler: h2c.NewHandler(unifiedHandler(...), &http2.Server{}),
}
```

The load-bearing decision is to use HTTP handler routing with h2c, not TCP-level listener splitting. That keeps Cloud Run, native gRPC, gRPC-Web, and static HTTP in one Go server process.

## Current System Findings

- `internal/cli/dashboard.go` does not use `cmux`.
- It creates a normal `grpc.Server`, wraps it with Improbable `grpcweb.WrapServer`, and mounts the wrapper under `/farmtable.v1/` and `/farmtable.v1.FarmTableService/`.
- It serves `farmtable.WebAssets` from `web/dist` through `http.FileServer`.
- It runs the HTTP mux through `golang.org/x/net/http2/h2c`.
- `cmd/farmtable-server/main.go` is pure raw gRPC on `FARMTABLE_PORT`, defaults to `50051`, and requires `FARMTABLE_DB_URL`.
- The checkout has `Dockerfile` but no `Dockerfile.server`; the design should update the server image/build path that exists in the target branch, or recreate `Dockerfile.server` if deployment automation still expects it.
- `web/README.md` and Vite proxy describe gRPC-Web paths, but `web/src/components/ft-app.ts` currently uses `MockFarmTableClient`. Production API wiring remains a separate implementation task.

## Cloud Run Compatibility

Cloud Run can serve native gRPC when end-to-end HTTP/2 is enabled. Google documents that Cloud Run normally downgrades HTTP/2 to HTTP/1 except native gRPC, and that end-to-end HTTP/2 requires the container to handle HTTP/2 cleartext (`h2c`). The deployment should use:

```bash
gcloud run deploy farmtable \
  --image IMAGE_URL \
  --use-http2 \
  --port 8080
```

Equivalent YAML should name the container port `h2c`:

```yaml
ports:
- name: h2c
  containerPort: 8080
```

TLS is terminated by Google frontend infrastructure; the Go process listens cleartext h2c on `:8080`.

Source: Google Cloud Run HTTP/2 documentation, last updated 2026-07-07: https://docs.cloud.google.com/run/docs/configuring/http2

## API Surface and Data Flow

No protobuf schema changes are required.

Native CLI flow:

```text
ft CLI -> grpc.NewClient(server, TLS creds) -> Cloud Run HTTPS -> h2c to container
       -> grpcServer.ServeHTTP -> FarmTableService -> Ent/Postgres
```

Browser gRPC-Web flow:

```text
Dashboard JS -> POST /farmtable.v1... with application/grpc-web*
             -> Cloud Run -> unified handler -> grpcweb wrapper
             -> same grpc.Server/FarmTableService -> Ent/Postgres
```

Static asset flow:

```text
Browser -> GET /, /assets/*, /shoelace/assets/*
        -> Cloud Run -> unified handler -> embedded web/dist
```

## Implementation Plan

1. Extract shared server construction.
   - Add an internal package or file such as `internal/serverapp/unified.go`.
   - Inputs: `context.Context`, `store.Store`, `version`, auth lookup, asset filesystem, listen port.
   - Output: configured `*http.Server`, `*grpc.Server`, and a `Serve(net.Listener)` helper or small app struct.

2. Move the dashboard HTTP composition into that shared path.
   - Preserve Improbable gRPC-Web dependency already present in `go.mod`.
   - Preserve `golang.org/x/net/http2/h2c`, already present transitively and imported by dashboard.
   - Add raw gRPC routing before gRPC-Web/static routing.

3. Adapt `cmd/farmtable-server/main.go` for Cloud Run.
   - Keep `FARMTABLE_DB_URL` required.
   - Default port to `PORT` when present, then `FARMTABLE_PORT`, then `8080` for Cloud Run compatibility.
   - Build the Ent store and event bus as it does today.
   - Use the unified h2c HTTP server instead of `grpcServer.Serve(lis)`.
   - Keep graceful shutdown: call `httpServer.Shutdown`, then `grpcServer.GracefulStop`, with a timeout fallback to `grpcServer.Stop`.

4. Keep `ft dashboard` on the same shared server.
   - Continue supporting SQLite fallback for local dashboard mode.
   - Continue ensuring the local user/default collection before serving.
   - Keep `--open` behavior and local port conflict handling.

5. Update the container build.
   - If production deployment uses root `Dockerfile`, change the final command from `/ft dashboard --port 8080` to the unified production entry point only if Postgres mode is desired there.
   - Prefer building `cmd/farmtable-server` with frontend assets embedded and running it on `:8080`.
   - If deployment automation expects `Dockerfile.server`, recreate it as a multi-stage build that runs `npm ci && npm run build`, copies `web/dist` into the Go build context, builds `/farmtable-server`, exposes `8080`, and runs `/farmtable-server`.

6. Configure Cloud Run.
   - Set `FARMTABLE_DB_URL`.
   - Set `FARMTABLE_DB_DIALECT=postgres` only if non-default behavior is needed.
   - Set `FARMTABLE_DB_PASSWORD` if the DSN omits `password=`.
   - Set `FARMTABLE_TOKEN` or migrate to a bootstrap token strategy; current server-backed lookup only validates tokens already present in the database.
   - Deploy with `--use-http2`.

7. Verify locally before deploy.
   - Static: `curl -i http://localhost:8080/`.
   - h2c readiness: `curl -i --http2-prior-knowledge http://localhost:8080/`.
   - gRPC-Web: browser dashboard request or `curl` with `Content-Type: application/grpc-web+proto`.
   - Native gRPC: `ft status --server localhost:8080` with `FARMTABLE_INSECURE=1`.

## Alternatives Considered

### cmux

`cmux` can split raw gRPC and HTTP by inspecting TCP bytes. It is useful when independent servers must own the same listener. It is not recommended here because the existing dashboard already composes the protocols at HTTP handler level, Cloud Run HTTP/2 requires h2c handling anyway, and adding TCP-level routing would make local and Cloud Run behavior harder to reason about.

### gRPC-Web Only

Serving only the Improbable gRPC-Web wrapper plus static assets is closest to today’s dashboard. It is insufficient because native `ft` clients use raw gRPC over HTTP/2 and should not be forced through gRPC-Web.

### h2c + HTTP Handler Routing

This is the recommended approach. It matches the dashboard’s current shape, requires no new dependency, and supports static HTTP, gRPC-Web, and native gRPC on one listener.

### Connect

Connect would support browser and native clients cleanly over HTTP/1.1 and HTTP/2, but it changes the RPC stack, generation workflow, and client code. That is too much migration cost for the immediate Cloud Run unification goal.

### grpc-gateway

grpc-gateway is useful for REST/JSON clients. Farm Table’s browser path is already intended to be gRPC-Web, and native clients already speak gRPC, so gateway JSON transcoding adds codegen and operational surface without solving a current requirement.

## Migration / Rollout

1. Land the shared unified server behind existing commands without changing public CLI flags.
2. Keep current local `ft dashboard` behavior as the first regression target.
3. Deploy a new Cloud Run revision with the unified image and `--use-http2`.
4. Smoke test static dashboard, gRPC-Web, and native CLI against the revision URL.
5. Shift traffic only after native CLI calls and dashboard loading both pass.
6. Keep the old pure gRPC image/revision available for rollback until the dashboard and CLI have passed basic production checks.

Reversible decisions:

- The location/name of the shared Go package.
- Whether root `Dockerfile` or `Dockerfile.server` is the production image entry point.
- CORS origin policy tightening after the first deployment.

Load-bearing decisions:

- One Cloud Run service must be deployed with end-to-end HTTP/2/h2c.
- Raw gRPC and gRPC-Web must route to the same `grpc.Server` instance to avoid duplicate service registration and divergent auth/event behavior.

## Open Questions

- Should the production dashboard be public, token-gated, or protected by Cloud Run/IAP? Current token interceptors protect only gRPC metadata-bearing calls, not static asset reads.
- What is the intended production token bootstrap path? `FARMTABLE_TOKEN` currently enables store-backed lookup but does not itself create a token row.
- Should CORS remain permissive as in `ft dashboard`, or be restricted to the Cloud Run/custom domain origin?
- Is `Dockerfile.server` missing only in this checkout, or does deployment automation still refer to it?
- When will `web/src/components/ft-app.ts` switch from `MockFarmTableClient` to a real gRPC-Web client?

## Implementation Phases

1. Shared handler extraction: move gRPC-Web/static/h2c composition into reusable code and keep `ft dashboard` passing.
2. Raw gRPC route: add content-type/protocol routing to `grpcServer.ServeHTTP`; add focused handler tests if practical.
3. Production command: update `cmd/farmtable-server` to use the unified h2c HTTP server on Cloud Run’s port.
4. Image update: build frontend assets into the production binary/image and run the unified server entry point.
5. Deployment config: enable Cloud Run HTTP/2 and update environment variables.
6. End-to-end verification: test dashboard, browser API, and native CLI against the deployed revision before traffic migration.

## Acceptance Criteria

- One container listens on one port, defaulting to Cloud Run `PORT`/`8080`.
- `curl -i /` returns the dashboard HTML or static shell.
- Browser gRPC-Web requests under `/farmtable.v1/` and `/farmtable.v1.FarmTableService/` reach `FarmTableService`.
- Native `ft` commands can call the Cloud Run URL over TLS as raw gRPC.
- Local `ft dashboard --port 8080` still works with SQLite and embedded assets.
- Cloud Run revision is configured for end-to-end HTTP/2 (`--use-http2` or `ports.name: h2c`).
- Auth behavior is unchanged for gRPC and gRPC-Web calls.
- Rollback to the prior pure gRPC revision remains possible during rollout.
