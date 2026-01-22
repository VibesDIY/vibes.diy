# vibes.diy API

WebSocket-based API for vibes.diy chat persistence and app deployment. Supports both HTTP POST and WebSocket connections using the same handler via the Evento event-driven framework.

## Package Structure

```
api/
├── types/              @vibes.diy/api-types    SHARED (client + server)
│   ├── msg-types.ts    Request/response types, VibeFile, MsgBase envelope, arktype schemas
│   ├── types.ts        FileSystemItem with transform support
│   └── vibes-diy-serv-ctx.ts  Server context for wrapper/iframe rendering
│
├── pkg/                @vibes.diy/api-pkg      SHARED (client + server)
│   ├── api.ts          VibesDiyApiIface interface (3 methods)
│   ├── encoder.ts      Evento encoders: ReqRes, W3CWebSocket, Combined
│   ├── index.ts        Re-exports
│   └── react/          React components (client only in practice)
│
├── impl/               @vibes.diy/api-impl     CLIENT
│   └── index.ts        VibeDiyApi class (WebSocket client, WIP - no reconnection)
│
├── svc/                @vibes.diy/api-svc      SERVER (Cloudflare Workers)
│   ├── cf-serve.ts     Cloudflare Worker entry point (HTTP + WebSocket)
│   ├── create-handler.ts   Evento pipeline setup with all handlers
│   ├── check-auth.ts   Auth middleware (clerk, device-id verification)
│   ├── unwrap-msg-base.ts  MsgBase envelope unwrapping for validation
│   ├── api.ts          VibesApiSQLCtx type + VibesFPApiParameters
│   ├── entry-point-utils.ts  URL construction for deployed apps
│   │
│   ├── public/         Public API handlers (Evento handlers)
│   │   ├── ensure-app-slug-item.ts  App deployment with CID-based storage
│   │   ├── ensure-chat-context.ts   Chat session creation/retrieval
│   │   ├── append-chat-section.ts   Message persistence with seq numbers
│   │   └── serv-entry-point.ts      Serves deployed app HTML
│   │
│   ├── intern/         Internal helpers
│   │   ├── ensure-slug-binding.ts   User/app slug management (random-words)
│   │   ├── ensure-storage.ts        CID calculation (SHA-256 + base58btc)
│   │   ├── import-map.ts            ESM import map generation (esm.sh)
│   │   ├── render-vibes.tsx         HTML rendering with import map injection
│   │   └── write-apps.ts            App record creation with transforms (sucrase, acorn)
│   │
│   └── sql/
│       └── vibes-diy-api-schema.ts  Drizzle schema (D1)
│
└── tests/              @vibes.diy/api-test
    └── api.test.ts
```

## Package Summary

| Package | Runs On | Purpose |
|---------|---------|---------|
| `@vibes.diy/api-types` | Both | arktype schemas, request/response types |
| `@vibes.diy/api-pkg` | Both | Interface + encoders (shared contract) |
| `@vibes.diy/api-impl` | Client | `VibeDiyApi` WebSocket client class |
| `@vibes.diy/api-svc` | Server | Cloudflare Worker handlers, D1/Drizzle |

## Architecture

### Message Envelope

All requests are wrapped in a `MsgBase` envelope:

```typescript
interface MsgBase {
  tid: string;      // Transaction ID for request/response correlation
  src: string;      // Source identifier
  dst: string;      // Destination identifier
  ttl: number;      // Time-to-live
  payload: unknown; // The actual request/response
}
```

### Evento Pipeline

The server uses Evento (from `@adviser/cement`) for request routing. Handlers are registered in order:

1. **CORS preflight** - Handles OPTIONS requests
2. **servEntryPoint** - Serves deployed app HTML (hostname routing: `{appSlug}--{userSlug}.{host}/~{fsId}~/`)
3. **Request logging** - Logs incoming POST/PUT requests, rejects other methods with 503
4. **ensureAppSlugItem** - App deployment handler
5. **ensureChatContext** - Chat session handler
6. **appendChatSection** - Message persistence handler
7. **Not-found handler** - Returns 501 for unmatched requests (semantically "Not Implemented")
8. **Error handler** - Catches and formats errors as 500

