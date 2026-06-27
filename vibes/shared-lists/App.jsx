import React, { useState } from "react";
import { useFireproof } from "use-fireproof";
import { useViewer, useVibe } from "use-vibes";

const DB = "sharedLists";
const STEP = 1; // spacing for appends (epsilon guard intentionally omitted — see spec §4)

// `sorted` is the items already sorted ascending by position.
function positionForAppend(sorted) {
  return sorted.length ? sorted[sorted.length - 1].position + STEP : STEP;
}

// targetIndex = the slot in the visually-sorted array AFTER the dragged item is removed.
function positionForDrop(sorted, targetIndex) {
  const before = sorted[targetIndex - 1]; // undefined when dropping at the top
  const after = sorted[targetIndex]; // undefined when dropping at the bottom
  if (!before) return after.position - STEP; // top
  if (!after) return before.position + STEP; // bottom
  return (before.position + after.position) / 2; // between → average
}

function ListRail({ lists, activeId, onPick, onNew, canCreate }) {
  return (
    <nav className="flex gap-2 overflow-x-auto px-5 py-3 border-b-2 border-black">
      {lists.map((l) => (
        <button
          key={l._id}
          onClick={() => onPick(l._id)}
          className={
            "px-3 py-2 rounded border-2 border-black whitespace-nowrap min-h-[44px] " +
            (l._id === activeId ? "bg-[oklch(0.8_0.18_85)] font-bold" : "bg-white")
          }
        >
          {l.title || "Untitled"}
        </button>
      ))}
      {canCreate && (
        <button onClick={onNew} className="px-3 py-2 rounded border-2 border-black bg-white min-h-[44px] shrink-0">
          + New list
        </button>
      )}
    </nav>
  );
}

function InviteBox({ onInvite }) {
  const [handle, setHandle] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onInvite(handle);
        setHandle("");
      }}
      className="flex gap-2"
    >
      <input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="friend handle"
        className="px-2 py-1 text-sm border-2 border-black rounded bg-white min-w-0"
      />
      <button type="submit" className="px-2 py-1 text-sm border-2 border-black rounded bg-white shrink-0">
        + invite
      </button>
    </form>
  );
}

