// Custom vitest reporter: records per-file PRE-RUN phase durations (collect /
// import, setupFiles, environment, prepare) plus test-exec time, so we can see
// where the dominant "import" phase cost actually goes and spot dumb work.
//
// The Jest-compatible `--reporter=json` we already run does NOT expose these
// phase fields — only per-file start/end. This reporter reads vitest's own
// per-module diagnostics and writes test-phase-timing.json next to it.
//
// It ALSO captures vitest's UNHANDLED errors/rejections (the reporter hook's
// second argument). Those make vitest exit non-zero WITHOUT marking any test as
// failed, so the json report shows "0 failed" while the job goes red — a
// baffling, undiagnosable state when CI runs json-only reporters (no pretty
// reporter prints the error text). We dump them to the Actions log AND to
// test-unhandled-errors.json so parse-test-timing.py can surface them in the job
// summary. See #2425/#2426.
//
// Loaded by vitest (`--reporter=./tools/vitest-phase-reporter.ts`) and
// transformed on the fly — it is NOT in a tsconfig and is eslint-ignored, like
// other root tooling (see agents/code-quality.md § Root tooling).
//
// Design rules:
//   - NEVER throw out of a reporter hook (a thrown reporter aborts the run).
//   - Support both the legacy (onFinished) and v4 (onTestRunEnd) reporter APIs;
//     whichever yields the richer data wins (durations are summed, so we keep
//     the call with the larger grand total).
//   - All durations are milliseconds, as vitest reports them.
import { writeFileSync } from "node:fs";

const OUT = "test-phase-timing.json";
const ERR_OUT = "test-unhandled-errors.json";
const PHASES = ["collect", "setup", "environment", "prepare", "test"] as const;
type Phase = (typeof PHASES)[number];
type PhaseRow = { name: string } & Record<Phase, number>;

interface VitestFile {
  filepath?: string;
  name?: string;
  collectDuration?: number;
  setupDuration?: number;
  environmentLoad?: number;
  prepareDuration?: number;
  result?: { duration?: number };
}

interface VitestModule {
  moduleId?: string;
  task?: { filepath?: string };
  diagnostic?: () => Record<string, unknown>;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export default class PhaseReporter {
  private bestTotal = -1;

  // Backward-compat shim for vitest <= v3 (onFinished). v4 removed this hook in
  // favour of onTestRunEnd below; it's harmless on v4 (never called) and keeps
  // the reporter working if run under an older vitest.
  onFinished(files: VitestFile[] = [], errors: unknown[] = []): void {
    this.captureErrors(errors);
    const rows: PhaseRow[] = (files || []).map((f) => ({
      name: f.filepath || f.name || "?",
      collect: num(f.collectDuration),
      setup: num(f.setupDuration),
      environment: num(f.environmentLoad),
      prepare: num(f.prepareDuration),
      test: num(f.result && f.result.duration),
    }));
    this.emit(rows);
  }

  // New reporter API (vitest 4): TestModule.diagnostic() exposes the phases;
  // the second arg is the array of unhandled errors/rejections.
  onTestRunEnd(testModules: VitestModule[] = [], unhandledErrors: unknown[] = []): void {
    this.captureErrors(unhandledErrors);
    const rows: PhaseRow[] = [];
    for (const m of testModules || []) {
      let d: Record<string, unknown> = {};
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
    this.emit(rows);
  }

  // Serialize vitest's unhandled errors so a "0 failed but red" run is
  // diagnosable: print each to the Actions log (the only place the text appears
  // under json-only reporters) and persist them for the job summary. Both
  // reporter hooks may fire, so de-dupe by writing only when there is something
  // to write — and never throw (a thrown reporter aborts the run).
  private captureErrors(errors: unknown[] = []): void {
    try {
      if (!Array.isArray(errors) || errors.length === 0) return;
      const serialized = errors.map((e) => {
        const err = e as { message?: unknown; stack?: unknown; name?: unknown } | undefined;
        return {
          name: typeof err?.name === "string" ? err.name : "Error",
          message: typeof err?.message === "string" ? err.message : String(e),
          stack: typeof err?.stack === "string" ? err.stack : undefined,
        };
      });
      for (const s of serialized) {
        console.error(`[phase-reporter] UNHANDLED ${s.name}: ${s.message}`);
        if (s.stack) console.error(s.stack);
      }
      writeFileSync(ERR_OUT, JSON.stringify({ errors: serialized }, null, 2));
    } catch (err) {
      console.error("[phase-reporter] failed to capture unhandled errors", err);
    }
  }

  private emit(rows: PhaseRow[]): void {
    try {
      const totals: Record<Phase, number> = { collect: 0, setup: 0, environment: 0, prepare: 0, test: 0 };
      let grand = 0;
      for (const r of rows) {
        for (const p of PHASES) {
          totals[p] += r[p];
          grand += r[p];
        }
      }
      // Keep whichever API call produced the most signal.
      if (grand <= this.bestTotal) return;
      this.bestTotal = grand;
      writeFileSync(OUT, JSON.stringify({ totals, files: rows }, null, 2));
    } catch (err) {
      console.error("[phase-reporter] failed to write", OUT, err);
    }
  }
}