Each handler has `validate` (arktype schema check) and `handle` (business logic) phases. Some handlers also have a `post` phase for cleanup/logging.

## Data Flow

```
Client (browser)                      Server (CF Worker)
─────────────────                     ──────────────────
VibeDiyApi.ensureAppSlug()        →   cf-serve.ts
        ↓                                   ↓
   WebSocket.send(MsgBox<Req>)    →   WebSocketPair upgrade
                                            ↓
                                      CombinedEventoEnDecoder.encode()
                                            ↓
                                      Evento.trigger() with handlers
                                            ↓
                                      unwrapMsgBase() → extract payload
                                            ↓
                                      checkAuth() → verify token
                                            ↓
                                      handler.handle() → business logic
                                            ↓
                                      D1 queries (Drizzle ORM)
                                            ↓
   MsgBox<Res>                    ←   SendResponseProvider.send()
```

## API Methods

### `ensureAppSlug()`
Deploy an app with a filesystem. Process:
1. Verify auth token (clerk/device-id)
2. Create or retrieve user slug binding
3. Create or retrieve app slug binding
4. Calculate CIDs for all file contents
5. Store assets in D1 `Assets` table
6. Apply transforms (jsx-to-js, import map generation)
7. Create `Apps` record with filesystem manifest
8. Return `entryPointUrl` for iframe loading

### `ensureChatContext()`
Create or retrieve a chat session:
1. If `contextId` provided, verify it exists and belongs to user
2. Otherwise, generate new contextId (12-char ID)
3. Insert into `ChatContexts` table
4. Return `contextId`

### `appendChatSection()`
Add messages to a chat context:
1. Verify context exists and belongs to user
2. Get max `seq` for context, increment
3. Insert into `ChatSections` with `origin` ('user' or 'llm')
4. Blocks use `BlockMsgs | PromptMsg` types from `@vibes.diy/call-ai-v2`
5. Return `seq` number

## CI/CD

The API is bundled into the main vibes.diy Cloudflare Worker (not a separate deployment).

### Workflow

`.github/workflows/vibes-diy-deploy.yaml`

**Triggers:**
- Push to `vibes.diy/**/*` paths
- Tags: `vibes-diy@*`
- Manual dispatch

### Environments

| Trigger | Environment | Domain |
|---------|-------------|--------|
| Tag `vibes-diy@s*` | staging | `*.dev-v2.vibesdiy.net` |
| Tag `vibes-diy@p*` | production | `*.prod-v2.vibesdiy.net` |
| Path push or other tags | dev | `*.dev-v2.vibesdiy.net` |

### Deploy Steps

Deployment is handled by the GitHub Action (`vibes.diy/actions/deploy`). The action runs:

```bash
pnpm run build              # Build React app + bundle worker
pnpm run drizzle:d1-remote  # Run D1 migrations
core-cli writeEnv | wrangler secret bulk  # Push secrets
pnpm run deploy:${ENV}      # wrangler deploy
```

Do not run these manually - push a tag or merge to trigger the workflow.

### Infrastructure

| Resource | Binding | Purpose |
|----------|---------|---------|
| D1 Database | `DB` | Chat contexts, sections, apps |
| Static Assets | `ASSETS` | React app build |

### Server Context (VibesApiSQLCtx)

All handlers receive a shared context via `ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx")`:

```typescript
interface VibesApiSQLCtx {
  sthis: SuperThis;              // Fireproof utilities (logger, nextId, env)
  db: VibesSqlite;               // Drizzle DB instance
  tokenApi: Record<string, FPApiToken>;  // Auth verifiers by type
  deviceCA: DeviceIdCAIf;        // Device ID certificate authority
  logger: Logger;                // Structured logger
  params: VibesFPApiParameters;  // Service configuration
  cache: CfCacheIf;              // Cloudflare cache API
  fetchPkgVersion(pkg): Promise<string | undefined>;  // npm registry lookup
  waitUntil<T>(promise): void;   // CF worker lifecycle
  ensureStorage(...items): Promise<Result<StorageResult[]>>;  // Asset storage
}
```

