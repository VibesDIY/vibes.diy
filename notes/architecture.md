# Vibes.diy Architecture

## System Overview

Three layers: editor (parent frame), sandbox (child iframe), backend (Cloudflare Workers).

```
EDITOR (Parent Frame)              SANDBOX (Child Iframe)           BACKEND (CF Workers)
┌──────────────────────┐          ┌──────────────────────┐        ┌──────────────────┐
│ React SPA            │ postMsg  │ Vibe Runtime         │        │ API (Hono/Evento)│
│ ├─ Chat UI           │◄────────►│ ├─ registerDeps()    │        │ ├─ Auth (Clerk)   │
│ ├─ CodeEditor        │          │ ├─ mountVibe()       │        │ ├─ Chat/Prompt    │
│ ├─ srv-sandbox       │          │ ├─ Fireproof hooks   │        │ ├─ Publish        │
│ └─ Clerk auth        │          │ └─ User's app.jsx    │        │ └─ Asset serving  │
└──────────────────────┘          └──────────────────────┘        └──────────────────┘
         │                                                                  ▲
         └──────────────── WebSocket (vibeDiyApi) ──────────────────────────┘
```

## Sandbox Architecture

### Parent Side: srv-sandbox

`vibes.diy/vibe/srv-sandbox/srv-sandbox.ts` — Evento-based message router in the editor frame.

Handles messages from the iframe:
- `vibe.evt.runtime.ready` — runtime booted, deps list attached
- `vibe.req.register.fpdb` — app created a Fireproof database, register it
- `vibe.req.fetchCloudToken` — get sync credentials (Clerk-gated)
- `vibe.req.callAI` — app wants to call an LLM (routed through backend)

All messages use `tid` (transaction ID) for request/response pairing.

### Child Side: Vibe Runtime

`vibes.diy/vibe/runtime/` — runs inside the sandboxed iframe.

Boot sequence:
1. Browser loads HTML with import map
2. `registerDependencies()` creates `VibeSandboxApi`, sends `runtime.ready`
3. Hooks Fireproof `ledgerSvc.onCreate()` to auto-register databases
4. Registers `callAI()` global function
5. `mountVibe()` creates React root, wraps in `VibeContextProvider`, renders app

### Iframe Sandbox Permissions

```html
<iframe sandbox="allow-scripts allow-same-origin allow-forms" />
```

No top navigation, no popups. Communication only via `postMessage`.

### Message Protocol

Defined in `vibes.diy/vibe/types/index.ts`. All messages validated via arktype schemas. Key types:

| Direction | Type | Purpose |
|-----------|------|---------|
| iframe → parent | `vibe.evt.runtime.ready` | Runtime booted |
| iframe → parent | `vibe.req.register.fpdb` | Register database |
| parent → iframe | `vibe.res.register.fpdb` | DB metadata response |
| parent → iframe | `vibe.evt.attach.fpdb` | Attach sync to DB |
| iframe → parent | `vibe.req.callAI` | AI request |
| parent → iframe | `vibe.res.callAI` | AI response |
| iframe → parent | `vibe.req.fetchCloudToken` | Cloud sync token |

## Prompt & Code Generation Flow

See also: `notes/prompt-flow.md` for the proposed orchestration refactor.

### Two-Stage Process

**Stage 1: Dependency Selection** (`prompts/pkg/prompts.ts`)
- `selectLlmsAndOptions()` sends user prompt to GPT-4o
- Returns which modules to include: fireproof, callai, d3, three-js, web-audio, image-gen
- Fallback default: `["fireproof", "callai"]`

**Stage 2: System Prompt Construction** (`makeBaseSystemPrompt()`)
- Loads `.txt` documentation for each selected module from `prompts/pkg/llms/`
- Builds system prompt: React best practices, Tailwind, Fireproof integration, style constraints
- Includes import statements for selected libraries

### Server-Side Streaming Pipeline

`vibes.diy/api/svc/public/prompt-chat-section.ts` — handles the LLM call:

