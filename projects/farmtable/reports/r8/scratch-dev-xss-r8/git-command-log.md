# git/verification command log — every invocation is a WRITE

| UTC | tree | command |
|---|---|---|
| 2026-07-29T09:57:29Z | /workspace/farmtable-xss-r8 | git status --porcelain -uall |
| 2026-07-29T09:57:29Z | /workspace/farmtable-xss-r8 | git diff HEAD --stat |
| 2026-07-29T09:57:29Z | /workspace/farmtable-xss-r8 | git diff af9ea8c --stat |
| 2026-07-29T09:57:37Z | /workspace/farmtable-xss-r8 | git check-ignore -v web/.tmp-test web/node_modules web/dist |
| 2026-07-29T10:00:28Z | /workspace/farmtable-xss-r8 | git status --porcelain -uall (final) |
| 2026-07-29T12:36:51Z | /workspace/farmtable-xss-r8 | git status --porcelain -uall (post-build) |
| 2026-07-29T12:44:19Z | /workspace/farmtable-xss-r8 | git status --porcelain -uall --ignored (contamination audit) |
| 2026-07-29T12:48:12Z | /workspace/farmtable-xss-r8 | git log --oneline -1 (HEAD 901670e) |
| 2026-07-29T12:48:12Z | /workspace/farmtable-xss-r8 | git status --porcelain -uall (EMPTY; pre-commit check before the Bulletin 19.1 strike commit) |
| 15:43:10Z | farmtable-xss-r8 | git fsck --unreachable --dangling --no-progress (result: 0 commits) |
| 15:44:02Z | farmtable-xss-r8 | git rev-list --objects e4e3d13..07f12a3 (89 objects) |
| 15:44:05Z | /workspace/farmtable | git cat-file --batch-check over 89 objects (0 missing) + negative control |
| 15:44:40Z | farmtable-xss-r8 | git for-each-ref (bare) = 2280 refs; salvage 463, em-ci 45 |
| 15:44:52Z | farmtable-xss-r8 | git bundle create /tmp/probe.bundle --all (rc=0, 4496196 bytes) |
| 15:45:30Z | /tmp/probe-restore.git | git init --bare; git fetch /tmp/probe.bundle refs/*:refs/* (rc=0); for-each-ref = 2280 |
| 15:46:25Z | farmtable-xss-r8 | git for-each-ref (bare) = 2045 refs; salvage 228 -- DELETION DETECTED, 235 gone |
| 15:47:10Z | farmtable-xss-r8 | git rev-list over 2045 live tips; 0 of 172 deleted-ref SHAs orphaned |
| 15:47:40Z | farmtable-xss-r8 | git for-each-ref --contains (3 samples) -> refs/em-audit/salvage/* |
