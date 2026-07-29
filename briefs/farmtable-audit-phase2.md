# audit-phase2 — security audit, full Phase 2 web UI line

Read `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-phase2-review-context.md` first. It has the range, the standing bars, and — importantly for you — what is already live and therefore not a Phase 2 defect.

Workspace: `/workspace/farmtable-audit-phase2`, branch `task-state-web-ui-v2` at `633f8f2`.

## Start here, because it will otherwise dominate your findings

The unhardened `renderMarkdown` — bare `DOMPurify.sanitize(marked.parse(md))`, no `FORBID_TAGS`, no `FORBID_ATTR` — is in this line, and both `unsafeHTML` sinks (`ft-inspector-comments.ts:221`, `ft-inspector-desc.ts:233`) are in it too.

**I verified all of that is already on `origin/main` and already live in production.** Phase 2 neither introduces nor worsens it. It is being fixed on a separate branch (#195, `markdown-sanitize`) that merges ahead of Phase 2. Do not file it against Phase 2.

What I *do* want: whether Phase 2 **adds any new path** into those sinks, or any new attacker-controlled string that reaches `unsafeHTML`, or any new shadow-root context where sanitized-but-class-bearing markup could forge UI. That is a genuine Phase 2 question and the answer is not obvious across 73 files.

## What I want from you specifically

1. **New attacker-controlled data reaching the DOM.** 39 commits of new UI. Enumerate what is newly rendered and where it comes from — task titles, descriptions, comments, labels, hold reasons, assignee names, blocker titles surfaced by the new attention view. Any of it rendered unescaped, used in an attribute position, or interpolated into a `title`/`aria-label`?
2. **The attention view's new data flow.** It reaches *through* relationships to read a blocker task's stage and surfaces blocker information in a panel and a dashboard tile. Does it surface any task the current user should not see? Is there any authorization assumption in the web layer that the store does not actually enforce?
3. **URL and navigation surface.** The dashboard tile dispatches `view-change` then `filter-change`, and the app reads `?view=` from the URL. Check for open-redirect, state injection via query params, and anything that lets a crafted link put the UI into a misleading state. There is an existing `safe-url` contract test — check its coverage is real and binding, not a self-built oracle.
4. **Supply chain.** `npm audit --audit-level=low` reports 0, which I verified. Go past that: any new dependency added across the 39 commits, what it is for, whether it is dev-only, and whether it can reach production. The `//go:embed all:web/dist` directive means **anything in `dist/` ships inside the Go binary** — so "dev-only" must be proven, not assumed.
5. **#196 adjacent.** I verified `sourcemap: false` and 0 `*.map` on this branch. Confirm nothing else in the build pipeline leaks source, comments, or internal identifiers into `dist/`.

## Severity discipline

Rate honestly and say what is exploitable versus theoretical. Earlier in this workstream a real HIGH was nearly missed because only one report was read; equally, an overstated finding cost a round. State your proof-of-concept for anything Medium or above, and mark clearly whether you executed it or reasoned it.

## Deliverable

A report at `/scion-volumes/scratchpad/projects/farmtable/reports/audit-phase2.md` with a severity table, a clear verdict, `file:line` refs, and PoCs for Medium-and-above.

Do not push. Do not modify production code. You MUST write the report at that exact path and then mark the task complete.
