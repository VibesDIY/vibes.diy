import type {
  D1Database,
  DurableObjectNamespace,
  Queue,
  R2Bucket,
  Request as CFRequest,
} from "@cloudflare/workers-types";

export interface CFEnv {
  DB: D1Database;
  ASSETS: {
    fetch: (input: CFRequest | RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  };
  VIBES_SERVICE: Queue;
  CHAT_SESSIONS: DurableObjectNamespace;
  FS_IDS_BUCKET: R2Bucket;
  BROWSER: unknown;
  VIBES_SVC_HOSTNAME_BASE: string;
}
