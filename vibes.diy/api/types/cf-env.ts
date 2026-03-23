import { D1Database, DurableObjectNamespace, Queue, Fetcher, R2Bucket } from "@cloudflare/workers-types";

export interface CFEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  FS_IDS_BUCKET: R2Bucket;

  VIBES_SVC_HOSTNAME_BASE: string;
  VIBES_SVC_PROTOCOL: string;
  VIBES_SVC_PORT?: string;
  // Add more bindings here as needed
  MAX_TENANTS?: number;
  MAX_ADMIN_USERS?: number;
  MAX_MEMBER_USERS?: number;
  MAX_INVITES?: number;
  MAX_LEDGERS?: number;
  MAX_APPID_BINDINGS?: number;

  CLERK_PUBLISHABLE_KEY: string;
  CLOUD_SESSION_TOKEN_PUBLIC: string;
  DB_FLAVOUR?: string;
  NEON_DATABASE_URL?: string;

  CHAT_SESSIONS: DurableObjectNamespace;
  VIBES_SERVICE: Queue;
  BROWSER: Fetcher; // screenshotter uses Cloudflare's Browser Rendering API, which is accessed via a Fetcher binding
}
