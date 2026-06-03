import { DurableObject, Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";

declare const Response: typeof CFResponse;

interface OnChangeEvent {
  doc: unknown;
  oldDoc: unknown | null;
  db: string;
}

interface BackendHandlers {
  onChange?: (event: OnChangeEvent, ctx: BackendCtx) => Promise<void> | void;
  [key: string]: unknown;
}

interface BackendCtx {
  secrets: Record<string, string>;
  userInfo: { ownerHandle: string; writerHandle: string };
  appInfo: { ownerHandle: string; appSlug: string };
  db: {
    put: (doc: unknown) => Promise<unknown>;
    get: (id: string) => Promise<unknown>;
  };
}

interface InvokeBody {
  action: "onChange";
  source: string;
  cid: string;
  event: OnChangeEvent;
  ownerHandle: string;
  appSlug: string;
  writerHandle: string;
  secrets?: Record<string, string>;
  putDocUrl: string;
}

function parseInvokeBody(raw: unknown): InvokeBody {
  if (typeof raw !== "object" || raw === null) throw new Error("invalid invoke body");
  const b = raw as Record<string, unknown>;
  if (typeof b.action !== "string") throw new Error("missing action");
  if (typeof b.source !== "string") throw new Error("missing source");
  if (typeof b.cid !== "string") throw new Error("missing cid");
  if (typeof b.event !== "object" || b.event === null) throw new Error("missing event");
  if (typeof b.ownerHandle !== "string") throw new Error("missing ownerHandle");
  if (typeof b.appSlug !== "string") throw new Error("missing appSlug");
  if (typeof b.writerHandle !== "string") throw new Error("missing writerHandle");
  if (typeof b.putDocUrl !== "string") throw new Error("missing putDocUrl");
  return {
    action: b.action as "onChange",
    source: b.source,
    cid: b.cid,
    event: b.event as OnChangeEvent,
    ownerHandle: b.ownerHandle,
    appSlug: b.appSlug,
    writerHandle: b.writerHandle,
    secrets: typeof b.secrets === "object" && b.secrets !== null ? (b.secrets as Record<string, string>) : {},
    putDocUrl: b.putDocUrl,
  };
}

export class BackendDO implements DurableObject {
  private currentCid: string | null = null;
  private handlers: BackendHandlers | null = null;

  private loadSource(source: string, cid: string): void {
    if (this.currentCid === cid && this.handlers !== null) return;

    // Transform ES module export syntax to CommonJS-style assignments so we can
    // wrap the module body in a Function factory.
    // export async function onChange(...) → exports.onChange = async function onChange(...)
    // export function onChange(...) → exports.onChange = function onChange(...)
    // export const config = ... → exports.config = ...
    const transformed = source
      .replace(/export\s+(async\s+)function\s+(\w+)/g, "exports.$2 = $1function $2")
      .replace(/export\s+const\s+(\w+)/g, "exports.$1");

    const wrappedSource = `const exports = {};\n${transformed}\nreturn exports;`;

    // eslint-disable-next-line no-new-func
    const factory = new Function(wrappedSource);
    this.handlers = factory() as BackendHandlers;
    this.currentCid = cid;
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    if (request.method !== "POST") {
      return new Response("expected POST", { status: 400 }) as unknown as CFResponse;
    }

    let body: InvokeBody;
    try {
      body = parseInvokeBody(await request.json());
    } catch (err) {
      return new Response(JSON.stringify({ error: `invalid request body: ${err instanceof Error ? err.message : String(err)}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }) as unknown as CFResponse;
    }

    if (body.action !== "onChange") {
      return new Response(JSON.stringify({ error: `unsupported action: ${body.action}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }) as unknown as CFResponse;
    }

    try {
      this.loadSource(body.source, body.cid);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `source compilation failed: ${err instanceof Error ? err.message : String(err)}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ) as unknown as CFResponse;
    }

    const handler = this.handlers?.onChange;
    if (typeof handler !== "function") {
      return new Response(JSON.stringify({ error: "no onChange export found in source" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }) as unknown as CFResponse;
    }

    const { putDocUrl, ownerHandle, appSlug, writerHandle, secrets, event } = body;

    const ctx: BackendCtx = {
      secrets: secrets ?? {},
      userInfo: { ownerHandle, writerHandle },
      appInfo: { ownerHandle, appSlug },
      db: {
        put: async (doc: unknown): Promise<unknown> => {
          const res = await globalThis.fetch(putDocUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-writer-handle": writerHandle,
            },
            body: JSON.stringify({ doc }),
          });
          if (!res.ok) {
            throw new Error(`db.put failed: ${res.status} ${await res.text()}`);
          }
          return res.json();
        },
        get: async (id: string): Promise<unknown> => {
          const getUrl = new URL(putDocUrl);
          getUrl.searchParams.set("id", id);
          const res = await globalThis.fetch(getUrl.toString(), {
            method: "GET",
            headers: {
              "x-writer-handle": writerHandle,
            },
          });
          if (!res.ok) {
            throw new Error(`db.get failed: ${res.status} ${await res.text()}`);
          }
          return res.json();
        },
      },
    };

    try {
      await handler(event, ctx);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `onChange handler threw: ${err instanceof Error ? err.message : String(err)}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ) as unknown as CFResponse;
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }) as unknown as CFResponse;
  }
}
