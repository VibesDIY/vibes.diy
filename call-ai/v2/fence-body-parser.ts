import type { Edit } from "./apply-edits.js";

export type FenceParseErrorKind =
  | "orphan-divider"
  | "orphan-end"
  | "unterminated-search"
  | "unterminated-replace"
  | "content-before-search"
  | "divider-as-end";

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
  const plainLines: string[] = [];
  let searchLines: string[] = [];
  let replaceLines: string[] = [];
  const edits: Edit[] = [];
  const errors: FenceParseError[] = [];
  let sawAnyMarker = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
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
      continue;
    }

    if (DIVIDER.test(trimmed)) {
      if (mode === "in-search") {
        mode = "in-replace";
        continue;
      }
      if (mode === "in-replace") {
        // Lenient recovery: the model closed the REPLACE with `=======`
        // instead of `>>>>>>> REPLACE`. Treat the divider as the implicit
        // end of replace, emit the edit, and surface a soft warning so
        // consumers can count how often this fallback fires.
        edits.push({
          op: "replace",
          search: searchLines.join("\n"),
          replace: replaceLines.join("\n"),
        });
        searchLines = [];
        replaceLines = [];
        mode = "between";
        errors.push({ kind: "divider-as-end", lineNr });
        continue;
      }
      errors.push({ kind: "orphan-divider", lineNr });
      continue;
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
        continue;
      }
      errors.push({ kind: "orphan-end", lineNr });
      continue;
    }

    if (mode === "plain") {
      plainLines.push(line);
      continue;
    }
    if (mode === "in-search") {
      searchLines.push(line);
      continue;
    }
    if (mode === "in-replace") {
      replaceLines.push(line);
      continue;
    }
    // mode === "between": stray content between sections — treat as a
    // content-before-search error unless blank, in which case ignore.
    if (line.trim().length > 0) {
      errors.push({ kind: "content-before-search", lineNr });
    }
  }

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
