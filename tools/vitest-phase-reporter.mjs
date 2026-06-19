// Custom vitest reporter: records per-file PRE-RUN phase durations (collect /
// import, setupFiles, environment, prepare) plus test-exec time, so we can see
// where the dominant "import" phase cost actually goes and spot dumb work.
//
// The Jest-compatible `--reporter=json` we already run does NOT expose these
// phase fields — only per-file start/end. This reporter reads vitest's own
// per-module diagnostics and writes test-phase-timing.json next to it.
//
// Design rules:
//   - NEVER throw out of a reporter hook (a thrown reporter aborts the run).
//   - Support both the legacy (onFinished) and v4 (onTestRunEnd) reporter APIs;
//     whichever yields the richer data wins (durations are summed, so we keep
//     the call with the larger grand total).
//   - All durations are milliseconds, as vitest reports them.
import { writeFileSync } from "node:fs";

const OUT = "test-phase-timing.json";
const PHASES = ["collect", "setup", "environment", "prepare", "test"];

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export default class PhaseReporter {
  constructor() {
    this._bestTotal = -1;
  }

  // Legacy reporter API (vitest <= 3, still invoked in 4.x compat paths).
  onFinished(files = []) {
    const rows = (files || []).map((f) => ({
      name: f.filepath || f.name || "?",
      collect: num(f.collectDuration),
      setup: num(f.setupDuration),
      environment: num(f.environmentLoad),
      prepare: num(f.prepareDuration),
      test: num(f.result && f.result.duration),
    }));
    this._emit(rows);
  }

  // New reporter API (vitest 4): TestModule.diagnostic() exposes the phases.
  onTestRunEnd(testModules = []) {
    const rows = [];
    for (const m of testModules || []) {
      let d = {};
      try {
        d = typeof m.diagnostic === "function" ? m.diagnostic() : {};
      } catch {
        d = {};
      }
      rows.push({
        name: m.moduleId || (m.task && m.task.filepath) || "?",
        collect: num(d.collectDuration),
        setup: num(d.setupDuration),
        environment: num(d.environmentSetupDuration),
        prepare: num(d.prepareDuration),
        test: num(d.duration),
      });
    }
    this._emit(rows);
  }

  _emit(rows) {
    try {
      const totals = {};
      let grand = 0;
      for (const p of PHASES) totals[p] = 0;
      for (const r of rows) {
        for (const p of PHASES) {
          totals[p] += r[p];
          grand += r[p];
        }
      }
      // Keep whichever API call produced the most signal.
      if (grand <= this._bestTotal) return;
      this._bestTotal = grand;
      writeFileSync(OUT, JSON.stringify({ totals, files: rows }, null, 2));
    } catch (err) {
      console.error("[phase-reporter] failed to write", OUT, err);
    }
  }
}
