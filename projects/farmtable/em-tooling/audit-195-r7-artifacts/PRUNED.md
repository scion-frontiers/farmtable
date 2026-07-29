# Prune note — audit-195-r7 artifacts

Copied out of the agent container's `/tmp/audit-r7/` before GC, because the reproduction
artifacts (especially `predictions.md`) were the only evidence that P1–P9 preceded their
measurements, and `/tmp` dies with the container.

**Pruned by the EM after the copy landed:** `sb/node_modules` and `sb2/node_modules`.

| | files | size |
|---|---|---|
| as copied | 23201 | 266M |
| after prune | 4437 | 25M |

**Precondition asserted before deleting anything:** `package-lock.json` present in BOTH
sandboxes, so `npm ci` reproduces the pruned trees byte-for-byte. The prune aborts rather
than proceeding if either lockfile is absent, or if the `node_modules` glob matches zero
directories (a zero match would otherwise report a successful prune that did nothing).

**Manifest re-verified after the prune, not just before it** — all 12 load-bearing paths
still present, including the two lockfiles and `sb/src/components/ft-empty-state.ts`
(the F-1 split-specifier PoC) and `sb/vite.config.ts` (the F-4 `transformIndexHtml` PoC).
Checking a manifest only before a destructive step tells you what you *intended* to keep.
