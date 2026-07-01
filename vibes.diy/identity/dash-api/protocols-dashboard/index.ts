// Lifted verbatim from @fireproof/core-types-protocols-dashboard@0.24.19
// `index.ts` (upstream tag fireproof-storage/fireproof@core@v0.24.19). This is
// the owned barrel for the dashboard wire-type contract — the request/response
// DTOs (`msg-types`), the API interface (`fp-api-interface`), the runtime
// type-guards (`msg-is`), the config/auth shapes (`dash-types`), and the token
// verify result types (`token`). The three identity consumers (dash-client.ts,
// index.ts, node.ts) import from here instead of `@fireproof/*`.
export * from "./dash-types.js";
export * from "./fp-api-interface.js";
export * from "./msg-is.js";
export * from "./msg-types.js";

export * from "./token.js";
export interface FPTokenContext {
  readonly secretToken: string;
  readonly publicToken: string;
  readonly issuer: string;
  readonly audience: string;
  readonly validFor: number; // seconds
  readonly extendValidFor: number; // seconds
}
