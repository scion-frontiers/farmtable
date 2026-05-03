# Integration Research: Jira Cloud

> Research template for evaluating a Farm Table integration target.

---

## 1. Platform Overview

- **Platform:** Jira Cloud (Atlassian)
- **Tier:** 1 — Launch Target
- **Primary users:** Software engineering teams, product managers, IT, and agile organizations for issue tracking and project management.
- **Archetype tested:** Highly customizable, deeply hierarchical enterprise task tracker with rich text descriptions (Atlassian Document Format), arbitrary custom workflows, and highly structured schema requirements.

---

## 2. Data Model

### Native task structure

- **Task entity name:** Issue (includes Epics, Stories, Tasks, Bugs, Sub-tasks, and custom types)
- **Identifier format:** Alphanumeric key combining project key and sequential number (e.g., `PROJ-123`). Also has an internal integer ID.
- **Hierarchy model:** Flexible, but typically standard issue types (Level 0: Story, Task, Bug) can have a parent (Level 1: Epic) and children (Level -1: Sub-tasks). Premium/Enterprise supports custom higher hierarchy levels (Initiative, Theme, etc. via Advanced Roadmaps). Jira now uses a unified `parent` field for all hierarchical linking.
- **Maximum nesting depth:** Technically configurable in Jira Premium (N levels above Epic), but functionally typically 3-5 levels (e.g., Initiative → Epic → Story → Sub-task).
- **Description format:** Atlassian Document Format (ADF) in v3 API (JSON-based structured rich text format). Note: v2 API used Atlassian wiki markup or HTML.

### Fields and metadata

- **Built-in fields:** `summary` (title), `description`, `status`, `priority`, `assignee`, `reporter`, `issuetype`, `project`, `labels`, `duedate`, `created`, `updated`, `parent`.
- **Custom fields:** Extremely prevalent. Configured globally or per-project. Field types include text, number, dates, select lists (single/multi), users, groups, issue links, and third-party app fields. Discovered via `/rest/api/3/field`. Represented as `customfield_100XX` in the API payload.
- **Required fields:** Highly configurable per issue type and per project via "Field Configurations" and "Screen Schemes". `summary`, `project`, and `issuetype` are globally mandatory for creation, but admins can require anything else.

### Relationships and dependencies

- **Supported relationship types:** Links (Blocks, Relates to, Duplicates, Clones) and Hierarchy (`parent`).
- **How relationships are modeled:**
  - Hierarchy: The unified `parent` field links issues vertically.
  - Sibling/Dependencies: "Issue Links" (a separate resource/field `issuelinks`) connect issues horizontally.
- **Cross-project references:** Yes, parent and issue links can easily span across multiple projects within the same Jira workspace.

### NTO mapping considerations

- **Status mapping to OPEN / IN_PROGRESS / ON_HOLD / CLOSED:**
  - Jira uses "Status Categories" to group custom statuses: `To Do` (maps to OPEN), `In Progress` (maps to IN_PROGRESS), `Done` (maps to CLOSED). ON_HOLD might map to a custom status categorized as `To Do` or `In Progress` depending on the org.
- **Priority mapping to URGENT / HIGH / NORMAL / LOW:**
  - Native defaults: Highest, High, Medium, Low, Lowest.
  - Proposed map: Highest -> URGENT, High -> HIGH, Medium -> NORMAL, Low/Lowest -> LOW.
- **Assignee model:** Single assignee by default. (Multiple assignees usually requires a custom field or third-party add-on).
- **Fields with no NTO equivalent:** `components`, `fixVersions`, `versions`, `environment`, `resolution`, `security`, specific `customfield_XXX`. These should go in `remote_data`.
- **NTO fields with no native equivalent:** Farm Table concepts that don't fit into standard issue fields may need to be mapped to custom fields or stored in Farm Table only.

---

## 3. API Surface

### API architecture

- **API style:** REST
- **Base URL pattern:** `https://{your-domain}.atlassian.net/rest/api/3/`
- **API versioning strategy:** URL path versioning (currently `/3/` for ADF support, `/2/` for older formats).
- **Documentation URL:** [Jira Cloud Platform REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)