```
User prompt → injectSystemPrompt() → LLM streaming request
  → createStatsCollector → createLineStream → createDataStream
  → createSseStream → createDeltaStream → createSectionsStream
  → Extract code blocks → Store in DB → Emit via WebSocket
```

Code blocks are extracted, stored as `FileSystemItem` entries, and auto-published to a dev `fsId`.

### Prompts Package (`@vibes.diy/prompts`)

Contains:
- System prompt builder and dependency selector
- 10+ style themes (brutalist, synthwave, bauhaus, etc.)
- LLM module catalog with documentation
- UserSettings and ChatMessage type definitions

## Publish Flow

`vibes.diy/api/svc/public/ensure-app-slug-item.ts`

1. **Auth** — verify Clerk JWT, extract userId
2. **Slugs** — create/retrieve userSlug + appSlug (3-word random slugs)
3. **Assets** — SHA-256 hash each file → CID → store in D1 Assets table
4. **Transform** — JSX→JS via sucrase, extract imports via acorn
5. **Import map** — generate from bare specifiers, store as `import-map.json`
6. **fsId** — deterministic CID from sorted filenames + content CIDs + env
7. **Store** — write to `sqlApps` with releaseSeq, mode (dev/production)

Returns entry point URL: `https://{appSlug}--{userSlug}.vibes.app/~{fsId}~/`

## Database Schema (D1/Drizzle)

| Table | Key | Purpose |
|-------|-----|---------|
| `Assets` | assetId (CID) | Content-addressed blob storage |
| `UserSlugBindings` | (userSlug, userId) | User identity → slug mapping |
| `AppSlugBindings` | (appSlug, userSlug) | App ownership |
| `Apps` | (appSlug, userId, releaseSeq) | App versions with filesystem |
| `ChatContexts` | chatId | Chat sessions |
| `ChatSections` | (chatId, promptId, blockSeq) | Chat messages/code blocks |
| `PromptContexts` | (userId, chatId, promptId) | Token usage tracking |
| `ApplicationChats` | (userId, appSlug, userSlug, chatId) | App-specific chats |
| `UserSettings` | userId | User preferences |

### Access Control

- All write endpoints require Clerk JWT via `checkAuth()`
- Every query filters by authenticated `userId`
- Slug ownership verified through `UserSlugBindings` join
- Published apps in `production` mode are publicly readable
- Dev mode apps only visible to owner
- Chat history private to owner (never exposed to other users)

## Fireproof Integration & Sync

### Database Naming

Apps get isolated databases: `vf-{appSlug}-{installId}-{dbName}`

### Sync Flow

1. App creates Fireproof database → `onCreate` hook fires
2. Runtime sends `register.fpdb` to parent
3. Parent responds with DB metadata
4. When user authenticates, `doAttach()` activates cloud sync
5. Token strategy fetches credentials via Clerk dashboard API
6. Fireproof ledger syncs via UCAN tokens

### Multi-Device

Same database name + same user identity = synced data. Ledger naming includes app metadata so each app is isolated, but the same app syncs across devices.

## Call-AI (`call-ai/pkg/`)

Browser-loaded AI API client:
- Streaming via SSE (AsyncGenerator)
- Structured output with JSON schema
- Multi-format SSE parsing (Anthropic, OpenAI, OpenRouter)
- Fallback model support
- Token usage and timing metadata

## Package Structure

```
prompts/pkg/     @vibes.diy/prompts      System prompts, settings, module catalog
call-ai/pkg/     call-ai                 AI API streaming client
use-vibes/base/  @vibes.diy/use-vibes-base  Enhanced useFireproof, ImgGen
use-vibes/pkg/   use-vibes               Public API, re-exports
vibes.diy/api/   @vibes.diy/api-*        Backend services (types, impl, svc)
vibes.diy/vibe/  (internal)              Sandbox runtime, srv-sandbox, types
vibes.diy/pkg/   (internal)              Editor SPA (React Router)
```
