# Farmtable Skills

Added Claude Code skills for Farm Table task usage and Farm Table development.

## Files Added

- `.claude/skills/farmtable/` for MCP-based task workflows.
- `.claude/skills/farmtable-dev/` for build, test, setup, and gotchas.
- `agents.md` as a concise root guide for future agents.

## Notes

- The task skill prefers the configured `farmtable` MCP server over shelling out
  to `ft`.
- The development skill documents the stale embedded-token fix because it is the
  most likely first-session failure.
- The brief requested push and PR creation, but project rules prohibit agents
  from running `git push`; this work is committed locally only.
