import { type } from "arktype";

export const AppCode = type({
  "streamId?": "string",
  code: "string[]",
  complete: "boolean",
});
export type AppCode = typeof AppCode.infer;

export const EditorStateIdle = type({
  state: "'idle'",
});
export type EditorStateIdle = typeof EditorStateIdle.infer;
export function isEditorStateIdle(obj: unknown): obj is EditorStateIdle {
  return !(EditorStateIdle(obj) instanceof type.errors);
}

export const EditorStateStartGenerating = type({
  state: "'start-generating'",
  lines: "string[]",
});
export type EditorStateStartGenerating = typeof EditorStateStartGenerating.infer;
export function isEditorStateStartGenerating(obj: unknown): obj is EditorStateStartGenerating {
  return !(EditorStateStartGenerating(obj) instanceof type.errors);
}

export const EditorStateMoreLines = type({
  state: "'more-lines'",
  lines: "string[]",
  newLines: "string[]",
});
export type EditorStateMoreLines = typeof EditorStateMoreLines.infer;
export function isEditorStateMoreLines(obj: unknown): obj is EditorStateMoreLines {
  return !(EditorStateMoreLines(obj) instanceof type.errors);
}

export const ArkEditorStateToEdit = type({
  state: "'to-edit'",
  buffer: "string",
  hash: "bigint",
});
export type ArkEditorStateToEdit = typeof ArkEditorStateToEdit.infer;
export type EditorStateToEdit = ArkEditorStateToEdit & {
  onChange: (newCode?: string) => void;
};
export function isEditorStateToEdit(obj: unknown): obj is EditorStateToEdit {
  return !(ArkEditorStateToEdit(obj) instanceof type.errors);
}

export const ArkEditorStateEdit = type({
  state: "'edit'",
  // toEdit: ArkEditorStateToEdit,
  buffer: "string",
  hash: "bigint",
});
export type ArkEditorStateEdit = typeof ArkEditorStateEdit.infer;
export type EditorStateEdit = ArkEditorStateEdit & {
  toEdit: EditorStateToEdit;
};
export function isEditorStateEdit(obj: unknown): obj is EditorStateEdit {
  return !(ArkEditorStateEdit(obj) instanceof type.errors);
}

export const EditorState = EditorStateIdle.or(EditorStateStartGenerating)
  .or(EditorStateMoreLines)
  .or(ArkEditorStateToEdit)
  .or(ArkEditorStateEdit);
export type EditorState = EditorStateIdle | EditorStateStartGenerating | EditorStateMoreLines | EditorStateToEdit | EditorStateEdit;

export function isEditorState(obj: unknown): obj is EditorState {
  return !(EditorState(obj) instanceof type.errors);
}
