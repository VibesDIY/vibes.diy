import React, { useState, useRef, useEffect } from "react";

// A note editor that buffers keystrokes locally so typing never re-renders the
// whole app. It only persists (via onSave) when you focus away, and adopts
// external live-query updates only while you're not editing.
export default function NoteField({ saved, onSave, className, placeholder = "Add note...", collapsedStyle }) {
  const [text, setText] = useState(saved || "");
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setText(saved || "");
  }, [saved]);

  const expanded = focused || (text && text.length > 0);

  const commit = async () => {
    editingRef.current = false;
    setFocused(false);
    if ((text || "") === (saved || "")) return;
    setSaving(true);
    try {
      await onSave(text);
    } catch (e) {
      /* live query reconciles; leave the text as typed */
    } finally {
      setTimeout(() => setSaving(false), 400);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <textarea
        placeholder={placeholder}
        value={text}
        style={expanded ? undefined : collapsedStyle}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => {
          editingRef.current = true;
          setFocused(true);
        }}
        onBlur={commit}
        className={className}
        rows={expanded ? 2 : 1}
      />
      {saving && <span className={`text-xs font-bold opacity-60`}>Saving…</span>}
    </div>
  );
}
