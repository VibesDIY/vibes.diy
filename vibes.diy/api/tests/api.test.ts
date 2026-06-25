import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { loadAsset, processStream, Result, TestFetchPair, TestWSPair } from "@adviser/cement";
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
        // The server records the resolved model id on the streamed/persisted
        // prompt.req block (the default it dispatched with, since no override
        // was sent). Matched loosely — the concrete default comes from the
        // model catalog and is not what this test pins.
        model: expect.any(String),
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
    return { appSlug: res.appSlug, ownerHandle: res.ownerHandle };
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
    let ownerHandle: string | undefined;
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
      if (!ownerHandle) {
        ownerHandle = res.ownerHandle;
      }
      expect(res.ownerHandle).toBe(ownerHandle);
    }
  });

  it("coerce invalid ownerHandles", async () => {
    const id = sthis.nextId(8).str.toLocaleLowerCase();
    for (let i = 0; i < 3; i++) {
      const rRes = await api.ensureAppSlug({
        appSlug: `valid-app-slug-${id}`,
        ownerHandle: `Invalid User Slug! ${id}`,
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
      expect(res.ownerHandle).toBe(`invalid-user-slug-${id}`);
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
    expect(res.ownerHandle.length).toBeGreaterThan(3);

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
    expect(res.ownerHandle).toBe(res.ownerHandle);
  });

  it("reconciles same runId dev->production in place even when fsId drifts", async () => {
    const id = sthis.nextId(8).str.toLocaleLowerCase();
    const appSlug = `runid-app-${id}`;
    const ownerHandle = `runid-owner-${id}`;
    const runId = `prompt-${id}`;

    const rDev = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      ownerHandle,
      runId,
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "export default function App() { return <div>dev version</div>; }",
        },
      ],
    });
    const dev = rDev.Ok();
    if (!isResEnsureAppSlugOk(dev)) {
      assert.fail("Expected dev ensureAppSlug to return ResEnsureAppSlugOk");
    }

    const rProd = await api.ensureAppSlug({
      mode: "production",
      appSlug,
      ownerHandle,
      runId,
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "export default function App() { return <div>production version</div>; }",
        },
      ],
    });
    const prod = rProd.Ok();
    if (!isResEnsureAppSlugOk(prod)) {
      assert.fail("Expected production ensureAppSlug to return ResEnsureAppSlugOk");
    }

    expect(dev.fsId).not.toBe(prod.fsId);

    const rows = await appCtx.vibesCtx.sql.db
      .select()
      .from(appCtx.vibesCtx.sql.tables.apps)
      .where(
        and(eq(appCtx.vibesCtx.sql.tables.apps.appSlug, appSlug), eq(appCtx.vibesCtx.sql.tables.apps.ownerHandle, ownerHandle))
      )
      .orderBy(appCtx.vibesCtx.sql.tables.apps.releaseSeq);

    expect(rows).toHaveLength(1);
    expect(rows[0].mode).toBe("production");
    expect(rows[0].runId).toBe(runId);
    expect(rows[0].fsId).toBe(prod.fsId);
  });

  it("does not let a delayed dev publish regress a finalized production release", async () => {
    // Regression for #2616 review (Codex P2): if the production push wins the
    // race first, a later same-runId dev publish must not repoint the row at the
    // older dev snapshot — production is the terminal state of the operation.
    const id = sthis.nextId(8).str.toLocaleLowerCase();
    const appSlug = `noregress-app-${id}`;
    const ownerHandle = `noregress-${id}`;
    const runId = `prompt-noregress-${id}`;

    // Dev publish (mirrors the server-side publish during the codegen stream).
    const rDev0 = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      ownerHandle,
      runId,
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "export default function App() { return <div>dev version</div>; }",
        },
      ],
    });
    if (!isResEnsureAppSlugOk(rDev0.Ok())) {
      assert.fail("Expected dev ensureAppSlug to return ResEnsureAppSlugOk");
    }

    // Production push finalizes the run (reconciles the dev row in place).
    const rProd = await api.ensureAppSlug({
      mode: "production",
      appSlug,
      ownerHandle,
      runId,
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "export default function App() { return <div>production version</div>; }",
        },
      ],
    });
    const prod = rProd.Ok();
    if (!isResEnsureAppSlugOk(prod)) {
      assert.fail("Expected production ensureAppSlug to return ResEnsureAppSlugOk");
    }

    // A delayed dev publish for the same run arrives AFTER production finalized,
    // carrying a different (stale) dev filesystem.
    const rDev = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      ownerHandle,
      runId,
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "export default function App() { return <div>stale dev version</div>; }",
        },
      ],
    });
    const dev = rDev.Ok();
    if (!isResEnsureAppSlugOk(dev)) {
      assert.fail("Expected dev ensureAppSlug to return ResEnsureAppSlugOk");
    }

    // The late dev publish is a no-op: it resolves to the finalized production
    // fsId rather than its own (stale) dev snapshot. (The API response echoes
    // the requested mode, so the persisted row state below is the real proof.)
    expect(dev.fsId).toBe(prod.fsId);

    const rows = await appCtx.vibesCtx.sql.db
      .select()
      .from(appCtx.vibesCtx.sql.tables.apps)
      .where(
        and(eq(appCtx.vibesCtx.sql.tables.apps.appSlug, appSlug), eq(appCtx.vibesCtx.sql.tables.apps.ownerHandle, ownerHandle))
      )
      .orderBy(appCtx.vibesCtx.sql.tables.apps.releaseSeq);

    expect(rows).toHaveLength(1);
    expect(rows[0].mode).toBe("production");
    expect(rows[0].fsId).toBe(prod.fsId);
  });

  it("re-points PromptContexts to the new fsId when a same-runId reconcile drifts the fsId", async () => {
    // Regression for #2616: the dev publish during a generate stores its fsId in
    // PromptContexts, and loadVersionTimeline joins PromptContexts.fsId ->
    // Apps.fsId. The production push reconciles the row in place to a new fsId,
    // so the prompt context must be re-pointed or the generated turn orphans.
    const id = sthis.nextId(8).str.toLocaleLowerCase();
    const appSlug = `runid-link-app-${id}`;
    const ownerHandle = `runid-link-owner-${id}`;
    const runId = `prompt-link-${id}`;
    const chatId = `chat-link-${id}`;

    const rDev = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      ownerHandle,
      runId,
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "export default function App() { return <div>dev version</div>; }",
        },
      ],
    });
    const dev = rDev.Ok();
    if (!isResEnsureAppSlugOk(dev)) {
      assert.fail("Expected dev ensureAppSlug to return ResEnsureAppSlugOk");
    }

    // The dev Apps row carries the authenticated userId; reuse it so the
    // PromptContexts row we seed matches the relink's (userId, promptId) filter.
    const devRow = await appCtx.vibesCtx.sql.db
      .select()
      .from(appCtx.vibesCtx.sql.tables.apps)
      .where(
        and(eq(appCtx.vibesCtx.sql.tables.apps.appSlug, appSlug), eq(appCtx.vibesCtx.sql.tables.apps.ownerHandle, ownerHandle))
      )
      .limit(1)
      .then((r) => r[0]);

    // Simulate the PromptContexts row the dev publish writes for this turn.
    await appCtx.vibesCtx.sql.db.insert(appCtx.vibesCtx.sql.tables.promptContexts).values({
      userId: devRow.userId,
      chatId,
      promptId: runId,
      fsId: dev.fsId,
      nethash: "test-nethash",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      ref: { type: "prompt.usage.sql" },
      created: new Date().toISOString(),
    });

    const rProd = await api.ensureAppSlug({
      mode: "production",
      appSlug,
      ownerHandle,
      runId,
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "export default function App() { return <div>production version</div>; }",
        },
      ],
    });
    const prod = rProd.Ok();
    if (!isResEnsureAppSlugOk(prod)) {
      assert.fail("Expected production ensureAppSlug to return ResEnsureAppSlugOk");
    }

    expect(dev.fsId).not.toBe(prod.fsId);

    const pcRows = await appCtx.vibesCtx.sql.db
      .select()
      .from(appCtx.vibesCtx.sql.tables.promptContexts)
      .where(eq(appCtx.vibesCtx.sql.tables.promptContexts.promptId, runId));

    // The prompt context now points at the production fsId, so the join in
    // loadVersionTimeline still resolves the generated turn.
    expect(pcRows).toHaveLength(1);
    expect(pcRows[0].fsId).toBe(prod.fsId);
  });

  it("keeps fsId dedup fallback when runId is absent", async () => {
    const id = sthis.nextId(8).str.toLocaleLowerCase();
    const appSlug = `fsid-fallback-app-${id}`;
    const ownerHandle = `fsid-fallback-owner-${id}`;
    const fileSystem: VibeFile[] = [
      {
        type: "code-block",
        lang: "jsx",
        filename: "/App.jsx",
        content: "export default function App() { return <div>same content</div>; }",
      },
    ];

    const rDev = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      ownerHandle,
      fileSystem,
    });
    const dev = rDev.Ok();
    if (!isResEnsureAppSlugOk(dev)) {
      assert.fail("Expected dev ensureAppSlug to return ResEnsureAppSlugOk");
    }

    const rProd = await api.ensureAppSlug({
      mode: "production",
      appSlug,
      ownerHandle,
      fileSystem,
    });
    const prod = rProd.Ok();
    if (!isResEnsureAppSlugOk(prod)) {
      assert.fail("Expected production ensureAppSlug to return ResEnsureAppSlugOk");
    }

    expect(prod.fsId).toBe(dev.fsId);

    const rows = await appCtx.vibesCtx.sql.db
      .select()
      .from(appCtx.vibesCtx.sql.tables.apps)
      .where(
        and(eq(appCtx.vibesCtx.sql.tables.apps.appSlug, appSlug), eq(appCtx.vibesCtx.sql.tables.apps.ownerHandle, ownerHandle))
      )
      .orderBy(appCtx.vibesCtx.sql.tables.apps.releaseSeq);

    expect(rows).toHaveLength(1);
    expect(rows[0].mode).toBe("production");
    expect(rows[0].fsId).toBe(dev.fsId);
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
        ownerHandle: res.ownerHandle,
        fsId: res.fsId,
      },
    });
    // console.log("render iframe content page res:", url);
    const resIframe = await api.cfg.fetch(url);
    expect(resIframe.status).toBe(200);
    const iframeText = await resIframe.text();
    // The vibe document must render on a solid platform surface, never the gray
    // grid (which means platform fallback / hard error). A transparent app body
    // would otherwise let the grid show through.
    expect(iframeText).toContain('class="vibe-app-surface"');
    expect(iframeText).not.toContain('class="grid-background"');
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

  it("bare iframe-host URL opened top-level redirects to the canonical viewer (#2354)", async () => {
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `export default function App() { return <div>Shared vibe</div>; }`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug to return a ResEnsureAppSlugOk");
    }
    const baseUrl = calcEntryPointUrl({
      hostnameBase: ".nowhere",
      protocol: "http",
      port: "4711",
      bindings: { appSlug: res.appSlug, ownerHandle: res.ownerHandle, fsId: res.fsId },
    });
    // Mirror a real shared iframe src: invite token + iframe-internal plumbing
    // params + a duplicated key (tag=a&tag=b) to pin multiplicity preservation.
    const url =
      `${baseUrl}?token=invite-abc` +
      `&npmUrl=${encodeURIComponent("https://example/vibe-pkg/")}` +
      `&preview=yes&.stable-entry.=dev&tag=a&tag=b`;

    // Top-level navigation (Sec-Fetch-Dest: document) → 302 to the viewer on vibes.diy.
    const redirected = await api.cfg.fetch(url, { headers: { "Sec-Fetch-Dest": "document" } });
    expect(redirected.status).toBe(302);
    expect(redirected.headers.get("Cache-Control")).toBe("no-store");
    // Share/invite params (token) are preserved so the viewer can redeem access;
    // infra plumbing (npmUrl, preview, .stable-entry.) is stripped.
    const loc = new URL(redirected.headers.get("Location") ?? "");
    expect(`${loc.origin}${loc.pathname}`).toBe(`https://no-where/vibe/${res.ownerHandle}/${res.appSlug}`);
    expect(loc.searchParams.get("token")).toBe("invite-abc");
    expect(loc.searchParams.has("npmUrl")).toBe(false);
    expect(loc.searchParams.has("preview")).toBe(false);
    expect(loc.searchParams.has(".stable-entry.")).toBe(false);
    // Repeated query keys survive the redirect (not collapsed to a single value).
    expect(loc.searchParams.getAll("tag")).toEqual(["a", "b"]);

    // Embedded in an <iframe> (Sec-Fetch-Dest: iframe) → still serves the app document.
    const embedded = await api.cfg.fetch(url, { headers: { "Sec-Fetch-Dest": "iframe" } });
    expect(embedded.status).toBe(200);
    expect(await embedded.text()).toContain("import V");

    // No Sec-Fetch-Dest (crawler / curl) → unchanged, serves the page so og meta still resolves.
    const noHeader = await api.cfg.fetch(url);
    expect(noHeader.status).toBe(200);
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
      bindings: { appSlug: res.appSlug, ownerHandle: res.ownerHandle, fsId: res.fsId },
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
      bindings: { appSlug: res.appSlug, ownerHandle: res.ownerHandle, fsId: res.fsId },
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

  it("fully-qualified CDN URL imports are passed through, never re-prefixed onto esm.sh", async () => {
    // Regression for the garden-gnome/canary-import-regression misfire: an
    // `import x from "https://esm.sh/canvas-confetti"` was being captured as a
    // package and fed to render_esm_sh, which prepended `https://esm.sh/` again
    // → `https://esm.sh/https:/esm.sh/canvas-confetti` (400). Absolute-URL
    // specifiers must NOT land in the import map at all — the browser fetches
    // them directly.
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `import confetti from "https://esm.sh/canvas-confetti"; export default function App() { return <button onClick={() => confetti()}>go</button>; }`,
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
      bindings: { appSlug: res.appSlug, ownerHandle: res.ownerHandle, fsId: res.fsId },
    });
    const resIframe = await api.cfg.fetch(url);
    expect(resIframe.status).toBe(200);
    const iframeText = await resIframe.text();

    const importMapMatch = iframeText.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    if (!importMapMatch) {
      assert.fail("iframe HTML must contain an importmap script tag");
    }
    const importMap = JSON.parse(importMapMatch[1]) as { imports: Record<string, string> };
    // The absolute URL must not appear as an import-map key …
    expect(
      importMap.imports,
      `absolute-URL import must not be captured as a package; got: ${JSON.stringify(importMap.imports)}`
    ).not.toHaveProperty("https://esm.sh/canvas-confetti");
    // … and the doubled-prefix URL must never be emitted as a value.
    expect(JSON.stringify(importMap.imports)).not.toContain("esm.sh/https:");
  });

  it("node: builtin imports are mapped through esm.sh, not dropped", async () => {
    // Codex review on #2471: a browser-polyfillable builtin like
    // `import { Buffer } from "node:buffer"` must stay in the import map mapped
    // to https://esm.sh/node:buffer (esm.sh polyfills it) — same as the hot-swap
    // fallback. Dropping it would leave an unresolved `node:` specifier that
    // fails browser module resolution.
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `import { Buffer } from "node:buffer"; export default function App() { return <div>{Buffer.from("hi").toString()}</div>; }`,
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
      bindings: { appSlug: res.appSlug, ownerHandle: res.ownerHandle, fsId: res.fsId },
    });
    const resIframe = await api.cfg.fetch(url);
    expect(resIframe.status).toBe(200);
    const iframeText = await resIframe.text();

    const importMapMatch = iframeText.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    if (!importMapMatch) {
      assert.fail("iframe HTML must contain an importmap script tag");
    }
    const importMap = JSON.parse(importMapMatch[1]) as { imports: Record<string, string> };
    expect(
      importMap.imports,
      `node:buffer must be mapped through esm.sh; got: ${JSON.stringify(importMap.imports)}`
    ).toHaveProperty("node:buffer", "https://esm.sh/node:buffer");
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
        ownerHandle: res.ownerHandle,
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
          eq(appCtx.vibesCtx.sql.tables.apps.ownerHandle, res.ownerHandle),
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
      error: { code: "app-slug-invalid" },
    });
  });

  it("rejects ensureAppSlug with empty fileSystem", async () => {
    const res = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [],
    });
    expect(res.isErr()).toBe(true);
    expect(res.Err()).toMatchObject({
      error: { code: "app-slug-invalid" },
    });
  });

  it("repeatable stable ensureAppSlug", async () => {
    const now = Date.now();
    for (let i = 0; i < 2; i++) {
      const res = await api.ensureAppSlug({
        mode: "dev",
        appSlug: "sand-nose-hope",
        ownerHandle: `immediately-steel-${now}`,
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
        ownerHandle: `immediately-steel-${now}`,
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

  it("queries the llm", async () => {
    const rChatRes = await api.openChat({
      mode: "chat",
    });
    expect(rChatRes.isOk()).toBe(true);
    const chat = rChatRes.Ok();
    const rPrompt = await chat.prompt({
      messages: [{ role: "user", content: [{ type: "text", text: `use fixture response` }] }],
    });
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
    const allBlocks = nextFn.mock.calls.filter((c) => "blocks" in c[0]).flatMap((c) => c[0].blocks);
    expect(allBlocks.some((b: { type: string }) => b.type === "prompt.block-end")).toBe(true);
    expect(allBlocks.length).toEqual(3);
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

  // Early UI release (#2472): for a code-producing turn, the live wire emits
  // prompt.block-end (which flips the client's `running` off, releasing the
  // overlay) BEFORE the post-persist block.end that carries fsRef — and exactly
  // one prompt.block-end is emitted live. The persisted record still keeps the
  // fsRef-bearing block.end AND a terminal prompt.block-end for replay (covered
  // by the promptFS replay assertions above + seed-chat-section).
  it("emits prompt.block-end before the fsRef-bearing block.end (early UI release)", async () => {
    const chat = (await api.openChat({ mode: "chat" })).Ok();
    const rPrompt = await chat.promptFS([
      {
        type: "code-block",
        filename: "/App.jsx",
        lang: "jsx",
        content: `export default function App() { return <div>early release</div>; }`,
      } satisfies VibeFile,
    ]);
    expect(rPrompt.isOk()).toBe(true);

    const liveBlocks: { type: string; fsRef?: unknown }[] = [];
    await processStream(chat.sectionStream, async (msg) => {
      if (!("blocks" in msg)) return;
      for (const b of msg.blocks as { type: string; fsRef?: unknown }[]) liveBlocks.push(b);
      // The fsRef-bearing block.end is the last live event of the terminal path.
      if (msg.blocks.some((b: { type: string; fsRef?: unknown }) => b.type === "block.end" && b.fsRef)) {
        await chat.close();
      }
    });

    const promptEndIdxs = liveBlocks.map((b, i) => (b.type === "prompt.block-end" ? i : -1)).filter((i) => i >= 0);
    const fsBlockEndIdx = liveBlocks.findIndex((b) => b.type === "block.end" && b.fsRef);
    // Exactly one prompt.block-end on the live wire (early emit; the finally's
    // persist is store-only and must not duplicate the live event).
    expect(promptEndIdxs).toHaveLength(1);
    // The fsRef-bearing block.end exists and arrives AFTER prompt.block-end.
    expect(fsBlockEndIdx).toBeGreaterThanOrEqual(0);
    expect(promptEndIdxs[0]).toBeLessThan(fsBlockEndIdx);
  });

  describe("ensureAppSettings", () => {
    let appSlug: string;
    let ownerHandle: string;
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
      ownerHandle = res.ownerHandle;
    });

    it("ensureAppSettings not found", async () => {
      const res = await api.ensureAppSettings({ appSlug: "non-existent-app", ownerHandle: "non-existent-user" });
      expect(res.Ok().error).toContain("not-found");
    });

    it("ensureAppSettings found", async () => {
      const res = await api.ensureAppSettings({ appSlug, ownerHandle });
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
      ownerHandle = test.ownerHandle;

      const ref = await api.ensureAppSettings({ appSlug, ownerHandle });
      const res = await api2.ensureAppSettings({
        appSlug,
        ownerHandle,
        request: {
          enable: true,
          autoAcceptRole: "viewer",
        },
      });
      expect(res.Ok().settings.entries).toEqual(ref.Ok().settings.entries);
    });

    it("ensureAppSettings update title", async () => {
      const x1 = await api.ensureAppSettings({ appSlug, ownerHandle, title: "My App" });
      const x2 = await api.ensureAppSettings({ appSlug, ownerHandle, title: "My App" });
      const x3 = await api.ensureAppSettings({ appSlug, ownerHandle, title: "My App1" });
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
      const x1 = await api.ensureAppSettings({ appSlug, ownerHandle, codegen: { model: m("x") } });
      const x2 = await api.ensureAppSettings({ appSlug, ownerHandle, codegen: { model: m("x") } });
      const x3 = await api.ensureAppSettings({ appSlug, ownerHandle, codegen: { model: m("x1"), apiKey: "x" } });
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
            usage: "codegen",
          }),
        ])
      );
      expect(x3.Ok().settings.entry.settings.codegen).toEqual({
        model: m("x1"),
        apiKey: "x",
      });
    });

    it("ensureAppSettings clears one app-level model override without touching the others (#2622)", async () => {
      const { appSlug, ownerHandle } = await createApp();

      await api.ensureAppSettings({ appSlug, ownerHandle, codegen: { model: m("override-codegen"), apiKey: "k" } });
      const pinned = await api.ensureAppSettings({ appSlug, ownerHandle, runtime: { model: m("override-runtime") } });

      const codegenRows = (res: Awaited<ReturnType<typeof api.ensureAppSettings>>) =>
        res.Ok().settings.entries.filter((e) => e.type === "active.model" && (e.usage === "codegen" || e.usage === "chat"));
      const runtimeRows = (res: Awaited<ReturnType<typeof api.ensureAppSettings>>) =>
        res.Ok().settings.entries.filter((e) => e.type === "active.model" && (e.usage === "runtime" || e.usage === "app"));

      expect(codegenRows(pinned)).toHaveLength(1);
      expect(runtimeRows(pinned)).toHaveLength(1);

      // Clearing codegen removes its active.model row and the usage falls back to
      // the resolved default (no longer the override) while runtime stays pinned.
      const cleared = await api.ensureAppSettings({ appSlug, ownerHandle, codegen: null });
      expect(codegenRows(cleared)).toHaveLength(0);
      expect(cleared.Ok().settings.entry.settings.codegen?.model?.id).not.toBe("override-codegen");
      expect(runtimeRows(cleared)).toHaveLength(1);
      expect(cleared.Ok().settings.entry.settings.runtime).toEqual({ model: m("override-runtime") });

      // A repeated clear when nothing is pinned is a safe no-op.
      const clearedAgain = await api.ensureAppSettings({ appSlug, ownerHandle, codegen: null });
      expect(codegenRows(clearedAgain)).toHaveLength(0);
    });

    it("ensureAppSettings canonicalizes duplicate + legacy-named codegen model entries on save (#2608)", async () => {
      const { appSlug, ownerHandle } = await createApp();
      const seed = await api.ensureAppSettings({ appSlug, ownerHandle, codegen: { model: m("seed-chat"), apiKey: "seed-key" } });
      const appSettings = appCtx.vibesCtx.sql.tables.appSettings;

      // Seed rows using the pre-#2608 legacy `usage` tokens ("chat" → codegen,
      // "app" → runtime) directly so we exercise back-compat reads.
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
        .where(
          and(eq(appSettings.userId, seed.Ok().userId), eq(appSettings.appSlug, appSlug), eq(appSettings.ownerHandle, ownerHandle))
        );

      const selectedCodegen = { model: m("saved-chat"), apiKey: "saved-key" };
      const save = await api.ensureAppSettings({ appSlug, ownerHandle, codegen: selectedCodegen });
      // The guard matches both legacy "chat" and canonical "codegen", so the two
      // seeded legacy rows collapse into a single canonical entry.
      const saveCodegenEntries = save
        .Ok()
        .settings.entries.filter((entry) => entry.type === "active.model" && (entry.usage === "codegen" || entry.usage === "chat"));

      expect(saveCodegenEntries).toHaveLength(1);
      expect(saveCodegenEntries[0]).toMatchObject({ usage: "codegen" });
      expect(save.Ok().settings.entry.settings.codegen).toEqual(selectedCodegen);

      const read = await api.ensureAppSettings({ appSlug, ownerHandle });
      const readCodegenEntries = read
        .Ok()
        .settings.entries.filter((entry) => entry.type === "active.model" && (entry.usage === "codegen" || entry.usage === "chat"));

      expect(readCodegenEntries).toHaveLength(1);
      expect(read.Ok().settings.entry.settings.codegen).toEqual(selectedCodegen);
      // The legacy "app" (runtime) row is untouched and still resolves into the
      // canonical runtime bucket on read.
      expect(read.Ok().settings.entry.settings.runtime).toEqual({ model: m("app-model") });
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
      const { appSlug, ownerHandle } = await createApp();
      // Seed with any settings field to materialize the AppSettings row; the
      // direct UPDATE below requires an existing row to target.
      const seed = await api.ensureAppSettings({ appSlug, ownerHandle, title: "seed-title" });
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
        .where(and(eq(appSettings.userId, userId), eq(appSettings.appSlug, appSlug), eq(appSettings.ownerHandle, ownerHandle)));

      // One save per entry type. Each save must canonicalize that type to one entry.
      await api.ensureAppSettings({ appSlug, ownerHandle, title: "new-title" });
      await api.ensureAppSettings({ appSlug, ownerHandle, theme: "new-theme" });
      await api.ensureAppSettings({ appSlug, ownerHandle, skills: ["new-skill"] });
      await api.ensureAppSettings({ appSlug, ownerHandle, iconDescription: "new-icon-desc" });
      await api.ensureAppSettings({ appSlug, ownerHandle, env: [{ key: "NEW", value: "v" }] });
      await api.ensureAppSettings({ appSlug, ownerHandle, publicAccess: { enable: false } });
      await api.ensureAppSettings({ appSlug, ownerHandle, request: { enable: false } });
      await api.ensureAppSettings({ appSlug, ownerHandle, dbAcl: { dbName: "shared", acl: { read: ["members"] } } });

      const final = await api.ensureAppSettings({ appSlug, ownerHandle });
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

    it("ensureAppSettings update runtime", async () => {
      const x1 = await api.ensureAppSettings({ appSlug, ownerHandle, runtime: { model: m("x") } });
      const x2 = await api.ensureAppSettings({ appSlug, ownerHandle, runtime: { model: m("x") } });
      const x3 = await api.ensureAppSettings({ appSlug, ownerHandle, runtime: { model: m("x1"), apiKey: "x" } });
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
            usage: "runtime",
          }),
        ])
      );
      expect(x3.Ok().settings.entry.settings.runtime).toEqual({
        model: m("x1"),
        apiKey: "x",
      });
    });

    it("ensureAppSettings update env", async () => {
      const x1 = await api.ensureAppSettings({ appSlug, ownerHandle, env: [{ key: "x", value: "x" }] });
      const x2 = await api.ensureAppSettings({ appSlug, ownerHandle, env: [{ key: "x", value: "x" }] });
      const x3 = await api.ensureAppSettings({
        appSlug,
        ownerHandle,
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
      const { appSlug, ownerHandle } = await createApp();
      const x1 = await api.ensureAppSettings({
        appSlug,
        ownerHandle,
        publicAccess: {
          enable: true,
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        ownerHandle,
        publicAccess: {
          enable: false,
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        ownerHandle,
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
      const { appSlug, ownerHandle } = await createApp();
      const x1 = await api.ensureAppSettings({
        appSlug,
        ownerHandle,
        request: {
          enable: true,
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        ownerHandle,
        request: {
          enable: true,
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        ownerHandle,
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
          ownerHandle: "example-user",
          appSlug: "example-app",
          promptId,
          outerTid: "outer",
        } as unknown as ReqWithVerifiedAuth<ReqPromptChatSection>,
        resChat: {
          appSlug: "example-app",
          ownerHandle: "example-user",
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
            eq(vctx.sql.tables.apps.ownerHandle, "example-user"),
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
        runId: promptId,
        userId: "testUserId",
        ownerHandle: "example-user",
      });
      expect(pctx.Ok()).toEqual({
        blockSeq: 138,
        fsRef: {
          _t: {
            appSlug: "example-app",
            fsId: "zDdC6RKfJgJB9HzK8qKMXGgTSaENJXjXBWUarsrgShUCW",
            mode: "dev",
            ownerHandle: "example-user",
          },
        },
      });
    });
  });

  // request flow and invite flow tests moved to api-access-flow.test.ts
});
