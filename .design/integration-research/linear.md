# Integration Research: Linear

> Research template for evaluating a Farm Table integration target.

---

## 1. Platform Overview

- **Platform:** Linear
- **Tier:** 1 — Launch Target
- **Primary users:** Product and engineering teams, highly favored by startups and modern tech companies who value speed, keyboard-first interfaces, and opinionated agile workflows.
- **Archetype tested:** High-speed, GraphQL-first issue tracking. Validates mapping opinionated data models with cursor-based pagination and complexity-based rate limiting.

---

## 2. Data Model

### Native task structure

- **Task entity name:** Issue
- **Identifier format:** `[TEAM_PREFIX]-[NUMBER]` (e.g., `ENG-123`). The API primarily uses UUIDs for internal IDs, but human-readable identifiers are widely used and supported.
- **Hierarchy model:** Initiative → Project → Issue → Sub-issue. (Milestones can also group issues within Projects).
- **Maximum nesting depth:** Sub-issues can be nested up to 10 levels deep. Initiatives can be nested up to 5 levels (on Enterprise plans).
- **Description format:** Markdown (with specific conventions for user and issue mentions).

### Fields and metadata

- **Built-in fields:** Title, description, state (status), priority, assignee, due date, labels, team, project, cycle, estimate.
- **Custom fields:** Available (mostly on Enterprise plans). They are strongly typed (`text`, `number`, `singleSelect`, `multiSelect`, `date`). They are scoped at the Team or Workspace level and can be retrieved via the GraphQL API on the `Issue` object.
- **Required fields:** For creation, only `teamId` and `title` are strictly required (unless using a template).

### Relationships and dependencies

- **Supported relationship types:** `blocks`, `related`, `duplicate`.
- **How relationships are modeled:** First-class API objects via the `IssueRelation` type. You link them using the `issueRelationCreate` mutation. "Blocked by" is just the inverse query of "blocks". Parent/child relationships (sub-issues) are handled differently via the `parentId` field.
- **Cross-project references:** Yes, issues can reference issues in other teams or projects seamlessly.

### NTO mapping considerations

- **Status mapping to OPEN / IN_PROGRESS / ON_HOLD / CLOSED:** 
  Linear relies on categorized `WorkflowStates` instead of hardcoded statuses. The mapping logic should use the `type` field of the workflow state:
  - `triage` → OPEN
  - `unstarted` → OPEN
  - `started` → IN_PROGRESS
  - `backlog` → ON_HOLD
  - `completed` → CLOSED
  - `canceled` → CLOSED
- **Priority mapping to URGENT / HIGH / NORMAL / LOW:**
  - 1 (Urgent) → URGENT
  - 2 (High) → HIGH
  - 3 (Medium) → NORMAL
  - 4 (Low) → LOW
  - 0 (No priority) → Unmapped / remote_data passthrough.
- **Assignee model:** Single assignee per issue (via `assigneeId`).
- **Fields with no NTO equivalent:** `cycle`, `estimate` (story points), `boardOrder`.
- **NTO fields with no native equivalent:** None major, though arbitrary external tracking IDs might need to be stored in Custom Fields or as Labels if Custom Fields aren't enabled.

---

## 3. API Surface

### API architecture

- **API style:** GraphQL (Exclusive; no REST equivalent).
- **Base URL pattern:** `https://api.linear.app/graphql`
- **API versioning strategy:** Continuous evolution (no strict path versioning). They deprecate fields gracefully in the schema.
- **Documentation URL:** https://developers.linear.app/docs/graphql/working-with-the-graphql-api

### Key endpoints / operations

| Operation | Method / Query | Notes |
|-----------|---------------|-------|
| List tasks | `issues` (Query) | Cursor-based connection with standard GraphQL pagination (`first`, `after`). Filtering supported via `filter` argument. |
| Get task detail | `issue` (Query) | Fetches full representation based on the requested selection set. |
| Create task | `issueCreate` (Mutation)| Requires `teamId`, `title`. |
| Update task | `issueUpdate` (Mutation)| Partial update supported. Provide only the fields to change. |
| Transition status | `issueUpdate` (Mutation)| Update the `stateId` to the UUID of the target `WorkflowState`. |
| Add comment | `commentCreate` (Mutation)| Markdown format. Threading supported via `parentId` on comments. |
| List relationships| `issue` -> `relations` | Nested connection within the Issue query to fetch dependencies. |

### Pagination

- **Strategy:** Cursor-based (Relay-compliant GraphQL connections).
- **Default page size / max page size:** Default is 50. Maximum varies by query complexity, but it is highly recommended to specify limits to save rate limit points.
- **Total count available?** Yes, GraphQL connections often expose a `pageInfo` object and a `nodes` array, but counting the total might require a specific aggregation query or checking the schema for totalCount fields.

### Rate limiting

- **Rate limit model:** Dual-limit model (Request count + GraphQL Complexity limit). Leaky bucket approach based on the authenticated user.
- **Documented limits:** 
  - Requests: 5,000 per hour (for Personal API keys and OAuth apps).
  - Complexity: 3,000,000 points per hour.
- **Rate limit headers:** 
  - `X-RateLimit-Requests-Limit` / `-Remaining` / `-Reset`
  - `X-RateLimit-Complexity-Limit` / `-Remaining` / `-Reset`
- **Recommended backoff strategy:** Watch the remaining complexity/requests headers. If a 429 or 400 with `RATELIMITED` is returned, sleep until the timestamp in the `-Reset` header.

### Webhooks / real-time updates

