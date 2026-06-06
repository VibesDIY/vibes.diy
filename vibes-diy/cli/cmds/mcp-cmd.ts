import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { command, option, string } from "cmd-ts";
import { basename, join } from "node:path";
import { readFileSync } from "node:fs";
import { exception2Result } from "@adviser/cement";
import { FireflyApiAdapter } from "@vibes.diy/api-impl";
import { isResGetDoc, isResGetDocNotFound, isResPutDoc, isResDeleteDoc, isResQueryDocs } from "@vibes.diy/api-types";
import type { ResGetDoc } from "@vibes.diy/api-types";
// @ts-expect-error "charwise" has no types
import charwise from "charwise";
import type { CliCtx } from "../cli-ctx.js";
import { resolveUserSlug } from "./db/shared.js";

async function startMcpServer(ctx: CliCtx, args: { appSlug: string; ownerHandle: string; apiUrl: string }) {
  if (!ctx.vibesDiyApiFactory) {
    console.error("Not logged in. Run 'vibes-diy login' first.");
    process.exit(1);
  }

  const api = ctx.vibesDiyApiFactory(args.apiUrl);

  const rUser = await resolveUserSlug(api, args.ownerHandle);
  if (rUser.isErr()) {
    console.error(`Failed to resolve user slug: ${rUser.Err()}`);
    process.exit(1);
  }
  const ownerHandle = rUser.Ok();

  const packageJson = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "package.json"), "utf8"));

  const server = new McpServer({
    name: "vibes-diy",
    version: packageJson.version as string,
  });

  // ── vibes_list_apps ──────────────────────────────────────────────
  server.tool(
    "vibes_list_apps",
    "List all apps (vibes) owned by the authenticated user",
    {},
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async () => {
      try {
        const items: Record<string, unknown>[] = [];
        let cursor: string | undefined;
        do {
          const rPage = await api.listRecentVibes({ limit: 100, ...(cursor ? { cursor } : {}) });
          if (rPage.isErr()) {
            return { content: [{ type: "text" as const, text: `Error: ${rPage.Err()}` }] };
          }
          const page = rPage.Ok();
          items.push(...page.items);
          cursor = page.nextCursor;
        } while (cursor);
        return { content: [{ type: "text" as const, text: JSON.stringify(items) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e}` }] };
      }
    }
  );

  // ── vibes_list_databases ─────────────────────────────────────────
  server.tool(
    "vibes_list_databases",
    "List database names for an app",
    {
      app_slug: z.string().optional().describe("App slug; defaults to the server's configured app slug"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (params) => {
      try {
        const slug = params.app_slug ?? args.appSlug;
        const r = await api.listDbNames({ appSlug: slug, ownerHandle });
        if (r.isErr()) {
          return { content: [{ type: "text" as const, text: `Error: ${r.Err()}` }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(r.Ok().dbNames) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e}` }] };
      }
    }
  );

  // ── vibes_get ────────────────────────────────────────────────────
  server.tool(
    "vibes_get",
    "Get a document by ID from a database",
    {
      doc_id: z.string().describe("Document ID"),
      db: z.string().optional().describe("Database name (default: 'default')"),
      app_slug: z.string().optional().describe("App slug; defaults to the server's configured app slug"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (params) => {
      try {
        const slug = params.app_slug ?? args.appSlug;
        const dbName = params.db ?? "default";
        const adapter = new FireflyApiAdapter(api, slug, { ownerHandle });
        const r = await adapter.getDoc(params.doc_id, dbName);
        if (r.isErr()) {
          return { content: [{ type: "text" as const, text: `Error: ${r.Err()}` }] };
        }
        const res = r.Ok();
        if (isResGetDocNotFound(res)) {
          return { content: [{ type: "text" as const, text: `Document not found: ${params.doc_id}` }] };
        }
        if (!isResGetDoc(res)) {
          return { content: [{ type: "text" as const, text: `Unexpected response: ${JSON.stringify(res)}` }] };
        }
        const getRes = res as ResGetDoc;
        return { content: [{ type: "text" as const, text: JSON.stringify({ ...getRes.doc, _id: getRes.id }) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e}` }] };
      }
    }
  );

  // ── vibes_put ────────────────────────────────────────────────────
  server.tool(
    "vibes_put",
    "Create or update a document in a database",
    {
      doc: z.string().describe("JSON document to store"),
      doc_id: z.string().optional().describe("Document ID (_id); generated if omitted"),
      db: z.string().optional().describe("Database name (default: 'default')"),
      app_slug: z.string().optional().describe("App slug; defaults to the server's configured app slug"),
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    async (params) => {
      try {
        const rParsed = await exception2Result(() => JSON.parse(params.doc) as Record<string, unknown>);
        if (rParsed.isErr()) {
          return { content: [{ type: "text" as const, text: `Invalid JSON: ${rParsed.Err()}` }] };
        }
        const doc = rParsed.Ok();
        const slug = params.app_slug ?? args.appSlug;
        const dbName = params.db ?? "default";
        const adapter = new FireflyApiAdapter(api, slug, { ownerHandle });
        const docId = params.doc_id ?? undefined;
        const r = await adapter.putDoc(doc, docId, dbName);
        if (r.isErr()) {
          return { content: [{ type: "text" as const, text: `Error: ${r.Err()}` }] };
        }
        const res = r.Ok();
        if (!isResPutDoc(res)) {
          return { content: [{ type: "text" as const, text: `Unexpected response: ${JSON.stringify(res)}` }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify({ id: res.id, ok: true }) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e}` }] };
      }
    }
  );

  // ── vibes_delete ─────────────────────────────────────────────────
  server.tool(
    "vibes_delete",
    "Delete a document by ID from a database",
    {
      doc_id: z.string().describe("Document ID to delete"),
      db: z.string().optional().describe("Database name (default: 'default')"),
      app_slug: z.string().optional().describe("App slug; defaults to the server's configured app slug"),
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    async (params) => {
      try {
        const slug = params.app_slug ?? args.appSlug;
        const dbName = params.db ?? "default";
        const adapter = new FireflyApiAdapter(api, slug, { ownerHandle });
        const r = await adapter.deleteDoc(params.doc_id, dbName);
        if (r.isErr()) {
          return { content: [{ type: "text" as const, text: `Error: ${r.Err()}` }] };
        }
        const res = r.Ok();
        if (!isResDeleteDoc(res)) {
          return { content: [{ type: "text" as const, text: `Unexpected response: ${JSON.stringify(res)}` }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify({ id: res.id, ok: true }) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e}` }] };
      }
    }
  );

  // ── vibes_query ──────────────────────────────────────────────────
  server.tool(
    "vibes_query",
    "Query documents by field value with optional key and limit filters",
    {
      field: z.string().describe("Field name to index on"),
      db: z.string().optional().describe("Database name (default: 'default')"),
      key: z.string().optional().describe("Exact key match (JSON value)"),
      limit: z.number().optional().describe("Maximum number of results (0 or omitted = no limit)"),
      app_slug: z.string().optional().describe("App slug; defaults to the server's configured app slug"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (params) => {
      try {
        const slug = params.app_slug ?? args.appSlug;
        const dbName = params.db ?? "default";
        const adapter = new FireflyApiAdapter(api, slug, { ownerHandle });

        const r = await adapter.queryDocs(dbName);
        if (r.isErr()) {
          return { content: [{ type: "text" as const, text: `Error: ${r.Err()}` }] };
        }
        const res = r.Ok();
        if (!isResQueryDocs(res)) {
          return { content: [{ type: "text" as const, text: `Unexpected response: ${JSON.stringify(res)}` }] };
        }

        const field = params.field;
        let rows = res.docs
          .filter((doc) => doc[field] !== undefined)
          .map((doc) => ({
            doc,
            encodedKey: charwise.encode(doc[field]) as string,
          }));

        // Apply key filter (exact match on encoded key)
        if (params.key !== undefined && params.key !== "") {
          const keyStr = params.key;
          const rKey = await exception2Result(() => JSON.parse(keyStr) as unknown);
          if (rKey.isErr()) {
            return { content: [{ type: "text" as const, text: `Invalid key JSON: ${rKey.Err()}` }] };
          }
          const encodedKey = charwise.encode(rKey.Ok()) as string;
          rows = rows.filter((r) => r.encodedKey === encodedKey);
        }

        // Sort by charwise-encoded key
        rows.sort((a, b) => (a.encodedKey < b.encodedKey ? -1 : a.encodedKey > b.encodedKey ? 1 : 0));

        // Apply limit
        if (params.limit !== undefined && params.limit > 0) {
          rows = rows.slice(0, params.limit);
        }

        const docs = rows.map((r) => r.doc);
        return { content: [{ type: "text" as const, text: JSON.stringify(docs) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e}` }] };
      }
    }
  );

  // ── Connect transport ────────────────────────────────────────────
  const transport = new StdioServerTransport();
  console.error("vibes-diy MCP server started");
  await server.connect(transport);

  // Block forever — the process exits on SIGINT
  await new Promise<never>(() => {
    /* never resolves */
  });
}

export function mcpCmd(ctx: CliCtx) {
  return command({
    name: "mcp",
    description: "Start an MCP server for AI agent data access (stdio transport)",
    args: {
      appSlug: option({
        long: "app-slug",
        description: "App slug; defaults to env VIBES_APP_SLUG or basename(cwd)",
        type: string,
        defaultValue: () => ctx.sthis.env.get("VIBES_APP_SLUG") ?? basename(process.cwd()),
        defaultValueIsSerializable: true,
      }),
      ownerHandle: option({
        long: "user-slug",
        description: "User slug; defaults to defaultHandle from user settings",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      apiUrl: option({
        long: "api-url",
        short: "u",
        description: "set the api url",
        type: string,
        defaultValue: () => ctx.sthis.env.get("VIBES_API_URL") ?? "https://vibes.diy/api?.stable-entry.=cli",
        defaultValueIsSerializable: true,
      }),
    },
    handler: async (handlerArgs) => {
      // Start MCP server directly — this is a long-running process
      // Don't use cliStream/evento pattern
      await startMcpServer(ctx, handlerArgs);
    },
  });
}
