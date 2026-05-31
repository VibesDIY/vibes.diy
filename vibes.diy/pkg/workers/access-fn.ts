import { DurableObject, DurableObjectState, Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { CFEnv } from "@vibes.diy/api-types";
import type { AccessDescriptor, UserContext } from "@vibes.diy/api-types";
import { makeHelpers } from "@vibes.diy/api-svc/public/access-function.js";

declare const Response: typeof CFResponse;

// AccessFnDO is named by the CID of access.js.
// Cold start: load source from D1 Assets, eval once with new Function(), cache.
// The CF Worker process provides isolation — unsafe_eval is scoped to the Worker sandbox,
// not a shared JS VM.
export class AccessFnDO implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly env: CFEnv;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private cachedFn: Function | undefined;

  constructor(state: DurableObjectState, env: CFEnv) {
    this.state = state;
    this.env = env;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private async loadFn(cid: string): Promise<Function> {
    if (this.cachedFn) return this.cachedFn;

    const row = await this.env.DB.prepare("SELECT content FROM Assets WHERE assetId = ?")
      .bind(cid)
      .first<{ content: string | Uint8Array | ArrayBuffer }>();

    if (!row) {
      throw new Error(`access.js not found for CID: ${cid}`);
    }

    let source: string;
    if (typeof row.content === "string") {
      source = row.content;
    } else {
      const sthis = ensureSuperThis();
      const bytes = row.content instanceof ArrayBuffer ? new Uint8Array(row.content) : row.content;
      source = sthis.txt.decode(bytes);
    }

    // Strip ES module export keywords so new Function() can wrap the source.
    // Supports: `export default function ...`, `export default (doc, ...) => ...`,
    // and `export function access(...)`.
    const munged = source
      .replace(/^export\s+default\s+/m, "var __access = ")
      .replace(/^export\s+function\s+access\b/m, "var __access = function access");

    // eslint-disable-next-line no-new-func
    const getFn = new Function(`${munged};\nreturn typeof __access !== 'undefined' ? __access : undefined;`);
    const fn = getFn();
    if (typeof fn !== "function") {
      throw new Error(`access.js did not export a callable function (CID: ${cid})`);
    }
    this.cachedFn = fn;
    return fn;
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    if (request.method !== "POST") {
      return new Response("Expected POST", { status: 400 });
    }

    let body: { cid: string; doc: unknown; oldDoc: unknown; user: UserContext | null };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { cid, doc, oldDoc, user } = body;
    if (!cid) {
      return new Response("Missing cid", { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    let fn: Function;
    try {
      fn = await this.loadFn(cid);
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let result: AccessDescriptor;
    try {
      result = fn(doc, oldDoc, user, makeHelpers(user)) as AccessDescriptor;
    } catch (err: unknown) {
      // Access function threw — could be ForbiddenError or plain throw { forbidden }
      const reason =
        err && typeof err === "object" && "forbidden" in err ? String((err as { forbidden: unknown }).forbidden) : String(err);
      return new Response(JSON.stringify({ forbidden: reason }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result ?? {}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