### Key endpoints / operations

| Operation | Method / Query | Notes |
|-----------|---------------|-------|
| List tasks | `GET /search` or `POST /search` | Uses JQL (Jira Query Language). Supports filtering. |
| Get task detail | `GET /issue/{issueIdOrKey}` | Can expand fields, changelog, transitions. |
| Create task | `POST /issue` | Requires project, issuetype, summary. Strict validation against screen schemes. |
| Update task | `PUT /issue/{issueIdOrKey}` | Partial updates via standard fields, or specialized `editmeta`. |
| Transition status | `POST /issue/{issueIdOrKey}/transitions` | Must specify a valid transition ID, not just a status. |
| Add comment | `POST /issue/{issueIdOrKey}/comment` | Body must be in Atlassian Document Format (ADF). |
| List relationships| `GET /issue/{issueIdOrKey}` | Issue links and parent are embedded in the issue representation. |

### Pagination

- **Strategy:** Offset-based (`startAt`, `maxResults`).
- **Default page size / max page size:** Defaults typically to 50, maximum is usually 100 for search endpoints.
- **Total count available?** Yes, the `total` field is returned in paged responses.

### Rate limiting

- **Rate limit model:** Multi-layered:
  - Burst rate limits (per-second token bucket, per-tenant/endpoint).
  - Points-based hourly quota.
  - Per-issue write limits.
