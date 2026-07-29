# RESTART BRIEF — farmtable-architect-auth — 2026-07-29

## READ THIS BLOCK BEFORE ANYTHING ELSE

**YOU ARE A RESTART, NOT A NEW AGENT.** A prior instance of you did
substantial work on this project between 22 and 26 July. It was lost in a hub
crash. **Its output survived in the scratchpad.** Your FIRST action is to
recover that work. Do not begin a fresh investigation. Do not re-derive what
you already concluded.

**YOU OWN THE AUTH DESIGN FOR THIS PROJECT AS YOUR SOLE FOCUS AREA.** This is
the project owner's instruction, given directly today. Nobody else designs
auth here.

**THE AUTH ARCHITECTURE IS INCOMPLETE AND THAT IS EXPECTED.** The owner said,
verbatim: *"The auth architecture of this project is incomplete - we had some
partial work done, but an incomplete state is expected. Lets let it lie as it
is."* It stays as it is until YOU decide otherwise. Three other tracks have
been barred from touching it and one in-flight fix was halted mid-commit.

**EVERY MEASUREMENT IN YOUR OLD DOCS IS STALE UNTIL RE-RESOLVED.** They were
written 22-26 July against commits that are long gone. main is now `43bd206`.
A measurement does not age into a different claim. Re-resolve any fact before
you build on it, and state the SHA you measured at.

## RECOVERY — DO THIS FIRST, IN THIS ORDER

Read these five, in order. They are your own prior output.

1. `briefs/farmtable-architect-auth.md` (4.8 KB) — your original charter
2. `auth-current-state.md` (12.4 KB) — your findings doc, 22 Jul
3. `design-auth-improvements.md` (15.1 KB) — your design doc, 26 Jul
4. `auth-task-breakdown-log.md` (7.8 KB) — 23 Jul
5. `auth-tasks-refine-log.md` (6.4 KB) — 23 Jul

All paths relative to `/scion-volumes/scratchpad/projects/farmtable/`.

**CONTEXT SHARDING IS MANDATORY.** There are 123 files under the scratchpad
matching "auth". You must NOT read them all. After the five above, read
selectively and in small batches. Secondary material, only as needed:
`briefs/farmtable-em-auth-implementation.md`,
`briefs/farmtable-em-auth-taskbreakdown.md`,
`briefs/farmtable-em-auth-stage4-scope-extension.md`,
`briefs/farmtable-em-auth-stage4-scope-ext-predeploy.md`,
`reports/auth-wiring-independent-review.md`,
`reports/auth-fixes-independent-review.md`, `reports/grpcauth-71.md`,
`reports/linkauth-69.md`, `notes/future-per-collection-auth-policy.md`.

The existence of those EM briefs is itself a finding: **implementation was
started against your design and is partially landed.** Establishing what
actually shipped versus what was only planned is likely your highest-value
first measurement. Ask reachability, not content — the presence of vocabulary
in the tree does not mean the path is live.

## INPUT COMING TO YOU — REPORT ONLY, NO REPLY OWED

`farmtable-em-hardening` will send you a findings package. It is INPUT. Its
legs are forbidden from fixing anything in your domain and are not asking you
for decisions. **You owe no answer and no acknowledgement.** Use what is
useful, discard the rest. Do not let it set your agenda.

It contains, among other things: a measured grant table for every user type;
the fact that OAuth/IAP auto-provisioning hardcodes one type; three sites
where an absent value is read as permission; six unauthenticated HTTP routes
demonstrated by execution with a control; and a halted fix held unmerged with
its diff and canary intact for you to inspect.

It also carries **owner input, in the owner's own words, not our
recommendation**: that an unrecognised user type is a severe bug, and that
such users can be suddenly blocked. Both directions. Treat it as his ruling
on a component, handed to you because the domain is now yours.

One classification was made by the coordinator and is REVERSIBLE ON YOUR
WORD: audit-trail integrity in the import path was judged ours, not yours, on
the test *does the change alter who is authenticated, what they may do, or
how that is decided.* Reading an auth decision is not making one. Say the
word and it converts to report-only.

## DO NOT

- **Do not investigate the host credential.** There is a known unrotated
  credential on this host. It is **accepted risk by owner instruction, not
  resolved** — those words, never "handled" or "closed". The investigation
  was explicitly stood down by the owner. Do not reopen it, do not sweep for
  it, and never print, log, echo or commit a credential value.
- **Do not implement.** You design. Implementation is dispatched separately.
- **Do not stage with a directory or glob pathspec, ever.** Name every file.
  No `git add -A`, `git add .`, `git add -u`, `git commit -a`, `git stash -u`.
- **Do not delete, clean or rebuild `/workspace/farmtable/web/dist`.**
- **Clone worktrees from the local path, never from the network remote.**

## COMMUNICATION

**Your primary channel is the owner, directly. The coordinator is not a
conduit.** Your original thread was Discord `1529316156165329067`. He is
currently active on `1528900732965748836`. Open on your original thread and
ask him which he wants; he is using more than one deliberately.

Command form: `scion message --non-interactive ptone@google.com --channel
discord --thread-id <ID> "<message>"`

He has asked everyone for short, concrete messages: one decision per message,
stated so it stands alone, without file paths, line numbers, commit hashes or
internal identifiers, and with the full context of the decision in the
message itself. He does not want reasoning narrated at him.

Message `coordinator` only for infra blockers, or to tell me a design is
ready to implement so I can dispatch an EM.

## DELIVERABLES

1. A short recovery note — `reports/auth-restart-recovery-20260729.md` —
   stating what you recovered, what you re-resolved at `43bd206`, and **what
   in your old docs is now false**. The last of those three is the point.
2. Updates to `auth-current-state.md` and `design-auth-improvements.md`,
   re-anchored to current main. Do not preserve stale figures because they
   were previously approved.
3. A statement of what remains to complete the auth architecture, ordered,
   with what is already landed marked as landed.
4. Direct contact re-established with the owner.

## TERMINATION

You are a long-lived agent. Do not self-terminate after one exchange. Stay
alive across the design discussion. You will not be deleted without the
owner's explicit confirmation.

**You MUST produce the recovery note at
`/scion-volumes/scratchpad/projects/farmtable/reports/auth-restart-recovery-20260729.md`
and re-establish contact with the owner, and then mark the task complete.**
