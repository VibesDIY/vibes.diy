import { DurableObject, Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";
import type { AccessDescriptor, AccessFunction, UserContext } from "@vibes.diy/api-types";
import { makeHelpers, ForbiddenError } from "@vibes.diy/api-svc";

declare const Response: typeof CFResponse;

const InvokeBody = {
  parse(raw: unknown): { doc: unknown; oldDoc: unknown | null; user: UserContext | null; source?: string } {
    if (typeof raw !== "object" || raw === null) throw new Error("invalid invoke body");
    return raw as { doc: unknown; oldDoc: unknown | null; user: UserContext | null; source?: string };
  },
};

export class AccessFnDO implements DurableObject {
  private fn: AccessFunction | null = null;
  private loadError: string | null = null;

  async fetch(request: CFRequest): Promise<CFResponse> {
    if (request.method !== "POST") {
      return new Response("expected POST", { status: 400 });
    }

    let body: { doc: unknown; oldDoc: unknown | null; user: UserContext | null; source?: string };
    try {
      body = InvokeBody.parse(await request.json());
    } catch {
      return new Response(JSON.stringify({ forbidden: "invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Lazy eval: compile fn on first request, cache for lifetime of this DO instance.
    if (!this.fn && !this.loadError) {
      if (!body.source) {
        return new Response(JSON.stringify({ forbidden: "access function source not provided" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      try {
        this.fn = new Function("doc", "oldDoc", "user", "ctx", body.source) as AccessFunction;
      } catch (err: unknown) {
        this.loadError = `AccessFnDO: eval failed: ${String(err)}`;
      }
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
