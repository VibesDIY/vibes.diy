/**
 * Normalize cost/tokens from an @openrouter/agent response. The accumulated
 * `totalCost` (across all turns of an agentic run) is authoritative when
 * present; otherwise fall back to the usage block.
 */
export interface CostSource {
  readonly totalCost?: number;
  readonly usage?: { readonly totalTokens?: number; readonly cost?: number };
}
export function extractCost(response: CostSource): { costUsd: number; tokens: number } {
  return {
    costUsd: response.totalCost ?? response.usage?.cost ?? 0,
    tokens: response.usage?.totalTokens ?? 0,
  };
}