### D1 Schema

Defined in `svc/sql/vibes-diy-api-schema.ts` using Drizzle ORM.

**Assets** - Binary content storage (could move to R2)
| Column | Type | Description |
|--------|------|-------------|
| `assetId` | text PK | CID of content |
| `content` | blob | Actual content |
| `created` | text | ISO timestamp |

**UserSlugBindings** - Maps users to their human-friendly slugs
| Column | Type | Description |
|--------|------|-------------|
| `userId` | text | User identifier |
| `userSlug` | text | Human-friendly user slug (unique) |
| `created` | text | ISO timestamp |

Primary key: `(userSlug, userId)`. Unique index on `userSlug`.

**AppSlugBindings** - Maps apps to slugs within a user's namespace
| Column | Type | Description |
|--------|------|-------------|
| `userSlug` | text FK | References UserSlugBindings.userSlug |
| `appSlug` | text | Human-friendly app slug |
| `created` | text | ISO timestamp |

Primary key: `(appSlug, userSlug)`.

**Apps** - Deployed app versions with filesystem and environment
| Column | Type | Description |
|--------|------|-------------|
| `appSlug` | text | App identifier |
| `userId` | text | Owner |
| `userSlug` | text | Owner's slug |
| `releaseSeq` | int | Incremented on each deployment |
| `fsId` | text | CID of filesystem manifest |
| `env` | json | Environment variables (VibesEnv) |
| `fileSystem` | json | Array of FileSystemItem with transforms |
| `mode` | text | 'production' or 'dev' |
| `created` | text | ISO timestamp |

Primary key: `(appSlug, userId, releaseSeq)`. Indexes on `fsId` and `created`.

**ChatContexts** - Chat session containers
| Column | Type | Description |
|--------|------|-------------|
| `contextId` | text PK | UUID v4 |
| `userId` | text | Owner |
| `created` | text | ISO timestamp |

**ChatSections** - Individual messages/blocks within a chat
| Column | Type | Description |
|--------|------|-------------|
| `contextId` | text FK | References ChatContexts.contextId |
| `seq` | int | Section sequence number (0-indexed, auto-incremented) |
| `origin` | text | 'user' or 'llm' |
| `blocks` | json | Array of BlockMsgs or PromptMsg from call-ai-v2 |
| `created` | text | ISO timestamp |

Primary key: `(seq, contextId)`.

### Environment Variables

**Required:**
| Variable | Purpose |
|----------|---------|
| `CLOUD_SESSION_TOKEN_PUBLIC` | Public key for cloud session tokens |
| `CLERK_PUBLISHABLE_KEY` | Clerk auth verification |
| `DEVICE_ID_CA_PRIV_KEY` | Device ID certificate authority private key |
| `DEVICE_ID_CA_CERT` | Device ID certificate authority cert |
| `WRAPPER_BASE_URL` | Base URL for app wrapper (e.g., `https://wrapper.vibes.diy`) |
| `FP_VERSION` | Fireproof version for import maps |
| `VIBES_SVC_HOSTNAME_BASE` | Base hostname for deployed apps (e.g., `vibes.app`) |

**Optional (with defaults):**
| Variable | Default | Purpose |
|----------|---------|---------|
| `VIBES_SVC_PROTOCOL` | `https` | Protocol for deployed apps |
| `MAX_APP_SLUG_PER_USER_ID` | `10` | Max app slugs per user |
| `MAX_USER_SLUG_PER_USER_ID` | `10` | Max user slugs per user |
| `MAX_APPS_PER_USER_ID` | `50` | Max app deployments per user |

## Message Types

### VibeFile (for deployment)

Six variants for different content types:

