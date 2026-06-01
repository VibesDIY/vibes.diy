import { DurableObject, DurableObjectState, Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";
import { CFEnv } from "@vibes.diy/api-types";
import type { AccessDescriptor, AccessFunction, UserContext } from "@vibes.diy/api-types";
import { makeHelpers, ForbiddenError } from "@vibes.diy/api-svc";

declare const Response: typeof CFResponse;

const InvokeBody = {
  parse(raw: unknown): { doc: unknown; oldDoc: unknown | null; user: UserContext | null } {
    if (typeof raw !== "object" || raw === null) throw new Error("invalid invoke body");
    return raw as { doc: unknown; oldDoc: unknown | null; user: UserContext | null };
  },
};

export class AccessFnDO implements DurableObject {
  private fn: AccessFunction | null = null;
  private loadError: string | null = null;

  constructor(state: DurableObjectState, env: CFEnv) {
    state.blockConcurrencyWhile(async () => {
      // state.id.name is the CID we used in idFromName(cid).
      const cid = state.id.name;
      if (!cid) {
        this.loadError = "AccessFnDO: missing id.name — must be created via idFromName(cid)";
        return;
      }
      const obj = await env.FS_IDS_BUCKET.get(cid);
      if (!obj) {
        this.loadError = `AccessFnDO: access.js not found in R2 for CID ${cid}`;
        return;
      }
      const source = await obj.text();
      try {
        // new Function runs during blockConcurrencyWhile — covered by allow_eval_during_startup.
        this.fn = new Function("doc", "oldDoc", "user", "ctx", source) as AccessFunction;
      } catch (err: unknown) {
        this.loadError = `AccessFnDO: eval failed for CID ${cid}: ${String(err)}`;
      }
    });
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    if (request.method !== "POST") {
      return new Response("expected POST", { status: 400 });
    }

    if (this.loadError) {
      return new Response(JSON.stringify({ forbidden: this.loadError }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!this.fn) {
      return new Response(JSON.stringify({ forbidden: "access function not loaded" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: { doc: unknown; oldDoc: unknown | null; user: UserContext | null };
    try {
      body = InvokeBody.parse(await request.json());
    } catch {
      return new Response(JSON.stringify({ forbidden: "invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const helpers = makeHelpers(body.user);
    let result: AccessDescriptor | { forbidden: string };
    try {
      result = this.fn(body.doc, body.oldDoc, body.user, helpers);
    } catch (err: unknown) {
      if (err instanceof ForbiddenError) {
        result = { forbidden: err.forbidden };
      } else {
        result = { forbidden: `access function threw: ${String(err)}` };
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
