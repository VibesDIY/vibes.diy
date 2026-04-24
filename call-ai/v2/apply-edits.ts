export type ApplyEditOk = { ok: true; content: string; matchKind: "exact" | "trailing-ws" };
export type ApplyEditErrReason = "no-match" | "multiple-match";
export type ApplyEditErr = { ok: false; reason: ApplyEditErrReason; matchCount: number };
export type ApplyEditResult = ApplyEditOk | ApplyEditErr;

function rstripLines(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n");
}

function findAllOccurrences(haystack: string, needle: string): number[] {
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

export function applyReplace(source: string, search: string, replace: string): ApplyEditResult {
  if (search.length === 0) {
    return { ok: false, reason: "no-match", matchCount: 0 };
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
    const r = applyReplace(content, edit.search, edit.replace);
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
