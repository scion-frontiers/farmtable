# Integration Research: Asana

> Research template for evaluating a Farm Table integration target.

---

## 1. Platform Overview

- **Platform:** Asana
- **Tier:** 1 — Launch Target
- **Primary users:** Project managers, cross-functional teams, marketing, operations, and product teams. Used for broad work management and collaboration.
- **Archetype tested:** Hierarchical task management with flexible custom fields and multi-homing (tasks existing in multiple projects simultaneously).

---

## 2. Data Model

### Native task structure

- **Task entity name:** Task (can also act as a Subtask, Milestone, or Approval depending on `resource_subtype`).
- **Identifier format:** String GID (Global ID) composed of digits (e.g., `"120123456789"`). Must be treated as a string, not a number.
- **Hierarchy model:** Portfolio → Project → Section → Task → Subtask (Subtasks can have further subtasks). 
- **Maximum nesting depth:** Technically allows many levels of subtasks (up to 5 levels are typically visible in the UI).
- **Description format:** HTML (`html_notes` for task body, `html_text` for comments). Custom Asana XML subset wrapped in `<body>` tags. Does not natively support Markdown.

### Fields and metadata

- **Built-in fields:** `gid`, `name`, `completed`, `completed_at`, `due_on`, `due_at`, `start_on`, `assignee`, `notes` / `html_notes`, `projects`, `memberships`, `parent`.
- **Custom fields:** Highly customizable (`resource_subtype`: text, number, enum, multi_enum, date, people, boolean). Fields are shared across a Workspace/Project but values do NOT inherit from parent tasks to subtasks automatically unless the subtask is explicitly added to the project.
- **Required fields:** Generally, only the workspace is strictly required for task creation, and usually a name/title.

### Relationships and dependencies

- **Supported relationship types:** Parent/Child (Subtasks). Dependencies: "Blocks" and "Blocked by" (or `dependents` and `dependencies`).
- **How relationships are modeled:** First-class API objects via endpoints like `/tasks/{task_gid}/dependencies` and `/tasks/{task_gid}/dependents`. Subtasks are modeled using the `parent` property on the Task object.
- **Cross-project references:** Highly supported. A single task can belong to multiple projects simultaneously (called "multi-homing") and maintain its core identity (`gid`).

### NTO mapping considerations

- **Status mapping to OPEN / IN_PROGRESS / ON_HOLD / CLOSED:**
  - *Ambiguous.* Asana only natively supports `completed = false` (OPEN) and `completed = true` (CLOSED). 
  - IN_PROGRESS and ON_HOLD do not have native equivalents and must be mapped either to custom field `enum` values or project Sections (e.g., a "Doing" section).
- **Priority mapping to URGENT / HIGH / NORMAL / LOW:** Asana does not have a native Priority field. Priority is implemented using a Custom Field of type `enum`. This must be dynamically discovered per workspace/project.
- **Assignee model:** Single assignee. A task can only have one user assigned. (Collaborators/followers can be multiple).
- **Fields with no NTO equivalent:** `memberships` (section mapping), multi-homed `projects`, collaborators/followers.
- **NTO fields with no native equivalent:** Statuses like IN_PROGRESS (relies on custom conventions).

---

## 3. API Surface

### API architecture

- **API style:** REST
- **Base URL pattern:** `https://app.asana.com/api/1.0`
- **API versioning strategy:** URL path versioning (currently `/api/1.0`).
- **Documentation URL:** https://developers.asana.com/docs

### Key endpoints / operations

| Operation | Method / Query | Notes |
|-----------|---------------|-------|
| List tasks | `GET /tasks?project={gid}` | Requires a project, workspace, or assignee. Uses cursor-based pagination. |
| Get task detail | `GET /tasks/{task_gid}` | By default returns compact representation. Use `opt_fields` (e.g., `?opt_fields=name,custom_fields`) to get full details. |
| Create task | `POST /tasks` | Must specify workspace. Use `html_notes` for description. |
| Update task | `PUT /tasks/{task_gid}` | Partial updates supported. |
| Transition status | `PUT /tasks/{task_gid}` | Set `"completed": true/false`. Custom status requires updating `custom_fields` or section `memberships`. |
| Add comment | `POST /tasks/{task_gid}/stories` | Use `html_text` field for formatted comments. |
| List relationships | `GET /tasks/{task_gid}/dependencies` | Fetch tasks that block this task. |

### Pagination

- **Strategy:** Cursor-based (`offset`).
- **Default page size / max page size:** Max page size is `100` via `limit` param.
- **Total count available?** No direct total count returned in standard list responses.

### Rate limiting

- **Rate limit model:** Requests per minute per token.
- **Documented limits:** 1,500 requests/minute for paid domains; 150 requests/minute for free domains. Concurrent limits: 50 read, 50 write requests in flight. Search API has lower limits (60/min).
- **Rate limit headers:** Standard rate limit headers. Exceeding limits returns `429 Too Many Requests`.
- **Recommended backoff strategy:** Must check the `Retry-After` header for seconds to wait before retrying.

### Webhooks / real-time updates

- **Webhook support:** Yes.
- **Event types available:** `task.added`, `task.changed`, `task.deleted`, `story.added`, etc.
- **Webhook registration method:** API (`POST /webhooks`). Requires an X-Hook-Secret handshake.
- **Payload format:** Event envelopes containing `action`, `resource`, `user`, and `change` information.
- **If no webhooks:** The API provides an `/events` polling endpoint (Event Streams) via long-polling, but this counts towards webhook usage limits.

---

## 4. Authentication & Authorization

### Auth model

