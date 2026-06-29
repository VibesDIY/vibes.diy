import type { BackendHandler } from "./backend-executor.js";

/**
 * Push-time parsing of a vibe's `backend.js` (#2856, slice B2) — the pure,
 * Workers-safe core of discovery. Given the handler source, it reports which
 * trigger exports exist and validates the declared schedule, so the push path
 * can register schedules and **reject bad intervals before they ever arm an
 * alarm**. No DB, no I/O — the persistence (`backendFunctionBindings` row) and
 * the push wiring are the next cut (B2b), which consumes this result.
 *
 * Mirrors `process-access-bindings.ts`'s `parseExportNames`, but scoped to the
 * three known trigger names plus the `config` schedule, rather than arbitrary
 * per-`dbName` access exports.
 */

/** Min/max schedule interval (inclusive). Faster than 5s is rejected at push; slower than 1h too. */
export const MIN_INTERVAL_MS = 5_000;
export const MAX_INTERVAL_MS = 3_600_000;

const HANDLER_NAMES: readonly BackendHandler[] = ["fetch", "scheduled", "onChange"];

export interface BackendSchedule {
  /** Parsed interval in milliseconds, already validated within [MIN, MAX]. */
  readonly intervalMs: number;
  /** The raw `config.scheduled.interval` string as authored (e.g. `"5m"`). */
  readonly raw: string;
}

export interface BackendConfigParseResult {
  /** Which trigger exports the file declares, in `fetch`/`scheduled`/`onChange` order. */
  readonly handlers: BackendHandler[];
  /** Whether a `config` export is present at all. */
  readonly hasConfig: boolean;
  /** The validated schedule, when a `scheduled` handler + a valid interval are both present. */
  readonly schedule?: BackendSchedule;
  /** Push-time rejection reasons (empty ⇒ the file is registrable as-is). */
  readonly errors: string[];
}

/** True if `source` exports a top-level binding named `name` (function / const / let / var / export-list, incl. `x as name`). */
function exportsName(source: string, name: string): boolean {
  // `export [async] function NAME` | `export [default] const/let/var NAME =`
  const decl = new RegExp(`export\\s+(?:async\\s+)?(?:function\\s+${name}\\b|(?:const|let|var)\\s+${name}\\b)`);
  if (decl.test(source)) return true;
  // `export { NAME }` or `export { x as NAME }` — scan each export-list block.
  const listPattern = /export\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = listPattern.exec(source)) !== null) {
    const inner = m[1];
    const bareOrAliased = new RegExp(`(?:\\bas\\s+${name}\\b|(?:^|,)\\s*${name}\\s*(?:,|$))`);
    if (bareOrAliased.test(inner)) return true;
  }
  return false;
}

/** Parse a `"<n><unit>"` duration (e.g. `"5s"`, `"30s"`, `"1m"`, `"5m"`, `"15m"`, `"1h"`) to ms, or `undefined` if malformed. */
function parseDurationMs(raw: string): number | undefined {
  const m = /^(\d+)\s*(s|m|h)$/.exec(raw.trim());
  if (m === null) return undefined;
  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n)) return undefined;
  const mult = m[2] === "s" ? 1_000 : m[2] === "m" ? 60_000 : 3_600_000;
  return n * mult;
}

/**
 * Slice the balanced `{ … }` object literal starting at `openIdx` (the index of the `{`),
 * skipping braces that appear inside string/template literals. Returns `undefined` if unbalanced.
 */
function sliceBalancedObject(source: string, openIdx: number): string | undefined {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (quote !== null) {
      if (ch === "\\") {
        i++; // skip the escaped char
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(openIdx, i + 1);
    }
  }
  return undefined;
}

/** The `config` binding's object literal (`[export] const|let|var config = { … }`), brace-balanced — or `undefined` if absent. */
function extractConfigObject(source: string): string | undefined {
  const decl = /(?:export\s+)?(?:const|let|var)\s+config\s*=\s*\{/.exec(source);
  if (decl === null) return undefined;
  const openIdx = decl.index + decl[0].length - 1; // the `{`
  return sliceBalancedObject(source, openIdx);
}

/**
 * Extract `config.scheduled.interval`, anchored to the **exported `config` object** so a stray
 * `scheduled: { interval: … }` in a helper/defaults/sample object elsewhere in the file can neither
 * hijack the schedule nor register one when no `config` export supplies it (per Codex review).
 */
function extractIntervalLiteral(source: string): string | undefined {
  const configObj = extractConfigObject(source);
  if (configObj === undefined) return undefined;
  const m = /scheduled\s*:\s*\{[^}]*?\binterval\s*:\s*["']([^"']+)["']/s.exec(configObj);
  return m?.[1];
}

/**
 * Parse + validate a `backend.js` source at push time.
 *
 * - Detects which of `fetch`/`scheduled`/`onChange` are exported.
 * - If a `scheduled` handler is present, requires `config.scheduled.interval` to
 *   be a **static string-literal** duration (`"<n><s|m|h>"`) within `[5s, 1h]`;
 *   anything faster, slower, malformed, or **computed/indirect** (`interval: FIVE`)
 *   is a push-time error (never silently clamped, never deferred to first alarm).
 * - An `interval` with no `scheduled` handler is ignored (not an error).
 *
 * Contract (per @CharlieHelps): push-time discovery is deterministic and never
 * evaluates untrusted `config`, so only a literal interval is supported.
 */
export function parseBackendConfig(source: string | undefined): BackendConfigParseResult {
  const errors: string[] = [];
  if (source === undefined || source.trim() === "") {
    return { handlers: [], hasConfig: false, errors };
  }

  const handlers = HANDLER_NAMES.filter((name) => exportsName(source, name));
  const hasConfig = exportsName(source, "config");
  const hasScheduled = handlers.includes("scheduled");

  let schedule: BackendSchedule | undefined;
  const rawInterval = extractIntervalLiteral(source);

  if (hasScheduled) {
    if (rawInterval === undefined) {
      errors.push(
        'scheduled handler requires config.scheduled.interval as a static string-literal duration, e.g. { scheduled: { interval: "5m" } }; computed/indirect values are unsupported'
      );
    } else {
      const intervalMs = parseDurationMs(rawInterval);
      if (intervalMs === undefined) {
        errors.push(
          `config.scheduled.interval "${rawInterval}" is not a valid duration — use a string literal like "5s", "1m", or "1h"`
        );
      } else if (intervalMs < MIN_INTERVAL_MS) {
        errors.push(`config.scheduled.interval "${rawInterval}" is faster than the 5s minimum`);
      } else if (intervalMs > MAX_INTERVAL_MS) {
        errors.push(`config.scheduled.interval "${rawInterval}" is slower than the 1h maximum`);
      } else {
        schedule = { intervalMs, raw: rawInterval };
      }
    }
  }

  return { handlers, hasConfig, schedule, errors };
}
