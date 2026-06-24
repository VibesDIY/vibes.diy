// Public scoring surface reused by sibling eval harnesses. Keep this curated —
// it is the package's exported API, not an internal grab-bag.
export { runRubric } from "./rubric.js";
export { computeStructure } from "./structure.js";
export { judgeFeature, readDevVars } from "./judge.js";
export { collectSourceFiles } from "./score.js";
export type { StructureSignals } from "./structure.js";
export type { RubricResult, JudgeResult } from "./cell.js";
export type { JudgeDeps, DevVars } from "./judge.js";
