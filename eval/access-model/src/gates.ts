export interface RateSummary {
  readonly twoFileRate: number;
  readonly renderableRate: number;
  readonly metric: number;
}
export interface HoldoutSummary {
  readonly metric: number;
}

export interface GatesInput {
  readonly checkGreen: boolean; // gate 1: pnpm check + promptAnchor
  readonly guardrail: { ok: boolean; hits: string[] }; // gate 4
  readonly current: RateSummary;
  readonly baseline: RateSummary;
  readonly holdoutCurrent: HoldoutSummary; // gate 5
  readonly holdoutBaseline: HoldoutSummary;
  readonly noiseBand?: number; // tolerance for "regress"; default 0.05
}
export interface GatesResult {
  readonly pass: boolean;
  readonly failed: string[];
}

/**
 * The 5 verify discard-gates (#2602). Combines the run's rollup, the baseline
 * rollup, the holdout rollup, the `pnpm check` result, and the guardrail result
 * into `{ pass, failed[] }`. Any failure ⇒ the autoresearch loop reverts the
 * iteration regardless of the metric.
 */
export function evaluateGates(i: GatesInput): GatesResult {
  const band = i.noiseBand ?? 0.05;
  const failed: string[] = [];
  if (!i.checkGreen) failed.push("check"); // gate 1
  if (i.current.twoFileRate < i.baseline.twoFileRate - band) failed.push("two-file-emission"); // gate 2
  if (i.current.renderableRate < i.baseline.renderableRate - band) failed.push("renderable"); // gate 3
  if (!i.guardrail.ok) failed.push("guardrail"); // gate 4
  if (i.holdoutCurrent.metric < i.holdoutBaseline.metric - band) failed.push("holdout-regression"); // gate 5
  return { pass: failed.length === 0, failed };
}
