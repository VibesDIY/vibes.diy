# Code MVP — Task Summary

## Domain Model

An **app** is source code (App.jsx + related files). A **group** is a named audience for that app — `dev`, `work-lunch`, `family-reunion`, etc. A **target** is `{owner}/{app}/{group}`, the fully-qualified deployment destination.

Every deploy produces an **fsId** — an immutable content-addressed snapshot of the app's files. The fsId is what gets served at the group's URL. Different groups can point to different fsIds (dev has your latest save, work-lunch has last Tuesday's publish).

### Version history in the database

Every push — live or publish — creates a row in the `Apps` table with an auto-incremented `releaseSeq`. The DB is a domain log: `(appSlug, userId, releaseSeq)` is the primary key, and each row stores `fsId`, `mode` (dev/production), `fileSystem`, `env`, and `created` timestamp. Same-content pushes are deduplicated (return existing row). Assets are content-addressed (stored once, referenced by CID).

Two mutations exist: old dev rows can be **evicted** when a user hits their app quota (oldest dev rows are pruned first), and a dev row's mode is **upgraded** to production in place when the same fsId is published. These are housekeeping — the log is append-mostly, not strictly immutable.

Locally, `vibes.json` also elides history — `live` replaces its single `fs` entry on each push (only current state matters for the running session), while `publish` appends to history. This is advisory; the server has the fuller log.

### Groups are all the same

`dev` is not special infrastructure — it's just a group name. The only difference is convention: `dev` signals "construction zone, expect instability." Any group can receive live updates or published snapshots.

The `default` group is the one exception: it has no group segment in the URL, giving the shortest shareable link. `use-vibes publish` with no arg targets `default`. Browsing to a target URL without a group serves `default`.

### Three verbs, one primitive

All three commands produce an fsId and point a group at it:

- **`use-vibes dev`** — sugar for `live dev`. Watches files, pushes every save to the `dev` group. The dev URL updates immediately.
- **`use-vibes live <group>`** — same file-watch push, any group. `live work-lunch` means your audience sees every save in real time. Replaces the group's fsId on each push.
- **`use-vibes publish [group]`** — one-time push. Produces a single fsId, points the group at it, exits. No arg = `default` group. The group's URL is now a stable snapshot. History is appended to vibes.json.

The difference is lifecycle, not mechanism: `live` is a long-running session that keeps replacing the fsId. `publish` is a single shot that appends to history.

### Invites make groups shareable

Any group can have an invite link. `use-vibes invite work-lunch` generates a join URL — anyone who opens it gets access to that group's app and data. The invite is scoped to the target (`jchris/coffee-order/work-lunch`), not the whole app. Different groups can have different audiences with different permissions.

### URLs

Each target has a permanent HTTPS URL:
```
https://coffee-order-work-lunch--jchris.vibecode.garden
       └───────appSlug──────────┘ └user┘
```

At the URL layer, the code uses `appSlug--userSlug` (one double-dash). The CLI's three-part target (`owner/app/group`) is a higher-level concept — at the subdomain level, `appSlug` absorbs both app identity and group name. The fsId (content-addressed snapshot) lives in the path: `/~zFJwy...~/`. This domain boundary is intentional — the CLI resolves targets to appSlug+userSlug before hitting the API.

The URL always serves whatever fsId the group currently points to. When `live` pushes a new fsId, the URL updates. When `publish` freezes a snapshot, that's what the URL serves until the next publish.

---

## FRONTEND
- **F0. Reconcile sidebar features** — Sidebar has diverged; vibe card, publish, settings, invites, DB explorer need a coherent home
- **F1. Wire publish button** — Users can publish their vibe to a public URL with one click
- **F2. Code editor lets you edit** — Users can hand-edit generated code and see changes live before publishing
- **F3. Integrate DB Explorer** — Users can browse and edit their app's Fireproof data in a visual explorer
- **F4. Re-enable invite route** — Users can generate an invite URL and share it to grant access
- **F5. Mobile responsive published vibes** — Published vibes work on phones
- **F6. List users in a vibe** — Vibe owner can see who has access and who accepted invites
- **F7. Map groupIds to sandbox appSlug** — Each group/install gets its own sandboxed data partition
- **F8. Sync status indicator** — Users know when their data is syncing vs offline

## API SERVER
- **A1. Expose createInviteToken** — Backend can create invite codes for sharing vibes
- **A2. Expose acceptInvite** — Invited users can accept and gain access to shared vibes
- **A3. Expose getFPToken** — Shared users get Fireproof cloud tokens for synced access
- **A4. Expose listAcceptedInvites** — Vibe owners can see who accepted their invites
- **A5. Expose deleteInviteToken + deleteAccept** — Owners can revoke access
- **A6. Slug availability check** — Users see if their desired publish URL is taken (optional)

## CORE FEATURES
- **C1. Publishing e2e** — Prompt → generated code → published URL → working app
- **C2. Invite e2e** — Owner creates invite → shares URL → invitee accepts → sees app + data
- **C3. Multi-device sync e2e** — Log in on second device → same data → writes sync both ways

## PRODUCTION ENV
- **P1. Configure FPCLOUD_URL** — Sync actually works, data flows to cloud and back
- **P2. Run D1 migrations** — Invite system has its database tables in production
- **P3. Deploy API with invite handlers** — Invite system is live
- **P4. Verify domain routing** — Published vibes resolve correctly on all configured domains

## METERING / QUOTA
- **M1. Merge rate limiter** — Users get fair usage limits, prevents runaway costs
- **M2. Usage display UI** — Users see how much they've used before hitting limits
- **M3. Storage quotas** — Prevent unbounded growth of published vibes and assets

## CLI
- **L0. Bootstrap use-vibes CLI** — Add CLI to the existing use-vibes workspace package
- **L1. Move create-vibe into monorepo** — Already published; move in after use-vibes CLI is solid
- **L2a. CLI auth** — Authenticate and identify the current user
- **L2b. CLI live** — Watch files, push every save to a target group
- **L3. CLI publish** — One-time push of current code to a target group
- **L3b. CLI slices + system** — List RAG slices; emit assembled system prompt to stdout
- **L3c. CLI edit** — AI-edit a file from the terminal, stream diff to stdout
- **L4. CLI invite** — Generate a join link for a target group from the terminal
- **L5. Live reload for group URLs** — Group URLs auto-refresh when new code is pushed
