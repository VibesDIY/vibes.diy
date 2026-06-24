import { loadAsset, Result, string2stream } from "@adviser/cement";
import { DeviceIdCA } from "@fireproof/core-device-id";
import { ensureSuperThis, sts } from "@fireproof/core-runtime";
import { createAppContext, noopCache } from "@vibes.diy/api-svc";
import {
  type AccessDescriptor,
  type EvtRequestGrant,
  type EvtViewerGrantsChanged,
  type LLMHeaders,
  type Model,
  MsgBase,
  S3Api,
} from "@vibes.diy/api-types";
import { StubS3Api } from "./stub-s3-api.js";
import { createVibesApiTables, toDBFlavour, VibesSqlite } from "@vibes.diy/api-sql";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { createClient } from "@libsql/client/node";
import { inject } from "vitest";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import fs from "fs/promises";
import path from "node:path";

let isolationCounter = 0;

/**
 * Fail-closed default for `inferenceFetch` in tests: any un-mocked external
 * inference request throws a clear, actionable error naming the host instead of
 * hitting the wire. Mirrors the `fetchAsset` precedent below. Tests that need a
 * real response inject `inferenceFetch` via opts. See VibesDIY/vibes.diy#2481.
 */
const failClosedInferenceFetch: typeof fetch = (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  return Promise.reject(new Error(`network request in test — inject a mock or add a fixture: ${url}`));
};

// Per-process, WAL-checkpointed copy of the schema'd DB that
// globalSetup.libsql.ts builds once per run. Memoized so the work happens at
// most once per worker; every isolated test DB is stamped out from it.
let templatePromise: Promise<string> | undefined;

/**
 * Make a pristine, self-contained template to copy per-test from.
 *
 * The source is `dist/dash-backend.sqlite`, which globalSetup.libsql.ts rebuilds
 * with a real `drizzle-kit push` at the start of every run — so it is the
 * retained push canary AND can never be stale relative to the schema (no
 * hashing/cache-invalidation needed). We never mutate that shared file: we copy
 * it once per worker and `wal_checkpoint(TRUNCATE)` the copy so a plain
 * `copyFile` of just the `.sqlite` is a consistent snapshot.
 */
