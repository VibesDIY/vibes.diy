// Public scoring surface reused by sibling eval harnesses. Keep this curated —
// it is the package's exported API, not an internal grab-bag.
export { runRubric } from "./rubric.js";
export { computeStructure } from "./structure.js";
export { judgeFeature, readDevVars, assertJudgeReachable } from "./judge.js";
export { isTransientError, retryWithBackoff } from "./backoff.js";
export type { BackoffOpts } from "./backoff.js";
export { collectSourceFiles } from "./score.js";
export type { StructureSignals } from "./structure.js";
export type { RubricResult, JudgeResult } from "./cell.js";
export type { JudgeDeps, DevVars } from "./judge.js";
