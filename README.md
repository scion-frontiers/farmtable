# 🚜 Farm Table

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Farm Table is an **open-source task runtime built specifically for AI agents**. It provides coding and execution agents with a single, predictable, and robust interface to receive work, understand complex dependency structures, and track execution progress—whether tasks reside in GitHub, Jira, Linear, or Farm Table's own built-in graph-native backend.

When no external platform is connected, the built-in backend provides a **graph-native task store** complete with dependency tracking, atomic CAS (Compare-And-Swap) claims, and instant ready-task detection. No API keys, no SaaS accounts, and zero complex configuration are required.

**NOTE: Farmtable is at an early and experimental stage**
---

## 🚀 System Architecture & Modes

Farm Table operates transparently in two modes from the exact same codebase:

```text
┌─ Embedded Mode (Default) ──────────────────────────────────────┐
│  ft CLI ──bufconn──► In-Process FarmTableService                │
│                      └──► EntStore (SQLite)                    │
│  Single process. Zero infrastructure. Just works.              │
├─ Client-Server Mode ───────────────────────────────────────────┤
│  ft CLI ──gRPC/TLS──► farmtable-server (Separate Process)      │
│                       └──► EntStore (Postgres)                  │
│  Multi-agent coordination. Production deployments.             │
└────────────────────────────────────────────────────────────────┘
```

- **Embedded Mode**: Automatically selected by default. SQLite is used as the local store at `~/.farmtable/farmtable.db` (overridable via `FARMTABLE_DB_PATH`). Communication is routed through `bufconn` (an in-memory network connection), creating a single-binary zero-dependency experience.
- **Client-Server Mode**: Enabled automatically if the `FARMTABLE_SERVER` environment variable, `--server` flag, or the config file server key is supplied. This connects the CLI or agent to a standalone `farmtable-server` backed by Postgres for multi-agent coordination.

---

## 💎 Core Abstractions & Features

### 📦 Normalized Task Object (NTO)
Every task—whether synced from GitHub or managed locally—is represented in a single, predictable schema defined in Protobuf (`proto/farmtable/v1/farmtable.proto`).
- **Three-Tier Status Model**: Status is decoupled into three fields (`phase`, `stage`, and `native_label`) to let agents easily branch on high-level lifecycles while humans and dashboards enjoy fine-grained stage tracking.
- **Code Context Tracking**: Tasks natively carry Git repo and branch references, pull request info, and CI status.
- **Remote Lossless Sync**: Original platform fields are preserved in `remote_id`, `remote_url`, and custom `remote_data` JSON.

### 🕸️ Graph Queries & Ready-Task Detection
Farm Table handles task dependencies as a directed dependency graph:
- **`GetReadyTasks`**: Returns actionable tasks in `ready` stage that have no unresolved blocking dependencies.
- **`GetDependencyTree`**: Recursively traverses downstream (`blocks`) and upstream (`blocked_by`) relationships.
- **`GetCriticalPath`**: Calculates the longest blocking chain in a collection, identifying the absolute bottleneck determining minimum completion time.
- **`GetBottlenecks`**: Highlights tasks blocking the highest number of transitive downstream dependents.

### 🔌 Model Context Protocol (MCP) Adapter
By running `ft mcp serve`, Farm Table acts as an MCP server. It exposes **10 rich tools** (including `task_list`, `task_claim`, `task_ready`, and `task_critical_path`) over stdio, allowing any MCP-compliant LLM client or agent framework to naturally explore, claim, and resolve tasks.

---

## 🖥️ Rich Web Dashboard

Farm Table includes a stunning browser-based dashboard built using Vite, TypeScript, Lit web components, and Shoelace UI components. 

```text
web/
├── index.html
├── package.json
└── src/
    ├── components/         # Lit Web Components (Kanban, Tree Graph, Inspector)
    ├── store/              # Client-side state and stream coordination
    └── styles/             # Shoelace design system themes
```

The web dashboard is fully reactive and features:
1. **Interactive Kanban Board**: Move tasks across columns representing their current workflow stages.
2. **Dependency Tree DAG**: A visual node-link diagram showing task hierarchies and critical paths laid out using `@dagrejs/dagre`.
3. **Interactive Inspector Panel**: Instant access to selected task details, comments, audit trails, and code metadata.

---

## 🛠️ Local Development & Quick Start

### 1. Prerequisites
- **Go**: 1.22+
- **Node.js**: 22+ (for building/running the web dashboard)
- **Protobuf / Buf**: (Only for API contract modifications)

### 2. Standard Development Commands
```bash
# Set up your environment paths
export PATH=/workspace/.farmtable/bin:$PATH
export FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db

# Build the entire Go project
go build ./...

# Run the unit test suite
go test ./...

# Rebuild the ft CLI binary locally
go build -o /workspace/.farmtable/bin/ft ./cmd/ft

# Regenerate Ent ORM models after schema edits
go generate ./internal/store/ent
```

### 3. Running the Web Dashboard Locally
First, start the local backend to serve the gRPC-Web proxy:
```bash
ft dashboard --port 8080
```

Next, boot the Vite frontend dev server:
```bash
cd web
npm install
npm run dev
```

---

## 🐳 Docker & Production Deployment

To run Farm Table as a production service (backed by Postgres), build the unified Docker image:
```bash
docker build -t farmtable .
```
The multi-stage build automatically transpiles frontend assets using Node, embeds them into the compiled Go binary using `go:embed`, and exposes the unified server on startup.

---

## 🤝 Contributing

Contributions are welcome! Please refer to:
- [How to Contribute](docs/contributing.md) to get started and sign our CLA.
- [Code of Conduct](docs/code-of-conduct.md) to review our community interaction standards.

## 📄 License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.
