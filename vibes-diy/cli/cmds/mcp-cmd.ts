import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { command, option, string } from "cmd-ts";
import { basename } from "node:path";
import { exception2Result } from "@adviser/cement";
import { FireflyApiAdapter } from "@vibes.diy/api-impl";
import { isResGetDoc, isResGetDocNotFound, isResPutDoc, isResDeleteDoc, isResQueryDocs } from "@vibes.diy/api-types";
import type { ResGetDoc } from "@vibes.diy/api-types";
// @ts-expect-error "charwise" has no types
import charwise from "charwise";
import type { CliCtx } from "../cli-ctx.js";
import { resolveUserSlug } from "./db/shared.js";

import type { VibesDiyApi } from "@vibes.diy/api-impl";

export interface McpServerDeps {
  readonly api: VibesDiyApi;
  readonly appSlug: string;
  readonly ownerHandle: string;
}

export function createMcpServer(deps: McpServerDeps): McpServer {
  const { api, appSlug, ownerHandle } = deps;
  const args = { appSlug };

  const server = new McpServer({
    name: "vibes-diy",
    version: "0.0.0",
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
    {},
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async () => {
      try {
        const slug = args.appSlug;
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
      id: z.string().describe("Document ID"),
      db: z.string().optional().describe("Database name (default: 'default')"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (params) => {
      try {
        const slug = args.appSlug;
        const dbName = params.db ?? "default";
        const adapter = new FireflyApiAdapter(api, slug, { ownerHandle });
        const r = await adapter.getDoc(params.id, dbName);
        if (r.isErr()) {
          return { content: [{ type: "text" as const, text: `Error: ${r.Err()}` }] };
        }
        const res = r.Ok();
        if (isResGetDocNotFound(res)) {
          return { content: [{ type: "text" as const, text: `Document not found: ${params.id}` }] };
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
      doc: z.record(z.unknown()).describe("Document to store"),
      id: z.string().optional().describe("Document ID (_id); generated if omitted"),
      db: z.string().optional().describe("Database name (default: 'default')"),
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    async (params) => {
      try {
        const slug = args.appSlug;
        const dbName = params.db ?? "default";
        const adapter = new FireflyApiAdapter(api, slug, { ownerHandle });
        const docId = params.id;
        const r = await adapter.putDoc(params.doc, docId, dbName);
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
      id: z.string().describe("Document ID to delete"),
      db: z.string().optional().describe("Database name (default: 'default')"),
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    async (params) => {
      try {
        const slug = args.appSlug;
        const dbName = params.db ?? "default";
        const adapter = new FireflyApiAdapter(api, slug, { ownerHandle });
        const r = await adapter.deleteDoc(params.id, dbName);
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
    "Query documents by field value with optional key, prefix, range, limit, and descending filters",
    {
      field: z.string().describe("Field name to index on"),
      db: z.string().optional().describe("Database name (default: 'default')"),
      key: z.string().optional().describe("Exact key match (JSON value)"),
      prefix: z.string().optional().describe("Key prefix match (JSON value)"),
      range: z.tuple([z.string(), z.string()]).optional().describe("Key range [start, end] (JSON values)"),
      limit: z.number().optional().describe("Maximum number of results (0 or omitted = no limit)"),
      descending: z.boolean().optional().describe("Return results in descending order"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (params) => {
      try {
        const slug = args.appSlug;
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

        // Apply prefix filter
        if (params.prefix !== undefined && params.prefix !== "") {
          const prefixStr = params.prefix;
          const rPrefix = await exception2Result(() => JSON.parse(prefixStr) as unknown);
          if (rPrefix.isErr()) {
            return { content: [{ type: "text" as const, text: `Invalid prefix JSON: ${rPrefix.Err()}` }] };
          }
          const prefixVal = rPrefix.Ok();
          let encodedPrefix = charwise.encode(prefixVal) as string;
          if (Array.isArray(prefixVal) && encodedPrefix.endsWith("!")) {
            encodedPrefix = encodedPrefix.slice(0, -1);
          }
          rows = rows.filter((r) => r.encodedKey.startsWith(encodedPrefix));
        }

        // Apply range filter
        if (params.range !== undefined) {
          const [rangeStart, rangeEnd] = params.range;
          const rStart = await exception2Result(() => JSON.parse(rangeStart) as unknown);
          const rEnd = await exception2Result(() => JSON.parse(rangeEnd) as unknown);
          if (rStart.isErr()) {
            return { content: [{ type: "text" as const, text: `Invalid range start JSON: ${rStart.Err()}` }] };
          }
          if (rEnd.isErr()) {
            return { content: [{ type: "text" as const, text: `Invalid range end JSON: ${rEnd.Err()}` }] };
          }
          const encodedStart = charwise.encode(rStart.Ok()) as string;
          const encodedEnd = charwise.encode(rEnd.Ok()) as string;
          rows = rows.filter((r) => r.encodedKey >= encodedStart && r.encodedKey <= encodedEnd);
        }

        // Sort by charwise-encoded key
        rows.sort((a, b) => (a.encodedKey < b.encodedKey ? -1 : a.encodedKey > b.encodedKey ? 1 : 0));

        // Apply descending
        if (params.descending) {
          rows.reverse();
        }

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

  return server;
}

async function startMcpServer(ctx: CliCtx, handlerArgs: { appSlug: string; ownerHandle: string; apiUrl: string }) {
  if (!ctx.vibesDiyApiFactory) {
    console.error("Not logged in. Run 'vibes-diy login' first.");
    process.exit(1);
  }

  const api = ctx.vibesDiyApiFactory(handlerArgs.apiUrl);

  const rUser = await resolveUserSlug(api, handlerArgs.ownerHandle);
  if (rUser.isErr()) {
    console.error(`Failed to resolve user slug: ${rUser.Err()}`);
    process.exit(1);
  }
  const ownerHandle = rUser.Ok();

  const server = createMcpServer({ api, appSlug: handlerArgs.appSlug, ownerHandle });

  const transport = new StdioServerTransport();
  console.error("vibes-diy MCP server started");
  await server.connect(transport);

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
        long: "handle",
        description: "Handle; defaults to defaultHandle from user settings",
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
