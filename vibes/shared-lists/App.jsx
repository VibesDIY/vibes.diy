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

const CARD = "border-2 border-black rounded-xl shadow-[3px_3px_0_0_#000]";

// Inline stroke icons (house style: no emoji in the UI).
function Svg({ size = 18, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}
const IconCheck = (p) => (
  <Svg {...p}>
    <polyline points="20 6 9 17 4 12" />
  </Svg>
);
const IconX = (p) => (
  <Svg {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
);
const IconUp = (p) => (
  <Svg {...p}>
    <polyline points="18 15 12 9 6 15" />
  </Svg>
);
const IconDown = (p) => (
  <Svg {...p}>
    <polyline points="6 9 12 15 18 9" />
  </Svg>
);
const IconPlus = (p) => (
  <Svg {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);
function IconGrip({ size = 16, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...rest}>
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  );
}

function ListRail({ lists, activeId, onPick, onNew, canCreate }) {
  return (
    <nav className="flex gap-2 overflow-x-auto px-5 py-3">
      {lists.map((l) => {
        const active = l._id === activeId;
        return (
          <button
            key={l._id}
            onClick={() => onPick(l._id)}
            className={
              "shrink-0 whitespace-nowrap rounded-lg border-2 border-black px-3 py-2 text-sm font-bold shadow-[2px_2px_0_0_#000] transition active:translate-y-px " +
              (active ? "bg-[oklch(0.85_0.17_88)]" : "bg-white hover:-translate-y-px")
            }
          >
            {l.title || "Untitled"}
          </button>
        );
      })}
      {canCreate && (
        <button
          onClick={onNew}
          className="shrink-0 whitespace-nowrap rounded-lg border-2 border-dashed border-black/40 px-3 py-2 text-sm font-bold text-black/50 hover:border-black hover:text-black"
        >
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
      className="flex items-center gap-1"
    >
      <input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="add friend by handle"
        className="w-40 min-w-0 rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm outline-none"
      />
      <button
        type="submit"
        aria-label="invite"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-black bg-white hover:bg-[oklch(0.85_0.17_88)]"
      >
        <IconPlus size={16} />
      </button>
    </form>
  );
}

export default function App() {
  const { useLiveQuery, database } = useFireproof(DB);
  const { viewer, isViewerPending, ViewerTag } = useViewer();
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
  const [saving, setSaving] = useState(0);

  // Optimistic writes (per prompts/llms/use-vibe.md): Fireproof is local-first, so
  // useLiveQuery reflects the change immediately; the runtime surfaces a toast if
  // the server rejects. `run` tracks in-flight writes for the "Saving…" pill and
  // keeps a rejected put from becoming an unhandled promise rejection.
  async function run(fn) {
    setSaving((n) => n + 1);
    try {
      await fn();
    } catch (e) {
      console.error("[shared-lists] write failed", e);
    } finally {
      setSaving((n) => n - 1);
    }
  }

  const writeVerdict =
    ready && activeListId ? can.create({ type: "item", listId: activeListId, authorHandle: me?.userHandle }) : null;
  // Preview the list-create gate with a valid placeholder _id: access.js builds the
  // channel from doc._id (safeId), and a create candidate has no _id yet — without
  // one the predictor throws "Invalid id" and the gate wrongly reads as denied.
  const createListVerdict = ready ? can.create({ type: "list", _id: "list-preview", creatorHandle: me?.userHandle }) : null;
  const canCreateList = !!createListVerdict?.ok;
  const canInvite =
    ready && activeListId ? can.create({ type: "member", listId: activeListId, addedBy: me?.userHandle }).ok : false;

  function createList() {
    if (!me) return;
    // Generate the _id ourselves so it's a valid channel token (safeId) and the
    // same value the create predictor saw — Fireproof's auto _id isn't guaranteed
    // to match /^[A-Za-z0-9_-]+$/.
    const _id = "list-" + crypto.randomUUID();
    setActiveId(_id); // optimistic: select the new list right away
    run(() => database.put({ _id, type: "list", title: "Untitled list", creatorHandle: me.userHandle }));
  }

  function addItem(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !me || !activeListId) return;
    setText(""); // optimistic: clear the input immediately
    run(() =>
      database.put({
        type: "item",
        listId: activeListId,
        text: t,
        done: false,
        position: positionForAppend(sorted),
        authorHandle: me.userHandle,
        createdAt: Date.now(),
      })
    );
  }

  function toggle(doc) {
    run(() => database.put({ ...doc, done: !doc.done }));
  }

  function remove(doc) {
    run(() => database.del(doc._id));
  }

  function setPosition(doc, position) {
    return database.put({ ...doc, position });
  }

  function dropOn(targetDoc) {
    if (!dragId || dragId === targetDoc?._id) return;
    const dragged = sorted.find((d) => d._id === dragId);
    const without = sorted.filter((d) => d._id !== dragId);
    const targetIndex = targetDoc ? without.findIndex((d) => d._id === targetDoc._id) : without.length;
    setDragId(null);
    run(() => setPosition(dragged, positionForDrop(without, targetIndex)));
  }

  function nudge(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i];
    const b = sorted[j];
    run(async () => {
      await setPosition(a, b.position);
      await setPosition(b, a.position);
    });
  }

  function invite(handle) {
    const h = handle.trim();
    if (!h || !activeListId || !me) return;
    run(() => database.put({ type: "member", listId: activeListId, userHandle: h, addedBy: me.userHandle }));
  }

  function renameList(title) {
    if (!activeList || title === activeList.title) return;
    run(() => database.put({ ...activeList, title }));
  }

  function revoke(memberDoc) {
    run(() => database.del(memberDoc._id));
  }

  function deleteList() {
    if (!activeList) return;
    const id = activeList._id; // orphaned items are ignored by queries (no cascade in a CRDT)
    setActiveId(null);
    run(() => database.del(id));
  }

  return (
    <div className="min-h-screen bg-[oklch(0.97_0.012_95)] font-sans text-[oklch(0.2_0.02_260)]">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col">
        <header className="flex items-end justify-between gap-3 px-5 pt-8 pb-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Shared Lists</h1>
            <p className="mt-1 text-sm text-black/50">make a list, add friends, drag to reorder</p>
          </div>
          {saving > 0 && (
            <span className="mb-1 flex shrink-0 items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-black/50">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[oklch(0.7_0.18_85)]" />
              Saving…
            </span>
          )}
        </header>

        <ListRail lists={lists} activeId={activeListId} onPick={setActiveId} onNew={createList} canCreate={canCreateList} />

        {activeList && (
          <div className={"mx-5 mb-4 bg-white px-5 py-4 " + CARD}>
            <div className="flex items-center gap-3">
              <input
                key={activeList._id}
                defaultValue={activeList.title}
                onBlur={(e) => renameList(e.target.value)}
                disabled={!(ready && can.edit({ ...activeList }).ok)}
                aria-label="list title"
                className="min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 text-xl font-black outline-none focus:bg-black/5 disabled:opacity-100"
              />
              {ready && can.delete(activeList).ok && (
                <button
                  onClick={deleteList}
                  aria-label="delete list"
                  className="shrink-0 rounded-lg border-2 border-black px-3 py-1.5 text-xs font-bold text-black/60 hover:bg-[oklch(0.62_0.22_25)] hover:text-white"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-medium text-black/50">Shared with</span>
              {members.length === 0 && <span className="text-xs italic text-black/40">just you</span>}
              {members.map((m) => (
                <span key={m._id} className="flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1">
                  <ViewerTag userHandle={m.userHandle} className="text-xs" />
                  {ready && can.delete(m).ok && (
                    <button
                      onClick={() => revoke(m)}
                      aria-label="remove friend"
                      className="text-black/40 hover:text-[oklch(0.62_0.22_25)]"
                    >
                      <IconX size={13} />
                    </button>
                  )}
                </span>
              ))}
              {canInvite && <InviteBox onInvite={invite} />}
            </div>
          </div>
        )}

        <ul className="flex-1 space-y-3 px-5 pb-12">
          {!activeListId ? (
            <li className="rounded-xl border-2 border-dashed border-black/30 px-4 py-12 text-center text-sm italic text-black/50">
              {isViewerPending
                ? "Connecting…"
                : canCreateList
                  ? "Create a list to get started."
                  : viewer
                    ? createListVerdict?.reason || "You can't create a list here."
                    : "Sign in to create a list."}
            </li>
          ) : (
            <>
              {sorted.map((it, i) => (
                <li
                  key={it._id}
                  draggable
                  onDragStart={() => setDragId(it._id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOn(it)}
                  className={
                    "group flex items-center gap-3 bg-white px-4 py-3.5 " + CARD + (dragId === it._id ? " opacity-40" : "")
                  }
                >
                  <span className="cursor-grab text-black/25 group-hover:text-black/50" aria-hidden>
                    <IconGrip size={16} />
                  </span>
                  <button
                    onClick={() => toggle(it)}
                    aria-label={it.done ? "mark not done" : "mark done"}
                    className={
                      "grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-black " +
                      (it.done ? "bg-[oklch(0.8_0.2_145)] text-black" : "bg-white text-transparent")
                    }
                  >
                    <IconCheck size={14} />
                  </button>
                  <span className={"flex-1 break-words " + (it.done ? "text-black/40 line-through" : "")}>{it.text}</span>
                  {it.authorHandle && <ViewerTag userHandle={it.authorHandle} className="shrink-0 text-[11px] opacity-60" />}
                  <span className="flex shrink-0 flex-col leading-none text-black/35">
                    <button
                      onClick={() => nudge(i, -1)}
                      disabled={i === 0}
                      className="hover:text-black disabled:opacity-20"
                      aria-label="move up"
                    >
                      <IconUp size={15} />
                    </button>
                    <button
                      onClick={() => nudge(i, 1)}
                      disabled={i === sorted.length - 1}
                      className="hover:text-black disabled:opacity-20"
                      aria-label="move down"
                    >
                      <IconDown size={15} />
                    </button>
                  </span>
                  <button
                    onClick={() => remove(it)}
                    aria-label="delete"
                    className="shrink-0 text-black/30 hover:text-[oklch(0.62_0.22_25)]"
                  >
                    <IconX size={16} />
                  </button>
                </li>
              ))}

              {writeVerdict?.ok ? (
                <li onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(null)}>
                  <form
                    onSubmit={addItem}
                    className="flex items-center gap-3 rounded-xl border-2 border-dashed border-black/40 px-4 py-3.5"
                  >
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-dashed border-black/40 text-black/40"
                      aria-hidden
                    >
                      <IconPlus size={14} />
                    </span>
                    <input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Add an item…"
                      aria-label="Add an item"
                      className="flex-1 bg-transparent text-base outline-none placeholder:text-black/40"
                    />
                    {text.trim() && (
                      <button
                        type="submit"
                        className="shrink-0 rounded-lg border-2 border-black bg-[oklch(0.85_0.17_88)] px-3 py-1.5 text-sm font-bold"
                      >
                        Add
                      </button>
                    )}
                  </form>
                </li>
              ) : (
                <li className="px-1 py-2 text-sm italic text-black/50">{writeVerdict?.reason || "Sign in to add items."}</li>
              )}
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
