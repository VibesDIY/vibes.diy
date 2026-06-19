#!/usr/bin/env python3
"""Summarize vitest's json report (test-timing.json) into the GitHub job summary.

Reads the Jest-compatible json produced by `vitest --reporter=json`, and appends
a Markdown block to $GITHUB_STEP_SUMMARY: totals, the Top-20 slowest files (by
wall duration), and any failures. Exits non-zero only when the report is missing
or unparseable, which the caller (actions/base) treats as a harness failure.
"""

import json
import os
import sys

REPORT = "test-timing.json"
TOP_N = 20


def rel(path: str) -> str:
    """Trim container/host prefixes so paths read as repo-relative."""
    if not path:
        return "?"
    path = path.replace("/work/", "")
    cwd = os.getcwd().rstrip("/") + "/"
    if path.startswith(cwd):
        path = path[len(cwd):]
    return path


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
