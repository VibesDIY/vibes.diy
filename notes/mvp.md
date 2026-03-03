# MVP Ship List

## Create

### 1. Homepage
Unauthenticated visitor lands on vibes.diy. Fast load, clear prompt to get started.

### 2. Authentication
Sidebar menu auth via Clerk. Login/signup flow.

### 3. App Builder (Editor View)
Authenticated user submits prompt, lands in editor, app generates. Subsequent prompts refine the codebase. This is `/chat/:userSlug/:appSlug`.

### 4. Publish
User publishes via the publish menu. Gets a `/vibe/` URL back.

## Run

### 5. Published Vibe
`/vibe/:userSlug/:appSlug` loads in major browsers + mobile. Data persists on reload.

### 6. Single Player, Multi-Device
Authenticated user sees synced data across devices. Writes propagate both directions.

### 7. Collaborator Experience
Invitee opens the vibe URL, authenticates, sees the running app. Sidebar shows Comments + Presence — no editor controls.

## Share

### 8. Invite
Owner invites collaborators by username via sidebar. No automated email — share the URL yourself. Invitee authenticates, sees app + synced data.

### 9. Vibe Public Page
Visitor (not invited, not owner) lands on `/vibe/:userSlug/:appSlug`. Sees the running app. Sidebar shows Remix + About.

### 10. Remix
Visitor hits Remix. Creates a new chat under their own slug, seeded with the published code. Redirects to `/chat/{visitorSlug}/{newAppSlug}`. The viral loop closes here.

## Platform

### 11. Comment Feed
Sidebar panel with discussion thread. Visible to owner + collaborators. Fireproof collection — no new infrastructure. Every app gets it for free.

### 12. My Vibes
Gallery of your apps — created and remixed. The home base after login.

## CLI

### 13. `vibes login` / `vibes whoami`
Bind CLI to account. Confirm identity and slug.

### 14. `vibes generate "prompt"`
Create a contract-valid app.jsx from the terminal.

### 15. `vibes publish app.jsx`
Push to live, get a `/vibe/` URL back.
