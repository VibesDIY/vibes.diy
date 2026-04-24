export type ApplyEditOk = { ok: true; content: string };
export type ApplyEditErrReason = "no-match" | "multiple-match";
export type ApplyEditErr = { ok: false; reason: ApplyEditErrReason; matchCount: number };
export type ApplyEditResult = ApplyEditOk | ApplyEditErr;

export function applyReplace(source: string, oldStr: string, newStr: string): ApplyEditResult {
  if (oldStr.length === 0) {
    return { ok: false, reason: "no-match", matchCount: 0 };
  }
  let matchCount = 0;
  let from = 0;
  let firstIdx = -1;
  while (true) {
    const idx = source.indexOf(oldStr, from);
    if (idx === -1) break;
    if (matchCount === 0) firstIdx = idx;
    matchCount += 1;
    from = idx + oldStr.length;
    if (matchCount > 1) break;
  }
  if (matchCount === 0) return { ok: false, reason: "no-match", matchCount: 0 };
  if (matchCount > 1) return { ok: false, reason: "multiple-match", matchCount };
  return {
    ok: true,
    content: source.slice(0, firstIdx) + newStr + source.slice(firstIdx + oldStr.length),
  };
}

export interface ReplaceEdit {
  readonly op: "replace";
  readonly old: string;
  readonly new: string;
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
  readonly oldSnippet: string;
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
    const r = applyReplace(content, edit.old, edit.new);
    if (r.ok) {
      content = r.content;
      return;
    }
    errors.push({
      index,
      reason: r.reason,
      matchCount: r.matchCount,
      oldSnippet: edit.old,
    });
  });
  return { content, errors };
}
