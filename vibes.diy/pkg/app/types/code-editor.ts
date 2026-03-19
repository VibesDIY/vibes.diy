// export type SettleState = "idle" | "codeGeneration-running" | "code-settle";

import { type } from "arktype";

export const AppCode = type({
  code: "string",
  complete: "boolean",
});

export type AppCode = typeof AppCode.infer;

const CodeEventBase = type({
  type: "'onCode'",
  appCode: AppCode,
});

export const CodeEventOk = type({
  codeState: "'ok'",
  hasChanged: "boolean",
}).and(CodeEventBase);
export type CodeEventOk = typeof CodeEventOk.infer;

export function isCodeEventOk(event: CodeEvent): event is CodeEventOk {
  return !(CodeEventOk(event) instanceof type.errors);
}

export const CodeEventEdit = type({
  codeState: "'edit'",
}).and(CodeEventBase);

export type CodeEventEdit = typeof CodeEventEdit.infer;
export function isCodeEventEdit(event: CodeEvent): event is CodeEventEdit {
  return !(CodeEventEdit(event) instanceof type.errors);
}

export const CodeEventInit = type({
  codeState: "'init'",
}).and(CodeEventBase);

export type CodeEventInit = typeof CodeEventInit.infer;
export function isCodeEventInit(event: CodeEvent): event is CodeEventInit {
  return !(CodeEventInit(event) instanceof type.errors);
}

// function isCodeEventOk(event: CodeEvent): event is CodeEventOk {
//   return !(CodeEventOk(event) instanceof type.errors);
// }
export const MonacoMarkerInfo = type({
  message: "string",
  startLineNumber: "number",
  startColumn: "number",
  endLineNumber: "number",
  endColumn: "number",
  severity: "number",
});

export const CodeEventError = type({
  codeState: "'error'",
  // error: "string",
  markers: MonacoMarkerInfo.array(),
}).and(CodeEventBase);

export type CodeEventError = typeof CodeEventError.infer;

export function isCodeEventError(event: CodeEvent): event is CodeEventError {
  return !(CodeEventError(event) instanceof type.errors);
}

// function isCodeEventError(event: CodeEvent): event is CodeEventError {
//   return !(CodeEventError(event) instanceof type.errors);
// }

export const CodeEvent = CodeEventOk.or(CodeEventError).or(CodeEventEdit).or(CodeEventInit);

export type CodeEvent = typeof CodeEvent.infer;
