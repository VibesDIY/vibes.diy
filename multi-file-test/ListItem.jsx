import React from "react"

export default function ListItem({ todo, canWrite, onToggle, onDelete, formatDate }) {
  const c = {
    row: "flex items-center gap-3 py-3 border-b border-[#f0e6d2] last:border-0",
    text: "flex-1",
    done: "flex-1 line-through text-[#9b8b6a]",
    date: "text-xs text-[#9b8b6a]",
    btn: "px-3 py-2 rounded-lg border border-[#e8dcc4] text-sm text-[#6b5d42] hover:bg-[#fdfaf3]",
  };
  return (
    <li className={c.row}>
      <input
        type="checkbox"
        className="w-5 h-5 accent-[#c9a35e]"
        checked={!!todo.completed}
        onChange={onToggle}
        disabled={!canWrite}
      />
      <div className="flex-1">
        <div className={todo.completed ? c.done : c.text}>{todo.text}</div>
        <div className={c.date}>{formatDate(todo.createdAt)}</div>
      </div>
      {canWrite && (
        <button className={c.btn} onClick={onDelete} aria-label="Delete task">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </li>
  );
}