# Deleting a Durable Object class for real — cli-first, and only after a positive zero

Source: #2714 Spec B Phase E (PRs #2783 cli-unbind → PR-E2 delete)

The DO collapse ended where it had to: deleting the three old session classes
(`ChatSessions`/`AppSessions`/`SharedSessions`) with `deleted_classes`. That
migration is **irreversible** — it destroys every instance and all state for the
class — so the interesting part isn't the diff (delete three files, append one
migration), it's everything you have to prove *before* you're allowed to run it.

Two angles worth a post:

1. **Irreversible deploys are gated by evidence, not confidence.** We didn't
   delete because the code looked drained — we deleted because a Cloudflare
   analytics query (`durableObjectsInvocationsAdaptiveGroups` by `namespaceId`)
   showed the old-class namespaces at a literal **0 invocations** since the
   cutover deploy, on both prod and cli, with a whole-account sweep confirming the
   only stray hit was an unrelated ephemeral PR-preview worker. "No negative
   evidence" (zero log markers) was not enough for an irreversible step; we turned
   it into a **positive zero** first. The structural argument (nothing in the
   deployed code references the old bindings anymore) is what makes the zero
   *expected*; the query is what makes it *confirmed*.

2. **Cross-script bindings invert the deploy order.** The usual rule is
   prod-before-cli. But cli *cross-script-bound* prod's `AppSessions`/
   `SharedSessions` (shared data plane), and Cloudflare's migration validator
   counts a cross-script binding's `class_name` as a **live reference** — so prod
   `deleted_classes` fails with `10061` as long as cli still names the class. The
   fix is to split the work and **reverse the order**: a cli-only deploy that drops
   the cross-script bindings goes live *first* (PR-E1), and only then does prod's
   deletion deploy. Same shape as the `DocNotify` retirement two specs earlier
   (#2297 → #2298). Get it backwards and the prod deploy bounces off the validator.

Bonus gotcha from the mechanics: the unified class still needs the per-plane
user-notify helpers the old classes carried, so "delete the file" first means
*relocate* those helpers (into `session-callbacks.ts`) — and rename their log
labels off the dead class names, or a `[ChatSessions]` warn emitted by the *new*
class will masquerade as an old-class drain marker the next time someone greps for
one.