- **Documented limits:** Varies by tier and endpoint, but 429s are actively enforced.
- **Rate limit headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`, and `RateLimit-Reason`.
- **Recommended backoff strategy:** Respect `Retry-After`. If missing, use exponential backoff with jitter. Handle 429s gracefully.

### Webhooks / real-time updates

- **Webhook support:** Yes.
- **Event types available:** `jira:issue_created`, `jira:issue_updated`, `jira:issue_deleted`, `comment_created`, `sprint_started`, etc.
- **Webhook registration method:** UI, Atlassian Connect App/Forge descriptor, or via REST API.
- **Payload format:** JSON containing the event type, timestamp, user, the full issue object, and a `changelog` of modified fields. Note: Webhooks registered via API expire in 30 days and must be refreshed.

---

## 4. Authentication & Authorization

### Auth model

- **Supported auth methods:** Basic Auth with API Token (for scripts), OAuth 2.0 (3LO) for external apps, Atlassian Connect (JWT) / Forge for native apps.
- **Recommended method for Farm Table:** OAuth 2.0 (3LO - 3rd Legged OAuth) Authorization Code grant type. This is standard for external SaaS integrations to operate on behalf of a user.
- **OAuth grant type:** Authorization Code with PKCE is supported and recommended.
- **Token lifecycle:** Access tokens usually expire in 60 minutes. Refresh tokens are available but Atlassian supports "Rotating Refresh Tokens" which must be updated.

### Scopes and permissions

- **Available scopes:** E.g., `read:jira-work`, `write:jira-work`, `read:jira-user`.
- **Minimum scopes required for Farm Table:** `read:jira-work` (for syncing) and `write:jira-work` (for updating).
- **Granularity:** Generally instance-wide based on the authorizing user's permissions. Atlassian is introducing more granular scopes, but access is heavily governed by the user's project-level permissions (e.g., "Browse Projects", "Edit Issues").
- **Can scopes be narrowed after initial grant?** No, the app must request new authorization to change scopes.

### Service accounts / machine users

- **Bot/app user model:** Connect and Forge apps install as "App users" (bots). OAuth 2.0 3LO acts on behalf of the authorizing human user.
- **Audit trail:** Connect/Forge apps show up as the App performing the action. 3LO actions appear as the authorizing user.
- **Account lifecycle:** App users are created on install and deleted on uninstall.

---

## 5. Normalization Challenges

### Status mapping complexity

- **Custom workflow states:** Jira allows infinite custom statuses per project.
- **Workflow transition constraints:** Massive complexity. You cannot just `PUT` a status. You must query available transitions (`GET /issue/{id}/transitions`) and then `POST` a transition. Transitions may require specific fields to be set (Screen restrictions).
- **Default vs. custom workflows:** Every project can have an entirely bespoke workflow.

### Custom field handling

- **Field types supported:** Dozens (Text, Date, Number, Cascading Select, Multi-user, etc.).
- **Field discovery mechanism:** `GET /rest/api/3/field` to list all fields. `GET /rest/api/3/issue/createmeta` (deprecated/replaced by specific project/issuetype endpoints) or `GET /rest/api/3/issue/{id}/editmeta` to see what is required/available for a specific issue.
- **Mapping strategy:** Store unknown `customfield_XXXXX` keys in `remote_data`. A configuration step mapping specific Farm Table fields to discovered Jira custom fields per workspace will be necessary.

### Content format translation

- **Native format:** Atlassian Document Format (ADF) in v3.
- **Conversion to/from Markdown:** High difficulty. ADF is a complex, nested JSON structure. Requires a dedicated two-way ADF-to-Markdown translation library (e.g., using open source `adf-builder` or custom AST transformations) to safely preserve formatting without data loss. Alternatively, use the v2 API (which uses Markdown/Wiki markup) at the cost of using legacy endpoints.

### Identity resolution

- **User identifier format:** Atlassian account ID (AAID), a UUID-like string. (Emails and usernames are deprecated for privacy/GDPR).
- **Cross-referencing with Farm Table identity:** Requires mapping the user's email (if accessible via the `read:me` or user search APIs) to Farm Table users, or prompting users to link their Atlassian accounts.

---

## 6. Operational Considerations

### Data volume and performance

- **Typical task count per workspace:** Tens of thousands to millions.
- **Bulk operations support:** Yes, `POST /rest/api/3/issue/bulk` for creation. Bulk updates via API are more complex.
- **Search/filter capabilities:** Extremely powerful via JQL. Almost any field can be queried and indexed.

### Error handling

- **Error response format:** JSON payload with `errorMessages` (array of strings) and `errors` (map of field-specific errors).
- **Common failure modes:** Validation errors (missing required custom field during transition/creation), 429 Rate Limited, 403 Forbidden (user lacks permission for a specific project).
- **Idempotency support:** Limited native idempotency keys, but webhooks and retry logic need to rely on timestamps or tracking previously processed issue keys.

### Platform-specific quirks

- **Issue Types vs. Projects:** Required fields, available fields, and workflows vary wildly not just by project, but by Issue Type *within* a project.
- **Transitions:** Updating a status is an action (Transition), not a state change. A transition can pop up a "screen" requiring more fields, blocking simple integrations.
- **Unified Parent:** Jira has recently migrated from `Epic Link` and `Parent Link` to a single `parent` field, but some older instances/APIs might still expose the legacy fields.

---

## 7. Integration Complexity Assessment

| Dimension | Complexity (Low / Medium / High) | Notes |
|-----------|----------------------------------|-------|
| Data model mapping | High | Endless variations in custom fields and required issue types. |
| API ergonomics | Medium | Well documented but highly verbose (e.g., ADF, offset pagination). |
| Auth setup | Medium | Standard OAuth 2.0 3LO, but token rotation and Atlassian-specific flows require care. |
| Status normalization | High | Workflow transitions are strict. Cannot arbitrarily set statuses. |
| Custom field handling | High | Fields are `customfield_XXXXX`; requires dynamic discovery and mapping. |
| Real-time sync | Medium | Webhooks exist, but API-registered ones expire in 30 days. |
| Overall | High | One of the most complex issue trackers due to extreme configurability. |

---

## 8. Open Questions

- Should we use the v2 API (Markdown) to avoid the ADF translation complexity, or strictly v3 (ADF) to future-proof the integration?
- How do we handle Jira transitions that require user input (e.g., a "Resolution" field must be set when moving to "Done")? Do we prompt the Farm Table user, or attempt to provide defaults?
- Do we support dynamic custom field mapping in the Farm Table UI, or just sync core fields and push the rest into `remote_data`?

---

## 9. References

- [Jira Cloud Platform REST API v3 Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [Atlassian Document Format (ADF)](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/)
- [OAuth 2.0 (3LO) for Apps](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)
- [Jira Webhooks Documentation](https://developer.atlassian.com/cloud/jira/platform/webhooks/)
