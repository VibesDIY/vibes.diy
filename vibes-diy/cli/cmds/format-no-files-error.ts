/**
 * Builds the human-readable error string when a `generate` run streams a
 * response but ends with zero resolved files. Centralized so the diagnostic
 * shape can be tested without spinning up a full CLI run.
 *
 * See https://github.com/VibesDIY/vibes.diy/issues/1626 — the previous
 * `No files resolved from AI response.` message threw away every signal the
 * CLI already had (section-event count, byte count, apply-error reasons).
 */

const MAX_APPLY_ERRORS_SHOWN = 3;

export interface UpstreamErrorBrief {
  readonly code?: string;
  readonly message: string;
}

export interface NoFilesDiagnostics {
  /** Number of `vibes.diy.section-event` envelopes received from the server. */
  readonly sectionEventCount: number;
  /** Sum of `event.blocks.length` across every received section event. */
  readonly blockCount: number;
  /** Approximate total bytes streamed (JSON-encoded section events). */
  readonly streamedBytes: number;
  /** Upstream `vibes.diy.res-error` envelopes captured off the section stream. */
  readonly upstreamErrors: readonly UpstreamErrorBrief[];
  /** Already-summarized apply errors of the shape `path: reason`. */
  readonly applyErrors: readonly string[];
}

export function formatNoFilesError(diag: NoFilesDiagnostics): string {
  const headline =
    diag.upstreamErrors.length > 0
      ? `AI provider error: ${diag.upstreamErrors.map((e) => `${e.code ? `[${e.code}] ` : ""}${e.message}`).join("; ")}`
      : "No files resolved from AI response.";

  const lines = [headline];
  lines.push(
    `  - section events received: ${diag.sectionEventCount}` +
      (diag.blockCount > 0 ? ` (${diag.blockCount} block${diag.blockCount === 1 ? "" : "s"})` : "")
  );
  lines.push(`  - response bytes streamed: ${diag.streamedBytes}`);

  if (diag.applyErrors.length > 0) {
    lines.push(`  - ${diag.applyErrors.length} apply error${diag.applyErrors.length === 1 ? "" : "s"}:`);
    const shown = diag.applyErrors.slice(0, MAX_APPLY_ERRORS_SHOWN);
    for (const err of shown) lines.push(`      ${err}`);
    if (diag.applyErrors.length > MAX_APPLY_ERRORS_SHOWN) {
      lines.push(`      ... and ${diag.applyErrors.length - MAX_APPLY_ERRORS_SHOWN} more`);
    }
  }

  lines.push("  Rerun with --verbose for the full per-snapshot dump.");
  return lines.join("\n");
}