- **Webhook support:** Yes.
- **Event types available:** `Issue`, `Comment`, `Project`, etc. Payloads indicate the `action` (`create`, `update`, `remove`).
- **Webhook registration method:** Both API (via `webhookCreate` mutation) and UI.
- **Payload format:** JSON containing the `type`, `action`, `url`, and a `data` object containing the mutated entity state.
- **If no webhooks:** N/A.

---

## 4. Authentication & Authorization

### Auth model

- **Supported auth methods:** Personal API Key (PAT), OAuth 2.0 (Authorization Code), Client Credentials (for server-to-server).
- **Recommended method for Farm Table:** OAuth 2.0 (Authorization Code + PKCE) for user-facing integrations.
- **OAuth grant type:** Authorization Code.
- **Token lifecycle:** Access tokens are short-lived (24 hours). A rotating refresh token is provided (incurs a 6-month inactivity expiration). Linear mandates this rotating refresh token strategy.

### Scopes and permissions

- **Available scopes:** `read`, `write`, `admin`, `issues:create`, `comments:create`, `app:assignable`.
- **Minimum scopes required for Farm Table:** `read`, `write` (or `issues:create`, `comments:create` for granular least-privilege depending on NTO mapping).
- **Granularity:** Workspace-level.
- **Can scopes be narrowed after initial grant?** No, you must re-authenticate to change scopes.

### Service accounts / machine users

- **Bot/app user model:** Apps acting via OAuth can be designated as "agents". 
- **Audit trail:** API operations made via an application are attributed to the application (and the authorizing user). Linear also has formal Agent Interaction Guidelines (AIG) to give AI agents "first-class" presence with Agent Sessions.
- **Account lifecycle:** Managed via the Developer Settings in the workspace.

---

## 5. Normalization Challenges

### Status mapping complexity

- **Custom workflow states:** Teams define custom statuses, but every status must be mapped to one of the six standard lifecycle categories (`triage`, `backlog`, `unstarted`, `started`, `completed`, `canceled`). 
- **Workflow transition constraints:** Generally very flexible; any issue can be moved to almost any state unless restricted by internal team configurations (like mandatory triage).
- **Default vs. custom workflows:** The categories are fixed, but the specific states (and their names) are entirely custom per team. Normalization relies exclusively on the state's `type` field.

### Custom field handling

- **Field types supported:** `text`, `number`, `singleSelect`, `multiSelect`, `date`.
- **Field discovery mechanism:** Introspect the workspace or team's `customFieldDefinitions`.
- **Mapping strategy:** Pass through untouched into `remote_data` for preservation. Only primary structural fields should map directly to NTO fields. 

### Content format translation

- **Native format:** Markdown.
- **Conversion to/from Markdown:** Simple. Linear uses standard markdown with some specific extensions (like `@USER_ID` or internal issue links). Mentions will need ID resolution to look correct in Farm Table.

### Identity resolution

- **User identifier format:** UUID.
- **Cross-referencing with Farm Table identity:** You will need to query Linear users (via `users` GraphQL connection) to correlate email addresses to Linear UUIDs in order to assign tasks properly.

---

## 6. Operational Considerations

### Data volume and performance

- **Typical task count per workspace:** Tens of thousands. 
- **Bulk operations support:** The API supports batching multiple GraphQL queries or mutations in a single HTTP request (GraphQL aliasing), but you must be careful not to exceed the complexity limits.
- **Search/filter capabilities:** Linear provides a robust `filter` argument on the `issues` query (e.g., filter by team, status type, assignee, labels).

### Error handling

- **Error response format:** Standard GraphQL errors array. Usually HTTP 200 with `errors` inside, but HTTP 400 for rate limit or malformed queries.
- **Common failure modes:** Rate limiting (Complexity exceeded), permission denied (cross-team access), invalid UUIDs for assignments/states.
- **Idempotency support:** No native idempotency keys on issue creation; rely on external ID tracking to avoid duplicates.

### Platform-specific quirks

- **GraphQL Complexity vs N+1:** Because complexity scales geometrically with nested connections, retrieving issues with their associated comments, assignees, and parent projects all in one query can very rapidly drain the 3M/hour limit. You must use `first: 10` (or similar) on all nested arrays.
- **Teams vs Projects:** Linear forces issues to be in a Team, whereas Projects are optional time-boxed endeavors. This means the top-level grouping for syncing should probably be Teams, not Projects, or you risk missing standalone issues.

---

## 7. Integration Complexity Assessment

| Dimension | Complexity (Low / Medium / High) | Notes |
|-----------|----------------------------------|-------|
| Data model mapping | Low | Highly structured, clean mapping to standard agile concepts. |
| API ergonomics | Medium | GraphQL offers great power, but managing query complexity limits requires careful client architecture. |
| Auth setup | Medium | Standard OAuth2, but requires rotating refresh token logic. |
| Status normalization | Low | The state enum (`type`) makes normalization trivial regardless of custom names. |
| Custom field handling | Medium | The strongly typed GraphQL schema requires some dynamic querying to discover definitions. |
| Real-time sync | Low | Comprehensive webhooks available. |
| Overall | Medium | A fantastic developer experience, but requires strong GraphQL and complexity-management skills. |

---

## 8. Open Questions

- Does Farm Table need to sync Linear Initiatives, or is stopping at the Project/Issue level sufficient?
- Should Farm Table attempt to handle Linear "Cycles" (sprints), or just map standard Due Dates?
- How to handle mentions in Markdown? Should we try to map Linear user UUIDs embedded in Markdown to Farm Table users, or leave them as plain text?

---

## 9. References

- [Linear API Documentation](https://developers.linear.app/docs/graphql/working-with-the-graphql-api)
- [Linear Official TS/JS SDK](https://github.com/linear/linear/tree/master/packages/sdk)
- [Linear Webhooks Guide](https://developers.linear.app/docs/api/webhooks)
