import type { AccessMatrix } from "./config.js";

export type Capability = "app" | "chat" | "img" | "img-edit";
export interface CatalogModel {
  readonly id: string;
  readonly preSelected?: readonly string[];
}

/** The catalog floor for a capability — what getModelDefaults tier-3 resolves to. */
export function pickPreSelected(models: readonly CatalogModel[], cap: Capability): string {
  const found = models.find((m) => m.preSelected?.includes(cap));
  if (!found) throw new Error(`no preSelected model for capability: ${cap}`);
  return found.id;
}

export interface ResolveDeps {
  // Resolves what the TARGET env + handle actually defaults codegen to.
  // Real impl: query the models/defaults endpoint for `handle` (which applies the
  // user/app overrides), else fetch `${apiBase}/.../models.json` and pickPreSelected(_, "app").
  readonly fetchDefault: (matrix: AccessMatrix) => Promise<string>;
}

/**
 * Pin precedence: an explicit non-empty matrix.model wins verbatim (lets us pin a
 * specific id and freeze it); otherwise resolve the env's live default for the handle.
 * The resolved id is recorded in run.json so a later bump is visible and must
 * explicitly invalidate baseline.json.
 */
export async function resolveDefaultModel(matrix: AccessMatrix, deps: ResolveDeps): Promise<string> {
  if (matrix.model && matrix.model.trim()) return matrix.model.trim();
  return deps.fetchDefault(matrix);
}

/**
 * Real network adapter for ResolveDeps.fetchDefault — asks the target env what the
 * `eval` handle defaults codegen to. Prefers the platform's models/defaults resolution
 * (so per-handle/per-app overrides are honored exactly as a real generate would see
 * them); falls back to fetching the env's `models.json` (derive the asset URL from
 * `apiUrl` per the stable-entry routing in `agents/environments.md`) and
 * `pickPreSelected(models, "app")`. Logs the resolved id loudly at kickoff.
 *
 * TODO: not implemented (wired in generate driver / Task 8). The unit test stays on
 * the injected fake; this live adapter is implemented when the generate driver lands.
 */
export async function fetchDefault(_matrix: AccessMatrix): Promise<string> {
  throw new Error("fetchDefault: not implemented (wired in generate driver / Task 8)");
}
