# dev-xss-r9 — 14 orphan objects, no commit reachable

Pack: `dev-xss-r9-orphan-objects.pack`, 30,679 bytes. Restore-verified 14/14
into an empty bare repo, with a negative control (`rc=1`) and canonical main
also `rc=1`, proving the pack holds only these 14.

Found by the OBJECT-TYPED gate. The commit-typed gate returned **0 absent over
1066 commits** on the same store, minutes earlier. No commit-shaped enumerator
of any spelling returns these.

Population 7,359 objects; 14 absent from `/workspace/farmtable`:
**8 trees, 6 blobs, 0 commits.**

Restore with: `git unpack-objects < dev-xss-r9-orphan-objects.pack`

| object | type | bytes | what it is |
|---|---|---|---|
| `678fac55eb25` | blob | 3,653 | **Makefile mid-merge conflict state**, begins `<<<<<<< HEAD` |
| `e8d311102c42` | blob | 3,755 | **Makefile mid-merge conflict state**, begins `<<<<<<< HEAD`, the variant carrying `test-changed suite-manifest` |
| `cc443aad9b3d` | blob | 38,442 | superseded revision of `reports/dev-xss-union.md` |
| `b8904e5afaa1` | blob | 15,186 | superseded revision of the r8 fix-leg log |
| `99c794ee7919` | blob | 530 | `tsconfig.test.json` variant |
| `ed2cb91f0e7d` | blob | 901 | `web/package.json` variant |
| 8 trees | tree | 386–5,027 | the directory states those blobs hung from |

The two conflict-state Makefiles are the interesting ones: they are the only
record of what the merge actually looked like before resolution, and they exist
in no commit by construction — a resolved merge records the resolution, never
the conflict.
