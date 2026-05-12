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
  if (trimmed.replace(/^[ \t]+/, "").startsWith("...")) {
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
  startFrom: number
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

interface Segment {
  readonly lines: readonly ClassifiedLine[];
}

function splitIntoSegments(searchLines: readonly ClassifiedLine[]): {
  segments: readonly Segment[];
  leadingSkip: boolean;
  trailingSkip: boolean;
} {
  const segments: Segment[] = [];
  let buf: ClassifiedLine[] = [];
  let leadingSkip = false;
  let trailingSkip = false;
  searchLines.forEach((l, idx) => {
    if (l.kind === "skip") {
      if (segments.length === 0 && buf.length === 0) leadingSkip = true;
      if (buf.length > 0) {
        segments.push({ lines: buf });
        buf = [];
      }
      if (idx === searchLines.length - 1) trailingSkip = true;
    } else {
      buf.push(l);
    }
  });
  if (buf.length > 0) segments.push({ lines: buf });
  return { segments, leadingSkip, trailingSkip };
}

interface MatchTuple {
  readonly starts: readonly number[]; // segment start line indexes
}

function enumerateTuples(segments: readonly Segment[], sourceLines: readonly LineSpan[]): readonly MatchTuple[] {
  const tuples: MatchTuple[] = [];
  if (segments.length === 0) return tuples;
  const recurse = (segIdx: number, fromLine: number, acc: number[]): void => {
    if (segIdx === segments.length) {
      tuples.push({ starts: [...acc] });
      return;
    }
    const seg = segments[segIdx];
    const hits = findSegmentMatches(seg.lines, sourceLines, fromLine);
    for (const h of hits) {
      acc.push(h);
      recurse(segIdx + 1, h + seg.lines.length, acc);
      acc.pop();
    }
  };
  recurse(0, 0, []);
  return tuples;
}

function applyReplaceEllipsis(source: string, search: string, replace: string): ApplyEditResult {
  const searchLines = search.split("\n").map(classifyLine);
  const sourceLines = lineSpans(source);
  const { segments, leadingSkip, trailingSkip } = splitIntoSegments(searchLines);

  if (segments.length === 0) {
    return { ok: false, reason: "no-match", matchCount: 0 };
  }

  const tuples = enumerateTuples(segments, sourceLines);
  if (tuples.length === 0) return { ok: false, reason: "no-match", matchCount: 0 };
  if (tuples.length > 1) return { ok: false, reason: "multiple-match", matchCount: tuples.length };

  const t = tuples[0];
  const firstSegStart = t.starts[0];
  const lastSegStart = t.starts[t.starts.length - 1];
  const lastSegLen = segments[segments.length - 1].lines.length;

  const startLine = leadingSkip ? 0 : firstSegStart;
  const endLine = trailingSkip ? sourceLines.length - 1 : lastSegStart + lastSegLen - 1;
  const startChar = sourceLines[startLine].start;
  const endChar = sourceLines[endLine].end;

  // Pair each prefix-`...` SEARCH line with the source-line suffix it ate.
  // Models reach for trailing-`...` on REPLACE expecting "keep the original
  // tail" (a diff-`-p` intuition). Fighting that via prompt is whack-a-mole —
  // mirror the SEARCH capture into REPLACE instead, so the natural emission
  // does what they expect. Pairing is FIFO by prefix-`...` ordinal.
  const prefixSuffixes: string[] = [];
  segments.forEach((seg, segIdx) => {
    const segStart = t.starts[segIdx];
    seg.lines.forEach((line, lineIdx) => {
      if (line.kind === "prefix") {
        const sourceText = sourceLines[segStart + lineIdx].text;
        prefixSuffixes.push(sourceText.slice(line.prefix.length));
      }
    });
  });

  // Same intuition for leading-`...`: capture the source lines each skip ate
  // (leading skip, between-segments skips, trailing skip — in order) so that
  // a leading-`...` line on REPLACE can substitute the preserved content. The
  // model emitting standalone `...` on REPLACE between named keys intends "keep
  // the lines that were here"; Postel's law says accept that.
  const skipContents: string[] = [];
  const collectSkipLines = (startIdx: number, endIdx: number): string =>
    sourceLines
      .slice(startIdx, endIdx + 1)
      .map((s) => s.text)
      .join("\n");
  if (leadingSkip) {
    skipContents.push(collectSkipLines(0, firstSegStart - 1));
  }
  for (let i = 1; i < segments.length; i++) {
    const prevSegEnd = t.starts[i - 1] + segments[i - 1].lines.length - 1;
    const nextSegStart = t.starts[i];
    skipContents.push(collectSkipLines(prevSegEnd + 1, nextSegStart - 1));
  }
  if (trailingSkip) {
    const lastSegEnd = t.starts[segments.length - 1] + segments[segments.length - 1].lines.length - 1;
    skipContents.push(collectSkipLines(lastSegEnd + 1, sourceLines.length - 1));
  }

  const resolvedReplace = resolveReplaceEllipsis(replace, prefixSuffixes, skipContents);

  return {
    ok: true,
    matchKind: "ellipsis",
    content: source.slice(0, startChar) + resolvedReplace + source.slice(endChar),
  };
}

function resolveReplaceEllipsis(replace: string, prefixSuffixes: readonly string[], skipContents: readonly string[]): string {
  if (prefixSuffixes.length === 0 && skipContents.length === 0) return replace;
  let prefixCursor = 0;
  let skipCursor = 0;
  return replace
    .split("\n")
    .map((rawLine) => {
      const classified = classifyLine(rawLine);
      if (classified.kind === "skip") {
        if (skipCursor < skipContents.length) {
          return skipContents[skipCursor++];
        }
        return rawLine; // no SEARCH-side counterpart — keep literal for back-compat
      }
      if (classified.kind === "prefix") {
        if (prefixCursor < prefixSuffixes.length) {
          return classified.prefix + prefixSuffixes[prefixCursor++];
        }
        return rawLine; // no SEARCH-side counterpart — keep literal
      }
      return rawLine;
    })
    .join("\n");
}
