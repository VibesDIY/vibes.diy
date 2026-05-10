export interface ApplyReplaceInput {
  readonly source: string;
  readonly search: string;
  readonly replace: string;
}

export interface ApplyEditOk {
  readonly ok: true;
  readonly content: string;
  readonly matchKind: "exact" | "trailing-ws" | "ellipsis";
}
export type ApplyEditErrReason = "no-match" | "multiple-match";
export interface ApplyEditErr {
  readonly ok: false;
  readonly reason: ApplyEditErrReason;
  readonly matchCount: number;
}
export type ApplyEditResult = ApplyEditOk | ApplyEditErr;

function rstripLines(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n");
}

type LineKind = "anchor" | "prefix" | "skip";

interface ClassifiedLine {
  readonly kind: LineKind;
  readonly text: string;
  readonly prefix: string;
}

function classifyLine(rawLine: string): ClassifiedLine {
  const trimmed = rawLine.replace(/[ \t]+$/, "");
  if (trimmed.startsWith("...")) {
    return { kind: "skip", text: rawLine, prefix: "" };
  }
  if (trimmed.endsWith("...") && trimmed.length >= 3) {
    return { kind: "prefix", text: rawLine, prefix: trimmed.slice(0, -3) };
  }
  return { kind: "anchor", text: rawLine, prefix: "" };
}

function hasEllipsisToken(search: string): boolean {
  return search.split("\n").some((l) => {
    const k = classifyLine(l).kind;
    return k === "prefix" || k === "skip";
  });
}

function findAllOccurrences(haystack: string, needle: string): readonly number[] {
  const hits: number[] = [];
  if (needle.length === 0) return hits;
  let from = 0;
  while (true) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    hits.push(idx);
    from = idx + needle.length;
  }
  return hits;
}

export function applyReplace(input: ApplyReplaceInput): ApplyEditResult {
  const { source, search, replace } = input;
  if (search.length === 0) {
    return { ok: false, reason: "no-match", matchCount: 0 };
  }

  if (hasEllipsisToken(search)) {
    return applyReplaceEllipsis(source, search, replace);
  }

  const exact = findAllOccurrences(source, search);
  if (exact.length === 1) {
    const idx = exact[0];
    return {
      ok: true,
      matchKind: "exact",
      content: source.slice(0, idx) + replace + source.slice(idx + search.length),
    };
  }
  if (exact.length > 1) {
    return { ok: false, reason: "multiple-match", matchCount: exact.length };
  }

  const sourceTrimmed = rstripLines(source);
  const searchTrimmed = rstripLines(search);
  const tolerant = findAllOccurrences(sourceTrimmed, searchTrimmed);
  if (tolerant.length === 1) {
    const idx = tolerant[0];
    return {
      ok: true,
      matchKind: "trailing-ws",
      content: sourceTrimmed.slice(0, idx) + replace + sourceTrimmed.slice(idx + searchTrimmed.length),
    };
  }
  if (tolerant.length > 1) {
    return { ok: false, reason: "multiple-match", matchCount: tolerant.length };
  }

  return { ok: false, reason: "no-match", matchCount: 0 };
}

export interface ReplaceEdit {
  readonly op: "replace";
  readonly search: string;
  readonly replace: string;
}

export interface CreateEdit {
  readonly op: "create";
  readonly content: string;
}

export type Edit = ReplaceEdit | CreateEdit;

export interface ApplyEditsError {
  readonly index: number;
  readonly reason: ApplyEditErrReason;
  readonly matchCount: number;
  readonly search: string;
}

export interface ApplyEditsResult {
  readonly content: string;
  readonly errors: readonly ApplyEditsError[];
}

export function applyEdits(seed: string, edits: readonly Edit[]): ApplyEditsResult {
  let content = seed;
  const errors: ApplyEditsError[] = [];
  edits.forEach((edit, index) => {
    if (edit.op === "create") {
      content = edit.content;
      return;
    }
    const r = applyReplace({ source: content, search: edit.search, replace: edit.replace });
    if (r.ok) {
      content = r.content;
      return;
    }
    errors.push({
      index,
      reason: r.reason,
      matchCount: r.matchCount,
      search: edit.search,
    });
  });
  return { content, errors };
}

interface LineSpan {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function lineSpans(source: string): readonly LineSpan[] {
  const spans: LineSpan[] = [];
  let i = 0;
  while (i <= source.length) {
    const nl = source.indexOf("\n", i);
    const end = nl === -1 ? source.length : nl;
    spans.push({ start: i, end, text: source.slice(i, end) });
    if (nl === -1) break;
    i = nl + 1;
  }
  return spans;
}

function lineMatches(searchLine: ClassifiedLine, sourceText: string): boolean {
  if (searchLine.kind === "anchor") {
    const a = searchLine.text.replace(/[ \t]+$/, "");
    const b = sourceText.replace(/[ \t]+$/, "");
    return a === b;
  }
  if (searchLine.kind === "prefix") {
    return sourceText.startsWith(searchLine.prefix);
  }
  return false;
}

function findSegmentMatches(
  segment: readonly ClassifiedLine[],
  sourceLines: readonly LineSpan[],
  startFrom: number,
): readonly number[] {
  const hits: number[] = [];
  if (segment.length === 0) return hits;
  for (let i = startFrom; i + segment.length <= sourceLines.length; i++) {
    let ok = true;
    for (let j = 0; j < segment.length; j++) {
      if (!lineMatches(segment[j], sourceLines[i + j].text)) {
        ok = false;
        break;
      }
    }
    if (ok) hits.push(i);
  }
  return hits;
}

function applyReplaceEllipsis(
  source: string,
  search: string,
  replace: string,
): ApplyEditResult {
  const searchLines = search.split("\n").map(classifyLine);
  const sourceLines = lineSpans(source);

  // No skips yet: treat the entire search as one segment.
  if (searchLines.every((l) => l.kind !== "skip")) {
    const hits = findSegmentMatches(searchLines, sourceLines, 0);
    if (hits.length === 0) return { ok: false, reason: "no-match", matchCount: 0 };
    if (hits.length > 1)
      return { ok: false, reason: "multiple-match", matchCount: hits.length };
    const start = sourceLines[hits[0]].start;
    const lastIdx = hits[0] + searchLines.length - 1;
    const end = sourceLines[lastIdx].end;
    return {
      ok: true,
      matchKind: "ellipsis",
      content: source.slice(0, start) + replace + source.slice(end),
    };
  }

  // Skips not implemented yet — fall through to no-match.
  return { ok: false, reason: "no-match", matchCount: 0 };
}
