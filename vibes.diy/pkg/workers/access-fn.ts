import { DurableObject, Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";
import type { UserContext } from "@vibes.diy/api-types";
import { getQuickJSWASMModule } from "@cf-wasm/quickjs";

declare const Response: typeof CFResponse;

const InvokeBody = {
  parse(raw: unknown): { doc: unknown; oldDoc: unknown | null; user: UserContext | null; source?: string } {
    if (typeof raw !== "object" || raw === null) throw new Error("invalid invoke body");
    return raw as { doc: unknown; oldDoc: unknown | null; user: UserContext | null; source?: string };
  },
};

export class AccessFnDO implements DurableObject {
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

    if (!body.source) {
      return new Response(JSON.stringify({ forbidden: "access function source not provided" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const source = body.source;

    const QuickJS = await getQuickJSWASMModule();
    const vm = QuickJS.newContext();

    try {
      for (const stmt of [
        `const doc = ${JSON.stringify(body.doc)};`,
        `const oldDoc = ${JSON.stringify(body.oldDoc)};`,
        `const user = ${JSON.stringify(body.user)};`,
        `const ctx = ${JSON.stringify({})};`,
      ]) {
        const r = vm.evalCode(stmt);
        if (r.error) {
          r.error.dispose();
        } else {
          r.value.dispose();
        }
      }

      const fnResult = vm.evalCode(`(function() { ${source} })()`);

      if (fnResult.error) {
        const errVal = vm.dump(fnResult.error);
        fnResult.error.dispose();
        return new Response(JSON.stringify({ forbidden: `access function error: ${JSON.stringify(errVal)}` }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const accessResult = vm.dump(fnResult.value);
      fnResult.value.dispose();

      return new Response(JSON.stringify(accessResult), {
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      vm.dispose();
    }
  }
}
