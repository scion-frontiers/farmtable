# Integration Research: {Platform Name}

> Research template for evaluating a Farm Table integration target.
> Copy this file to `{platform-name}.md` and fill in each section.

---

## 1. Platform Overview

- **Platform:** {Platform Name}
- **Tier:** {1 — Launch Target / 2 — Future Candidate}
- **Primary users:** {Who uses this platform and why}
- **Archetype tested:** {What integration pattern this platform validates for Farm Table}

---

## 2. Data Model

### Native task structure

- **Task entity name:** {e.g., Issue, Task, Story, Card}
- **Identifier format:** {e.g., integer, UUID, alphanumeric key like PROJ-123}
- **Hierarchy model:** {e.g., Epic → Story → Sub-task, Portfolio → Project → Section → Task}
- **Maximum nesting depth:** {number of levels supported}
- **Description format:** {e.g., Markdown, HTML, Atlassian Document Format}

### Fields and metadata

- **Built-in fields:** {list core fields: title, description, status, priority, assignee, due date, labels, etc.}
- **Custom fields:** {how custom fields work — types supported, scoping rules, inheritance behavior}
- **Required fields:** {which fields are mandatory for task creation, and whether this is configurable}

### Relationships and dependencies

- **Supported relationship types:** {e.g., blocks, blocked-by, related, duplicate, parent-child}
- **How relationships are modeled:** {e.g., first-class API objects, label conventions, linked issues}
- **Cross-project references:** {can tasks reference or link to tasks in other projects/workspaces?}

### NTO mapping considerations

- **Status mapping to OPEN / IN_PROGRESS / ON_HOLD / CLOSED:** {list native statuses and which NTO state they map to; note any ambiguous cases}
- **Priority mapping to URGENT / HIGH / NORMAL / LOW:** {native priority levels and proposed mapping}
- **Assignee model:** {single assignee, multiple assignees, teams/groups}
- **Fields with no NTO equivalent:** {native fields that don't map cleanly and may need `remote_data` passthrough}
- **NTO fields with no native equivalent:** {normalized fields the platform doesn't support natively}

---

## 3. API Surface

### API architecture

- **API style:** {REST, GraphQL, or both}
- **Base URL pattern:** {e.g., `https://api.github.com`, `https://linear.app/api`}
- **API versioning strategy:** {e.g., URL path versioning, header-based, date-based}
- **Documentation URL:** {link to official API docs}

### Key endpoints / operations

| Operation | Method / Query | Notes |
|-----------|---------------|-------|
| List tasks | {endpoint or query name} | {pagination style, filter support} |
| Get task detail | {endpoint or query name} | {compact vs. full representations?} |
| Create task | {endpoint or query name} | {required fields, validation rules} |
| Update task | {endpoint or query name} | {partial update support, field-level locking} |
| Transition status | {endpoint or query name} | {workflow constraints, allowed transitions} |
| Add comment | {endpoint or query name} | {format, threading support} |
| List relationships | {endpoint or query name} | {how dependencies are queried} |

### Pagination

- **Strategy:** {cursor-based, offset-based, page-number-based}
- **Default page size / max page size:** {numbers}
- **Total count available?** {yes/no, and how}

### Rate limiting

- **Rate limit model:** {e.g., requests per minute, token bucket, per-user vs. per-app}
- **Documented limits:** {specific numbers}
- **Rate limit headers:** {which headers indicate remaining quota}
- **Recommended backoff strategy:** {exponential with jitter, retry-after header, etc.}

### Webhooks / real-time updates

- **Webhook support:** {yes/no}
- **Event types available:** {e.g., task.created, task.updated, comment.added}
- **Webhook registration method:** {API, UI, both}
- **Payload format:** {summary of what's included}
- **If no webhooks:** {polling strategy, virtual webhook feasibility}

---

## 4. Authentication & Authorization

### Auth model

- **Supported auth methods:** {e.g., OAuth 2.0, API key, PAT, JWT, service account}
- **Recommended method for Farm Table:** {which method and why}
- **OAuth grant type:** {e.g., Authorization Code + PKCE, Client Credentials}
- **Token lifecycle:** {access token TTL, refresh token behavior, revocation}

### Scopes and permissions

- **Available scopes:** {list relevant scopes for read/write task access}
- **Minimum scopes required for Farm Table:** {the least-privilege set}
- **Granularity:** {org-level, project-level, per-resource}
- **Can scopes be narrowed after initial grant?** {yes/no}

### Service accounts / machine users

- **Bot/app user model:** {how the platform represents non-human actors}
- **Audit trail:** {are actions by service accounts distinguishable from human actions?}
- **Account lifecycle:** {creation, suspension, deletion of machine users}

---

## 5. Normalization Challenges

### Status mapping complexity

- **Custom workflow states:** {can teams define arbitrary statuses? How many?}
- **Workflow transition constraints:** {are there rules about which status changes are allowed?}
- **Default vs. custom workflows:** {is there a standard set, or is everything custom?}

### Custom field handling

- **Field types supported:** {text, number, date, single-select, multi-select, user, etc.}
- **Field discovery mechanism:** {how to enumerate available custom fields via API}
- **Mapping strategy:** {how custom fields should be preserved in `remote_data` or mapped declaratively}

### Content format translation

- **Native format:** {Markdown, HTML, ADF, rich text, plain text}
- **Conversion to/from Markdown:** {difficulty level, known lossy conversions, library support}

### Identity resolution

- **User identifier format:** {e.g., integer ID, UUID, email, username}
- **Cross-referencing with Farm Table identity:** {how to map platform users to NTO assignees}

---

## 6. Operational Considerations

### Data volume and performance

- **Typical task count per workspace:** {rough scale — hundreds, thousands, tens of thousands}
- **Bulk operations support:** {batch create/update endpoints?}
- **Search/filter capabilities:** {query language, indexed fields}

### Error handling

- **Error response format:** {structured JSON errors, HTTP status conventions}
- **Common failure modes:** {permission denied, not found, rate limited, validation errors}
- **Idempotency support:** {idempotency keys, safe retries}

### Platform-specific quirks

- {Anything unusual about this platform's API behavior, data model, or limitations that doesn't fit above}
- {Known bugs, undocumented behavior, or gotchas from community/docs}

---

## 7. Integration Complexity Assessment

| Dimension | Complexity (Low / Medium / High) | Notes |
|-----------|----------------------------------|-------|
| Data model mapping | | |
| API ergonomics | | |
| Auth setup | | |
| Status normalization | | |
| Custom field handling | | |
| Real-time sync | | |
| Overall | | |

---

## 8. Open Questions

- {Questions that need answers before implementation can begin}
- {Unknowns that require hands-on API exploration or vendor clarification}

---

## 9. References

- {Link to official API documentation}
- {Link to SDK / client library if applicable}
- {Link to relevant community resources, blog posts, or integration guides}
