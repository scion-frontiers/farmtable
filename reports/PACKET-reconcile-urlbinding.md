# PACKET SECTION — CREDENTIAL EXPOSURE AND THE OFF-HOST MOVE

*Written for a reader with no prior context. No finding IDs. No credential value appears anywhere in
this document, in any form, including in examples.*

Every figure below is tagged **MEASURED**, **DERIVED**, or **UNCHECKED**. Nothing is a settled value
unless it says so. Section D lists the numbers that are **not** settled — read it before quoting any
figure from this work.

---

## A. WHAT THE CREDENTIAL EXPOSURE IS, IN PLAIN TERMS

**A live GitHub access token is stored in plain text in a configuration file on this machine.**

- **Where:** `/workspace/farmtable/.git/config` — the settings file belonging to the main working
  copy of the repository. **MEASURED.**
- **How it got there:** it is embedded in a remote URL, the address git uses to reach GitHub. Storing
  a token this way is a normal convenience; it means nobody has to type a password. It also means the
  token is a readable string in an ordinary file. **MEASURED.**
- **What kind of token:** a fine-grained personal access token, 93 characters. **MEASURED.**
- **Identification:** confirmed by cryptographic fingerprint against the value the coordinator already
  held — two independent fingerprints matched exactly (`d72bb520918e` and `fbefb3929dac`, the second
  being the same string with a trailing newline). **MEASURED.** These are one-way hashes; they
  identify the token without revealing it.
- **Verification controls:** the comparison was proven able to find a match (a known fingerprint was
  planted and found) and proven able to reject a non-match (a fabricated fingerprint was not found).
  **MEASURED.** So the match is not an artefact of a comparison that says yes to everything.

**What was NOT done, deliberately and permanently:** the token was never printed, never logged, never
copied, and **never used**. Its validity was not tested. Checking whether a credential still works
requires using it, and using it is the thing we are trying to prevent. Pattern-matching a file is not
authentication; that line was not crossed.

**Plain-language bottom line:** the token is sitting in a file. Nothing observed indicates it has left
this machine. But anything that copies that file, or the directory containing it, takes the token with
it.

---

## B. MOVE MECHANISMS — WHAT IS SAFE AND WHAT EXFILTRATES

If the repository needs to be moved off this machine, **the method decides whether the credential goes
with it.** This is not a detail. It is the decision.

| ✅ SAFE — does **not** carry the token | ❌ EXFILTRATES — **does** carry the token |
|---|---|
| `git bundle` | `cp -a` of the `.git` directory |
| `git clone` | `rsync` of the `.git` directory |
| `git push` | `tar` of the `.git` directory or the working folder |
| | `mv` of the `.git` directory |
| | any drag-and-drop, file-manager, or backup-tool copy of the folder |

**The rule in one line:** *git's own transfer commands rebuild the settings file at the destination and
do not copy the old one. Filesystem copies copy everything, including the settings file, including the
token.* **DERIVED** from the location finding; the location itself is **MEASURED**.

**Two further reasons a folder copy is worse than it looks:**

1. The working folder also contains **four additional complete working copies of the repository nested
   inside it** (under `.claude/worktrees`). **MEASURED.** A folder-level copy takes those too. Their
   existence was not known to any inventory taken during this investigation until it was specifically
   looked for.
2. A folder copy captures whatever else happens to be in the folder. The token is the exposure we
   found. It is not evidence that the token is the *only* thing there — see Section C.

**Standing prohibition currently in force:** any filesystem-level copy of a `.git` directory or a
working folder is prohibited outright. A refs-only move via `bundle` or `clone` remains gated pending
a decision from the escalation owner.

---

## C. THE CLEAN RESULT — AND EXACTLY WHAT IT DOES AND DOES NOT COVER

**The finding: the repository's stored history contains no tokens of this type. MEASURED.**

| what was checked | result |
|---|---|
| objects in the repository's history examined | **6,914** |
| objects that failed to read or produced any error | **0** |
| tokens of this type found in that history | **0** |

### Why this zero can be trusted, when most zeros cannot