export default function App() {
  const { useLiveQuery, database } = useFireproof(DB);
  const { ViewerTag } = useViewer();
  const { can, ready, me } = useVibe(DB);

  // lists newest-first via _id (roughly temporal — no createdAt needed for ordering)
  const { docs: lists } = useLiveQuery((d) => (d.type === "list" ? d._id : undefined), { descending: true });
  const [activeId, setActiveId] = useState(null);
  const activeListId = activeId || lists[0]?._id || null;
  const activeList = lists.find((l) => l._id === activeListId) || null;

  // compound index [listId, position] → already sorted ascending by position
  const { docs: sorted } = useLiveQuery((d) => (d.type === "item" ? [d.listId, d.position] : undefined), {
    prefix: activeListId ? [activeListId] : ["__none__"],
  });
  const { docs: members } = useLiveQuery((d) => (d.type === "member" ? d.listId : undefined), {
    key: activeListId || "__none__",
  });

  const [text, setText] = useState("");
  const [dragId, setDragId] = useState(null);

  const writeVerdict =
    ready && activeListId ? can.create({ type: "item", listId: activeListId, authorHandle: me?.userHandle }) : null;
  // Preview the list-create gate with a valid placeholder _id: access.js builds the
  // channel from doc._id (safeId), and a create candidate has no _id yet — without
  // one the predictor throws "Invalid id" and the gate wrongly reads as denied.
  const createListVerdict = ready ? can.create({ type: "list", _id: "list-preview", creatorHandle: me?.userHandle }) : null;
  const canCreateList = !!createListVerdict?.ok;
  const canInvite =
    ready && activeListId ? can.create({ type: "member", listId: activeListId, addedBy: me?.userHandle }).ok : false;

  async function createList() {
    if (!me) return;
    // Generate the _id ourselves so it's a valid channel token (safeId) and the
    // same value the create predictor saw — Fireproof's auto _id isn't guaranteed
    // to match /^[A-Za-z0-9_-]+$/.
    const _id = "list-" + crypto.randomUUID();
    await database.put({ _id, type: "list", title: "Untitled list", creatorHandle: me.userHandle });
    setActiveId(_id);
  }

  async function addItem(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !me || !activeListId) return;
    setText("");
    await database.put({
      type: "item",
      listId: activeListId,
      text: t,
      done: false,
      position: positionForAppend(sorted),
      authorHandle: me.userHandle,
      createdAt: Date.now(),
    });
  }

  async function toggle(doc) {
    await database.put({ ...doc, done: !doc.done });
  }

  async function remove(doc) {
    await database.del(doc._id);
  }

  async function setPosition(doc, position) {
    await database.put({ ...doc, position });
  }

  async function dropOn(targetDoc) {
    if (!dragId || dragId === targetDoc?._id) return;
    const dragged = sorted.find((d) => d._id === dragId);
    const without = sorted.filter((d) => d._id !== dragId);
    const targetIndex = targetDoc ? without.findIndex((d) => d._id === targetDoc._id) : without.length;
    await setPosition(dragged, positionForDrop(without, targetIndex));
    setDragId(null);
  }

  async function nudge(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i];
    const b = sorted[j];
    await setPosition(a, b.position);
    await setPosition(b, a.position);
  }

  async function invite(handle) {
    const h = handle.trim();
    if (!h || !activeListId || !me) return;
    await database.put({ type: "member", listId: activeListId, userHandle: h, addedBy: me.userHandle });
  }

  async function renameList(title) {
    if (!activeList || title === activeList.title) return;
    await database.put({ ...activeList, title });
  }

  async function revoke(memberDoc) {
    await database.del(memberDoc._id);
  }

  async function deleteList() {
    if (!activeList) return;
    await database.del(activeList._id); // orphaned items are ignored by queries (no cascade in a CRDT)
    setActiveId(null);
  }

  return (
    <div className="min-h-screen bg-[oklch(0.98_0.01_95)] text-[oklch(0.2_0.02_260)] font-sans flex flex-col">
      <header className="px-5 pt-6 pb-3">
        <h1 className="text-2xl font-black">Shared Lists</h1>
      </header>

      <ListRail lists={lists} activeId={activeListId} onPick={setActiveId} onNew={createList} canCreate={canCreateList} />

      {activeList && (
        <div className="px-5 py-3 border-b-2 border-black flex items-center gap-3 flex-wrap">
          <input
            key={activeList._id}
            defaultValue={activeList.title}
            onBlur={(e) => renameList(e.target.value)}
            disabled={!(ready && can.edit({ ...activeList }).ok)}
            className="font-bold bg-transparent border-b-2 border-transparent focus:border-black disabled:opacity-100 min-w-0"
          />
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {members.map((m) => (
              <span key={m._id} className="flex items-center gap-1">
                <ViewerTag userHandle={m.userHandle} className="text-xs" />
                {ready && can.delete(m).ok && (
                  <button onClick={() => revoke(m)} className="text-xs opacity-40 hover:opacity-100" aria-label="revoke">
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
          {canInvite && <InviteBox onInvite={invite} />}
          {ready && can.delete(activeList).ok && (
            <button onClick={deleteList} className="text-xs opacity-50 hover:text-[oklch(0.6_0.2_25)]">
              Delete list
            </button>
          )}
        </div>
      )}

      <ul className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {!activeListId ? (
          <li className="text-sm opacity-50 italic">
            {canCreateList
              ? "Create a list to get started."
              : me
                ? createListVerdict?.reason || "You can't create a list here."
                : "Sign in to create a list."}
          </li>
        ) : sorted.length === 0 ? (
          <li className="text-sm opacity-50 italic">No items yet — add one below.</li>
        ) : (
          sorted.map((it, i) => (
            <li
              key={it._id}
              draggable
              onDragStart={() => setDragId(it._id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(it)}
              className={
                "px-3 py-2 bg-white border-2 border-black rounded flex items-center gap-3 " +
                (dragId === it._id ? "opacity-40" : "")
              }
            >
              <input type="checkbox" checked={it.done} onChange={() => toggle(it)} className="w-5 h-5 shrink-0" />
              <span className={it.done ? "line-through opacity-50" : ""}>{it.text}</span>
              {it.authorHandle && <ViewerTag userHandle={it.authorHandle} className="text-xs opacity-60 shrink-0 ml-auto" />}
              <span className="flex flex-col leading-none shrink-0">
                <button
                  onClick={() => nudge(i, -1)}
                  disabled={i === 0}
                  className="text-xs disabled:opacity-20"
                  aria-label="move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => nudge(i, 1)}
                  disabled={i === sorted.length - 1}
                  className="text-xs disabled:opacity-20"
                  aria-label="move down"
                >
                  ▼
                </button>
              </span>
              <button
                onClick={() => remove(it)}
                className="text-xs opacity-40 hover:opacity-100 hover:text-[oklch(0.6_0.2_25)] shrink-0"
                aria-label="delete"
              >
                ✕
              </button>
            </li>
          ))
        )}
        {activeListId && <li onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(null)} className="h-6" />}
      </ul>

      {activeListId &&
        (ready && writeVerdict && !writeVerdict.ok ? (
          <div className="px-5 py-3 border-t-2 border-black text-sm opacity-70 italic">
            {writeVerdict.reason || "Sign in to add items."}
          </div>
        ) : (
          <form
            onSubmit={addItem}
            className="sticky bottom-0 bg-[oklch(0.98_0.01_95)] px-5 py-3 flex gap-2 border-t-2 border-black"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add an item…"
              className="flex-1 px-3 py-2 border-2 border-black rounded bg-white min-h-[44px]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[oklch(0.8_0.18_85)] border-2 border-black rounded font-bold min-h-[44px]"
            >
              Add
            </button>
          </form>
        ))}
    </div>
  );
}
