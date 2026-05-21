import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { loadAsset, processStream, Result, TestFetchPair, TestWSPair, sleep } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import {
  calcEntryPointUrl,
  CFInject,
  cfServe,
  handlePromptContext,
  noopCache,
  VibesApiSQLCtx,
  vibesMsgEvento,
  WSSendProvider,
} from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { BlockEndMsg, BlockMsgs, isBlockStreamMsg } from "@vibes.diy/call-ai-v2";
import {
  isActiveDbAcl,
  isActiveEnv,
  isActiveIconDescription,
  isActiveSkills,
  isActiveTheme,
  isActiveTitle,
  isEnablePublicAccess,
  isEnableRequest,
  isPromptBlockEnd,
  isResEnsureAppSlugOk,
  PromptAndBlockMsgs,
  PromptMsgs,
  ReqPromptChatSection,
  ReqWithVerifiedAuth,
  SectionEvent,
} from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { and, eq } from "drizzle-orm/sql/expressions";
import { type } from "arktype";
import type { Model, VibeFile } from "@vibes.diy/api-types";

/** Minimal Model object for test fixtures */
function m(id: string): Model {
  return { id, name: id, description: id };
}

function toByPromptIds(calls: unknown[][]): Record<string, PromptAndBlockMsgs[]> {
  return calls.reduce(
    (acc, call) => {
      const msg = call[0] as SectionEvent;
      if (!acc[msg.promptId]) {
        acc[msg.promptId] = [];
      }
      for (const block of msg.blocks) {
        acc[msg.promptId].push(block);
      }
      return acc;
    },
    {} as Record<string, PromptAndBlockMsgs[]>
  );
}

function emptySectorStream(chatId: string, promptId: string, index: number) {
  return [
    {
      chatId,
      seq: 0,
      streamId: expect.any(String),
      timestamp: expect.any(Date),
      type: "prompt.block-begin",
    },
    {
      chatId,
      seq: 1,
      streamId: expect.any(String),
      timestamp: expect.any(Date),
      request: {
        messages: [{ content: [{ type: "text", text: `Hello world ${index}` }], role: "user" }],
      },
      type: "prompt.req",
    },
    {
      type: "prompt.block-end",
      chatId,
      seq: 2,
      streamId: expect.any(String),
      timestamp: expect.any(Date),
    },
  ];
}

