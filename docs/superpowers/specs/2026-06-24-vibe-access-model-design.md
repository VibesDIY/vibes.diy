# Vibe access model — design philosophy & decisions

**Date:** 2026-06-24
**Status:** living design doc. Ratifies the model and the decisions reached during the
owner-role-seeding work (#2553 → #2555/#2556/#2584, tracking #2554) and the broader
access-model discussion that followed it.
**Scope:** how permissions work _inside_ a vibe (who may read/write which documents), the
mental model the code generator should hold, and — importantly — the primitives we
deliberately choose **not** to build.

> This doc records the _reasoning_, not just the conclusions. The conclusions are cheap to
> restate; the trade-offs behind them are what get re-litigated six months later. Read the
> rationale, not only the verdicts.

---

## 0. TL;DR

1. Vibe data is **multiplayer-by-default, per-object-shared** (the Drive/Notion/Figma model),
   not **a site with an admin** (the WordPress/CMS model).
2. The default generated app gives **every visitor their own object domain**. An owner-only
   app is a **latent-surprise bug**, not a permission style.
3. Two orthogonal axes: **channels have the arity of objects; roles have the arity of types.**
   Channels answer _"who can **see**"_; roles answer _"who can **do**."_
4. **"Owner" is not a global in-vibe concept.** It is either (a) a per-object-graph role
   (workspace owner, doc author) or (b) the out-of-vibe deployer. The runtime keeps one
   reserved `owner` role as a backstop for genuine global admin, and that's all.
5. We are **not** building two tempting primitives: the codegen `ownerRoles` _producer_, and
   channel-scoped roles. The current channel/role/grant machinery reaches the **entire**
   design space — cleanly for our targets, clunkily at the 3+ tier edge — and
   clunky-at-the-edge beats cutting-it-off.
6. Prompt principle: **examples bias, grammar enables.** Feature the targets as exemplars;
   describe the full primitive grammar; **never enumerate limits.**

---

## 1. Where this came from

A deployed vibe — `garden-gnome/aegina-checklist` — would not let its **owner** save. Its
`access.js` was `if (!user.isOwner) ctx.requireRole("editor")`, and the owner was never put in
the `editor` role, so the owner's write hinged entirely on `user.isOwner` resolving true across
three independent code paths (write gate, read gate, client `can.*` predictor). The moment it
resolved false anywhere — multi-handle user, a handle-binding gap, the predictor not knowing
ownership — the owner was locked out of their own app.

The shallow fix was "make `isOwner` resolve reliably." The right fix was to ask **why owner
write authority ran through a magic boolean at all** — and that question unspooled into the
whole model below. `isOwner` turned out to be the vestigial organ of a mental model we don't
actually want.

---

## 2. The mental-model shift: workspace, not site

There are two mental models for multi-user app data, and almost every confusion in this space
comes from mixing them:

- **Site-with-an-admin** (WordPress, phpBB, classic CMS): one app, a global administrator,
  roles assigned top-down. The admin is load-bearing — nothing happens until they set it up.
  This is where `isOwner` and "the owner grants roles" come from.
- **Per-user-workspace + per-object-sharing** (Google Drive, Notion, Figma): every user has
  their own stuff; any object can be shared peer-to-peer; there is **no global admin in the
  data path.** The person who deployed the app is just user #1.

Vibes are shareable URLs that are supposed to _just work_ — so the second model is the right
default. The first model requires an _install/administration_ step before the app is usable by
anyone else, which is precisely the magic-killer.

This reframes the whole effort: removing `isOwner` is not "dropping a feature." It is removing
the single primitive that pulled generated apps toward the wrong mental model.

---

## 3. The "just runs" principle and the Form-A trap

**Just runs** = a URL that works, not an app you administer. Hold this as the north star.

Its sharpest corollary is about a failure mode we must design _out_ of codegen:

> **An owner-only app is invisible-broken to the only person who can see it work.**

The creator generates a todo app, adds todos, it works perfectly **for them** (they're the
owner), they share the link — and it is dead for every visitor, who can't add a thing. The
creator never witnesses the failure. For a platform whose entire value is _shareable_ apps,
silently generating apps that only work for their author is close to the worst outcome there
is. Call this the **Form-A trap** (owner-only writes = a demo-works/reality-broken bug). It is
not a permission _style_ to offer; it is a smell codegen should almost never emit.

App-shape taxonomy (useful for reasoning about defaults):

|       | Shape                                                       | Permission model                                 | Needs roles past `owner`? | "Just runs"?                |
| ----- | ----------------------------------------------------------- | ------------------------------------------------ | ------------------------- | --------------------------- |
| **A** | Personal / parallel (todo, journal, notes)                  | author-owned; each user their own private domain | no                        | ✅ default                  |
| **B** | Public shared (wall, guestbook, map)                        | author-owned writes + public read                | no                        | ✅ default                  |
| **C** | Owner-curated (personal blog, portfolio, announcements)     | `requireRole("owner")` write, public read        | no (reserved role)        | ✅                          |
| **D** | Approved-collaborator (team blog, forum w/ mods, workspace) | a privileged tier beyond author-owned            | **yes**                   | the rare, administered case |

A and B are the defaults. C is fine via the always-seeded reserved `owner` role (zero config).
**D is the only category that needs more — and it is, by definition, the least "just runs"
category.** Optimizing the platform's default machinery for D works _against_ the A/B/C
majority.

---

## 4. The two axes: channels = objects, roles = types; see vs do

The cleanest thing to come out of this discussion:

- **Channels have the arity of objects** — O(many), one per shareable thing (`list:123`).
  A channel grant means _"you can reach this object."_ Membership scales **per user** when
  expressed as direct `grant.users` (each user holds _their_ objects), which keeps the viewer
  query (`who-am-i`) a direct lookup instead of a global scan.
- **Roles have the arity of types** — O(few), a small reusable vocabulary (author, commenter,
  manager, viewer). A role names a **capability tier**, not a thing.

The load-bearing distinction underneath is **act vs. see**:

- **Visibility** ("who can _see_ this content") is what channels are _for_. A genuinely
  restricted subset of content (a mods-only audit log) legitimately gets its own channel.
- **Capability** ("who can _do_ this action") is what roles are for. "Can create rooms" is not
  content anyone reads — it is a flag.

Conflating them — encoding _capability_ as channel membership (`ws:42/admin`, `ws:42/mod`,
`ws:42/owner`) — is what produces channel explosion (objects × tiers) and, worse, re-imports
the `isOwner` footgun class: implicit naming conventions, bundle-granting ("a mod needs base
_and_ mod channels — forget one and they can act but can't read"), hierarchy-by-hand, and no
single source of truth for "what is Bob here." For codegen that is exactly the silent-broken
pattern we are trying to eliminate.

**Rule of thumb the generator should hold:** capability rides on _role/membership_; only a real
need to hide a _subset of content_ justifies an extra channel.

---

## 5. Owner, dissolved

In this model "owner" is never a global in-vibe concept. It is always one of:

- **A per-object-graph role** — the _creator_ of a workspace, the _author_ of a doc. Rooted in
  an object graph, held by a regular user, meaningless app-wide.
- **The out-of-vibe deployer** — controls code/deploy/the owner panel/billing. Irrelevant to
  the data path.

What the runtime keeps:

- **A reserved, always-seeded `owner` role.** The deploying handle is auto-seeded into it at
  every grant-reduce site, so `ctx.requireRole("owner")` covers genuine app-wide admin
  (moderation, global settings) with **zero declaration**. This is the backstop for the rare
  legitimate site-with-admin need — available, never central.
- **The explicit admin-mode bypass, unchanged.** `requireRole`/`requireAccess` no-op under
  `adminMode` (`vibe/runtime/access-runner.ts`), and `adminMode = isOwner && connectionAdminMode`
  is an opt-in per-app toggle independent of the access-fn `user`. It guarantees the owner can
  never be _permanently_ locked out, which de-risks the whole seeding mechanism (worst case is
  "toggle admin mode," never "stuck"). It is the deployer's deliberate override, not the
  everyday path.

What goes away: `user.isOwner` inside the access function. Phase 1 stopped _teaching_ it; the
field itself is removed in phase 3, gated on the back-catalog migration (see §12). The
client-side `me.isOwner` (app-shell chrome — "you own this") stays forever; it is display, not
a write gate.

---

## 6. The mechanics we build on (grounding)

So the reader knows the substrate the decisions rest on:

- An `access.js` doc-write returns `{ channels, members?, grant? }` (or throws
  `{ forbidden }`). Outputs that carry grants are stored (`accessFnOutputs`).
- A **`GrantReduce`** materializes those outputs into:
  `members` (role → users), `roleGrants` (role → channels), `userGrants` (user → channels),
  `publicChannels`. (`api/svc/public/grant-reduce.ts`.)
- `ctx.requireRole(role)` ≙ `members[role]` includes the user.
  `ctx.requireAccess(channel)` ≙ the user's resolved channels (direct `userGrants` ∪
  role-expanded `roleGrants`) include the channel. (`api/svc/public/access-function.ts`,
  `vibe/runtime/access-runner.ts`.)
- The reserved-`owner` seed is injected via `seedOwnerGrants` / `newSeededReduce` at the **six**
  seed-sensitive reduce sites (write gate, the three read reduces, `who-am-i.resolveGrants`,
  and the write-delta clone `grantsReduceAfter`). It lives outside `docContributions` so it
  survives a rebuild and can't collide with a user doc `_id`.

The crucial consequence used throughout §7: **child-doc enforcement only ever reads
`grantState`.** `access.js` cannot query; it sees `(doc, oldDoc, user, grantState)`. So any
membership fact that must gate a _child_ doc has to have been _projected into the reduce_ by
some prior access-fn output.

---

## 7. The reachability ladder

How far each membership mechanism reaches, on the current system unless noted.

### 7a. Single root doc — and why it doesn't escape the indirection

Tempting idea: make the object-graph's root doc special — only its creator may edit it, and the
membership map lives on it (`ws.members = { alice: "owner", … }`). Looks like it removes the
grant-doc indirection.

It doesn't. The root doc's `members` map only _directly_ governs edits to **the root doc
itself**. When Bob writes a _message_ in the graph, `access.js` doesn't get the root doc and
can't query it — so Bob's membership must already be in `grantState`, which means the root
doc's write had to **project** it (emit `grant.users[bob] = ["ws:42"]`). **Single-root-doc is
just the indirection collapsed onto one mutable document** — the root doc as the _sole_ grant
source feeding the same reduce.

Its ceiling is therefore the ceiling of one mutable doc:

1. **Single administrator by construction.** "Only the creator edits the doc → only they grant"
   means _one_ admin. Delegating forces granting full doc-edit (which also lets the delegate
   rewrite the creator field, settings, anything) unless you hand-write field-diff logic
   codegen will get subtly wrong.
2. **Concurrency clobber.** All membership changes serialize through one doc; concurrent
   edits can lose an addition on merge.
3. **Scale cap.** N members = an O(N) map rewritten and re-projected on every change.
4. **Inbound is awkward.** A request-to-join can't be written to a creator-only doc, so
   requests become side docs anyway.

Crucially, **those limits coincide exactly with the threshold where you'd want something
richer.** Below them (small, single-admin, low-concurrency) the root doc is fine.

### 7b. The hybrid (current system, no new primitive)

Move membership _off_ the root doc into independent grant docs, but let the root doc **seed an
admin channel**:

- `ws` doc (creator-edited) → projects `grant.users[creator] = ["ws:42", "ws:42/admin"]`.
- `memberGrant` doc (gated `requireAccess("ws:42/admin")`) → any admin issues these
  independently → projects `grant.users[invitee] = ["ws:42"]`.
- child docs → `requireAccess("ws:42")`.

This recovers **delegated admin, concurrency safety, scale, and request-approve** on the
current system — at the cost of _two_ capability channels (`ws:42`, `ws:42/admin`), which is
tolerable. It only turns clunky at **3+ distinct capability tiers** (owner/admin/mod/member/…),
where parallel-channel encoding becomes the §4 footgun.

### 7c. Channel-scoped roles (a primitive we are NOT building yet)

The "correct" abstraction for the 3+ tier case: let a channel membership carry a role —
`members: { "ws:42": { owner: [...], mod: [...], member: [...] } }`, `requireRole("mod",
"ws:42")`. One channel per object (visibility), role-tag on membership (capability), no
parallel-channel explosion, single source of truth.

### Reachability table

| Capability                              | Single root doc | Hybrid (current system)   | Channel-scoped roles |
| --------------------------------------- | --------------- | ------------------------- | -------------------- |
| Creator + small group                   | ✅              | ✅                        | ✅                   |
| Delegated admin (mods invite)           | ❌              | ✅                        | ✅                   |
| Concurrent grants safe                  | ❌              | ✅                        | ✅                   |
| Large membership                        | ❌              | ✅                        | ✅                   |
| Request / approve                       | ~               | ✅                        | ✅                   |
| **3+ clean capability tiers per graph** | ❌              | ~ (parallel-channel mess) | ✅                   |
| New primitive needed                    | no              | no                        | **yes**              |

The hybrid reaches **everything except clean N-tier capability.** That single row is the
_entire_ marginal value of channel-scoped roles. The migration is smooth because **child-doc
gates always read `grantState`** — an app can graduate root-doc → hybrid → channel-scoped roles
and its `requireAccess("ws:42")` content checks never change; only the _source_ feeding the
reduce changes. So we can defer the primitive with no rewrite cost later.

---

## 8. Deliberate non-decisions (with rationale)

### 8a. We removed the `ownerRoles` column entirely (no producer, no receiver)

The spec's "declare-don't-extract" `ownerRoles` manifest had a **receiving** half (the column,
the `ReqEnsureAppSlug` field, the additive write, reads at the six seed sites) and a
**producing** half (codegen declares `ownerRoles` + threads it through the chat push). The
producer was never built — nothing ever set `req.ownerRoles` — so the column was always `NULL`.

