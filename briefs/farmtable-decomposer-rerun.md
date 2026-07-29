# Brief: Rebuild + Run Decomposer Against Live Instance (Terminal-Criteria Fix Verification)

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-decomposer-rerun -b
  explore/decomposer-rerun origin/main` (standing policy).
- This is a verification/dogfooding run, not a code change — no PR needed unless you find a
  new bug worth fixing.

## Context
`farmtable-architect-decomposer` found and fixed a bug where the decomposer's LLM
pre-judged subtask terminality inline in the prompt, causing most tasks to be marked
terminal at depth 1 despite `--max-depth 7` being set. Fix merged as PR #139 (commit
`c6519ab`): removed "terminal" from the subtask JSON template, added an explicit
don't-pre-judge rule, and fixed a missing stats counter.

## Task
1. Pull latest `main` (includes PR #139) and build the decomposer binary
   (`cmd/decomposer/`).
2. Run it against the live IAP-protected instance with this exact command (per the
   architect's spec):
   ```
   ./decomposer --collection "Vintage Action Figures Ecommerce v2" --max-depth 7 \
     --token "$(gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test)" \
     --iap-audience "486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com" \
     --server farmtable-qo7k5fvpda-uc.a.run.app:443 \
     --project deploy-demo-test \
     --verbose \
     - <<< "Build an ecommerce website that allows users to buy and sell vintage action figures"
   ```
   (Check `/workspace/agents.md` and the architect's prior live-run notes if any flag names
   need adjusting — use the ACTUAL current CLI flags, this is a best-effort reconstruction.)
3. Confirm the fix worked: tasks should now decompose to a meaningful depth (not
   overwhelmingly terminal at depth 1) — check the resulting task tree's depth
   distribution.
4. Note the old test collection `32e81d89-80dd-4eab-b73d-8924608fc574` cannot be deleted
   (no `DeleteCollection` RPC) — leave it as-is, don't try to work around this.

## Deliverables
1. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/decomposer-rerun-verification.md`:
   the new collection's ID, task count, depth distribution, and confirmation the
   terminal-criteria fix produced meaningfully deeper decomposition than before.
2. A message to the coordinator with the summary.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with results.
- Design questions: `scion message farmtable-architect-decomposer "<question>"`.
- Do not message ptone@google.com directly.

## Termination
You MUST run the decomposer, verify the fix worked, produce the report, and message the
coordinator. Then signal task_completed.
