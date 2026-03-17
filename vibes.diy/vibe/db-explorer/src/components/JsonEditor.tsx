import React, { useState, useCallback, useRef, useMemo } from "react";
import { S } from "../lib/styles.js";
import { highlightJson, focusAtScroll, textareaStyle, preStyle } from "../lib/json-editor-utils.js";
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
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const scrollRef = useRef(0);

  const isDirty = text !== original;
  const canSave = isValid && isDirty;

  const handleChange = useCallback((value: string) => {
    setText(value);
    try {
      const parsed = JSON.parse(value);
      setIsValid(typeof parsed === "object" && parsed !== null && !Array.isArray(parsed));
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

  const startEditing = useCallback(() => {
    scrollRef.current = preRef.current?.scrollTop ?? 0;
    setEditing(true);
    requestAnimationFrame(() => {
      if (textareaRef.current) focusAtScroll(textareaRef.current, { text, scrollTop: scrollRef.current });
    });
  }, [text]);

  const highlighted = useMemo(() => highlightJson(text), [text]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {docId && <div style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted }}>_id: {docId}</div>}
      {editing ? (
        <textarea
          className="code-editor"
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => {
            if (isValid) {
              scrollRef.current = textareaRef.current?.scrollTop ?? 0;
              setEditing(false);
              requestAnimationFrame(() => {
                if (preRef.current) preRef.current.scrollTop = scrollRef.current;
              });
            }
          }}
          rows={Math.min(text.split("\n").length, 18)}
          spellCheck={false}
          style={textareaStyle(isValid)}
        />
      ) : (
        <pre ref={preRef} onClick={startEditing} dangerouslySetInnerHTML={{ __html: highlighted }} style={preStyle} />
      )}
      {!isValid && <div style={{ fontSize: 11, color: S.danger, fontFamily: S.mono }}>Invalid JSON — must be a plain object</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn
          onClick={handleSave}
          disabled={!isValid || !isDirty}
          bg={canSave ? S.accent : S.accent + "15"}
          color={canSave ? "#fff" : S.accent + "50"}
          style={{ fontWeight: 600, cursor: canSave ? "pointer" : "default" }}
        >
          Save
        </Btn>
        <Btn onClick={onDiscard} color={S.textDim}>
          Discard
        </Btn>
      </div>
    </div>
  );
}