> **Reversal (2026-06-24, before the column ever reached prod):** we dropped the receiving
> half too. The drizzle `ownerRoles` column was merged in #2556 but the `drizzle:neon` push
> that adds it hadn't run, so removing it pre-deploy cost nothing (vs. a `DROP COLUMN`
> migration later). What's left is the **whole actual mechanism**: the reserved `owner` role,
> seeded from the `ownerHandle` at the six reduce sites via `seedOwnerGrants`/`newSeededReduce`,
> with no stored declaration. `parseOwnerRoles`, the `processAccessBindings` additive-merge,
> the who-am-i precedence maps, and the `ownerRoles` selects/args are gone.

We will not build either half, because:

- **It is redundant.** The reserved `owner` role + app-level grant docs already let an app seed
  the owner (or anyone) into any domain role, more flexibly, with no manifest. (This is exactly
  how aegina's own `editorGrant` works.)
- **It tilts codegen toward site-with-admin** — the model we're moving away from.
- **It carries a brick risk** (declare a custom owner role that nothing seeds → owner locked
  out — caught in review on #2584). And a permanent always-`NULL` column with no writer is
  dead schema weight on the hot write path.

**If declared owner roles are ever genuinely needed**, add the column **and** a producer
together as one coherent feature, designed right at that point — don't carry speculative
receiving plumbing ahead of any writer.

### 8b. We will NOT build channel-scoped roles (yet)

The hybrid reaches everything but clean 3+ tiers (§7). 3+ tier workspaces (Slack/Canva-grade)
are **not a near-term target** — but they must remain _possible_, clunkily, via parallel
channels. Clunky-at-the-edge beats a false ceiling.

**Build trigger:** when "3+ capability tiers rooted to an object graph, generated cleanly"
becomes a roadmap target. **Design rules locked now** so it's right when built: scope = the
object's channel; expose a **viewer-indexed** projection (`user → {channel: role}`) so
`who-am-i`/`can.*` stay direct lookups, never a global scan. Per review (Charlie): this is
likely an _additional_ projection, **not** a hard replacement of role-indexed source state —
admin/introspection paths still want role-centric access, so we'll probably maintain both.

### 8c. Invite/discovery needs no new primitive

The grant _mechanism_ already works (a member writes a grant doc). The only real need is
**handle discovery**, solved without a token-redemption system:

- **Request-approve, in `access.js`, today.** A `request` doc is the one type that takes _no_
  `requireAccess` (any signed-in user may create it), routed to the object's admin channel; the
  requester's handle is `user.userHandle` at write time, so it's self-identifying and
  unforgeable. A scoped admin approves with a normal grant. This _inverts_ the flow so nobody
  needs anyone's handle in advance.
- **Out-of-band directory / friends list** — a separate platform nicety for proactive "add
  Bob," orthogonal to `access.js`.

Eventually, **object-scope the existing app-level invite/request flow** (the sharing tab is
app-scoped and owner-mediated today). Token-redemption was over-engineering; rejected.

---

## 9. The prompt principle: examples bias, grammar enables

How to honor "leave the 3+ tier edge reachable, but don't feature it, and don't forbid it":

- **Recipes (worked examples) bias.** They are the shapes the model reflexively reaches for, so
  feature **only the targets** — per-user-private (A/B), owner-curated via reserved `owner`
  (C), the per-object hybrid. Each example pulls generation toward a good default.
- **Grammar (the primitive vocabulary) enables reachability.** Channels are arbitrary strings;
  `requireAccess` gates membership; `requireRole`/`members` gate type; `grant.users`/
  `grant.roles` project access; a doc's output _is_ a grant. Describe this **completely** and
  the 3+ tier case is reachable by _composition_ — the model derives it (a bit messily) with no
  example to copy.

Two hard rules that fall out:

1. **Never enumerate limits.** State capabilities and defaults positively; let the _absence_ of
   an example be the only signal that something is off the beaten path. Don't tell the model a
   shape is impossible, and don't weigh against it.
2. **Don't feature the messy edge.** No 3+ tier parallel-channel exemplar — an example would
   entrench the footgun (over-bias) just as a prohibition would amputate it (false ceiling).
   Cap _features_ at the targets; keep _grammar_ complete.

The failure to avoid cuts both ways: an example of the messy pattern over-biases toward it; an
explicit prohibition amputates it. Silence on the shape + completeness on the grammar threads
the needle.

---

## 10. Infra follow-up: idempotent (no-op) writes

Several patterns here (and any LLM-generated "ensure X exists" effect) want to write a doc that
may already be in its desired state. On an append-only CRDT log, a naive re-write grows the log
even when nothing changed.

**Proposal:** **no-op a `put` whose content is byte-identical to the writer's current head for
that `_id`.** This is sound: in a content-addressed CRDT, an identical write is the _identity
element_ of the merge — it carries no new information, so skipping the append is semantically
invisible (concurrent writers still merge correctly). It turns a class of naive declarative
patterns from "log-bloat bug" into "free idempotence," and it pays off far beyond access (any
reconcile-to-desired-state code the model emits).

**True today vs. not (per review, Charlie):** the underlying Fireproof/pail CRDT _already_
treats an identical-value put as a no-op at the head/event level. But our **app-documents
pipeline does not short-circuit yet** — each `putDoc` still allocates a new `seq` revision
regardless of content. So this is a property to **enforce in our write pipeline**, not
something already true end-to-end. It's a Fireproof/Firefly-core + pipeline change, separate
from the access work; tracked here so it isn't lost, not blocking anything above.

---

## 11. Status & phasing

Owner-role-seeding (the concrete work this model grew out of):

- **Phase 1 — shipped.** Keystone seed + reserved `owner` role (#2555); storage + six-site
  wiring + additive redeploy (#2556); codegen prompts: author-owned default,
  `ctx.requireRole("owner")`, ACL-envelope framing (#2584). `isOwner` is no longer _taught_;
  the field is still populated.
- **Phase 2 — #2554.** Migrate the back-catalog vibes off `user.isOwner` onto roles
  (incl. unbricking aegina). Hard prerequisite for phase 3. **Gated on phase-1 runtime being
  deployed to prod** before any live vibe is migrated.
- **Phase 3.** Remove the `isOwner` field from the access-fn `user` context. `me.isOwner`
  (chrome) stays.

This doc's model feeds the phase-2 migration patterns and any future prompt work (the per-object
hybrid, Form-A avoidance, capability/visibility framing are **not yet** in the prompt — #2584
only carries the first layer).

---

## 12. When to revisit

- **3+ tier becomes a target** → build channel-scoped roles, per the §8b locked rules.
- **A flagship truly needs declare-and-forget custom owner roles** → build the `ownerRoles`
  producer (or, preferably, lean on app self-seed via the reserved `owner` role).
- **Declarative-write log bloat shows up** → land the Fireproof no-op-identical-writes change
  (§10).
- **Per-object collaboration gets featured in the prompt** → teach the hybrid + Form-A
  avoidance + capability/visibility as _positive grammar_, deliberately silent on 3+ tiers.

---

## Appendix: one-line glossary

- **Channel** — a read-routing key with the arity of _objects_. Membership = "can see this."
- **Role** — a capability tier with the arity of _types_. Membership = "can do this."
- **Reserved `owner` role** — always-seeded global-admin backstop; the only in-vibe "owner."
- **Form-A trap** — owner-only writes; works for the creator, silently broken for everyone else.
- **Hybrid** — root doc seeds an admin channel; admins issue independent member grants; child
  docs `requireAccess` the graph channel. The recommended collaborative default.
- **Examples-bias / grammar-enables** — feature targets as recipes; describe primitives as
  grammar; never enumerate limits.
