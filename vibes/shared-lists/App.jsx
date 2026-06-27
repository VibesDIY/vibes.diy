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

// Atelier Studio theme (prompts/pkg/themes/atelier.md): warm light palette, soft
// hairline borders, gentle shadows, Playfair Display / Space Mono. Respects the
// visitor's system color scheme via the dark media query below.
const FONT_DISPLAY = { fontFamily: "'Playfair Display', Georgia, serif" };
const FONT_BODY = { fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" };
const FONT_MONO = { fontFamily: "'Space Mono', ui-monospace, monospace" };
const CARD = "rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]";
// Compact ViewerTag pill (it carries its own border/padding; don't double-wrap it).
const TAG = { fontSize: 12, padding: "3px 11px 3px 3px" };

function ThemeStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Space+Mono&display=optional');
      :root {
        --comp-bg: oklch(0.96 0.03 70);
        --comp-surface: oklch(1 0 0);
        --comp-text: oklch(0.25 0.04 30);
        --comp-muted: oklch(0.50 0.04 30);
        --comp-border: oklch(0.25 0.04 30 / 0.14);
        --comp-accent: oklch(0.65 0.18 55);
        --comp-accent-text: oklch(1 0 0);
        --comp-done: oklch(0.74 0.13 150);
        --comp-danger: oklch(0.58 0.20 25);
        /* Alias the theme into the tokens ViewerTag reads, so avatars/pills match. */
        --accent: var(--comp-accent);
        --border: var(--comp-border);
        --muted: var(--comp-muted);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --comp-bg: oklch(0.21 0.02 45);
          --comp-surface: oklch(0.27 0.02 45);
          --comp-text: oklch(0.95 0.02 70);
          --comp-muted: oklch(0.72 0.03 60);
          --comp-border: oklch(0.95 0.02 70 / 0.16);
          --comp-accent: oklch(0.72 0.17 58);
          --comp-accent-text: oklch(0.18 0.02 45);
          --comp-done: oklch(0.72 0.14 150);
          --comp-danger: oklch(0.66 0.20 25);
        }
      }
    `}</style>
  );
}

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
      <circle cx="9" cy="5" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="9" cy="19" r="1.4" />
      <circle cx="15" cy="5" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="15" cy="19" r="1.4" />
    </svg>
  );
}

function ListRail({ lists, activeId, onPick, onNew, canCreate }) {
  return (
    <nav className="flex gap-2 overflow-x-auto px-5 py-1">
      {lists.map((l) => {
        const active = l._id === activeId;
        return (
          <button
            key={l._id}
            onClick={() => onPick(l._id)}
            className={
              "shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition " +
              (active
                ? "bg-[var(--comp-accent)] text-[var(--comp-accent-text)]"
                : "border border-[var(--comp-border)] bg-[var(--comp-surface)] text-[var(--comp-text)] hover:border-[var(--comp-accent)]")
            }
          >
            {l.title || "Untitled"}
          </button>
        );
      })}
      {canCreate && (
        <button
          onClick={onNew}
          className="shrink-0 whitespace-nowrap rounded-full border border-dashed border-[var(--comp-border)] px-4 py-1.5 text-sm text-[var(--comp-muted)] hover:border-[var(--comp-accent)] hover:text-[var(--comp-text)]"
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
      className="flex items-center gap-1.5"
    >
      <input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="add friend by handle"
        style={FONT_MONO}
        className="w-40 min-w-0 rounded-full border border-[var(--comp-border)] bg-[var(--comp-bg)] px-3 py-1.5 text-xs outline-none focus:border-[var(--comp-accent)]"
      />
      <button
        type="submit"
        aria-label="invite"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--comp-border)] text-[var(--comp-muted)] hover:border-[var(--comp-accent)] hover:text-[var(--comp-accent)]"
      >
        <IconPlus size={15} />
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
  // Optimistic `done` overrides keyed by item _id. We flip the value locally for
  // an instant check/strikethrough, then drop the override once the write settles
  // so the live query is the single source of truth — on failure that means the
  // row simply reverts to its current saved state (no inverse threading).
  const [optimisticDone, setOptimisticDone] = useState({});

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
    const next = !doc.done;
    setOptimisticDone((o) => ({ ...o, [doc._id]: next })); // reflect immediately
    run(() => database.put({ ...doc, done: next })).finally(() =>
      // Drop the override and defer to the live query (reverts on a failed save).
      setOptimisticDone((o) => {
        const copy = { ...o };
        delete copy[doc._id];
        return copy;
      })
    );
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
    <div className="min-h-screen bg-[var(--comp-bg)] text-[var(--comp-text)]" style={FONT_BODY}>
      <ThemeStyle />
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col">
        <header className="flex items-end justify-between gap-3 px-5 pt-9 pb-4">
          <div>
            <h1 style={FONT_DISPLAY} className="text-4xl font-bold tracking-tight">
              Shared Lists
            </h1>
            <p style={FONT_MONO} className="mt-1.5 text-xs uppercase tracking-wider text-[var(--comp-muted)]">
              make a list · add friends · drag to reorder
            </p>
          </div>
          {saving > 0 && (
            <span
              style={FONT_MONO}
              className="mb-1.5 flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--comp-border)] px-2.5 py-1 text-[11px] text-[var(--comp-muted)]"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--comp-accent)]" />
              Saving…
            </span>
          )}
        </header>

        <ListRail lists={lists} activeId={activeListId} onPick={setActiveId} onNew={createList} canCreate={canCreateList} />

        {activeList && (
          <div className={"mx-5 mt-3 mb-4 px-5 py-4 " + CARD}>
            <div className="flex items-center gap-3">
              <input
                key={activeList._id}
                defaultValue={activeList.title}
                onBlur={(e) => renameList(e.target.value)}
                disabled={!(ready && can.edit({ ...activeList }).ok)}
                aria-label="list title"
                style={FONT_DISPLAY}
                className="min-w-0 flex-1 border-b border-transparent bg-transparent py-0.5 text-2xl font-bold outline-none focus:border-[var(--comp-border)] disabled:opacity-100"
              />
              {ready && can.delete(activeList).ok && (
                <button
                  onClick={deleteList}
                  aria-label="delete list"
                  style={FONT_MONO}
                  className="shrink-0 rounded-full border border-[var(--comp-border)] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--comp-muted)] hover:border-[var(--comp-danger)] hover:text-[var(--comp-danger)]"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span style={FONT_MONO} className="text-[11px] uppercase tracking-wide text-[var(--comp-muted)]">
                Shared with
              </span>
              {members.length === 0 && <span className="text-sm italic text-[var(--comp-muted)]">just you</span>}
              {members.map((m) => (
                <span key={m._id} className="flex items-center gap-1">
                  <ViewerTag userHandle={m.userHandle} style={TAG} />
                  {ready && can.delete(m).ok && (
                    <button
                      onClick={() => revoke(m)}
                      aria-label="remove friend"
                      className="text-[var(--comp-muted)] opacity-60 hover:text-[var(--comp-danger)] hover:opacity-100"
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

        <ul className="flex-1 space-y-2 px-5 pb-12">
          {!activeListId ? (
            <li className="rounded-xl border border-dashed border-[var(--comp-border)] px-4 py-12 text-center text-sm italic text-[var(--comp-muted)]">
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
              {sorted.map((it, i) => {
                const done = it._id in optimisticDone ? optimisticDone[it._id] : it.done;
                return (
                  <li
                    key={it._id}
                    draggable
                    onDragStart={() => setDragId(it._id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOn(it)}
                    className={
                      "group flex items-center gap-3 px-4 py-3 transition " +
                      CARD +
                      (dragId === it._id ? " opacity-40" : " hover:border-[var(--comp-accent)]")
                    }
                  >
                    <span className="cursor-grab text-[var(--comp-muted)] opacity-40 group-hover:opacity-80" aria-hidden>
                      <IconGrip size={16} />
                    </span>
                    <button
                      onClick={() => toggle(it)}
                      aria-label={done ? "mark not done" : "mark done"}
                      className={
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition " +
                        (done
                          ? "border-transparent bg-[var(--comp-done)] text-[var(--comp-accent-text)]"
                          : "border-[var(--comp-border)] bg-transparent text-transparent hover:border-[var(--comp-accent)]")
                      }
                    >
                      <IconCheck size={14} />
                    </button>
                    <span className={"flex-1 break-words " + (done ? "text-[var(--comp-muted)] line-through" : "")}>{it.text}</span>
                    {it.authorHandle && (
                      <span className="shrink-0 opacity-70">
                        <ViewerTag userHandle={it.authorHandle} style={TAG} />
                      </span>
                    )}
                    <span className="flex shrink-0 flex-col leading-none text-[var(--comp-muted)] opacity-50">
                      <button
                        onClick={() => nudge(i, -1)}
                        disabled={i === 0}
                        className="hover:text-[var(--comp-text)] disabled:opacity-20"
                        aria-label="move up"
                      >
                        <IconUp size={15} />
                      </button>
                      <button
                        onClick={() => nudge(i, 1)}
                        disabled={i === sorted.length - 1}
                        className="hover:text-[var(--comp-text)] disabled:opacity-20"
                        aria-label="move down"
                      >
                        <IconDown size={15} />
                      </button>
                    </span>
                    <button
                      onClick={() => remove(it)}
                      aria-label="delete"
                      className="shrink-0 text-[var(--comp-muted)] opacity-50 hover:text-[var(--comp-danger)] hover:opacity-100"
                    >
                      <IconX size={16} />
                    </button>
                  </li>
                );
              })}

              {writeVerdict?.ok ? (
                <li onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(null)}>
                  <form
                    onSubmit={addItem}
                    className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--comp-border)] px-4 py-3"
                  >
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-[var(--comp-border)] text-[var(--comp-muted)]"
                      aria-hidden
                    >
                      <IconPlus size={14} />
                    </span>
                    <input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Add an item…"
                      aria-label="Add an item"
                      className="flex-1 bg-transparent outline-none placeholder:text-[var(--comp-muted)] placeholder:opacity-60"
                    />
                    {text.trim() && (
                      <button
                        type="submit"
                        className="shrink-0 rounded-full bg-[var(--comp-accent)] px-4 py-1.5 text-sm font-semibold text-[var(--comp-accent-text)]"
                      >
                        Add
                      </button>
                    )}
                  </form>
                </li>
              ) : (
                <li className="px-1 py-2 text-sm italic text-[var(--comp-muted)]">
                  {writeVerdict?.reason || "Sign in to add items."}
                </li>
              )}
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
