import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Result } from "@adviser/cement";
import type { VibesDiyApi } from "@vibes.diy/api-impl";
import { createMcpServer } from "./mcp-cmd.js";

function makeMockApi() {
  return {
    listRecentVibes: vi.fn().mockResolvedValue(
      Result.Ok({
        items: [
          { ownerHandle: "og", appSlug: "test-app", title: "Test App" },
          { ownerHandle: "og", appSlug: "other-app", title: "Other App" },
        ],
        nextCursor: undefined,
      })
    ),
    listDbNames: vi.fn().mockResolvedValue(Result.Ok({ dbNames: ["main", "settings"] })),
    getDoc: vi.fn().mockImplementation(async (req: { docId: string }) =>
      Result.Ok({
        type: "vibes.diy.res-get-doc",
        status: "ok",
        id: req.docId,
        doc: { title: "Test Doc", type: "note" },
      })
    ),
    putDoc: vi.fn().mockResolvedValue(
      Result.Ok({
        type: "vibes.diy.res-put-doc",
        status: "ok",
        id: "generated-id-123",
      })
    ),
    deleteDoc: vi.fn().mockImplementation(async (req: { docId: string }) =>
      Result.Ok({
        type: "vibes.diy.res-delete-doc",
        status: "ok",
        id: req.docId,
      })
    ),
    queryDocs: vi.fn().mockResolvedValue(
      Result.Ok({
        type: "vibes.diy.res-query-docs",
        status: "ok",
        docs: [
          { _id: "doc-1", type: "note", title: "First" },
          { _id: "doc-2", type: "task", title: "Second" },
          { _id: "doc-3", type: "note", title: "Third" },
        ],
      })
    ),
  };
}

async function setupClient() {
  const api = makeMockApi();
  const server = createMcpServer({
    api: api as unknown as VibesDiyApi,
    appSlug: "test-app",
    ownerHandle: "og",
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.1" });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { client, server, api, clientTransport, serverTransport };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MCP server — tool listing", () => {
  it("exposes all 6 tools", async () => {
    const { client } = await setupClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["vibes_delete", "vibes_get", "vibes_list_apps", "vibes_list_databases", "vibes_put", "vibes_query"]);
    await client.close();
  });

  it("marks read-only tools correctly", async () => {
    const { client } = await setupClient();
    const { tools } = await client.listTools();
    const readTools = tools.filter((t) => t.annotations?.readOnlyHint === true);
    const writeTools = tools.filter((t) => t.annotations?.destructiveHint === true);
    expect(readTools.map((t) => t.name).sort()).toEqual(["vibes_get", "vibes_list_apps", "vibes_list_databases", "vibes_query"]);
    expect(writeTools.map((t) => t.name).sort()).toEqual(["vibes_delete", "vibes_put"]);
    await client.close();
  });
});

describe("MCP server — vibes_list_apps", () => {
  it("returns all apps", async () => {
    const { client } = await setupClient();
    const result = await client.callTool({ name: "vibes_list_apps", arguments: {} });
    const text = (result.content as { type: string; text: string }[])[0].text;
    const items = JSON.parse(text);
    expect(items).toHaveLength(2);
    expect(items[0].appSlug).toBe("test-app");
    expect(items[1].title).toBe("Other App");
    await client.close();
  });
});

describe("MCP server — vibes_list_databases", () => {
  it("returns database names for the session app", async () => {
    const { client, api } = await setupClient();
    const result = await client.callTool({ name: "vibes_list_databases", arguments: {} });
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(["main", "settings"]);
    expect(api.listDbNames).toHaveBeenCalledWith({ appSlug: "test-app", ownerHandle: "og" });
    await client.close();
  });
});

describe("MCP server — vibes_get", () => {
  it("retrieves a document by ID", async () => {
    const { client } = await setupClient();
    const result = await client.callTool({ name: "vibes_get", arguments: { id: "doc-abc", db: "main" } });
    const text = (result.content as { type: string; text: string }[])[0].text;
    const doc = JSON.parse(text);
    expect(doc._id).toBe("doc-abc");
    expect(doc.title).toBe("Test Doc");
    await client.close();
  });

  it("uses 'default' db when db is omitted", async () => {
    const { client, api } = await setupClient();
    await client.callTool({ name: "vibes_get", arguments: { id: "doc-abc" } });
    const call = api.getDoc.mock.calls[0][0] as Record<string, unknown>;
    expect(call.dbName).toBe("default");
    await client.close();
  });
});

describe("MCP server — vibes_put", () => {
  it("creates a document and returns the ID", async () => {
    const { client } = await setupClient();
    const result = await client.callTool({
      name: "vibes_put",
      arguments: { doc: { type: "note", title: "New Note" }, db: "main" },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    const res = JSON.parse(text);
    expect(res.id).toBe("generated-id-123");
    expect(res.ok).toBe(true);
    await client.close();
  });
});

describe("MCP server — vibes_delete", () => {
  it("deletes a document and returns confirmation", async () => {
    const { client } = await setupClient();
    const result = await client.callTool({ name: "vibes_delete", arguments: { id: "doc-to-delete", db: "main" } });
    const text = (result.content as { type: string; text: string }[])[0].text;
    const res = JSON.parse(text);
    expect(res.id).toBe("doc-to-delete");
    expect(res.ok).toBe(true);
    await client.close();
  });
});

describe("MCP server — vibes_query", () => {
  it("queries by field and returns matching documents", async () => {
    const { client } = await setupClient();
    const result = await client.callTool({ name: "vibes_query", arguments: { field: "type", db: "main" } });
    const text = (result.content as { type: string; text: string }[])[0].text;
    const docs = JSON.parse(text);
    expect(docs).toHaveLength(3);
    await client.close();
  });

  it("filters by key", async () => {
    const { client } = await setupClient();
    const result = await client.callTool({
      name: "vibes_query",
      arguments: { field: "type", db: "main", key: '"note"' },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    const docs = JSON.parse(text);
    expect(docs).toHaveLength(2);
    expect(docs.every((d: Record<string, unknown>) => d.type === "note")).toBe(true);
    await client.close();
  });

  it("respects limit", async () => {
    const { client } = await setupClient();
    const result = await client.callTool({
      name: "vibes_query",
      arguments: { field: "type", db: "main", limit: 1 },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    const docs = JSON.parse(text);
    expect(docs).toHaveLength(1);
    await client.close();
  });

  it("supports descending order", async () => {
    const { client } = await setupClient();
    const asc = await client.callTool({ name: "vibes_query", arguments: { field: "type", db: "main" } });
    const desc = await client.callTool({ name: "vibes_query", arguments: { field: "type", db: "main", descending: true } });
    const ascDocs = JSON.parse((asc.content as { type: string; text: string }[])[0].text);
    const descDocs = JSON.parse((desc.content as { type: string; text: string }[])[0].text);
    expect(ascDocs[0].type).toBe("note");
    expect(descDocs[0].type).toBe("task");
    await client.close();
  });
});
