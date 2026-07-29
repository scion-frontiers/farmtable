# THE PARKED-ITEM OWNER AUDIT
## Applying the coordinator's test to my own record, 2026-07-29
## "A DEFERRAL WHOSE TRIGGER HAS NO OWNER IS NOT A DEFERRAL, IT IS A DELETION WITH A RECEIPT."

### THE MEASUREMENT

215 tasks. 7 carry status in_progress: #1, #3, #72, #84, #85, #93, #97.
Of those 7, exactly ONE has a NAMED AGENT who fires its trigger: #93, and only because the
coordinator assigned importtrust-f7d to it thirty minutes ago, in the same message that stated
the rule.

** FOR EVERY OTHER ITEM IN THIS RECORD THE TRIGGER IS A PASSIVE CONSTRUCTION. ** "at merge time."
"next round." "follow-up." "once X is prioritized." "route to #197." I did not have to sample for
this; the passive voice is the house style of my own titles.

I am NOT reporting a count of the passive ones. A count of an uninspected population is form (10)
and I have committed it twice tonight already. The claim is a MEMBERSHIP claim about the severity-
bearing subset below, which I enumerated by reading titles, and the enumeration is bounded only by
what a title reveals -- an item whose title omits its severity is invisible to this pass and I have
not measured how many of those exist.

### THE SEVERITY-BEARING SUBSET, ALL WITH NO NAMED TRIGGER OWNER

CRITICAL / BLOCKING
  #53   [CRITICAL] #194 r8 C-1 label-write authz bypass
  #136  [CRITICAL] #194 r10 C-1 -- the fix REOPENS the class, task:write closes a task for FREE
  #97   [CRITICAL] url-scheme-validation fails the PRODUCTION CONTAINER BUILD (in_progress, no agent)
  #40   [BLOCKING] #195 r8 F-1 split module specifier -> arbitrary script execution
  #41   [BLOCKING] #195 r8 F-2 false narrowing in a production comment
  #59   [BLOCKING] #195 r9 the C7-l fix is itself bypassed
  #61   [BLOCKING] #195 r9 T-2, B3a ships with NO regression pin -- reverting it is GREEN
  #107  [CONVERGENT BLOCKING] #194 r9, 2 of 2 legs

HIGH
  #93   ImportCollection -> wildcard escalation, invisible in CLI/dashboard/MCP   ** OWNED **
  #98   bare task:write durably writes a lifecycle label that becomes authoritative on flip-on
  #102  the XSS fix does not close the harm it names -- markdown still emits attacker-chosen href
  #57   writeLabelSwap's error propagation, the entire behavioural change of r7, unpinned repo-wide
  #84   NO path in this repo runs the markdown guard (in_progress, no agent)
  #108  the #194 ruling covers THREE gates, not one

MEDIUM AND STRUCTURAL, LIVE IN PRODUCTION OR IN THE BUILD
  #22   NO CI EXISTS ANYWHERE IN THE REPO. Escalated. Never actioned.
  #100  go build/test/vet ALL fail on a fresh clone -- every Go gate ever reported was contingent
        on untracked web/dist
  #103  #195 and the XSS branch have MUTUALLY EXCLUSIVE npm test lists; resolving either way
        silently deletes a whole suite, exit 0
  #109  Encrypt() stores a credential in PLAINTEXT on caller-controlled input
  #143  hasExternalUnavailableLabel is a FOURTH authoritative path, unpriced in both directions
  #163  the two widest-policy sinks in the tree have NO test
  #173  a GitHub PAT sits in cleartext in canonical's origin URL. Reported. Not rotated.
  #115  after both merges there will be THREE URL scheme policies and the only in-tree statement
        of policy describes TWO

### WHY THE RECEIPT IS THE HARMFUL PART, DEMONSTRATED ON #93

#93 is the worked example and it is the only one where the whole cycle has now run to completion:
  1. FILED by sec-verify-f7, correctly graded, with "NEEDS A REAL FIX, NOT DOCUMENTATION."
  2. A PRECONDITION ATTACHED WITH NO OWNER AND NO DATE -- "once F7 gets prioritized."
  3. The item reads as TRACKED, so nobody re-raises it.
  4. The record shows due diligence, so NOBODY AUDITS THE PARKING.
  5. It is in no round's scope, so the round that would rediscover it CANNOT see it and pays full
     price -- twice tonight, by two legs independently.
  6. Both rediscoveries were NARROWER than the original, and by §3.11 the thinner one overwrites
     the richer one because it is the one in front of us.
** RETRIEVAL WAS NEVER THE PROBLEM. THE COORDINATOR FOUND IT IN THIRTY SECONDS ONCE IT LOOKED.
WHAT RETRIEVAL CANNOT DO IS FIRE ON ITS OWN. **

### THE RULE, AND THE TEST

** NAME THE AGENT WHO FIRES THE TRIGGER. IF THE ANSWER IS A PASSIVE CONSTRUCTION, THE ITEM IS NOT
DEFERRED, IT IS DROPPED, AND THE FILE ENTRY IS WHAT WILL STOP ANYONE NOTICING. **

Corollary measured tonight, and it is why the cheap fix is the wrong one:
** AN AGED ESCALATED FINDING SELECTS THE CHEAPEST REMEDY. ** #93 aged into a users.type patch. The
coordinator declined to dispatch that patch, and it was right: importparams turned up a SECOND
caller-supplied value on the same path -- EntStore.ImportCollection accepts caller-supplied PRIMARY
KEYS via SetID, safe today only because the single server-side caller remaps to fresh UUIDs first.
A server-side invariant protecting a store-side API, not inherited by any second caller.
** SAFE BY CALLER COUNT, NOT BY CONSTRUCTION -- AND THE MEASUREMENT THAT CLOSES THE QUESTION IS THE
SAME MEASUREMENT THAT SHOWS THE ANSWER IS ACCIDENTAL. **
So the real question is neither users.type nor SetID: the import path sanitises SOME caller-supplied
fields and not others. If that handling is FIELD-ENUMERATED rather than invariant-based, F7d and
SetID are two instances of one root, and enumerating fields to sanitise is the SAME UNSOUND MOVE as
enumerating admissible forms -- a fourth domain for §6.7. Hypothesis, named falsifier, unmeasured,
unrated. Owned by importtrust-f7d.
