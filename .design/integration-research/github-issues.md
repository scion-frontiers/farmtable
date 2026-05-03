# Integration Research: GitHub Issues

> Research template for evaluating a Farm Table integration target.

---

## 1. Platform Overview

- **Platform:** GitHub Issues
- **Tier:** 1 — Launch Target
- **Primary users:** Software engineering teams, open-source communities, and product managers (using Projects V2).
- **Archetype tested:** Code-adjacent task tracking, validating the pattern where work items live right next to the source code, pull requests, and commit history.

---

## 2. Data Model

### Native task structure

- **Task entity name:** Issue (and potentially `ProjectV2Item` for extended project metadata).
- **Identifier format:** `Issue.number` (repo-scoped integer, e.g., `#123`) and `Issue.id` (global node ID, used extensively in GraphQL). Usually presented to users as `owner/repo#123`.
- **Hierarchy model:** `Issue -> Sub-issue` (recent addition to GitHub). Historically, hierarchy was modeled via tasklists within the description. There are also `Milestone -> Issue` and `Project -> Item (Issue/PR)` groupings.
- **Maximum nesting depth:** Technically nested parent-child (Parent > Child > Grandchild). Sub-issues can be deeply nested.
- **Description format:** GitHub Flavored Markdown (GFM).

### Fields and metadata

- **Built-in fields:** `title`, `body` (description), `state` (open/closed), `state_reason` (completed, not_planned, reopened), `labels`, `assignees`, `milestone`.
- **Custom fields:** Exclusively handled via GitHub Projects (V2). Issues themselves do not have native custom fields. Projects associate an Issue (`ProjectV2Item`) with fields (Text, Number, Date, Single-select, Iteration).
- **Required fields:** Only `title` is mandatory for issue creation.

### Relationships and dependencies

- **Supported relationship types:** Parent/Child (Sub-issues), Linked Pull Requests (Closing references, e.g., `Closes #123`), general markdown body `#issue` cross-references.
- **How relationships are modeled:** First-class `subIssues` connections via GraphQL and REST endpoints. Links parsed from the body markdown. Linked pull requests are accessible via `timelineItems`.
- **Cross-project references:** Yes, issues can reference issues in other repositories and organizations.

### NTO mapping considerations

- **Status mapping to OPEN / IN_PROGRESS / ON_HOLD / CLOSED:**
  - Native `open` -> `OPEN`
  - Native `closed` (reason: `completed`) -> `CLOSED`
  - Native `closed` (reason: `not_planned`) -> `ON_HOLD` or `CLOSED`
  - *Ambiguity:* Teams using GitHub Projects V2 often have "Status" single-select fields that map to `IN_PROGRESS`, `ON_HOLD`, etc., which overrides the binary native state.
- **Priority mapping to URGENT / HIGH / NORMAL / LOW:** No native priority field on issues. Relies on custom labels (e.g., `priority: high`) or Project V2 custom fields. NTO mapping will require a configurable strategy.
- **Assignee model:** Multiple assignees per issue (up to 10). Can be individual users (no direct team assignment natively, though teams can be mentioned).
- **Fields with no NTO equivalent:** `milestone`, `labels` (could potentially map to NTO tags/labels if supported).
- **NTO fields with no native equivalent:** `priority` (requires Labels/Projects workaround), `due_date` (available in Projects, not natively on Issues except via Milestones).

---

## 3. API Surface

### API architecture