describe("VibesDiyApi", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();

  async function createApp() {
    const now = sthis.nextId(8).str;
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Hello ${now}</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug to return ResEnsureAppSlugOk");
    }
    return { appSlug: res.appSlug, userSlug: res.userSlug };
  }

  // let svc: Awaited<ReturnType<typeof createHandler>>;
  let api: VibesDiyApi;
  let api2: VibesDiyApi;
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const testUser = await createTestUser({ sthis, deviceCA, seqUserId: 100 });

    const fetchPair = TestFetchPair.create();
    const wsPair = TestWSPair.create();

    fetchPair.server.onServe(async (req: Request) => {
      // console.log("fetchPair.server received request:", req.url, Object.fromEntries(req.headers.entries()));
      return cfServe(
        req as unknown as CFRequest,
        {
          appCtx: appCtx.appCtx,
          cache: noopCache,
          drizzle: appCtx.vibesCtx.sql.db,
          webSocket: {
            connections: new Set(),
            webSocketPair: () => ({
              client: wsPair.p1,
              server: wsPair.p2,
            }),
          },
        } as unknown as ExecutionContext & CFInject
      ) as unknown as Promise<Response>;
      // console.log("fetchPair.server received request:", req);
      // return
    });

    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);

    appCtx.vibesCtx.connections.add(wsSendProvider);

    wsPair.p2.onmessage = (event: MessageEvent) => {
      // console.log("wsPair.p2 received message", event.data.length);
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
      /* noop */
    };

    api = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => {
        return Result.Ok(await testUser.getDashBoardToken());
      },
    });

    const testUser2 = await createTestUser({ sthis, deviceCA, seqUserId: 200 });
    api2 = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => {
        return Result.Ok(await testUser2.getDashBoardToken());
      },
    });
  });

  it("make it a valid appSlug", async () => {
    const id = sthis.nextId(8).str.toLocaleLowerCase();
    let userSlug: string | undefined;
    for (let i = 0; i < 3; i++) {
      const rRes = await api.ensureAppSlug({
        appSlug: `Invalid App Slug! ${id}`,
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
      const res = rRes.Ok();
      if (!isResEnsureAppSlugOk(res)) {
        assert.fail("Expected invalid appSlug to return a ResEnsureAppSlugOk");
      }
      expect(res.appSlug).toBe(`invalid-app-slug-${id}`);
      if (!userSlug) {
        userSlug = res.userSlug;
      }
      expect(res.userSlug).toBe(userSlug);
    }
  });

  it("coerce invalid userSlugs", async () => {
    const id = sthis.nextId(8).str.toLocaleLowerCase();
    for (let i = 0; i < 3; i++) {
      const rRes = await api.ensureAppSlug({
        appSlug: `valid-app-slug-${id}`,
        userSlug: `Invalid User Slug! ${id}`,
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
      const res = rRes.Ok();
      if (!isResEnsureAppSlugOk(res)) {
        assert.fail("Expected invalid appSlug to return a ResEnsureAppSlugOk");
      }
      expect(res.userSlug).toBe(`invalid-user-slug-${id}`);
    }
  });

  it("does defaults", async () => {
    const rRes = await api.ensureAppSlug({
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
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug with defaults to return a ResEnsureAppSlugOk");
    }
    expect(res.appSlug.length).toBeGreaterThan(3);
    expect(res.userSlug.length).toBeGreaterThan(3);

    const rRes1 = await api.ensureAppSlug({
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
    const res1 = rRes1.Ok();
    if (!isResEnsureAppSlugOk(res1)) {
      assert.fail("Expected ensureAppSlug with defaults to return a ResEnsureAppSlugOk");
    }
    expect(res.fsId).toBe(res1.fsId);
    expect(res.appSlug).not.toBe(res1.appSlug);
    expect(res.userSlug).toBe(res.userSlug);
  });

  it("render iframe content page", async () => {
    // this is the iframe content page
    const rRes = await api.ensureAppSlug({
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
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug with defaults to return a ResEnsureAppSlugOk");
    }
    const url = calcEntryPointUrl({
      hostnameBase: ".nowhere",
      protocol: "http",
      port: "4711",
      bindings: {
        appSlug: res.appSlug,
        userSlug: res.userSlug,
        fsId: res.fsId,
      },
    });
    // console.log("render iframe content page res:", url);
    const resIframe = await api.cfg.fetch(url);
    expect(resIframe.status).toBe(200);
    const iframeText = await resIframe.text();
    // Mount JS now imports by original filename (e.g. /~fsId~/App.jsx), and
    // serv-entry-point serves the transformed JS transparently.
    const imports = [...iframeText.matchAll(/import V\d+ from "([^"]*\/App\.jsx)"/gm)];
    expect(imports.length).toBeGreaterThan(0);
    for (const imp of imports) {
      // imp[1] is an absolute path like "/~fsId~/App.jsx"; use native URL
      // resolution so it replaces the base path rather than appending to it.
      const importFile = await api.cfg.fetch(new URL(imp[1], url).toString());
      expect(importFile.status).toBe(200);
      const importText = await importFile.text();
      expect(importText).toContain(`console.log('hello world');`);
    }
  });

  it("multi-file app: only App.jsx is mounted, helper .js and .jsx modules are served but not default-imported", async () => {
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `import { greet } from "./utils.js"; import { Badge } from "./Badge.jsx"; export default function App() { return <div><Badge />{greet("world")}</div>; }`,
        },
        // plain JS helper — no JSX transform needed, no default export
        {
          type: "code-block",
          lang: "js",
          filename: "/utils.js",
          content: `export function greet(name) { return "Hello, " + name + "!"; }`,
        },
        // JSX helper component — needs JSX transform to be served, but NOT mounted
        {
          type: "code-block",
          lang: "jsx",
          filename: "/Badge.jsx",
          content: `export function Badge() { return <span>badge</span>; }`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug with multi-file to return a ResEnsureAppSlugOk");
    }
    const url = calcEntryPointUrl({
      hostnameBase: ".nowhere",
      protocol: "http",
      port: "4711",
      bindings: { appSlug: res.appSlug, userSlug: res.userSlug, fsId: res.fsId },
    });
    const resIframe = await api.cfg.fetch(url);
    expect(resIframe.status).toBe(200);
    const iframeText = await resIframe.text();

    // Only App.jsx (the auto-detected entry point) should appear as a default import in mount JS
    const defaultImports = [...iframeText.matchAll(/^import V\d+ from "([^"]+)"/gm)];
    expect(defaultImports.length).toBe(1);
    expect(defaultImports[0][1]).toContain("App.jsx");
    expect(iframeText).not.toMatch(/import V\d+ from ".*utils\.js"/);
    expect(iframeText).not.toMatch(/import V\d+ from ".*Badge\.jsx"/);

    // Both helpers must be reachable at their paths for relative imports to resolve
    const origin = new URL(defaultImports[0][1].replace(/App\.jsx$/, ""), url).toString();
    const utilsRes = await api.cfg.fetch(new URL("utils.js", origin).toString());
    expect(utilsRes.status).toBe(200);
    expect(await utilsRes.text()).toContain("greet");

    const badgeRes = await api.cfg.fetch(new URL("Badge.jsx", origin).toString());
    expect(badgeRes.status).toBe(200);
    // Badge.jsx is served as transformed JS (JSX syntax removed)
    expect(await badgeRes.text()).toContain("badge");
  });

  it("bare specifiers in plain .js helpers land in the import map", async () => {
    // Verifies the plain-JS branch in transformJSXAndImports (write-apps.ts:168) correctly
    // extracts bare imports and adds them to the import map. A regression here would silently
    // 404 in the browser since the import map entry would be missing.
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `import { formatAge } from "./helpers.js"; export default function App() { return <div>{formatAge(Date.now())}</div>; }`,
        },
        {
          type: "code-block",
          lang: "js",
          filename: "/helpers.js",
          // bare specifier "ms" must be extracted and put in the import map
          content: `import ms from "ms"; export function formatAge(ts) { return ms(Date.now() - ts); }`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug to return ResEnsureAppSlugOk");
    }
    const url = calcEntryPointUrl({
      hostnameBase: ".nowhere",
      protocol: "http",
      port: "4711",
      bindings: { appSlug: res.appSlug, userSlug: res.userSlug, fsId: res.fsId },
    });
    const resIframe = await api.cfg.fetch(url);
    expect(resIframe.status).toBe(200);
    const iframeText = await resIframe.text();

    // The rendered HTML must contain an import map with an entry for "ms"
    const importMapMatch = iframeText.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    if (!importMapMatch) {
      assert.fail("iframe HTML must contain an importmap script tag");
    }
    const importMap = JSON.parse(importMapMatch[1]);
    expect(importMap.imports, `import map must have an entry for "ms"; got: ${JSON.stringify(importMap.imports)}`).toHaveProperty(
      "ms"
    );

    // helpers.js must be served at its path (not 404) so relative imports resolve
    const defaultImports = [...iframeText.matchAll(/^import V\d+ from "([^"]+)"/gm)];
    const origin = new URL(defaultImports[0][1].replace(/App\.jsx$/, ""), url).toString();
    const helpersRes = await api.cfg.fetch(new URL("helpers.js", origin).toString());
    expect(helpersRes.status).toBe(200);
    expect(await helpersRes.text()).toContain("formatAge");
  });

  it("revalidates unversioned published root html when metadata changes for the same fsId", async () => {
    const rRes = await api.ensureAppSlug({
      mode: "production",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `export default function App() { return <div>Hello metadata validator</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug to return a ResEnsureAppSlugOk");
    }

    const url = calcEntryPointUrl({
      hostnameBase: ".nowhere",
      protocol: "http",
      port: "4711",
      bindings: {
        appSlug: res.appSlug,
        userSlug: res.userSlug,
      },
    });

    const firstRes = await api.cfg.fetch(url);
    expect(firstRes.status).toBe(200);
    expect(firstRes.headers.get("Cache-Control")).toBe("public, no-cache, must-revalidate");
    const firstEtag = firstRes.headers.get("ETag");
    expect(firstEtag).toBeTruthy();

    const updatedTitle = `meta-title-${sthis.nextId(8).str.toLowerCase()}`;
    await appCtx.vibesCtx.sql.db
      .update(appCtx.vibesCtx.sql.tables.apps)
      .set({
        meta: [{ type: "title", title: updatedTitle }],
      })
      .where(
        and(
          eq(appCtx.vibesCtx.sql.tables.apps.appSlug, res.appSlug),
          eq(appCtx.vibesCtx.sql.tables.apps.userSlug, res.userSlug),
          eq(appCtx.vibesCtx.sql.tables.apps.fsId, res.fsId),
          eq(appCtx.vibesCtx.sql.tables.apps.mode, "production")
        )
      );

    const revalidatedRes = await api.cfg.fetch(
      new Request(url, {
        headers: {
          "If-None-Match": firstEtag ?? "",
        },
      })
    );

    expect(revalidatedRes.status).toBe(200);
    const secondEtag = revalidatedRes.headers.get("ETag");
    expect(secondEtag).toBeTruthy();
    expect(secondEtag).not.toBe(firstEtag);
    const html = await revalidatedRes.text();
    expect(html).toContain(`<title>${updatedTitle}</title>`);

    const notModifiedRes = await api.cfg.fetch(
      new Request(url, {
        headers: {
          "If-None-Match": secondEtag ?? "",
        },
      })
    );

    expect(notModifiedRes.status).toBe(304);
    expect(notModifiedRes.headers.get("ETag")).toBe(secondEtag);
  });

  it("rejects ensureAppSlug with no code files", async () => {
    const res = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "str-asset-block", content: "body { color: red; }", filename: "/style.css" }],
    });
    expect(res.isErr()).toBe(true);
    expect(res.Err()).toMatchObject({
      code: "app-slug-invalid",
    });
  });

  it("rejects ensureAppSlug with empty fileSystem", async () => {
    const res = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [],
    });
    expect(res.isErr()).toBe(true);
    expect(res.Err()).toMatchObject({
      code: "app-slug-invalid",
    });
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
        entryPointUrl: `http://sand-nose-hope--immediately-steel-${now}.localhost.vibesdiy.net:8787/~zGDU8X6kbHpi3Uxf7jMZMhUTad4VbtrmrwuRxtpzXxn7s~`,
        env: {
          TEST_ENV_VAR: "hello world",
        },
        fileSystem: [
          {
            assetId: "zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
            assetURI: expect.stringMatching("//Assets/zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s"),
            fileName: "/App.jsx",
            mimeType: "text/javascript",
            size: expect.any(Number),
            transform: {
              type: "jsx-to-js",
              transformedAssetId: "zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK",
            },
          },
          {
            assetId: "zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK",
            assetURI: expect.stringMatching("//Assets/zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK"),
            fileName: "/~~transformed~~/zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
            mimeType: "text/javascript",
            size: 276,
            transform: {
              action: "jsx-to-js",
              transformedAssetId: "zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
              type: "transformed",
            },
          },
          {
            assetId: "zBKasKKmW2a3imcye1bbJvbZJRFF87V1vTsBZ12MEeUq1",
            assetURI: expect.stringMatching("//Assets/zBKasKKmW2a3imcye1bbJvbZJRFF87V1vTsBZ12MEeUq1"),
            fileName: "/~~calculated~~/import-map.json",
            mimeType: "application/importmap+json",
            size: 153,
            transform: {
              fromAssetIds: ["zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s"],
              type: "import-map",
            },
          },
        ],
        fsId: "zGDU8X6kbHpi3Uxf7jMZMhUTad4VbtrmrwuRxtpzXxn7s",
        mode: "dev",
        type: "vibes.diy.res-ensure-app-slug",
        userSlug: `immediately-steel-${now}`,
        // wrapperUrl: `https://tbd/immediately-steel-${now}/sand-nose-hope/zGDU8X6kbHpi3Uxf7jMZMhUTad4VbtrmrwuRxtpzXxn7s`,
      });
    }
  });

  it("can open chat", async () => {
    // console.log("Testing openChat");
    const rChatRes = await api.openChat({
      mode: "chat",
    });
    // console.log("openChat res", rChatRes);
    expect(rChatRes.isOk()).toBe(true);
    const chat = rChatRes.Ok();
    const resp = vi.fn();
    const promptIds: string[] = [];
    const loops = 3;
    const toWait = processStream(chat.sectionStream, async (msg) => {
      resp(msg);
      // console.log(resp.mock.calls.length)
      if (resp.mock.calls.length >= loops * 3) {
        await rChatRes.Ok().close();
      }

      // if (msg.type === "vibes.diy.section-event" && msg.promptId === promptIds[loops - 1]
      //   && isPromptBlockEnd(msg.blocks[0])) {
      //   console.log("Closing chat stream", msg, resp.mock.calls.map(c => c[0].blocks));
      // }
    });
    // console.log("Chat opened, sending prompts");

    for (let i = 0; i < loops; i++) {
      const rPrompt = await chat.prompt({
        messages: [{ role: "user", content: [{ type: "text", text: `Hello world ${i}` }] }],
      });
      expect(rPrompt.isOk()).toBe(true);
      promptIds.push(rPrompt.Ok().promptId);
    }
    // console.log("Prompts sent, waiting for responses");
    await toWait;
    // console.log("Prompts sent, waited for responses", resp.mock.calls.map(c => c[0].blocks));

    Array.from(Object.entries(toByPromptIds(resp.mock.calls))).forEach(([promptId, blocks], idx) => {
      // console.log("Checking promptId", promptId, "blocks", blocks, idx);
      expect(blocks).toEqual(emptySectorStream(chat.chatId, promptId, idx));
    });

    const rNext = await api.openChat({
      chatId: chat.chatId,
      mode: "chat",
    });
    const nextFn = vi.fn();
    await processStream(rNext.Ok().sectionStream, (msg) => {
      nextFn(msg);
      if (msg.type === "vibes.diy.section-event" && msg.promptId === promptIds[2] && isPromptBlockEnd(msg.blocks[0])) {
        rNext.Ok().close();
      }
    });

    Array.from(Object.entries(toByPromptIds(nextFn.mock.calls))).forEach(([promptId, blocks], idx) => {
      // console.log("Checking promptId", promptId, "blocks", blocks, idx);
      expect(blocks).toEqual(emptySectorStream(chat.chatId, promptId, idx));
    });
  });

  // TODO: consistently times out at 5s waiting for 44 blocks from the fixture
  // stream — broken since aa354215. Needs a rewrite of the block-count
  // expectation to match current LLM fixture output.
  it.skip("queries the llm", async () => {
    const rChatRes = await api.openChat({
      mode: "chat",
    });
    expect(rChatRes.isOk()).toBe(true);
    const chat = rChatRes.Ok();
    console.log("pre-chat.prompt");
    const rPrompt = await chat.prompt({
      messages: [{ role: "user", content: [{ type: "text", text: `use fixture response` }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    console.log("post-chat.prompt");
    const firstStream = processStream(chat.sectionStream, async () => {
      await sleep(100);
      // console.log("Received message in llm query test", msg);
    });

    const rNext = await api.openChat({
      chatId: chat.chatId,
      mode: "chat",
    });
    // console.log("pre-processStream");
    const nextFn = vi.fn();
    Promise.all([
      firstStream,
      await processStream(rNext.Ok().sectionStream, async (msg) => {
        nextFn(msg);
        const blocks = nextFn.mock.calls.reduce((acc, call) => acc + call[0].blocks.length, 0);
        // console.log("Received message in llm query test", blocks, "blocks so far", msg);
        if (blocks >= 44) {
          await rNext.Ok().close();
        }
        // if (msg.type === "vibes.diy.section-event" && msg.promptId === rPrompt.Ok().promptId && isPromptBlockEnd(msg.blocks[0])) {
        //   rNext.Ok().close();
        // }
      }),
    ]);
    // console.log("LLM query test, received blocks:", nextFn.mock.calls.flatMap((call) => call[0].blocks))
    expect(nextFn.mock.calls.flatMap((call) => call[0].blocks).length).toEqual(44);
  });

  it("promptFS", async () => {
    const rChatRes = await api.openChat({
      mode: "chat",
    });
    expect(rChatRes.isOk()).toBe(true);
    const chat = rChatRes.Ok();
    const rPrompt = await chat.promptFS([
      {
        type: "code-block",
        filename: "/App.jsx",
        lang: "jsx",
        content: `export default function App() { return <div>Hello VibesDiy</div>; } console.log('hello world');`,
      } satisfies VibeFile,
    ]);
    expect(rPrompt.isOk()).toBe(true);

    // Wait for the first stream to complete so blocks are persisted
    await processStream(chat.sectionStream, async (msg) => {
      if ("blocks" in msg && msg.blocks.some((b: { type: string }) => b.type === "prompt.block-end")) {
        await chat.close();
      }
    });

    // Re-open the same chat — replays persisted blocks
    const rNext = await api.openChat({
      chatId: chat.chatId,
      mode: "chat",
    });
    const nextFn = vi.fn();
    await processStream(rNext.Ok().sectionStream, async (msg) => {
      nextFn(msg);
      if ("blocks" in msg && msg.blocks.some((b: { type: string }) => b.type === "prompt.block-end")) {
        await rNext.Ok().close();
      }
    });
    const replayedBlocks = nextFn.mock.calls.filter((c) => "blocks" in c[0]).flatMap((c) => c[0].blocks);
    expect(replayedBlocks.length).toBeGreaterThan(0);
    expect(replayedBlocks[0]).toHaveProperty("type", "prompt.block-begin");
  });

  describe("ensureAppSettings", () => {
    let appSlug: string;
    let userSlug: string;
    beforeAll(async () => {
      const rRes = await api.ensureAppSlug({
        mode: "dev",
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
      const res = rRes.Ok();
      if (!isResEnsureAppSlugOk(res)) {
        assert.fail("Expected ensureAppSlug with defaults to return a ResEnsureAppSlugOk");
      }
      appSlug = res.appSlug;
      userSlug = res.userSlug;
    });

    it("ensureAppSettings not found", async () => {
      const res = await api.ensureAppSettings({ appSlug: "non-existent-app", userSlug: "non-existent-user" });
      expect(res.Ok().error).toContain("not-found");
    });

    it("ensureAppSettings found", async () => {
      const res = await api.ensureAppSettings({ appSlug, userSlug });
      expect(res.Ok().error).toBeFalsy();
    });

    it("ensureAppSettings can't update if not owner", async () => {
      // need for parallel test isolation, as the following tests will update the settings
      const rTest = await api.ensureAppSlug({
        mode: "dev",
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

      const test = rTest.Ok();
      if (!isResEnsureAppSlugOk(test)) {
        assert.fail("Expected ensureAppSlug with defaults to return a ResEnsureAppSlugOk");
      }
      appSlug = test.appSlug;
      userSlug = test.userSlug;

      const ref = await api.ensureAppSettings({ appSlug, userSlug });
      const res = await api2.ensureAppSettings({
        appSlug,
        userSlug,
        request: {
          enable: true,
          autoAcceptRole: "viewer",
        },
      });
      expect(res.Ok().settings.entries).toEqual(ref.Ok().settings.entries);
    });

    it("ensureAppSettings update title", async () => {
      const x1 = await api.ensureAppSettings({ appSlug, userSlug, title: "My App" });
      const x2 = await api.ensureAppSettings({ appSlug, userSlug, title: "My App" });
      const x3 = await api.ensureAppSettings({ appSlug, userSlug, title: "My App1" });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "active.title",
            title: "My App1",
          }),
        ])
      );
      expect(x3.Ok().settings.entry.settings.title).toBe("My App1");
    });

    it("ensureAppSettings update chat", async () => {
      const x1 = await api.ensureAppSettings({ appSlug, userSlug, chat: { model: m("x") } });
      const x2 = await api.ensureAppSettings({ appSlug, userSlug, chat: { model: m("x") } });
      const x3 = await api.ensureAppSettings({ appSlug, userSlug, chat: { model: m("x1"), apiKey: "x" } });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            param: {
              apiKey: "x",
              model: m("x1"),
            },
            type: "active.model",
            usage: "chat",
          }),
        ])
      );
      expect(x3.Ok().settings.entry.settings.chat).toEqual({
        model: m("x1"),
        apiKey: "x",
      });
    });

    it("ensureAppSettings canonicalizes duplicate chat model entries on save", async () => {
      const { appSlug, userSlug } = await createApp();
      const seed = await api.ensureAppSettings({ appSlug, userSlug, chat: { model: m("seed-chat"), apiKey: "seed-key" } });
      const appSettings = appCtx.vibesCtx.sql.tables.appSettings;

      await appCtx.vibesCtx.sql.db
        .update(appSettings)
        .set({
          settings: [
            {
              type: "active.model",
              usage: "chat",
              param: { model: m("older-chat"), apiKey: "older-key" },
            },
            {
              type: "active.model",
              usage: "chat",
              param: { model: m("claude-sonnet-4-6"), apiKey: "sonnet-key" },
            },
            {
              type: "active.model",
              usage: "app",
              param: { model: m("app-model") },
            },
          ],
        })
        .where(and(eq(appSettings.userId, seed.Ok().userId), eq(appSettings.appSlug, appSlug), eq(appSettings.userSlug, userSlug)));

      const selectedChat = { model: m("saved-chat"), apiKey: "saved-key" };
      const save = await api.ensureAppSettings({ appSlug, userSlug, chat: selectedChat });
      const saveChatEntries = save.Ok().settings.entries.filter((entry) => entry.type === "active.model" && entry.usage === "chat");

      expect(saveChatEntries).toHaveLength(1);
      expect(save.Ok().settings.entry.settings.chat).toEqual(selectedChat);

      const read = await api.ensureAppSettings({ appSlug, userSlug });
      const readChatEntries = read.Ok().settings.entries.filter((entry) => entry.type === "active.model" && entry.usage === "chat");

      expect(readChatEntries).toHaveLength(1);
      expect(read.Ok().settings.entry.settings.chat).toEqual(selectedChat);
      expect(read.Ok().settings.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "active.model",
            usage: "app",
            param: { model: m("app-model") },
          }),
        ])
      );
    });

    it("ensureAppSettings canonicalizes duplicates for every singleton entry type", async () => {
      const { appSlug, userSlug } = await createApp();
      // Seed with any settings field to materialize the AppSettings row; the
      // direct UPDATE below requires an existing row to target.
      const seed = await api.ensureAppSettings({ appSlug, userSlug, title: "seed-title" });
      const appSettings = appCtx.vibesCtx.sql.tables.appSettings;
      const userId = seed.Ok().userId;

      // Seed duplicate entries for every singleton type via direct UPDATE so we
      // can reproduce the broken-state shape that #1707 was triggered by.
      await appCtx.vibesCtx.sql.db
        .update(appSettings)
        .set({
          settings: [
            { type: "active.title", title: "old-title-1" },
            { type: "active.title", title: "old-title-2" },
            { type: "active.theme", theme: "old-theme-1" },
            { type: "active.theme", theme: "old-theme-2" },
            { type: "active.skills", skills: ["old-skill-1"] },
            { type: "active.skills", skills: ["old-skill-2"] },
            { type: "active.icon-description", description: "old-icon-desc-1" },
            { type: "active.icon-description", description: "old-icon-desc-2" },
            { type: "active.env", env: [{ key: "OLD_1", value: "v1" }] },
            { type: "active.env", env: [{ key: "OLD_2", value: "v2" }] },
            { type: "app.public.access", enable: false },
            { type: "app.public.access", enable: true },
            { type: "app.request", enable: false },
            { type: "app.request", enable: true },
            { type: "active.db-acl", dbName: "shared", acl: { read: ["readers"] } },
            { type: "active.db-acl", dbName: "shared", acl: { read: ["members"] } },
            { type: "active.db-acl", dbName: "private", acl: { read: ["editors"] } },
          ],
        })
        .where(and(eq(appSettings.userId, userId), eq(appSettings.appSlug, appSlug), eq(appSettings.userSlug, userSlug)));

      // One save per entry type. Each save must canonicalize that type to one entry.
      await api.ensureAppSettings({ appSlug, userSlug, title: "new-title" });
      await api.ensureAppSettings({ appSlug, userSlug, theme: "new-theme" });
      await api.ensureAppSettings({ appSlug, userSlug, skills: ["new-skill"] });
      await api.ensureAppSettings({ appSlug, userSlug, iconDescription: "new-icon-desc" });
      await api.ensureAppSettings({ appSlug, userSlug, env: [{ key: "NEW", value: "v" }] });
      await api.ensureAppSettings({ appSlug, userSlug, publicAccess: { enable: false } });
      await api.ensureAppSettings({ appSlug, userSlug, request: { enable: false } });
      await api.ensureAppSettings({ appSlug, userSlug, dbAcl: { dbName: "shared", acl: { read: ["members"] } } });

      const final = await api.ensureAppSettings({ appSlug, userSlug });
      const entries = final.Ok().settings.entries;

      expect(entries.filter(isActiveTitle)).toHaveLength(1);
      expect(entries.filter(isActiveTheme)).toHaveLength(1);
      expect(entries.filter(isActiveSkills)).toHaveLength(1);
      expect(entries.filter(isActiveIconDescription)).toHaveLength(1);
      expect(entries.filter(isActiveEnv)).toHaveLength(1);
      expect(entries.filter(isEnablePublicAccess)).toHaveLength(1);
      expect(entries.filter(isEnableRequest)).toHaveLength(1);

      // dbAcl: per-dbName. "shared" collapses to 1, "private" stays as 1.
      const dbAclEntries = entries.filter(isActiveDbAcl);
      expect(dbAclEntries.filter((e) => e.dbName === "shared")).toHaveLength(1);
      expect(dbAclEntries.filter((e) => e.dbName === "private")).toHaveLength(1);

      // Read-path projection reflects most recent save — this is the #1707 symptom.
      const settings = final.Ok().settings.entry.settings;
      expect(settings.title).toBe("new-title");
      expect(settings.theme).toBe("new-theme");
      expect(settings.skills).toEqual(["new-skill"]);
      expect(settings.iconDescription).toBe("new-icon-desc");
      expect(settings.env).toEqual([{ key: "NEW", value: "v" }]);
    });

    it("ensureAppSettings update app", async () => {
      const x1 = await api.ensureAppSettings({ appSlug, userSlug, app: { model: m("x") } });
      const x2 = await api.ensureAppSettings({ appSlug, userSlug, app: { model: m("x") } });
      const x3 = await api.ensureAppSettings({ appSlug, userSlug, app: { model: m("x1"), apiKey: "x" } });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            param: {
              apiKey: "x",
              model: m("x1"),
            },
            type: "active.model",
            usage: "app",
          }),
        ])
      );
      expect(x3.Ok().settings.entry.settings.app).toEqual({
        model: m("x1"),
        apiKey: "x",
      });
    });

    it("ensureAppSettings update env", async () => {
      const x1 = await api.ensureAppSettings({ appSlug, userSlug, env: [{ key: "x", value: "x" }] });
      const x2 = await api.ensureAppSettings({ appSlug, userSlug, env: [{ key: "x", value: "x" }] });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        env: [
          { key: "x1", value: "x" },
          { key: "x", value: "y" },
        ],
      });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.settings.env).toEqual([
        { key: "x1", value: "x" },
        { key: "x", value: "y" },
      ]);
    });

    it("ensureAppSettings update enable-public-access", async () => {
      const { appSlug, userSlug } = await createApp();
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        publicAccess: {
          enable: true,
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        publicAccess: {
          enable: false,
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        publicAccess: {
          enable: true,
          // tick: { count: 5, last: new Date() },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x1.Ok().settings.entry.publicAccess?.enable).toEqual(true);
      expect(x2.Ok().settings.entry.publicAccess?.enable).toEqual(false);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.publicAccess?.enable).toEqual(true);
      // expect(x3.Ok().settings.entry.publicAccess?.tick?.count).toBeGreaterThan(0);
    });

    it("ensureAppSettings update enable-request", async () => {
      const { appSlug, userSlug } = await createApp();
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        request: {
          enable: true,
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        request: {
          enable: true,
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        request: { enable: true, autoAcceptRole: "viewer" },
      });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.enableRequest).toBeDefined();
      expect(x3.Ok().settings.entry.enableRequest?.autoAcceptRole).toBe("viewer");
    });
  });

  describe("handlePromptContext", () => {
    let vctx: VibesApiSQLCtx;
    const req = {
      _auth: {
        verifiedAuth: {
          claims: {
            userId: "testUserId",
          },
        },
      },
      type: "vibes.diy.res-prompt-chat-section",
      mode: "chat",
    } as unknown as ReqWithVerifiedAuth<ReqPromptChatSection>;

    const bp = BlockMsgs.or(PromptMsgs);
    const collectedMsgs: BlockMsgs[] = [];
    beforeAll(async () => {
      vctx = appCtx.vibesCtx;
      // setup vctx and req with necessary properties for testing
      const rJsonl = await loadAsset("./prompt-ctx.fixture.jsonl", {
        basePath: () => import.meta.url,
      });
      for await (const line of (rJsonl.Ok() + "\n").split("\n")) {
        if (line.trim()) {
          const parsed = bp.array()(JSON.parse(line));
          if (parsed instanceof type.errors) {
            console.error("Error parsing line in fixture:", parsed.summary);
          } else {
            collectedMsgs.push(...parsed.filter((i) => isBlockStreamMsg(i)));
          }
        }
      }
    });

    it("processes prompt context correctly", async () => {
      const chatId = `testChatId-${vctx.sthis.nextId(8).str}`;
      const promptId = `testPromptId-${vctx.sthis.nextId(8).str}`;
      const pctx = await handlePromptContext({
        vctx,
        req: {
          ...req,
          chatId,
          userSlug: "example-user",
          appSlug: "example-app",
          promptId,
          outerTid: "outer",
        } as unknown as ReqWithVerifiedAuth<ReqPromptChatSection>,
        resChat: {
          appSlug: "example-app",
          userSlug: "example-user",
          mode: "chat",
        },
        promptId,
        blockSeq: collectedMsgs.length,
        value: collectedMsgs[collectedMsgs.length - 1] as BlockEndMsg,
        collectedMsgs,
      });
      // console.log("handlePromptContext result:", pctx);
      expect(pctx.isOk()).toBe(true);

      const fs = await vctx.sql.db
        .select()
        .from(vctx.sql.tables.apps)
        .where(
          and(
            eq(vctx.sql.tables.apps.appSlug, "example-app"),
            eq(vctx.sql.tables.apps.userSlug, "example-user"),
            eq(vctx.sql.tables.apps.fsId, pctx.Ok().fsRef.Unwrap().fsId)
          )
        )
        .limit(1)
        .then((r) => r[0]);
      // console.log("Database entries for exampleApp/exampleUser:", fs);
      expect(fs).toEqual({
        appSlug: "example-app",
        created: expect.any(String),
        env: {},
        fileSystem: [
          {
            assetId: "z7s2pNqju7dRUpKYPc5AisTkM8TsK4PHp2suH9YzQxXvc",
            assetURI: "s3://r2/z7s2pNqju7dRUpKYPc5AisTkM8TsK4PHp2suH9YzQxXvc",
            fileName: "/App.jsx",
            mimeType: "text/javascript",
            size: 5370,
            transform: {
              transformedAssetId: "z9F292JVxJPpjFBsMz9pzP8rc7qTPecWCzYxkBQrnsPMm",
              type: "jsx-to-js",
            },
          },
          {
            assetId: "z9F292JVxJPpjFBsMz9pzP8rc7qTPecWCzYxkBQrnsPMm",
            assetURI: "s3://r2/z9F292JVxJPpjFBsMz9pzP8rc7qTPecWCzYxkBQrnsPMm",
            fileName: "/~~transformed~~/z7s2pNqju7dRUpKYPc5AisTkM8TsK4PHp2suH9YzQxXvc",
            mimeType: "text/javascript",
            size: 9405,
            transform: {
              action: "jsx-to-js",
              transformedAssetId: "z7s2pNqju7dRUpKYPc5AisTkM8TsK4PHp2suH9YzQxXvc",
              type: "transformed",
            },
          },
          {
            assetId: "z2prY9cv7dc5XywUH4pxdyRSqtkmrA8S8Av768CRNiFs4",
            assetURI: expect.stringContaining("//Assets/z2prY9cv7dc5XywUH4pxdyRSqtkmrA8S8Av768CRNiFs4"),
            fileName: "/~~calculated~~/import-map.json",
            mimeType: "application/importmap+json",
            size: 153,
            transform: {
              fromAssetIds: ["z7s2pNqju7dRUpKYPc5AisTkM8TsK4PHp2suH9YzQxXvc"],
              type: "import-map",
            },
          },
        ],
        fsId: "zDdC6RKfJgJB9HzK8qKMXGgTSaENJXjXBWUarsrgShUCW",
        meta: [],
        mode: "dev",
        releaseSeq: 1,
        userId: "testUserId",
        userSlug: "example-user",
      });
      expect(pctx.Ok()).toEqual({
        blockSeq: 138,
        fsRef: {
          _t: {
            appSlug: "example-app",
            fsId: "zDdC6RKfJgJB9HzK8qKMXGgTSaENJXjXBWUarsrgShUCW",
            mode: "dev",
            userSlug: "example-user",
          },
        },
      });
    });
  });

  // request flow and invite flow tests moved to api-access-flow.test.ts
});
