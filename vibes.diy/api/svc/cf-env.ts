import { D1Database, Fetcher } from "@cloudflare/workers-types";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
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
}
