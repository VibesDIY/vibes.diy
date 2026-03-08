// Cloudflare Workers environment bindings.
// TODO: generate from wrangler.toml or wrangler types command.

import type { D1Database, DurableObjectNamespace, Fetcher, Queue, R2Bucket } from "@cloudflare/workers-types";

export interface CFEnv {
  readonly DB: D1Database;
  readonly ASSETS: Fetcher;
  readonly CHAT_SESSIONS: DurableObjectNamespace;
  readonly VIBES_SERVICE: Queue;
  readonly VIBES_SVC_HOSTNAME_BASE: string;
  readonly BROWSER: unknown;
  readonly FS_IDS_BUCKET: R2Bucket;
}
