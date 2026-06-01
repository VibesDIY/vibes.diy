import { DurableObject, DurableObjectState, Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";

declare const Response: typeof CFResponse;

export class AccessFnSpike implements DurableObject {
  private evalResult: unknown = null;
  private evalError: string | null = null;

  constructor(state: DurableObjectState) {
    state.blockConcurrencyWhile(async () => {
      try {
        const fn = new Function("return 2 + 2");
        this.evalResult = fn();
      } catch (err: unknown) {
        this.evalError = String(err);
      }
    });
  }

  async fetch(_request: CFRequest): Promise<CFResponse> {
    if (this.evalError) {
      return new Response(JSON.stringify({ ok: false, error: this.evalError }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, result: this.evalResult }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
