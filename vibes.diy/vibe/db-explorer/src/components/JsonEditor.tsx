import { useState, useCallback } from "react";
import { S } from "../lib/styles.js";
import { Btn } from "./Btn.js";

interface JsonEditorProps {
  doc: Record<string, unknown>;
  onSave: (doc: Record<string, unknown>) => void;
  onDiscard: () => void;
}

export function JsonEditor({ doc, onSave, onDiscard }: JsonEditorProps) {
  const docId = doc._id as string | undefined;
  const { _id, ...editable } = doc;
  const original = JSON.stringify(editable, null, 2);
  const [text, setText] = useState(original);
  const [isValid, setIsValid] = useState(true);

  const isDirty = text !== original;
  const canSave = isValid && isDirty;

  const handleChange = useCallback((value: string) => {
    setText(value);
    try {
      const parsed = JSON.parse(value);
      setIsValid(
        typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      );
    } catch {
      setIsValid(false);
    }
  }, []);

  const handleSave = useCallback(() => {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
      onSave({ ...parsed, _id: docId });
    } catch {
      // invalid JSON, shouldn't reach here since button is disabled
    }
  }, [text, docId, onSave]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {docId && (
        <div
          style={{
            fontFamily: S.mono,
            fontSize: 11,
            color: S.textMuted,
          }}
        >
          _id: {docId}
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        style={{
          fontFamily: S.mono,
          fontSize: 13,
          lineHeight: 1.5,
          color: S.text,
          background: S.bgSurface,
          border: `1px solid ${isValid ? S.border : S.danger}`,
          borderRadius: 4,
          padding: 12,
          resize: "vertical",
          minHeight: 200,
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
      />
      {!isValid && (
        <div style={{ fontSize: 11, color: S.danger, fontFamily: S.mono }}>
          Invalid JSON — must be a plain object
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn
          onClick={handleSave}
          disabled={!isValid || !isDirty}
          bg={canSave ? S.accent : S.accent + "15"}
          border={canSave ? S.accent : S.accent + "25"}
          color={canSave ? "#fff" : S.accent + "50"}
          style={{
            fontWeight: 600,
            cursor: canSave ? "pointer" : "default",
          }}
        >
          Save
        </Btn>
        <Btn onClick={onDiscard} border={S.border} color={S.textDim}>
          Discard
        </Btn>
      </div>
    </div>
  );
}
