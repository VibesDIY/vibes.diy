import type { Grade } from "./grade.js";

export interface MetricCell {
  readonly grade: Grade | "GENERATE_FAILED";
  readonly twoFile: boolean;
  readonly renderable: boolean;
  readonly formAStrict: boolean;
  readonly formABroad: boolean;
  readonly isOwnerWriteGate: boolean;
  readonly isOwnerToken?: boolean; // any literal `isOwner` token (#2631) — optional so existing callers are unaffected
  readonly ok: boolean; // false => platform/generate failure, excluded from score
}

const VALUE: Record<Grade, number> = { PASS: 1, SOFT: 0.5, FAIL: 0 };
const scoredOnly = (cells: readonly MetricCell[]) => cells.filter((c) => c.ok && c.grade !== "GENERATE_FAILED");

export function compositeMetric(cells: readonly MetricCell[]): number {
  const scored = scoredOnly(cells);
  if (scored.length === 0) return 0;
  return scored.reduce((s, c) => s + VALUE[c.grade as Grade], 0) / scored.length;
}

export interface Rollup {
  readonly scored: number;
  readonly platformFailed: number;
  readonly metric: number;
  readonly formAStrictRate: number;
  readonly formABroadRate: number;
  readonly isOwnerCount: number;
  readonly isOwnerTokenCount: number;
  readonly twoFileRate: number;
  readonly renderableRate: number;
}

export function rollup(cells: readonly MetricCell[]): Rollup {
  const scored = scoredOnly(cells);
  const n = scored.length || 1;
  const rate = (p: (c: MetricCell) => boolean) => scored.filter(p).length / n;
  return {
    scored: scored.length,
    platformFailed: cells.length - scored.length,
    metric: compositeMetric(cells),
    formAStrictRate: rate((c) => c.formAStrict),
    formABroadRate: rate((c) => c.formABroad),
    isOwnerCount: scored.filter((c) => c.isOwnerWriteGate).length,
    isOwnerTokenCount: scored.filter((c) => c.isOwnerToken === true).length,
    twoFileRate: rate((c) => c.twoFile),
    renderableRate: rate((c) => c.renderable),
  };
}