async function ensureTemplate(distDir: string): Promise<string> {
  const provided = inject("VIBES_DIY_TEST_SQL_URL" as never) as string | undefined;
  if (provided === undefined) {
    throw new Error("VIBES_DIY_TEST_SQL_URL not provided — globalSetup.libsql.ts must run before sqlite tests");
  }
  const sourcePath = new URL(provided).pathname;
  // Include the Vitest worker id alongside the pid: under the default forks
  // pool each worker is its own process (pid suffices), but threads share a
  // pid — the worker id keeps the template path collision-free either way.
  const workerId = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? "0";
  const templatePath = path.join(distDir, `template-${process.pid}-${workerId}.sqlite`);
  await Promise.all([
    fs.rm(templatePath, { force: true }),
    fs.rm(`${templatePath}-wal`, { force: true }),
    fs.rm(`${templatePath}-shm`, { force: true }),
  ]);
  // Copy the source plus any WAL/SHM sidecars so the snapshot is consistent
  // even if globalSetup left an un-checkpointed WAL behind.
  await fs.copyFile(sourcePath, templatePath);
  for (const ext of ["-wal", "-shm"]) {
    try {
      await fs.copyFile(`${sourcePath}${ext}`, `${templatePath}${ext}`);
    } catch (err) {
      // A missing sidecar is expected (globalSetup typically checkpoints on
      // close); ignore only that. Any other I/O error is real — rethrow.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  const client = createClient({ url: `file://${templatePath}` });
  try {
    await client.execute("PRAGMA wal_checkpoint(TRUNCATE)");
  } finally {
    client.close();
  }
  await Promise.all([fs.rm(`${templatePath}-wal`, { force: true }), fs.rm(`${templatePath}-shm`, { force: true })]);
  return templatePath;
}

async function createIsolatedSqliteDB(): Promise<string> {
  const root = path.dirname(new URL(import.meta.url).pathname);
  const distDir = path.join(root, "dist");
  await fs.mkdir(distDir, { recursive: true });

  // Don't memoize a rejection forever: if the one-time template build fails
  // transiently, clear the cached promise so the next context can retry.
  templatePromise ??= ensureTemplate(distDir).catch((err) => {
    templatePromise = undefined;
    throw err;
  });
  const templatePath = await templatePromise;

  const name = `test-${process.pid}-${++isolationCounter}`;
  const basePath = path.join(distDir, `dash-backend-${name}.sqlite`);
  await Promise.all([
    fs.rm(basePath, { force: true }),
    fs.rm(`${basePath}-wal`, { force: true }),
    fs.rm(`${basePath}-shm`, { force: true }),
  ]);
  // Copy the prebuilt template instead of re-running drizzle-kit: each test
  // still gets a fully isolated, fresh database (guardrail: isolation
  // preserved), just without paying the subprocess cost per context.
  await fs.copyFile(templatePath, basePath);
  return `file://${basePath}`;
}

async function createDrizzleDB(): Promise<VibesSqlite> {
  const flavour = (inject("DB_FLAVOUR" as never) as string) ?? "sqlite";

  if (flavour === "pg") {
    const pgUrl =
      (inject("VIBES_DIY_TEST_PG_URL" as never) as string | undefined) ??
      (inject("VIBES_DIY_TEST_NEON_URL" as never) as string | undefined);
    if (!pgUrl) {
      throw new Error("VIBES_DIY_TEST_PG_URL (or VIBES_DIY_TEST_NEON_URL) must be provided for pg tests");
    }

    // Local proxy hooks for ephemeral Postgres CI: when set, route Pool
    // WebSockets through the configured proxy endpoint instead of Neon's /v2.
    const wsProxy = process.env.VIBES_DIY_TEST_PG_WS_PROXY;
    if (wsProxy) {
      neonConfig.wsProxy = () => wsProxy;
    }
    const useSecureWs = process.env.VIBES_DIY_TEST_PG_USE_SECURE_WS;
    if (useSecureWs === "0") {
      neonConfig.useSecureWebSocket = false;
    } else if (useSecureWs === "1") {
      neonConfig.useSecureWebSocket = true;
    }

    const pool = new Pool({ connectionString: pgUrl });
    return drizzleNeon(pool) as unknown as VibesSqlite;
  }

  const url = await createIsolatedSqliteDB();
  const client = createClient({ url });
  return drizzleLibsql(client) as unknown as VibesSqlite;
}

export interface CreateVibeDiyTestCtxOpts {
  s3?: S3Api;
  models?: Model[];
  llmRequest?(prompt: LLMRequest & { headers: LLMHeaders }, opts?: { readonly signal?: AbortSignal }): Promise<Response>;
  // Injectable inference fetch seam (Prodia + call-ai). When omitted the test
  // ctx installs a fail-closed default that throws on any call, so an un-mocked
  // external request in a test is a loud, deterministic error (#2481).
  inferenceFetch?: typeof fetch;
  // Override teeWriter peerTimeout for tests (default 30s in production).
  // Canary tests set this small (e.g. 200ms) so deadlines fire fast.
  peerTimeout?: number;
  notifyRequestGrantChanged?(evt: EvtRequestGrant, senderConnId: string): Promise<void>;
  notifyViewerGrantsChanged?(evt: EvtViewerGrantsChanged, senderConnId: string): Promise<void>;
  notifyDocChanged?(
    evt: { ownerHandle: string; appSlug: string; dbName: string; docId: string; channel?: string },
    senderConnId: string
  ): Promise<void>;
  invokeAccessFn?(params: {
    cid: string;
    doc: unknown;
    oldDoc: unknown | null;
    user: { userHandle: string; displayName?: string } | null;
    source?: string;
    grantState?: {
      members: Record<string, string[]>;
      roleGrants: Record<string, string[]>;
      userGrants: Record<string, string[]>;
    };
    adminMode?: boolean;
  }): Promise<AccessDescriptor | { forbidden: string }>;
}

export async function createVibeDiyTestCtx(
  sthis: ReturnType<typeof ensureSuperThis>,
  deviceCA: DeviceIdCA,
  opts: CreateVibeDiyTestCtxOpts = {}
) {
  const flavour = toDBFlavour(inject("DB_FLAVOUR" as never) as string);
  const drizzleDB = await createDrizzleDB();

  const env = {
    CLOUD_SESSION_TOKEN_PUBLIC:
      "zeWndr5LEoaySgKSo2aZniYqZ3z6Ecx3Z6qFThtXC8aMEAx6oDFMKgm3SptRgHhN4UxFSvTnmU5HXNrF6cZ4dBz6Ddphq8hsxzUKbryaBu5AFnbNyHrZEod2uw2q2UnPgeEdTDszU1AzSn7iiEfSv4NZ17ENVx7WfRAY8J8F1aog8",
    CLERK_PUBLISHABLE_KEY: "pk_test_cHJlY2lzZS1jb2x0LTQ5LmNsZXJrLmFjY291bnRzLmRldiQ",
    DEVICE_ID_CA_PRIV_KEY: await sts.jwk2env(await deviceCA.getCAKey().exportPrivateJWK()),
    DEVICE_ID_CA_CERT: await deviceCA.caCertificate().then((r) => r.Ok().jwtStr),

    CLOUD_SESSION_TOKEN_SECRET:
      "z33KxHvFS3jLz72v9DeyGBqo7H34SCC1RA5LvQFCyDiU4r4YBR4jEZxZwA9TqBgm6VB5QzwjrZJoVYkpmHgH7kKJ6Sasat3jTDaBCkqWWfJAVrBL7XapUstnKW3AEaJJKvAYWrKYF9JGqrHNU8WVjsj3MZNyqqk8iAtTPPoKtPTLo2c657daVMkxibmvtz2egnK5wPeYEUtkbydrtBzteN25U7zmGqhS4BUzLjDiYKMLP8Tayi",

    ENTRY_POINT_TEMPLATE_URL:
      // "http://{fsId}{.groupid}.localhost.adviser.com/entry-point",
      "http://{fsId}.localhost.adviser.com/entry-point",
    FP_VERSION: "0.24.8-dev-test-device-id",

    VIBES_SVC_HOSTNAME_BASE: "localhost.vibesdiy.net",
    VIBES_SVC_PORT: "8787",
    VIBES_SVC_PROTOCOL: "http",
    CALLAI_API_KEY: "what-ever",
    CALLAI_CHAT_URL: "what-ever",

    LLM_BACKEND_URL: "http://what-ever",
    ENVIRONMENT: "test",

    LLM_BACKEND_API_KEY: "llm-api-key",
    DASHBOARD_URL: "dashboard-url",
    DEV_SERVER_HOST: "localhost",
    DEV_SERVER_PORT: "8787",

    RESEND_API_KEY: "resend-key",
    VIBES_DIY_PUBLIC_BASE_URL: "https://no-where",

    CLOUD_SESSION_TOKEN_ISSUER: "vibes-diy-test-issuer",

    MAX_APP_SLUG_PER_USER_ID: "10000",
    MAX_USER_SLUG_PER_USER_ID: "10000",
    MAX_APPS_PER_USER_ID: "50000",

    DB_FLAVOUR: flavour,
  };

  const defaultModels: Model[] = [
    {
      id: "anthropic/claude-opus-4.5",
      name: "Claude Opus 4.5 (Default)",
      description:
        "Claude Opus 4.5 is Anthropic's most powerful model, offering the best performance for complex reasoning, coding, and creative tasks",
      featured: true,
      preSelected: ["codegen", "runtime", "img"],
      imageInput: true,
    },
    {
      id: "anthropic/claude-sonnet-4.6",
      name: "Claude Sonnet 4.6",
      description: "Claude Sonnet 4.6 is Anthropic's most advanced Sonnet model to date",
      featured: true,
      supports: ["codegen", "runtime"],
      imageInput: true,
    },
    {
      id: "google/gemini-3.1-pro-preview",
      name: "Gemini 3.1 Pro",
      description: "Gemini 3.1 Pro is Google's frontier reasoning model for software engineering and agentic tasks",
      featured: true,
      fallbackFor: ["codegen", "runtime"],
      supports: ["codegen", "runtime"],
      imageInput: true,
    },
    {
      id: "deepseek/deepseek-chat-v3.1",
      name: "DeepSeek V3.1",
      description: "DeepSeek V3.1 is a text-only chat model (no image input).",
      supports: ["codegen", "runtime"],
    },
  ];

  return createAppContext({
    sthis,

    storageSystems: {
      sql: {
        flavour,
        db: drizzleDB,
        assets: createVibesApiTables(flavour).assets,
      },
      // Default to an in-memory S3 stub so >4KB content has somewhere to go.
      // Tests can pass a custom stub (e.g. with hangPut=true) to override.
      s3: opts.s3 ?? new StubS3Api(),
      ...(opts.peerTimeout !== undefined ? { peerTimeout: opts.peerTimeout } : {}),
    },
    fetchAsset: async (url: string) => {
      if (url.endsWith("models.json")) {
        return Result.Ok(await string2stream(JSON.stringify(opts.models ?? defaultModels)));
      }
      throw new Error(`fetchAsset not implemented in test for url: ${url}`);
    },
    postQueue: async (_msg: MsgBase) => {
      // throw new Error(`postQueue not implemented in test for msg: ${JSON.stringify(msg)}`);
    },
    llmRequest:
      opts.llmRequest ??
      (async (prompt: LLMRequest & { headers: LLMHeaders }) => {
        if (prompt.messages[0]?.content?.some((c) => c.type === "text" && c.text.includes("use fixture response"))) {
          const fixture = await loadAsset("./fixture.llm", { basePath: () => import.meta.url });
          return new Response(fixture.Ok(), { status: 200 });
        }
        return new Response("", { status: 200 });
      }),
    inferenceFetch: opts.inferenceFetch ?? failClosedInferenceFetch,
    netHash: () => "test-hash",
    connections: new Set(),
    env,
    db: drizzleDB,
    cache: noopCache,
    notifyRequestGrantChanged: opts.notifyRequestGrantChanged,
    notifyViewerGrantsChanged: opts.notifyViewerGrantsChanged,
    notifyDocChanged: opts.notifyDocChanged,
    ...(opts?.invokeAccessFn ? { invokeAccessFn: opts.invokeAccessFn } : {}),
  });
}
