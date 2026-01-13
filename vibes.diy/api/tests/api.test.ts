import { VibeDiyApi } from "vibes-diy-api-impl";
import { createHandler } from "vibes-diy-api-svc";
import { createClient } from "@libsql/client/node";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { drizzle } from "drizzle-orm/libsql";
import { Result } from "@adviser/cement";
import { ensureSuperThis, sts } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";

describe("VibesDiyApi", () => {
  const sthis = ensureSuperThis();
  const url = inject("VIBES_DIY_TEST_SQL_URL" as never) as string;
  const client = createClient({ url });
  const db = drizzle(client);

  let svc: Awaited<ReturnType<typeof createHandler>>;
  let api: VibeDiyApi;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);

    const testUser = await createTestUser({ sthis, deviceCA });

    const env = {
      CLOUD_SESSION_TOKEN_PUBLIC:
        "zeWndr5LEoaySgKSo2aZniYqZ3z6Ecx3Z6qFThtXC8aMEAx6oDFMKgm3SptRgHhN4UxFSvTnmU5HXNrF6cZ4dBz6Ddphq8hsxzUKbryaBu5AFnbNyHrZEod2uw2q2UnPgeEdTDszU1AzSn7iiEfSv4NZ17ENVx7WfRAY8J8F1aog8",
      CLERK_PUBLISHABLE_KEY:
        "pk_test_cHJlY2lzZS1jb2x0LTQ5LmNsZXJrLmFjY291bnRzLmRldiQ",
      DEVICE_ID_CA_PRIV_KEY: await sts.jwk2env(
        await deviceCA.getCAKey().exportPrivateJWK()
      ),
      DEVICE_ID_CA_CERT: await deviceCA
        .caCertificate()
        .then((r) => r.Ok().jwtStr),

      CLOUD_SESSION_TOKEN_SECRET:
        "z33KxHvFS3jLz72v9DeyGBqo7H34SCC1RA5LvQFCyDiU4r4YBR4jEZxZwA9TqBgm6VB5QzwjrZJoVYkpmHgH7kKJ6Sasat3jTDaBCkqWWfJAVrBL7XapUstnKW3AEaJJKvAYWrKYF9JGqrHNU8WVjsj3MZNyqqk8iAtTPPoKtPTLo2c657daVMkxibmvtz2egnK5wPeYEUtkbydrtBzteN25U7zmGqhS4BUzLjDiYKMLP8Tayi",
    };

    svc = await createHandler(db, env);
    api = new VibeDiyApi({
      fetch: (input, init?) => {
        return svc(new Request(input, init));
      },
      getToken: async () => {
        return Result.Ok(await testUser.getDashBoardToken());
      },
    });
  });

  it("results from internal binding ensureAppSlug", async () => {
    for (let i = 0; i < 2; i++) {
      const res = await api.ensureAppSlug({
        mode: "dev",
        appSlug: "sand-nose-hope",
        userSlug: "immediately-steel-four",
        env: {
          TEST_ENV_VAR: "hello world",
        },
        fileSystem: [
          {
            type: "code-block",
            lang: "jsx",
            filename: "/App.jsx",
            content: "console.log('hello world');",
          },
        ],
      });
      console.log("ensureAppSlug res", res);
      expect(res.Ok()).toEqual({
        appSlug: "sand-nose-hope",
        entryPointUrl: "string",
        env: {
          TEST_ENV_VAR: "hello world",
        },
        fileSystem: [
          {
            assetURI:
              "sql://Assets/zJ5Xm25YRTgvPVrrVTaR9p23jySFXy7qZg5K1gpT1NbXj",
            fileName: "/App.jsx",
            mimeType: "text/jsx",
            size: 27,
            transform: "jsx-to-js",
          },
        ],
        fsId: "z4pHQcuf8m2NRERgnFW6uRRD6twRd3fDq9UJC5yV2P3oT",
        mode: "dev",
        type: "vibes.diy.res-ensure-app-slug",
        userSlug: "immediately-steel-four",
        wrapperUrl: "string",
      });
    }
  });
});
