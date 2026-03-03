# The Complete Loop: Create / Share / Run

Every app is a REAL code artifact — standard TS/React/ESM, portable, exportable. Start fast on Vibes, graduate cleanly to enterprise.

The complete loop is the product. Each step increases the value of the other two.

## Create

Create isn't "generate code." It's code that conforms to a runtime contract and stays portable.

- Harness + prompts: higher first-run correctness, fewer broken apps
- CLI + web builder: fastest path from idea or patch to runnable artifact
- Remix tools: apps become editable objects, not one-off projects

Creation becomes repeatable manufacturing, not bespoke dev.

REAL check: output should be exportable and runnable with alternate providers.

## Share

Share isn't "export a URL." It's governed distribution.

- Web governance: manage apps, access, ownership, tokens
- Invites + instant join: collaboration without app-specific security
- Consistent sharing UI: one model, every app inherits it

Collaboration becomes default; security becomes platform code.

REAL check: enterprise can swap share/auth to SSO/RBAC without rewriting the app.

## Run

Run isn't "hosting." It's execution in a secure, shared context.

- No-build sandbox: deploy instantly, update instantly, no pipelines
- Login wrapper: identity + permissions always present
- State partitioning: durable data space aligned to sharing
- Custom domains later: extensible without changing app code

You remove the operational + security tax that kills micro-apps.

REAL check: same app can run under a different host with light wiring.

## Why the loop compounds

If any part is missing, you collapse into commoditized pieces:

- Create without Run => broken deploy, no instant update, no contract
- Run without Share => isolated apps, security work returns
- Share without Create => no velocity, nothing new to distribute

Together: minutes from idea to live app, one-click collaboration, safe-by-default sharing, viral distribution without creator ops burden.

## Sidebar: Refine / Remix

The sidebar is the platform. The iframe is the app.

Two verbs for two relationships to code:

- **Refine** — it's yours, you're improving it. Implies craft, iteration, quality. Links to `/chat/{yourSlug}/{appSlug}`.
- **Remix** — it's theirs, you're making it yours. Creates a new chat under your own slug, seeded with the published code. Redirects to `/chat/{yourSlug}/{newAppSlug}`.

Both say "this already exists and I'm making it better/different" — no throwaway generation.

### URL structure

- `/vibe/:userSlug/:appSlug` — public view, the running app. Shareable link.
- `/chat/:userSlug/:appSlug` — owner only, the editor. Where Refine happens.
- `/remix/:userSlug/:appSlug` — creates a new chat under the visitor's slug, seeds it with the current code, redirects to the visitor's own `/chat/` URL.

### Access control

Writes are protected — all API endpoints verify userId ownership via Clerk JWT. Non-owners cannot overwrite the original. Chat history (prompts, messages) is private to the owner. Only published app code is public.

## Sidebar by role

The sidebar shows different faces depending on your relationship to the app:

| Role | Sidebar shows |
|------|--------------|
| Owner | Refine, Settings, Comments, Presence |
| Collaborator (invitee) | Comments, Presence |
| Visitor (not invited) | Remix, About |

## Collaborative data layer

For invitees, the value isn't the code — it's being in a shared data world. Their first experience of Vibes isn't "a code tool," it's "a thing that worked instantly and I was collaborating in seconds."

The Create loop comes later, if at all, when they think "I could make one of these."

### Built-in comment feed

A comment feed lives in the sidebar alongside other platform features. No new infrastructure — comments are just another Fireproof collection in the same database, synced the same way.

What it gives the invitee:

- **Presence** — who's here
- **Context** — what are we doing, what just happened
- **Voice** — they can contribute without touching code

The app developer doesn't build chat, doesn't manage auth for chat, doesn't store messages. It's part of Run. Every app gets it for free.

## CLI: V1 scope

Four commands. The web UI handles everything else.

- **`vibes login`** — bind CLI to your account (Clerk auth flow)
- **`vibes whoami`** — confirm identity and slug
- **`vibes generate "prompt"`** — create a contract-valid app.jsx
- **`vibes publish app.jsx`** — push it live, get a `/vibe/` URL back

Generate implies validate — it outputs contract-compliant code or it's broken. Publish implies push + run. Share/invite/remix/refine live in the web UI. Export comes when the first enterprise customer asks.

### Eventually

The full map when demand justifies it:

- `token create|list|revoke` — agent + CI access
- `generate --n N --iters K` — parallel + iterative quality search
- `init` — scaffold from template
- `validate` — standalone contract checks
- `dev` — local preview matching Run sandbox
- `refine` / `remix` — CLI versions of the sidebar verbs
- `pull` — fetch live code to local (round-trip)
- `versions list|promote|rollback` — safety net
- `invite` / `joinlink create` — CLI share controls
- `export` — portable package + provider stubs (the REAL escape hatch)