A search that finds nothing looks identical to a search that never ran. This one was proven to work
**against the real token itself**: the exact same search pattern, run on the same machine, finds the
token in the configuration file. **MEASURED.**

> **The detector was proven against the genuine article, not against a test sample we invented.**
> Every other verification in this investigation was done with planted material, which only ever proves
> the tool can find *our idea* of the thing. This one proves it finds *the thing*.

### What this zero does NOT cover — read this before relying on it

- **It covers stored history only.** The configuration file is not part of stored history. **That is
  precisely why the search could not see the token, and why the token was found by a different
  method.** A clean history is not a clean machine.
- **It covers this one token format.** A credential in a different format — an SSH key, a password, a
  differently-shaped token — would not necessarily be caught by this pattern. **UNCHECKED.**
- **It covers this one repository's history.** **MEASURED** for the main repository. Other repositories
  on this machine were checked for database files, not for credentials. **UNCHECKED.**
- **It is a snapshot, not a standing state.** The repository is actively being written to by other work
  while this was measured (the object count rose from 6,894 to 6,914 during the investigation, and a
  working copy was written to at 10:00:28). **MEASURED.** Every figure here is an observation with a
  timestamp, not a permanent property.

---

## D. FIGURES THAT ARE **NOT** SETTLED — DO NOT QUOTE THESE AS FACTS

Listed so that no reader mistakes a published number for a verified one.

### D1. DECLARED, NOT CLEARED — nine measurements made with a technique that can silently report zero

These used a form that discards error messages. If the underlying command had failed, the result would
have been zero, **and zero would have looked like a clean answer.** They were not re-run. They are
probably fine. *Probably fine is not cleared.*

1. File counts within specific historical versions
2. A check for which references contain a particular commit
3. A count of commits reachable from a particular starting point
4. A sweep for database files across the machine
5. Two counts of total objects and internal directory structures *(one shape of this was later re-run
   clean; these two specific ones were not)*
6. Two lookups of a file's path inside repository history
7. A count of worktree registration configuration files

### D2. NUMBERS THAT MOVED, AND WHY

| figure | earlier | later | which variable moved |
|---|---|---|---|
| objects in history | 6,894 | **6,914** | the repository grew — **not** a measurement error |
| a category of references | 94 | **99** | the repository grew |
| local branches | 205 | **206** | the repository grew |
| my own command-audit total | 164 | **186** | my audit could not see its own most recent commands |

### D3. CORRECTIONS I MADE TO MY OWN WORK

- I initially reported that a search tool had been used unsafely **three times**. It was **zero**. My
  search was counting the *warnings about* the unsafe technique as *uses* of it. **Corrected.**
- I reported another count as **two**. It was **zero**. My pattern was miscounting a two-character
  symbol as a one-character one. **Corrected, verified by running it rather than by reading it.**
- I published a correction about measurement units that **was itself in the wrong units**. That
  incorrect correction was quoted onward before being caught. All counts in this work are now published
  in **both** units.
- One instance of a risky redirection did exist and my own audit's scope excluded it, because the
  question asked about a narrower case. Impact assessed and **benign**: error output went to the visible
  screen rather than being lost, the resulting file contains no error text, and no published figure
  depends on it. **MEASURED.**

### D4. THE HONEST CAVEAT ON EVERYTHING IN SECTION C

The error-checking re-runs came back clean. **They came back clean because every command happened to
succeed on this machine tonight. That is a property of this machine's current state, not a property of
the method.** The same method on a machine with a damaged repository would return the same reassuring
zeros for a different reason.

---

## E. THE ONE-LINE OPERATIONAL RECOMMENDATION

**Treat the token as exposed and rotate it.** It sits in plain text in a file that ordinary backup,
sync, and copy operations would capture, and it has been in that state for an unknown period —
**UNCHECKED**, and determining how long would require access to file history that was not available.
Rotation is the escalation owner's decision, not this investigation's.

Until that decision: **no filesystem-level copy of the repository folder or its `.git` directory,
by any tool, for any reason.**