| Type | Content | Use Case |
|------|---------|----------|
| `code-block` | Inline string, `lang: 'jsx' \| 'js'` | JSX/JS source code |
| `code-ref` | `refId` reference | Code stored elsewhere |
| `str-asset-block` | Inline string | CSS, JSON, text files |
| `str-asset-ref` | `refId` reference | String assets stored elsewhere |
| `uint8-asset-block` | `Uint8Array` | Images, fonts, binaries |
| `uint8-asset-ref` | `refId` reference | Binary assets stored elsewhere |

All file types share base properties:
```typescript
{
  filename: string;    // Must start with /, no //, /../, /./
  entryPoint?: boolean; // Last one wins, marks app entry
  mimetype?: string;   // Derived from filename if not set
}
```

### FileSystemItem (stored result)

After processing, files become `FileSystemItem`:
```typescript
{
  fileName: string;
  mimeType: string;
  assetId: string;     // CID of content
  assetURI: string;    // sql://Assets.assetId, s3://..., r2://...
  entryPoint?: boolean;
  size: number;
  transform?: {
    type: 'jsx-to-js' | 'imports' | 'import-map' | 'transformed';
    // ... transform-specific fields
  }
}
```

### Auth Types

```typescript
type DashAuthType = {
  type: 'clerk' | 'device-id';
  token: string;
}
```

Auth is verified via `tokenApi` which supports:
- **clerk** - Clerk JWT verification using `CLERK_PUB_JWT_KEY` / `CLERK_PUB_JWT_URL` env vars
- **device-id** - Device certificate verification using `DEVICE_ID_CA_*` keys

## Client Usage

> [!WARNING]
> The client (`@vibes.diy/api-impl`) is currently a work-in-progress. While it can send requests over WebSocket, the response correlation logic (matching server responses to requests via `tid`) is not yet fully implemented. It is currently primarily used for testing with direct handler calls.

The client is currently used in tests. The main vibes.diy app doesn't use it yet - integration is in progress.

### Creating a Client

```typescript
import { VibeDiyApi } from "@vibes.diy/api-impl";
import { Result } from "@adviser/cement";

const api = new VibeDiyApi({
  apiUrl: "wss://api.vibes.diy/v1/ws",  // Default if omitted
  getToken: async () => {
    // Return auth token (Clerk or device-id)
    return Result.Ok({ type: "clerk", token: clerkToken });
  },
  timeoutMs: 10000,  // Default: 10s request timeout
});
```

The client uses `KeyedResolvOnce` for connection pooling - multiple `VibeDiyApi` instances with the same `apiUrl` share a WebSocket connection. (See `impl/index.ts` for custom message routing options via the `msg` config.)

### Deploying an App

```typescript
const res = await api.ensureAppSlug({
  mode: "dev",  // 'dev' or 'production'
  appSlug: "my-app",      // optional, server generates 3-word slug
  userSlug: "my-user",    // optional, server generates 3-word slug
  env: { API_KEY: "..." },  // optional, passed to app runtime
  fileSystem: [
    {
      type: "code-block",
      lang: "jsx",
      filename: "/App.jsx",  // Must start with /, becomes entry point
      entryPoint: true,
      content: "export default function App() { return <div>Hello</div>; }",
    },
  ],
});

if (res.isOk()) {
  const { entryPointUrl, fsId, userSlug, appSlug, fileSystem } = res.Ok();
  // entryPointUrl -> https://{appSlug}--{userSlug}.{hostnameBase}/~{fsId}~/
  // e.g. https://my-app--my-user.vibes.app/~zABC123~/
  // fsId -> CID of filesystem manifest
  // fileSystem -> Array<FileSystemItem> with assetIds and transforms
}
```

**Response includes:**
- `entryPointUrl` - URL to load in iframe (constructed from `VIBES_SVC_*` config)
- `wrapperUrl` - URL for wrapper page with auth handoff
- `fsId` - CID of the filesystem manifest
- `fileSystem` - Processed `FileSystemItem[]` with CIDs and transforms applied

### Chat Context Management

