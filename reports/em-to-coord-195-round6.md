#195's three legs are all in and round 6 is dispatched. APPROVE / REQUEST
CHANGES / REQUEST CHANGES. The security audit found no XSS — 69 vectors plus 10
mXSS vectors, zero routes to script execution, DOMPurify at the latest release
with a clean audit across 154 packages — and the code-review leg approved
markdown.ts itself as-is. Every blocker is in the guard.

**The finding that justifies having run three legs.**

The test leg found a HIGH the other two did not, and it is a genuinely new shape.
renderMarkdown's ARITY is unconstrained. The guard rule that claims the sink's
argument is "a single renderMarkdown call and NOTHING else" only balances
parentheses — it says nothing about what sits between them. And all forty-odd
behavioural checks pass exactly one argument, so no fixture in the suite can
express a two-argument call. Add an ordinary-looking "render inline markdown for
one-line fields" option and the sink renders attacker markup completely raw with
the suite green at 61 of 61 and tsc --noEmit clean. Runtime-verified through the
compiled sanitizer, with an isolating control pinning the guard half separately.

Why five rounds of adversarial mutation testing missed it is the part worth
keeping. Every one of vectors V1 through V25 mutates a binding, a call-site
spelling, or a module specifier. **Not one changes an arity.** The leg stated the
reason exactly: a fixture that cannot express a two-argument call cannot be
mutated into failing on one. It was reachable only by asking what inputs the
tests cannot express — never by asking what mutation survives.

That is the self-shaped fixture again, and this instance sharpens the taxonomy in
a way I had not anticipated. The three levels we named were schema, state model,
and design. This is a fourth: **the arity of a function under test**. And note it
is not that the fixture was built badly — it is that the input domain has a
dimension nobody thought of as a dimension. An argument list is a collection, so
the cardinality axis applies to it, and the suite tests exactly one. The same leg
found the zero case too: renderMarkdown throws on null or undefined, both sinks
pass values arriving over gRPC, and a throw inside render() takes down the whole
Lit component. Cardinality zero and cardinality two, same blind axis, one missed
because nobody varied it and one missed because nobody varied it.

**On the amended criterion.** I asked all three legs whether I had defined the
problem down to fit the solution. Two answered independently, and both refused to
answer it as a matter of opinion. Their shared test: a criterion narrowed to fit
its solution is one that cannot fail that solution. This one can, and did — the
code-review leg's F1 and the test leg's T1 are both failures of the AMENDED
criterion on its own named axes, not of the original one. So the amendment was
honest. That is a better answer than either agreeing with my reasoning would have
been, and it is the same move the auditor made when it checked whether each green
mutation actually weakened the sanitizer before filing it.

They did not let me off, though. "Innocent-looking regression" describes the
AUTHOR'S INTENT, not the artifact. It is not decidable from a diff, and
adjudicating a future dispute is the only job an exit criterion has. Under my
wording someone could argue F1 away as adversarial because it omits semicolons. I
have accepted the reviewer's restatement in artifact terms — visible in the
scanned source view, name or call shape — which has identical coverage, makes
"rules own a NAME, not an EFFECT" the operative clause instead of a footnote, and
makes F1 unambiguously a violation. My sentence was the weaker one.

One further correction I want on the record because it goes against a boundary I
have been leaning on: the test leg argued T1 is INSIDE the technique's stated
reach, not beyond it. R5 does not fail to own an effect there — it fails to own a
SHAPE it explicitly claims to own, since its own docstring says the argument must
be the call and only the call, and an argument list is part of a call. So the
NAME/EFFECT boundary must not be allowed to absorb T1. That is the boundary
statement you and I both endorsed, being correctly prevented from becoming an
excuse.

**Two legs found the same thing independently** — that the entire BANNED_SINKS
list can be emptied with the suite green — one by direct mutation, one by
ablation pairing. Uncoordinated convergence on a vacuity the file itself
diagnoses three times and fixed everywhere else.

**One thing I want to flag as a standing risk rather than a finding.** The audit
confirmed the V25 acceptance at full transitive depth — 154 packages, planted
decoy self-check, exactly two prototype patchers and both dev-only. But it then
observed that the acceptance rationale rests on a property of the dependency tree
that is true today and ENFORCED BY NOTHING. One routine npm update could make
V25's effect reachable with no commit to this repo, at which point the documented
reason for accepting it quietly stops being true and nothing goes red. That is a
disclosed survivor whose disclosure can rot without anyone touching the
disclosure. I have not seen that shape before tonight and I do not think we have
a name for it. The fix is mechanical — promote the scan into CI over production
deps — and I have it tracked.

Also tracked and not blocking: the audit's Medium is that 36 of 46 blocked
vectors were blocked by DOMPurify's DEFAULTS and only 10 by the configuration we
have been reviewing for five rounds. 157 tags permitted, markdown emits 22. The
recommendation is to invert to an allow-list, keeping the forbid lists as a
verified-independent second barrier. I have deliberately kept that OUT of round 6
— it is a substantial rewrite of the actual XSS boundary and needs its own review
round rather than being folded into a cleanup.

Round 6 is with dev-195-cleanup-5 now and will need its own fresh three-way.
Still holding #194 at two of three legs.
