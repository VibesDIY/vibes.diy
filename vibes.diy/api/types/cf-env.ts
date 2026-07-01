import { D1Database, DurableObjectNamespace, Queue, Fetcher, R2Bucket } from "@cloudflare/workers-types";

export interface CFEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  FS_IDS_BUCKET: R2Bucket;

  VIBES_SVC_HOSTNAME_BASE: string;
  VIBES_SVC_PROTOCOL: string;
  VIBES_SVC_PORT?: string;

  // Self-hosted workspace npm URL, carries this deploy's ?v=<commit-sha> stamp
  // (appended in actions/deploy/action.yaml). Used to decide /vibe-pkg/ caching.
  WORKSPACE_NPM_URL?: string;
  // Add more bindings here as needed
  MAX_TENANTS?: number;
  MAX_ADMIN_USERS?: number;
  MAX_MEMBER_USERS?: number;
  MAX_INVITES?: number;
  MAX_LEDGERS?: number;
  MAX_APPID_BINDINGS?: number;
  // Codegen-DO admission limit (concurrent streams) — overrides
  // MAX_CONCURRENT_CODEGEN_STREAMS default when set.
  MAX_CONCURRENT_CODEGEN_STREAMS?: number;

  CLERK_PUBLISHABLE_KEY: string;
  CLOUD_SESSION_TOKEN_PUBLIC: string;
  DB_FLAVOUR?: string;
  NEON_DATABASE_URL?: string;

  VIBES_DIY_PUBLIC_BASE_URL: string;
  RESEND_API_KEY: string;
  VIBES_DIY_FROM_EMAIL: string;
  DISCORD_WEBHOOK_URL?: string;

  LLM_BACKEND_URL: string;
  LLM_BACKEND_API_KEY: string;
  PRODIA_TOKEN?: string;
  ICON_FALLBACK_MODEL?: string;

  // #2714 Spec B — the unified session class (the old CHAT_/APP_/SHARED_SESSIONS
  // bindings were retired in Phase E). SESSIONS carries the vibe + shared planes;
  // CODEGEN_SESSIONS the codegen plane. Both bind class "Sessions"; they are
  // separate handles so cli can cross-script SESSIONS→prod (shared data plane)
  // while keeping CODEGEN_SESSIONS local (per-env codegen isolation).
  SESSIONS: DurableObjectNamespace;
  CODEGEN_SESSIONS: DurableObjectNamespace;
  USER_NOTIFY: DurableObjectNamespace;

  // Per-app backend.js (#2856). BACKEND_DO is the per-vibe backend Durable Object
  // (B3). BACKEND_JS gates the runtime ("off" | "loader"); absent/anything-else ⇒
  // off, so the backend stays dark. LOADER is the Cloudflare Worker Loader binding
  // (open beta, absent until GA) — typed loosely here to avoid a vibe-runtime dep
  // in api-types; the BackendDO casts it. Undefined LOADER ⇒ no live isolate.
  BACKEND_DO: DurableObjectNamespace;
  BACKEND_JS?: string;
  LOADER?: unknown;
  BACKEND_POLICY_VERSION?: string;
  // Shared secret that authorizes the BackendDO control-plane pokes (arm/onChange)
  // against forged pokes from inside the untrusted isolate (#2856 security). The
  // isolate's `globalOutbound` self-stub can POST arbitrary requests to the DO, but
  // it has no worker `env`, so it can't produce this. Trusted callers (the queue
  // consumer's `QueueCtx`) attach it; the DO requires it for arm/onChange WHEN set.
  // Optional + merge-safe: when unset the DO stays permissive (unchanged behavior),
  // so it activates only once provisioned in BOTH the main-worker and queue-consumer
  // envs. Never enters the isolate's `WorkerCode.env`.
  BACKEND_INTERNAL_SECRET?: string;

  VIBES_SERVICE: Queue;
  BROWSER: Fetcher; // screenshotter uses Cloudflare's Browser Rendering API, which is accessed via a Fetcher binding
  META_CAPI_TOKEN?: string;
  META_PIXEL_ID?: string;
  META_ACCESS_TOKEN?: string;
  META_AD_ACCOUNT_ID?: string;
  CLERK_WEBHOOK_SECRET?: string;
}