- **Supported auth methods:** OAuth 2.0, Personal Access Tokens (PAT). Service Accounts available for Enterprise.
- **Recommended method for Farm Table:** OAuth 2.0 (Authorization Code Grant).
- **OAuth grant type:** Authorization Code + PKCE.
- **Token lifecycle:** Short-lived access tokens (typically 1 hour), long-lived refresh tokens.

### Scopes and permissions

- **Available scopes:** Granular scopes introduced in April 2025: `tasks:read`, `tasks:write`, `projects:read`, `projects:write`, `workspaces:read`, `users:read`, `openid`, etc.
- **Minimum scopes required for Farm Table:** `tasks:write`, `projects:read`, `users:read`, `workspaces:read`. 
- **Granularity:** Generally resource-type level (e.g. all tasks the user has access to).
- **Can scopes be narrowed after initial grant?** Granular scopes replace the old "Full access" model. Scopes are requested upfront during the OAuth flow.

### Service accounts / machine users

- **Bot/app user model:** Service Accounts are supported for Enterprise tiers and appear as users.
- **Audit trail:** Service account actions appear as the bot user. OAuth actions appear as the user who authorized the app.
- **Account lifecycle:** Created via admin console (Enterprise only).

---

## 5. Normalization Challenges

### Status mapping complexity

- **Custom workflow states:** There are no formal "workflow statuses" beyond incomplete/complete. Workflows are entirely custom via Sections (e.g., "To Do" section) or Custom Fields (enum).
- **Workflow transition constraints:** No rigid API constraints on changing sections or enum values, but user-defined "Rules" (automations) may trigger secondary actions.
- **Default vs. custom workflows:** Everything beyond complete/incomplete is custom. Discovery requires parsing project sections or workspace custom fields. High complexity to map robustly to NTO states.

### Custom field handling

- **Field types supported:** text, number, enum, multi_enum, date, people, boolean.
- **Field discovery mechanism:** `GET /projects/{project_gid}/custom_field_settings` or `/workspaces/{workspace_gid}/custom_fields`
- **Mapping strategy:** Need to identify target custom fields by GID. Mapping priority and custom status will require users to map their specific Asana fields/enums to the NTO model. Pass through unmapped fields via `remote_data`.

### Content format translation

- **Native format:** HTML (Asana-specific XML tag subset).
- **Conversion to/from Markdown:** Medium-High difficulty. Must parse Markdown and convert it to valid XML wrapped in `<body>` tags for Asana. Need a robust parser and a sanitizer to strip unsupported HTML tags (like `<div>` or `<span>`).

### Identity resolution

- **User identifier format:** String GID.
- **Cross-referencing with Farm Table identity:** Call `GET /users?workspace={workspace_gid}` to get users and match via `email` to Farm Table assignees. Ensure all IDs are treated as strings.

---

## 6. Operational Considerations

### Data volume and performance

- **Typical task count per workspace:** Can reach tens or hundreds of thousands in large organizations.
- **Bulk operations support:** Limited. Asana generally prefers single resource operations or webhooks. No standard bulk create/update endpoint.
- **Search/filter capabilities:** `/tasks/search` endpoint allows querying, but does not support `offset` pagination (must use `created_on.after` for chunking).

### Error handling

- **Error response format:** Structured JSON with an `errors` array containing `message`, sometimes a `help` link, and a random `phrase` for 500 errors.
- **Common failure modes:** `400 Bad Request` (often passing numbers instead of string GIDs), `429 Too Many Requests`, `401/403` permissions issues.
- **Idempotency support:** Webhooks delivery can be verified, but native idempotency keys on POST requests are not broadly supported; rely on checking state or retries.

### Platform-specific quirks

- **Compact vs. Full objects:** Asana defaults to returning compact objects (GID, name, resource_type). You MUST use `?opt_fields=` to get full details like `custom_fields` or `notes`.
- **String GIDs:** GIDs used to be numbers but are now strings. Treat them as strings everywhere.
- **Multi-homing:** A task can live in multiple projects simultaneously, which can complicate hierarchical syncing.
- **Subtask independence:** Subtasks do NOT inherit custom fields or project membership from their parent automatically.

---

## 7. Integration Complexity Assessment

| Dimension | Complexity (Low / Medium / High) | Notes |
|-----------|----------------------------------|-------|
| Data model mapping | Medium | Mapping subtasks and multi-homing requires care. |
| API ergonomics | Low | Clean REST API, consistent formats. |
| Auth setup | Low | Standard OAuth 2.0 with granular scopes. |
| Status normalization | High | Very complex since Asana lacks native workflows beyond complete/incomplete. Requires mapping Sections or Custom Fields. |
| Custom field handling | Medium | Needs API calls to discover `gid`s and enum option `gid`s for mappings. |
| Real-time sync | Medium | Webhooks require handshake validation and handle usage limits. |
| Overall | Medium | The main hurdles are status/priority normalization and HTML/Markdown translation. |

---

## 8. Open Questions

- Should we map IN_PROGRESS to a specific Asana custom field (like "Status") or to a Project Section (like "Doing") by default?
- Do we need to sync parent-child (subtask) relationships to Farm Table, or treat all synced tasks flatly?
- If a task is multi-homed (exists in 3 projects), how should we resolve which project it belongs to in Farm Table?

---

## 9. References

- [Asana Developer Documentation](https://developers.asana.com/docs)
- [Rate Limits](https://developers.asana.com/docs/rate-limits)
- [Errors](https://developers.asana.com/docs/errors)
- [Webhooks](https://developers.asana.com/docs/webhooks)
