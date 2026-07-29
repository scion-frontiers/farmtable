# PRE-REGISTRATION: expected web test file NAME SET after the task-state merge

Written 2026-07-29, BEFORE enumerating the merged tree.

Ordered by coordinator 15:47:40Z: "Pre-register step 1 BEFORE you look at step 2. If you
enumerate first and then write down what you expected, you have written down what you found."

## Provenance of this prediction

Derived from THE TWO PARENTS AND THE MERGE BASE ONLY. Merged tree
42a71d84294421fca73121c6e68be5c9d19fb5ba has NOT been enumerated at the time of writing.

    parent A (main)   2982ffd8f3f6e231d8855b9cae7c448c2bd3144f   6 web test files
    parent B (branch) e64138c058ad707d2b08b3a213cfa63c17c8e953  26 web test files
    merge base        aa08f1ae8ca972f463215f76113c121c4578ce70   1 web test file

Predicate used (same one on both parents):

    git ls-tree -r --name-only <rev> -- web | grep -E '\.(test|spec)\.[tj]s$' | sort

## WHY THE UNION IS THE RIGHT PREDICTION

A merge deletes a path only if one side deleted it relative to the merge base. The base
contains exactly ONE web test file, web/src/utils/task-ready.test.ts, and it is present in
BOTH parents. Therefore no side deletes anything, and the merged name set is the union.

This is the step that matters, because the coordinator's canary (5d9df1f) showed a green
gate on a commit that deleted a web test. A floor is a scalar and a manifest is a set.

## EXPECTED: 30 FILES

### In BOTH parents (2) — arrive unchanged in name; content differs
    web/src/util/safe-url.test.ts          <- CARVE-OUT, content held for em-hardening
    web/src/utils/task-ready.test.ts       <- the base file; ALSO the file em-ci deleted
                                              in canary 5d9df1f to produce a green

### From main 2982ffd only (4) — must SURVIVE the merge
    web/src/capabilities.test.ts
    web/src/components/inspector/render-sink-xss.test.ts
    web/src/util/assertions.test.ts
    web/src/util/url-binding-scan.test.ts

### From branch e64138c only (24) — must ARRIVE in the merge
    web/src/util/rank.test.ts
    web/src/util/task-state-utils.test.ts
    web/test/attention-view.test.ts
    web/test/ft-app.write-error-seam.test.ts
    web/test/ft-app.write-error.test.ts
    web/test/ft-dashboard-view.test.ts
    web/test/ft-filter-chips.test.ts
    web/test/ft-inspector-changes.vocabulary.test.ts
    web/test/ft-inspector-code.safe-url.test.ts
    web/test/ft-inspector-header.availability.test.ts
    web/test/ft-inspector-meta.safe-url.test.ts
    web/test/ft-inspector-meta.state.test.ts
    web/test/ft-inspector-relationships.test.ts
    web/test/ft-kanban-view.contract.test.ts
    web/test/ft-kanban.drop-refusal-affordances.test.ts
    web/test/ft-ready-queue-view.availability.test.ts
    web/test/ft-ready-queue-view.concurrent-reorder.test.ts
    web/test/ft-ready-queue-view.rank-adversarial.test.ts
    web/test/ft-ready-queue-view.rank.test.ts
    web/test/ft-task-card.attention.test.ts
    web/test/ft-toolbar.contract.test.ts
    web/test/queue-ordering.test.ts
    web/test/safe-url.contract.test.ts
    web/test/vocabulary.contract.test.ts

    2 + 4 + 24 = 30

## TWO INTEGERS WEARING ONE NAME — DO NOT CONFLATE (task #342 shape)

This "30" is the WEB TEST FILE NAME SET.
The other "30" already in the merge record is the MERGE POPULATION OF ALL PATHS.
They are different sets that coincidentally share a cardinality. The merge commit body
must label each with its predicate, never as a bare 30.

## THE CARVE-OUT DOES NOT MOVE THIS SET

web/src/util/safe-url.test.ts is add/add (stages 2 and 3, NO stage 1). Its CONTENT is
unresolved and held for em-hardening. Its NAME is present in both parents either way, so
the name-set prediction is independent of how the carve-out is resolved. If the merged
tree is missing this NAME, that is a different and worse failure than a bad resolution.

## FALSIFIERS, committed in advance

- Fewer than 30, or any main-only name absent  -> a survival failure. STOP, tell coordinator.
- Any branch-only name absent                  -> an arrival failure. STOP, tell coordinator.
- More than 30                                 -> an unexpected arrival. STOP, tell coordinator.
- Exactly these 30                             -> report as AN EMPTY DIFF AGAINST A STATED
                                                  EXPECTATION, explicitly NOT as "a green".