- **API style:** Both REST (v3) and GraphQL (v4). GraphQL is required for Projects V2 and highly recommended for deep hierarchies.
- **Base URL pattern:** `https://api.github.com` (REST), `https://api.github.com/graphql` (GraphQL).
- **API versioning strategy:** Header-based (`X-GitHub-Api-Version: 2022-11-28`) and Media Type (Accept headers for previews).
- **Documentation URL:** [GitHub REST API](https://docs.github.com/en/rest) / [GitHub GraphQL API](https://docs.github.com/en/graphql)

### Key endpoints / operations

| Operation | Method / Query | Notes |
|-----------|---------------|-------|
| List tasks | REST: `GET /repos/{owner}/{repo}/issues` | Supports pagination, filtering by assignee, label, state. |
| Get task detail | REST: `GET /repos/{owner}/{repo}/issues/{issue_number}` | Also accessible via GraphQL `repository.issue`. |
| Create task | REST: `POST /repos/{owner}/{repo}/issues` | Requires `title`. |
| Update task | REST: `PATCH /repos/{owner}/{repo}/issues/{issue_number}` | Partial updates supported. |
| Transition status | REST: `PATCH ...` with `state` | Also supports `state_reason`. |
| Add comment | REST: `POST /repos/{owner}/{repo}/issues/{issue_number}/comments` | Markdown body. Linear threading. |
| List relationships| GraphQL: `issue.subIssues` | Sub-issues are accessible via both REST and GraphQL connections. |

### Pagination

- **Strategy:** REST uses `Link` headers (page-based or cursor-based depending on endpoint). GraphQL uses Relay-compliant cursor-based pagination (`first`, `after`).
- **Default page size / max page size:** Default is typically 30; Max is 100 for REST and GraphQL.
- **Total count available?** Yes, REST returns `total_count` in search endpoints. GraphQL connections have `totalCount`.

### Rate limiting

- **Rate limit model:** Requests per hour per authenticated entity.
- **Documented limits:** 5,000 requests/hr for Personal Access Tokens. 15,000 requests/hr for server-to-server GitHub Apps. GraphQL calculates points (typically 5,000 points/hr).
- **Rate limit headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- **Recommended backoff strategy:** Respect `X-RateLimit-Reset` and standard HTTP 403 `Retry-After`.

### Webhooks / real-time updates

- **Webhook support:** Yes, excellent support.
- **Event types available:** `issues` (opened, edited, deleted, closed, reopened, assigned, labeled, etc.), `issue_comment` (created, edited, deleted).
- **Webhook registration method:** UI and API.
- **Payload format:** JSON payload containing the event `action`, the `issue` object state, `sender`, and `repository`.

---

## 4. Authentication & Authorization

### Auth model

- **Supported auth methods:** GitHub Apps, OAuth Apps, Personal Access Tokens (PAT).
- **Recommended method for Farm Table:** **GitHub App**. Provides fine-grained repository permissions and acts as a primary integration point natively supported by GitHub. Allows both user-to-server (impersonation) and server-to-server (background sync) tokens.
- **OAuth grant type:** Authorization Code (for user-to-server) or Private Key JWT signing to generate an Installation Token (for server-to-server).
- **Token lifecycle:** User-to-server access tokens expire after 8 hours; refresh tokens last 6 months. Installation tokens expire after 1 hour.

### Scopes and permissions

- **Available scopes:** GitHub Apps use granular permissions instead of global OAuth scopes. Relevant permissions: `Issues: Read & Write`, `Metadata: Read`, `Projects: Read & Write`.
- **Minimum scopes required for Farm Table:** `Issues: Read & Write`.
- **Granularity:** Configurable down to the specific repository during installation.
- **Can scopes be narrowed after initial grant?** Users configure repository access per installation; app developers declare the necessary permissions.

### Service accounts / machine users

- **Bot/app user model:** GitHub Apps act as their own identity (with a `[bot]` suffix, e.g., `farm-table[bot]`) when using server-to-server installation tokens.
- **Audit trail:** Actions taken by a GitHub app show the App's badge and avatar. User-to-server tokens show the user's avatar but indicate the action was performed via the App.
- **Account lifecycle:** App installations can be suspended or removed entirely by repository/organization admins.

---

## 5. Normalization Challenges

### Status mapping complexity

- **Custom workflow states:** GitHub Issues are natively binary (Open/Closed). However, GitHub Projects V2 allows custom single-select "Status" fields with arbitrary options.
- **Workflow transition constraints:** None natively on the Issue object.
- **Default vs. custom workflows:** Standard GitHub is just Open/Closed. Projects V2 relies heavily on custom workflows defined per-project.

### Custom field handling

- **Field types supported:** Handled via Projects V2 (Text, Number, Date, Single-select, Iteration).
- **Field discovery mechanism:** Must query the specific `ProjectV2` object via GraphQL to enumerate available fields and their Node IDs.
- **Mapping strategy:** Custom fields exist completely outside the `Issue` model, in the `ProjectV2Item` model. Finding custom fields requires knowing which Project the issue is attached to, requiring complex graph traversal.

### Content format translation

- **Native format:** GitHub Flavored Markdown (GFM).
- **Conversion to/from Markdown:** Low difficulty since it's already Markdown. However, preserving GitHub-specific embeds (e.g., commit SHAs, team mentions) requires care to ensure they render correctly externally.

### Identity resolution

- **User identifier format:** Integer ID (`id`) and username (`login`).
- **Cross-referencing with Farm Table identity:** NTO mapping requires matching on public email (if available) or requiring the user to explicitly map GitHub usernames to Farm Table identities, as emails are often private.

---

## 6. Operational Considerations

### Data volume and performance

- **Typical task count per workspace:** Tens of thousands of issues per repository are common in open-source projects.
- **Bulk operations support:** Limited. No true REST bulk create/update for issues. GraphQL allows query aliases to batch mutations in a single request.
- **Search/filter capabilities:** Powerful search API (Lucene-like syntax) via REST `/search/issues` and GraphQL `search`. Highly indexed.

### Error handling

- **Error response format:** Structured JSON errors.
- **Common failure modes:** 403 Forbidden (Rate limits or permissions), 404 Not Found (Missing repos), 422 Unprocessable Entity (Validation errors).
- **Idempotency support:** REST API lacks formal idempotency keys. GraphQL mutation requests generally require unique identifiers.

### Platform-specific quirks

- **Sub-issues Preview:** Sub-issues are a newly introduced feature (in Public Preview) and their APIs/behavior may shift.
- **Issue vs. PR ambiguity:** In the GitHub API, every Pull Request is also an Issue (but not every Issue is a PR). Listing issues will return PRs unless explicitly filtered out (e.g., checking for the `pull_request` key).
- **Fragmented Metadata:** The severe divergence between Issue metadata (labels, milestones) and Project V2 metadata (custom fields, custom status) requires fetching from multiple different graphs and reconciling them.

---

## 7. Integration Complexity Assessment

| Dimension | Complexity (Low / Medium / High) | Notes |
|-----------|----------------------------------|-------|
| Data model mapping | Medium | Split between Issues and Projects V2. |
| API ergonomics | Low | Extremely mature, well-documented API. |
| Auth setup | Medium | GitHub Apps (JWT + Installation tokens) are powerful but complex to implement. |
| Status normalization | High | Ambiguity between native Open/Closed and Projects V2 custom statuses. |
| Custom field handling | High | Requires GraphQL and traversing the ProjectV2 item graph. |
| Real-time sync | Low | Webhooks are reliable and granular. |
| Overall | Medium | |

---

## 8. Open Questions

- Should the integration only sync standard Issue states, or explicitly support syncing Projects V2 single-select fields as NTO Statuses?
- How do we handle issues that belong to multiple Projects simultaneously (and therefore have multiple different custom status fields)?
- Do we need to sync Pull Requests into Farm Table, or strictly filter for `is:issue`?
- What is our strategy for handling GitHub Sub-issues given they are currently in public preview?

---

## 9. References

- [GitHub REST API - Issues](https://docs.github.com/en/rest/issues)
- [GitHub GraphQL API Explorer](https://docs.github.com/en/graphql)
- [Building a GitHub App](https://docs.github.com/en/apps/creating-github-apps)
- [Managing Projects with the GraphQL API](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)