```typescript
// Create a new chat context (server generates contextId)
const ctx = await api.ensureChatContext({});

// Or retrieve/create with a specific contextId
const ctx = await api.ensureChatContext({ contextId: "my-context-id" });

if (ctx.isOk()) {
  const { contextId } = ctx.Ok();

  // Append a user message
  const userRes = await api.appendChatSection({
    contextId,
    origin: "user",  // 'user' | 'llm'
    blocks: [
      // BlockMsgs or PromptMsg from @vibes.diy/call-ai-v2
      {
        type: "prompt.txt",
        streamId: "stream-1",
        request: { model: "gpt-4", messages: [{ role: "user", content: "Hello" }] },
        timestamp: new Date(),
      },
    ],
  });
  // userRes.Ok().seq -> 0 (first section)

  // Append LLM response
  const llmRes = await api.appendChatSection({
    contextId,
    origin: "llm",
    blocks: sectionBlocks,  // BlockMsgs from call-ai sections stream
  });
  // llmRes.Ok().seq -> 1 (second section)
}
```

**Note:** Context ownership is enforced - you can only append to contexts created by your userId.

### Testing

Tests use a local handler directly rather than WebSocket. See `api/tests/api.test.ts` for the full setup including:
- Creating a local D1/libsql database
- Setting up test device-id auth
- Calling the handler directly

Note: The test passes an ad-hoc `fetch` property via TypeScript structural typing, but this isn't part of the official `VibeDiyApiParam` interface. A proper `fetch` override may be added in the future.

## Running Tests

```bash
cd vibes.diy/api/tests
pnpm test
```

## Implementation Details

### URL Structure

Deployed apps are served via hostname-based routing:

```
https://{appSlug}--{userSlug}.{hostnameBase}/~{fsId}~/
       └────────────────────┘ └──────────┘  └──────┘
              hostname          base domain   version path
```

Example: `https://my-app--fuzzy-purple-elephant.vibes.app/~z4PhNX7vuL~/`

The `extractHostToBindings()` function parses:
- Hostname pattern: `{appSlug}--{userSlug}.{rest}`
- Path pattern: `/~{fsId}~/` (fsId starts with `z`, 8+ chars)
- If no fsId in path, serves latest production release

### Slug Generation

When `appSlug` or `userSlug` are not provided, the server generates 3-word slugs using the `random-words` package:

```typescript
generate({ exactly: 1, wordsPerString: 3, separator: "-" })
// → "fuzzy-purple-elephant"
```

Up to 5 attempts are made to find a unique slug before failing.

### Transform Pipeline

The `write-apps.ts` module applies transforms to uploaded files:

1. **JSX → JS** (`sucrase` with automatic JSX runtime)
   - Input: `code-block` with `lang: "jsx"`
   - Output: `/~~transformed~~/{cid}` with `transform: { type: "transformed", action: "jsx-to-js" }`

2. **Import Extraction** (`acorn` parser)
   - Parses all JS files for `import`/`export` statements
   - Extracts bare specifiers (e.g., `react`, `@fireproof/core`)

3. **Import Map Generation**
   - Unknown packages → npm registry lookup for version → `esm.sh` URL
   - Predefined mappings for React 19.2.1, Fireproof, Clerk, etc.
   - Output: `/~~calculated~~/import-map.json` with `transform: { type: "import-map" }`

### fsId Calculation

The `fsId` is a deterministic CID computed from:
```typescript
hash(sortedFilenames + mimetypes + contentCIDs + sortedEnvJSON)
```

Same files + same env = same fsId (enables deduplication).

### Asset Caching

`serv-entry-point.ts` uses two-tier Cloudflare caching:
1. **Global cache** by CID: `assetCacheUrl/{assetId}`
2. **Path cache** by request URL

On cache miss: D1 query → populate both caches via `waitUntil()`.

### App Eviction

When a user exceeds `MAX_APPS_PER_USER_ID`:
- Oldest `dev` mode apps are evicted first (10% of total + 1)
- `production` apps are preserved
