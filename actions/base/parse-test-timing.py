#!/usr/bin/env python3
"""Summarize vitest's json report (test-timing.json) into the GitHub job summary.

Reads the Jest-compatible json produced by `vitest --reporter=json`, and appends
a Markdown block to $GITHUB_STEP_SUMMARY: totals, the Top-20 slowest files (by
wall duration), and any failures. Exits non-zero only when the report is missing
or unparseable, which the caller (actions/base) treats as a harness failure.

If test-phase-timing.json (from tools/vitest-phase-reporter.ts) is present, also
appends a best-effort "pre-run phase costs" section (collect/setup/environment/
prepare per file) — that report is instrumentation, so any problem reading it is
ignored rather than failing the summary.
"""

import json
import os
import sys

REPORT = "test-timing.json"
PHASE_REPORT = "test-phase-timing.json"
TOP_N = 20
PHASES = ["collect", "setup", "environment", "prepare", "test"]
PHASE_LABELS = {
    "collect": "collect/import",
    "setup": "setupFiles",
    "environment": "environment",
    "prepare": "prepare",
    "test": "test exec",
}


def rel(path: str) -> str:
    """Trim container/host prefixes so paths read as repo-relative."""
    if not path:
        return "?"
    path = path.replace("/work/", "")
    cwd = os.getcwd().rstrip("/") + "/"
    if path.startswith(cwd):
        path = path[len(cwd):]
    return path


def phase_lines() -> list:
    """Summarize test-phase-timing.json (per-file pre-run phases) if present.

    Best-effort: any read/parse problem yields no section rather than failing
    the summary (the phase report is instrumentation, not a gate)."""
    try:
        with open(PHASE_REPORT, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return []
    files = data.get("files") or []
    if not files:
        return []
    totals = data.get("totals") or {}

    lines = ["", "### Pre-run phase costs (aggregate ms, parallelized across workers)", ""]
    lines.append("| phase | seconds |")
    lines.append("| --- | --: |")
    for key in PHASES:
        lines.append(f"| {PHASE_LABELS[key]} | {totals.get(key, 0) / 1000:.1f} |")

    # "pre-run" = everything before a file's tests execute. Surfaces dumb work
    # in module import / setup that the wall-clock per-file view hides.
    pre = []
    for f in files:
        prerun = (f.get("collect", 0) + f.get("setup", 0) + f.get("environment", 0) + f.get("prepare", 0)) / 1000.0
        pre.append((prerun, f.get("test", 0) / 1000.0, rel(f.get("name", "?"))))
    pre.sort(reverse=True)
    shown = min(15, len(pre))
    lines.append("")
    lines.append(f"<details><summary>Top {shown} files by pre-run (collect+setup+env+prepare) time</summary>")
    lines.append("")
    lines.append("| # | pre-run s | test s | file |")
    lines.append("| --: | --: | --: | --- |")
    for i, (prerun, texec, name) in enumerate(pre[:15], 1):
        lines.append(f"| {i} | {prerun:.2f} | {texec:.2f} | `{name}` |")
    lines.append("")
    lines.append("</details>")
    return lines


def main() -> int:
    try:
        with open(REPORT, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError) as err:
        print(f"parse-test-timing: cannot read {REPORT}: {err}", file=sys.stderr)
        return 1

    results = data.get("testResults") or []
    if not results and not data.get("numTotalTests"):
        print("parse-test-timing: report has no test results", file=sys.stderr)
        return 1

    total = data.get("numTotalTests", 0)
    passed = data.get("numPassedTests", 0)
    failed = data.get("numFailedTests", 0)
    skipped = data.get("numPendingTests", 0) + data.get("numTodoTests", 0)
    failed_suites = data.get("numFailedTestSuites", 0)
    total_suites = data.get("numTotalTestSuites", len(results))

    # Failure detection must NOT rely on numFailedTests alone: a module that
    # fails to import/setup registers zero tests, so numFailedTests stays 0 even
    # though the suite failed (numFailedTestSuites > 0, a testResults entry with
    # status "failed", and success: false). Treat any of those as a failure,
    # otherwise the summary would print "All tests passed" over a red run.
    failed_result_entries = sum(1 for r in results if r.get("status") == "failed")
    bad_suites = failed_suites or failed_result_entries
    suite_failed = data.get("success") is False or failed > 0 or bad_suites > 0

    durations = []
    for r in results:
        start, end = r.get("startTime"), r.get("endTime")
        if isinstance(start, (int, float)) and isinstance(end, (int, float)):
            durations.append(((end - start) / 1000.0, rel(r.get("name", "?"))))
    durations.sort(reverse=True)

    if not suite_failed:
        headline = "✅ All tests passed."
    else:
        parts = []
        if failed:
            parts.append(f"{failed} test(s)")
        if bad_suites:
            parts.append(f"{bad_suites} suite(s)")
        headline = "❌ " + (" and ".join(parts) if parts else "suite") + " failed."

    out = []
    out.append("## Test suite result")
    out.append("")
    out.append(headline)
    out.append("")
    files_note = f"❌ {bad_suites} failed" if bad_suites else "all passed"
    out.append(f"- Suites: **{total_suites}** ({files_note})  •  Tests: **{total}** (✅ {passed} / ❌ {failed} / ⊘ {skipped})")
    if durations:
        out.append(f"- Sum of per-file wall time: **{sum(d for d, _ in durations):.1f}s** (runs parallelized across workers)")
    out.append("")
    if durations:
        out.append(f"<details><summary>Top {min(TOP_N, len(durations))} slowest files</summary>")
        out.append("")
        out.append("| # | seconds | file |")
        out.append("| --: | --: | --- |")
        for i, (dur, name) in enumerate(durations[:TOP_N], 1):
            out.append(f"| {i} | {dur:.2f} | `{name}` |")
        out.append("")
        out.append("</details>")

    out += phase_lines()

    failures = []
    for r in results:
        bad = [a.get("title", "?") for a in r.get("assertionResults", []) if a.get("status") == "failed"]
        if bad or r.get("status") == "failed":
            # A suite that fails to import/setup has no failed assertions — its
            # error lives in the file-level message. Surface it so the summary
            # shows the actual setup/import failure context, not a bare filename.
            msg = (r.get("message") or r.get("failureMessage") or "").strip()
            failures.append((rel(r.get("name", "?")), bad, msg))
    if failures:
        out.append("")
        out.append("<details><summary>Failed tests / suites</summary>")
        out.append("")
        for name, bad, msg in failures:
            out.append(f"- `{name}`")
            for title in bad:
                out.append(f"  - {title}")
            if not bad and msg:
                out.append(f"  - _suite error:_ {msg.splitlines()[0][:300]}")
        out.append("")
        out.append("</details>")

    text = "\n".join(out) + "\n"
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(text)
    else:
        print(text)

    print(
        f"parse-test-timing: {len(results)} files, {total} tests, {failed} failed",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
