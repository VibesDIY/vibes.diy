# When you delete a class, grep for its name in the log strings too

Source: #2714 Spec B Phase E follow-up (post-#2789 GC)

The DO collapse deleted `AppSessions` as a *class*, but the string
`"[AppSessions]"` lived on in seven `console.info`/`console.warn` labels inside
`localBroadcastCallbacks` (`api/svc/cf-serve.ts`) — the local-broadcast fanout
path that now runs *inside* the unified `Sessions` class. The code was correct;
the labels were lying. The hazard is specifically operational: the whole drain
proof for #2778 was "grep the tail for `[*Sessions]` markers and expect zero
old-class names." A live `[AppSessions]` line emitted by the *new* class would
masquerade as an old-class drain marker the next time someone runs that grep —
a false positive on the exact signal an irreversible deletion was gated on.

The fix is a one-liner (`[AppSessions]` → `[Sessions]`, plus the two test
assertions that pinned the old string). The lesson is the checklist item:
**deleting a class isn't done when the class file and bindings are gone — it's
done when the class *name* is gone from log labels, metrics tags, and any
grep-based ops runbook too.** Names leak into strings that the type system
can't see, and those are exactly the ones a future operator will trust.

Bonus: the sibling "cosmetic" — renaming the physical DO prefix `app:` →
`vibe:` for consistency with `ShardKind="vibe"` — looks identical in spirit but
is *not* safe. `app:`/`shared:` are pinned to the old classes' registration
shardIds so `idFromName` keeps addressing the same physical instance across the
collapse, and `resolveShardDO` must hit that same instance for persisted
UserNotify registrations. Renaming the prefix reroutes live instances and
strands registrations. Same "just a string" feeling, opposite blast radius —
one is a label nobody routes on, the other is an identity everybody routes on.
Know which kind of string you're touching.
