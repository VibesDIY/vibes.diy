import { VibeDiyApi } from "vibes-diy-api-impl";
import { createHandler } from "vibes-diy-api-svc";
import { createClient } from "@libsql/client/node";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { drizzle } from "drizzle-orm/libsql";
import { BuildURI, Result } from "@adviser/cement";
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
      CLERK_PUBLISHABLE_KEY: "pk_test_cHJlY2lzZS1jb2x0LTQ5LmNsZXJrLmFjY291bnRzLmRldiQ",
      DEVICE_ID_CA_PRIV_KEY: await sts.jwk2env(await deviceCA.getCAKey().exportPrivateJWK()),
      DEVICE_ID_CA_CERT: await deviceCA.caCertificate().then((r) => r.Ok().jwtStr),

      CLOUD_SESSION_TOKEN_SECRET:
        "z33KxHvFS3jLz72v9DeyGBqo7H34SCC1RA5LvQFCyDiU4r4YBR4jEZxZwA9TqBgm6VB5QzwjrZJoVYkpmHgH7kKJ6Sasat3jTDaBCkqWWfJAVrBL7XapUstnKW3AEaJJKvAYWrKYF9JGqrHNU8WVjsj3MZNyqqk8iAtTPPoKtPTLo2c657daVMkxibmvtz2egnK5wPeYEUtkbydrtBzteN25U7zmGqhS4BUzLjDiYKMLP8Tayi",

      WRAPPER_BASE_URL: "https://tbd",
      ENTRY_POINT_TEMPLATE_URL:
        // "http://{fsId}{.groupid}.localhost.adviser.com/entry-point",
        "http://{fsId}.localhost.adviser.com/entry-point",
      FP_VERSION: "0.24.8-dev-test-device-id",

      VIBES_SVC_HOSTNAME_BASE: "localhost.vibesdiy.net",
      VIBES_SVC_PROTOCOL: "http",
      CALLAI_API_KEY: "what-ever",
      CALLAI_CHAT_URL: "what-ever",
    };

    svc = await createHandler({
      db,
      cache: {
        put: async (_req: Request, _res: Response) => {
          /* noop */
        },
        match: async (_req: Request) => {
          return null;
        },
      },
      fetchPkgVersion: async (_pkg: string) => {
        return "1.2.3";
      },
      env,
    });
    api = new VibeDiyApi({
      fetch: (input, init?) => {
        return svc(new Request(input, init));
      },
      getToken: async () => {
        return Result.Ok(await testUser.getDashBoardToken());
      },
    });
  });

  it("does defaults", async () => {
    const res = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "console.log('hello world');",
        },
      ],
    });
    expect(res.Ok().appSlug.length).toBeGreaterThan(3);
    expect(res.Ok().userSlug.length).toBeGreaterThan(3);

    const res1 = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "console.log('hello world');",
        },
      ],
    });
    expect(res.Ok().fsId).toBe(res1.Ok().fsId);
    expect(res.Ok().appSlug).not.toBe(res1.Ok().appSlug);
    expect(res.Ok().userSlug).not.toBe(res1.Ok().userSlug);
  });

  it("render iframe content page", async () => {
    // this is the iframe content page
    const res = await api.ensureAppSlug({
      mode: "dev",
      env: {
        TEST_ENV_VAR: "testVar",
      },
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `export default function App() { return <div>Hello VibesDiy</div>; } console.log('hello world');`,
        },
      ],
    });
    const resIframe = await api.cfg.fetch(res.Ok().entryPointUrl);
    expect(resIframe.status).toBe(200);
    const iframeText = await resIframe.text();
    const imports = [...iframeText.matchAll(/^import \* as V\d+ from "(~~transformed~~\/[^"]*)"/gm)];
    for (const imp of imports || []) {
      const importFile = await api.cfg.fetch(BuildURI.from(res.Ok().entryPointUrl).appendRelative(imp[1]).toString());
      expect(importFile.status).toBe(200);
      const importText = await importFile.text();
      expect(importText).toContain(`console.log('hello world');`);
    }
  });

  it("repeatable stable ensureAppSlug", async () => {
    const now = Date.now();
    for (let i = 0; i < 2; i++) {
      const res = await api.ensureAppSlug({
        mode: "dev",
        appSlug: "sand-nose-hope",
        userSlug: `immediately-steel-${now}`,
        env: {
          TEST_ENV_VAR: "hello world",
        },
        fileSystem: [
          {
            type: "code-block",
            lang: "jsx",
            filename: "/App.jsx",
            content: [
              "import na from 'find-up';",
              "function App() {",
              "  return <div>Hello VibesDiy</div>;",
              "}",
              "console.log('hello world');",
              "App();",
            ]
              .map((i) => i.trim())
              .join("\n"),
          },
        ],
      });
      // console.log("ensureAppSlug res", res);
      expect(res.Ok()).toEqual({
        appSlug: "sand-nose-hope",
        entryPointUrl: `http://sand-nose-hope--immediately-steel-${now}.localhost.vibesdiy.net/~zGDU8X6kbHpi3Uxf7jMZMhUTad4VbtrmrwuRxtpzXxn7s~/`,
        env: {
          TEST_ENV_VAR: "hello world",
        },
        fileSystem: [
          {
            assetId: "zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
            assetURI: "sql://Assets/zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
            fileName: "/App.jsx",
            mimeType: "text/jsx",
            size: expect.any(Number),
            transform: {
              type: "jsx-to-js",
              transformedAssetId: "zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK",
            },
          },
          {
            assetId: "zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK",
            assetURI: "sql://Assets/zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK",
            fileName: "/~~transformed~~/zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
            mimeType: "application/javascript",
            size: 276,
            transform: {
              action: "jsx-to-js",
              transformedAssetId: "zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
              type: "transformed",
            },
          },
          {
            assetId: "z8SQeNpedZd3Tzj4WPTmWYzKPVY9qBnNnJ8TQ8jR3G9GC",
            assetURI: "sql://Assets/z8SQeNpedZd3Tzj4WPTmWYzKPVY9qBnNnJ8TQ8jR3G9GC",
            fileName: "/~~calculated~~/import-map.json",
            mimeType: "application/importmap+json",
            size: 6822,
            transform: {
              fromAssetIds: ["/App.jsx"],
              type: "import-map",
            },
          },
        ],
        fsId: "zGDU8X6kbHpi3Uxf7jMZMhUTad4VbtrmrwuRxtpzXxn7s",
        mode: "dev",
        type: "vibes.diy.res-ensure-app-slug",
        userSlug: `immediately-steel-${now}`,
        wrapperUrl: `https://tbd/immediately-steel-${now}/sand-nose-hope/zGDU8X6kbHpi3Uxf7jMZMhUTad4VbtrmrwuRxtpzXxn7s`,
      });
    }
  });
});
