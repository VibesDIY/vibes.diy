import React, { useState, useRef, useEffect } from "react";

// A note editor that buffers keystrokes locally so typing never re-renders the
// whole app. It only persists (via onSave) when you focus away, and adopts external
// live-query updates only while you're not editing.
export default function NoteField({ saved, onSave, className, placeholder = "Add a private note…" }) {
  const [text, setText] = useState(saved || "");
  const [saving, setSaving] = useState(false);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setText(saved || "");
  }, [saved]);

  const commit = async () => {
    editingRef.current = false;
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
    <div className="flex items-center gap-2">
      <textarea
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => (editingRef.current = true)}
        onBlur={commit}
        className={className}
        rows={text && text.length > 40 ? 2 : 1}
      />
      {saving && <span className="text-[0.7rem] font-bold uppercase tracking-wider opacity-60">Saving…</span>}
    </div>
  );
}
