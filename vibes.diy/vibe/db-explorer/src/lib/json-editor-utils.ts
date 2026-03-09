import { S, TC } from "./styles.js";

const JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false)\b|\bnull\b|\b(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function highlightJson(text: string): string {
  return escapeHtml(text).replace(JSON_TOKEN, (match, str?: string, colon?: string, bool?: string) => {
    if (str) {
      if (colon) return `<span style="color:${TC.key}">${str}</span>${colon}`;
      return `<span style="color:${TC.string}">${str}</span>`;
    }
    if (bool) return `<span style="color:${TC.boolean}">${match}</span>`;
    if (match === "null") return `<span style="color:${TC.null}">${match}</span>`;
    return `<span style="color:${TC.number}">${match}</span>`;
  });
}

export function midLinePos(opts: { text: string; scrollTop: number; clientHeight: number }): number {
  const lineH = 14 * 1.5;
  const midLine = Math.floor((opts.scrollTop + opts.clientHeight / 2) / lineH);
  const lines = opts.text.split("\n");
  let pos = 0;
  for (let i = 0; i < Math.min(midLine, lines.length); i++) pos += lines[i].length + 1;
  return pos;
}

export const codeStyle = {
  fontFamily: S.mono,
  fontSize: 14,
  lineHeight: 1.5,
  padding: 12,
  margin: 0,
  borderRadius: 4,
  width: "100%",
  boxSizing: "border-box" as const,
  whiteSpace: "pre-wrap" as const,
  wordWrap: "break-word" as const,
  overflowWrap: "break-word" as const,
};

export function textareaStyle(isValid: boolean) {
  return {
    ...codeStyle,
    color: S.text,
    background: S.bgSurface,
    border: `1px solid ${isValid ? S.border : S.danger}`,
    resize: "vertical" as const,
    minHeight: 200,
    outline: "none",
  };
}

export function focusAtScroll(ta: HTMLTextAreaElement, opts: { text: string; scrollTop: number }) {
  const pos = midLinePos({ text: opts.text, scrollTop: opts.scrollTop, clientHeight: ta.clientHeight });
  ta.setSelectionRange(pos, pos);
  ta.focus({ preventScroll: true });
  ta.scrollTop = opts.scrollTop;
}

export const preStyle = {
  ...codeStyle,
  background: S.bgSurface,
  color: S.text,
  border: `1px solid ${S.border}`,
  cursor: "text",
  minHeight: 200,
  overflow: "auto",
  maxHeight: 400,
};
