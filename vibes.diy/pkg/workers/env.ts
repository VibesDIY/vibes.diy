import { D1Database, DurableObjectNamespace, Queue, Fetcher } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  VIBES_SVC_HOSTNAME_BASE: string;
  // Add more bindings here as needed
  MAX_TENANTS?: number;
  MAX_ADMIN_USERS?: number;
  MAX_MEMBER_USERS?: number;
  MAX_INVITES?: number;
  MAX_LEDGERS?: number;
  MAX_APPID_BINDINGS?: number;

  CLERK_PUBLISHABLE_KEY: string;
  CLOUD_SESSION_TOKEN_PUBLIC: string;

  CHAT_SESSIONS: DurableObjectNamespace;
  VIBES_SERVICE: Queue;
  BROWSER: Fetcher; // screenshotter uses Cloudflare's Browser Rendering API, which is accessed via a Fetcher binding
}
