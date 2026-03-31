import { loadAsset, Result, string2stream } from "@adviser/cement";
import { DeviceIdCA } from "@fireproof/core-device-id";
import { ensureSuperThis, sts } from "@fireproof/core-runtime";
import { createAppContext, noopCache } from "@vibes.diy/api-svc";
import { MsgBase } from "@vibes.diy/api-types";
import { createVibesApiTables, toDBFlavour, VibesSqlite } from "@vibes.diy/api-sql";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { createClient } from "@libsql/client/node";
import { inject } from "vitest";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

async function createDrizzleDB(): Promise<VibesSqlite> {
  const flavour = (inject("DB_FLAVOUR" as never) as string) ?? "sqlite";

  if (flavour === "pg") {
    const neonUrl = inject("VIBES_DIY_TEST_NEON_URL" as never) as string;
    const pool = new Pool({ connectionString: neonUrl });
    return drizzleNeon(pool) as unknown as VibesSqlite;
  }

  const url = inject("VIBES_DIY_TEST_SQL_URL" as never) as string;
  const client = createClient({ url });
  return drizzleLibsql(client) as unknown as VibesSqlite;
}

export async function createVibeDiyTestCtx(sthis: ReturnType<typeof ensureSuperThis>, deviceCA: DeviceIdCA) {
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
    FPCLOUD_URL: "fpcloud-url",
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

  return createAppContext({
    sthis,

    storageSystems: {
      sql: {
        flavour,
        db: drizzleDB,
        assets: createVibesApiTables(flavour).assets,
      },
    },
    fetchAsset: async (url: string) => {
      if (url.endsWith("models.json")) {
        return Result.Ok(
          await string2stream(
            JSON.stringify([
              {
                id: "anthropic/claude-opus-4.5",
                name: "Claude Opus 4.5 (Default)",
                description:
                  "Claude Opus 4.5 is Anthropic's most powerful model, offering the best performance for complex reasoning, coding, and creative tasks",
                featured: true,
                preSelected: ["chat", "app", "img"],
              },
            ])
          )
        );
      }
      throw new Error(`fetchAsset not implemented in test for url: ${url}`);
    },
    postQueue: async (_msg: MsgBase) => {
      // throw new Error(`postQueue not implemented in test for msg: ${JSON.stringify(msg)}`);
    },
    llmRequest: async (prompt: LLMRequest) => {
      // console.log("Received LLM request in test llmRequest handler with messages:", prompt.messages.filter((m) => m.content.some((c) => c.type === "text")).map((m) => m.content.filter((c) => c.type === "text").map((c) => c.text).join("\n")).join("\n---\n"));
      if (prompt.messages[0]?.content?.some((c) => c.type === "text" && c.text.includes("use fixture response"))) {
        const fixture = await loadAsset("./fixture.llm", { basePath: () => import.meta.url });
        return new Response(fixture.Ok(), { status: 200 });
      }
      // console.log("Received LLM request in test llmRequest handler with messages:", prompt.messages);
      return new Response("", { status: 200 });
    },
    netHash: () => "test-hash",
    connections: new Set(),
    env,
    db: drizzleDB,
    cache: noopCache,
  });
}
