# WHAT READS THIS API — consumer population of the task-serving surface

Read-only measurement at `d305391` (my clone, HEAD `79c9b13` = `d305391` + one project-log
doc; production tree byte-identical). No tree modified, nothing built, nothing run.

**Answer: the Lit dashboard is NOT the only consumer. Six in-tree consumers, three of which
can observe `remote_data`. And the population is not bounded by the tree.**

Your prior is upheld, and I want to flag that I inherited it *after* my open pass, not before
— method below so you can check that.

---

## The consumer list

| # | Consumer | How I established it | `remote_data` observable? | What happens to it |
|---|---|---|---|---|
| 1 | **Lit web dashboard** (grpc-web + websockets) | `serverapp/unified.go` routes `/farmtable.v1.FarmTableService/` to `grpcweb.WrapServer`; `web/src/gen/grpc-client.ts` decodes it | **YES — Task and Collection both decoded** | `task.remoteData` is decoded and **never read**. `collection.remoteData` **IS read, twice, as a write-authorization gate.** See below. |
| 2 | **`ft` CLI** (`cmd/ft` → `internal/cli`) | gRPC client at `cli/connect.go` | On the wire yes; in output no | `cli/output.go::taskToMap` is an allowlist and sets `m["remote_data"] = nil` explicitly |
| 3 | **MCP server** (`internal/mcp`) | `cli/mcp.go`; `mcp/server.go` holds a gRPC client | On the wire yes; in output no | A **second, independent** `taskToMap` (`mcp/server.go`) that **omits the key entirely**. Output flows into LLM agent context. |
| 4 | **decomposer** (`cmd/decomposer` → `internal/decomposer/writer.go`) | `pb.NewFarmTableServiceClient` at `writer.go:63` | Reaches it; not read | Write-mostly (CreateTask/CreateCollection). Its only read is `ListCollections`, from which it takes `GetName()`/`GetId()` only. **Not a `remote_data` consumer.** |
| 5 | **`WatchTasks` stream / eventbus** | `proto` declares `rpc WatchTasks(...) returns (stream TaskEvent)`; `internal/streaming/eventbus.go` fans out `*pb.TaskEvent` | **YES — full Task, including `remote_data`, to every subscriber** | The bus itself never inspects it. Subscribers are #1 and #2. `cli/watch.go` routes through `taskToMap(..., compact=true)`, which omits the key. |
| 6 | **`ExportCollection` RPC** | `proto` service block; `internal/server/export_import.go` | Yes, into an emitted JSON document | `sanitizeRemoteData` is applied in `taskExport`. Gated: refuses any non-`farmtable` platform. |
| — | **Any out-of-tree gRPC / grpc-web client** | `.proto` is the published contract; `grpcweb.WithOriginFunc` returns `true` for **all origins**, websockets enabled | Unknown | **Cannot be bounded from the tree.** See limits. |

`internal/convert` appeared in the importer list but is enum conversion proto→domain
(inbound), not a consumer. `internal/testutil` is test scaffolding. Both excluded.

**No webhook, email, Slack or notification formatter exists.** `[MEASURED]` — zero non-test
matches for `webhook|smtp|SendMail|slack|notify|Notification` across `internal/` and `cmd/`.
One of the coordinator's four classes is simply absent.

---

## The finding the render-sink hunt could not have produced

**The dashboard reads `collection.remoteData` as an authorization decision, not as a render.**

```
capabilities.ts::getCapabilities   — Platform.GITHUB → rd.writable === true → GITHUB_CAPABILITIES
                                                     → otherwise            → ALL_DISABLED
ft-app.ts::isCollectionWritable    — same flag, default false
```

This is a **capability sink**, and a search for render sinks is structurally incapable of
finding it — the value is never printed, interpolated, or bound into a template. It is
branched on. That is why three legs missed it and it is not a criticism of any of them; it is
the population problem you asked me to test for, in its cleanest form.

Two consequences worth your attention:

