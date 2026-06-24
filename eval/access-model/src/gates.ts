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
  /**
   * Back-compat single tolerance. When set it seeds BOTH `rateBand` and `holdoutBand`
   * (unless those are given explicitly). Prefer the per-metric bands below.
   */
  readonly noiseBand?: number;
  /**
   * Tolerance for the two-file / renderable regression gates (2, 3). Default 0.05 —
   * those rates sit at ~1.0, so a tight band is right.
   */
  readonly rateBand?: number;
  /**
   * Tolerance for the holdout-regression gate (5). Default 0.17 — the MEASURED
   * same-prompt run-to-run jitter of the holdout metric (#2637). 0.05 was ~3× too
   * tight and produced false-positive discards against a high-variance baseline.
   */
  readonly holdoutBand?: number;
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
 *
 * Bands are per-metric (#2637): the two-file/renderable rates sit at ~1.0 so they
 * keep a tight 0.05 band, while the holdout metric carries ~0.17 of run-to-run
 * jitter (measured by re-running identical baseline prompts) and gets a band that
 * matches — otherwise gate 5 discards noise, not regressions.
 */
export function evaluateGates(i: GatesInput): GatesResult {
  const rateBand = i.rateBand ?? i.noiseBand ?? 0.05;
  const holdoutBand = i.holdoutBand ?? i.noiseBand ?? 0.17;
  const failed: string[] = [];
  if (!i.checkGreen) failed.push("check"); // gate 1
  if (i.current.twoFileRate < i.baseline.twoFileRate - rateBand) failed.push("two-file-emission"); // gate 2
  if (i.current.renderableRate < i.baseline.renderableRate - rateBand) failed.push("renderable"); // gate 3
  if (!i.guardrail.ok) failed.push("guardrail"); // gate 4
  if (i.holdoutCurrent.metric < i.holdoutBaseline.metric - holdoutBand) failed.push("holdout-regression"); // gate 5
  return { pass: failed.length === 0, failed };
}
