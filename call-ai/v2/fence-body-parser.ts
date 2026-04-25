import type { Edit } from "./apply-edits.js";

export type FenceParseErrorKind =
  | "orphan-divider"
  | "orphan-end"
  | "unterminated-search"
  | "unterminated-replace"
  | "content-before-search";

export interface FenceParseError {
  readonly kind: FenceParseErrorKind;
  readonly lineNr: number;
}

export interface ParsedFenceBody {
  readonly edits: readonly Edit[];
  readonly errors: readonly FenceParseError[];
}

const SEARCH_MARKER = /^<{7}\s+SEARCH\s*$/;
const DIVIDER = /^={7}\s*$/;
const REPLACE_MARKER = /^>{7}\s+REPLACE\s*$/;

type Mode = "plain" | "between" | "in-search" | "in-replace";

export function parseFenceBody(lines: readonly string[]): ParsedFenceBody {
  let mode: Mode = "plain";
  let plainLines: string[] = [];
  let searchLines: string[] = [];
  let replaceLines: string[] = [];
  const edits: Edit[] = [];
  const errors: FenceParseError[] = [];
  let sawAnyMarker = false;

  lines.forEach((line, i) => {
    const lineNr = i + 1;
    const trimmed = line.replace(/[ \t]+$/, "");

    if (SEARCH_MARKER.test(trimmed)) {
      sawAnyMarker = true;
      if (mode === "plain" && plainLines.some((l) => l.trim().length > 0)) {
        errors.push({ kind: "content-before-search", lineNr });
      }
      mode = "in-search";
      searchLines = [];
      replaceLines = [];
      return;
    }

    if (DIVIDER.test(trimmed)) {
      if (mode === "in-search") {
        mode = "in-replace";
        return;
      }
      errors.push({ kind: "orphan-divider", lineNr });
      return;
    }

    if (REPLACE_MARKER.test(trimmed)) {
      if (mode === "in-replace") {
        edits.push({
          op: "replace",
          search: searchLines.join("\n"),
          replace: replaceLines.join("\n"),
        });
        searchLines = [];
        replaceLines = [];
        mode = "between";
        return;
      }
      errors.push({ kind: "orphan-end", lineNr });
      return;
    }

    switch (mode) {
      case "plain":
        plainLines.push(line);
        return;
      case "in-search":
        searchLines.push(line);
        return;
      case "in-replace":
        replaceLines.push(line);
        return;
      case "between":
        // Stray content between sections — treat as a content-before-search error
        // unless blank, in which case ignore.
        if (line.trim().length > 0) {
          errors.push({ kind: "content-before-search", lineNr });
        }
        return;
    }
  });

  if (mode === "in-search") {
    errors.push({ kind: "unterminated-search", lineNr: lines.length });
  } else if (mode === "in-replace") {
    errors.push({ kind: "unterminated-replace", lineNr: lines.length });
  }

  if (!sawAnyMarker) {
    edits.push({ op: "create", content: plainLines.join("\n") });
  }

  return { edits, errors };
}