1. **The collection half of R1/R2 is not inert.** If `collectionToProto`'s
   `structOrNilLoggingErr` ever returns nil, `rd` is `undefined` and the dashboard silently
   drops to read-only. That is fail-*closed* and therefore safe, but the shipped comment says
   the line "CANNOT FIRE TODAY" and treats the outcome as a missing field. The outcome is a
   **silent capability downgrade in the UI.** Same for anything that causes `sanitizeRemoteData`
   to drop the key (`writable` is a top-level bool and not URL-bearing, so not today —
   depth or representability changes are the live risks).

2. **Nothing in the tree writes `writable`.** `[MEASURED]` — zero non-test matches for
   `"writable"` in Go, and none in `web/src` outside generated code. So `getCapabilities`
   currently always falls through to `ALL_DISABLED` for GitHub collections. Either the branch
   is dead, or the flag arrives from outside the tree. The one in-tree path that could
   persist an externally-authored collection `remote_data` is `ImportCollection`
   (`entstore.go:2117`, from an import document).

   **I am explicitly NOT drawing the conclusion that suggests.** Whether an import document
   can reach a GITHUB-platform collection, and whether import is reachable by an untrusted
   principal, are both `[UNCHECKED]`. I am flagging it for the audit leg rather than opening
   it, per your instruction — and because this is exactly where I overclaimed on R3 and I am
   not doing it twice.

---

## What I could not determine, and why

- **Out-of-tree consumers — I cannot bound this population from the tree alone.** Those are
  the words you asked for and they are the honest ones. This is a gRPC service with a
  published `.proto`, exposed over grpc-web with `WithOriginFunc` accepting **every** origin
  and websockets on. Any browser page and any process with the contract is a consumer. The
  tree tells me who ships *in this repo*; it cannot tell me who calls the endpoint.
- **Whether either allowlist is test-enforced.** I did not check for tests pinning
  `taskToMap`'s exclusion of `remote_data` in `internal/cli` or `internal/mcp`. Determining it
  properly needs a run and the fence is live. **Structural note that does not need a run:**
  they are two independently maintained allowlists in two packages using two different
  mechanisms (explicit `= nil` vs. key omission). Nothing couples them, and MCP's is already
  narrower — it also omits `remote_id`, `remote_url` and `custom_fields`, which the CLI emits.
- **Whether `structToRecord` in the generated TS client sanitizes.** Not read; it is generated
  code and outside my delta.
- **The `decomposer` binary's full surface.** I read `writer.go` only, which is the file
  holding its gRPC client. If it has another read path elsewhere in `internal/decomposer` I
  did not see it.

---

## Method, so you can check it for shared blind spots

**Not a name search, and deliberately not the render-sink instrument.** I went
transport-first:

1. `ls cmd/` — what binaries exist at all. This is what surfaced `decomposer`, which nobody
   had named.
2. `proto/farmtable.proto` service block — the actual served surface, including the streaming
   RPC.
3. Import graph: every non-generated, non-test package importing the generated pb package.
   That is a **structural** enumeration — a consumer cannot hide from it by naming things
   unexpectedly, which is the specific weakness of the technique the test leg and I shared on R3.
4. Per consumer, traced the **output path**: every `printJSON`/`toolJSON`/marshal call site
   and what is handed to it.
5. **Wholesale-serializer check**, which is the one that could have made all the allowlists
   irrelevant: the generated struct carries `json:"remote_data,omitempty"`, so any
   `encoding/json` call on a raw `*pb.Task` emits the field regardless of any allowlist. I
   checked every `printJSON`/`toolJSON` argument and every `m["task"] =` assignment. **No path
   hands a raw Task to a serializer.** `[MEASURED]`
6. Only then the coordinator's four classes as a second pass — which found the absent one
   (no formatter) and confirmed the rest were already in the list.

**Ordering disclosure:** steps 1–5 were complete before I read your prior. Step 6 was after.
The dashboard-is-not-alone conclusion came out of step 1, not out of your message.

**Shared blind spot I still have:** steps 3–5 are all Go-side. My statement about the *web*
consumer rests on reading `web/src`, which is the same tree the three legs searched. If the
dashboard has a consumer path through generated code I did not read, I would miss it the same
way they did.
