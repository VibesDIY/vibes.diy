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

    durations = []
    for r in results:
        start, end = r.get("startTime"), r.get("endTime")
        if isinstance(start, (int, float)) and isinstance(end, (int, float)):
            durations.append(((end - start) / 1000.0, rel(r.get("name", "?"))))
    durations.sort(reverse=True)

    out = []
    out.append("## Test suite result")
    out.append("")
    out.append("✅ All tests passed." if failed == 0 else f"❌ {failed} test file(s)/case(s) failed.")
    out.append("")
    out.append(f"- Files: **{len(results)}**  •  Tests: **{total}** (✅ {passed} / ❌ {failed} / ⊘ {skipped})")
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
            failures.append((rel(r.get("name", "?")), bad))
    if failures:
        out.append("")
        out.append("<details><summary>Failed tests</summary>")
        out.append("")
        for name, bad in failures:
            out.append(f"- `{name}`")
            for title in bad:
                out.append(f"  - {title}")
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
