import type { D1Database } from "@cloudflare/workers-types";
import type { R2BucketIf } from "./intern/asset-provider.js";

export interface Env {
  DB: D1Database;
  ASSETS_BUCKET?: R2BucketIf;
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
