import React, { useRef, useState } from "react";
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

  // Three stable, type-keyed live queries (the proven idiom): each is subscribed
  // once and hydrates on load. We filter/sort by the active list in plain JS so the
  // subscriptions never change as the active list does — a query whose `prefix`
  // changed with activeListId was the cause of the "empty until you write" flash.
  const { docs: listDocs } = useLiveQuery("type", { key: "list" });
  const { docs: itemDocs } = useLiveQuery("type", { key: "item" });
  const { docs: memberDocs } = useLiveQuery("type", { key: "member" });

  const lists = [...listDocs].sort((a, b) => (a._id < b._id ? 1 : -1)); // newest-first by _id
  const [activeId, setActiveId] = useState(null);
  const activeListId = activeId || lists[0]?._id || null;
  const activeList = lists.find((l) => l._id === activeListId) || null;
  const members = memberDocs.filter((m) => m.listId === activeListId);

  const [text, setText] = useState("");
  const [dragId, setDragId] = useState(null);
  const [saving, setSaving] = useState(0);
  // Optimistic `done` overrides keyed by item _id. We flip the value locally for an
  // instant check/strikethrough and then LEAVE it: the live query lands the same
  // value a moment later (network-delayed) and the override is simply redundant.
  // Clearing it on success would flash old→new as the query catches up, so we only
  // clear on a FAILED save — which reverts the row to its current saved state.
  const [optimisticDone, setOptimisticDone] = useState({});
  // Optimistic `position` overrides keyed by item _id — same idea, so a reorder
  // (nudge or drag) re-sorts instantly instead of waiting on the live query.
  const [optimisticPos, setOptimisticPos] = useState({});
  const dragIdRef = useRef(null);

  // The rendered list: raw query rows with optimistic overrides applied, then
  // sorted by the effective position. Everything below reads/reorders `items`.
  const items = itemDocs
    .filter((it) => it.listId === activeListId)
    .map((it) => ({
      ...it,
      done: it._id in optimisticDone ? optimisticDone[it._id] : it.done,
      position: it._id in optimisticPos ? optimisticPos[it._id] : it.position,
    }))
    .sort((a, b) => a.position - b.position);

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
        position: positionForAppend(items),
        authorHandle: me.userHandle,
        createdAt: Date.now(),
      })
    );
  }

  function toggle(doc, currentDone) {
    const next = !currentDone; // base off the displayed state so a quick re-tap works
    setOptimisticDone((o) => ({ ...o, [doc._id]: next })); // reflect immediately, and keep it
    setSaving((n) => n + 1);
    database
      .put({ ...doc, done: next })
      .catch((e) => {
        console.error("[shared-lists] toggle failed", e);
        // Revert: drop the override so the live query (current saved state) shows through.
        setOptimisticDone((o) => {
          const copy = { ...o };
          delete copy[doc._id];
          return copy;
        });
      })
      .finally(() => setSaving((n) => n - 1));
  }

  function remove(doc) {
    run(() => database.del(doc._id));
  }

  // Persist position changes. Like the toggle, keep the optimistic positions on
  // success (the live query lands them) and drop them only on a failed save.
  function commitPositions(updates) {
    setOptimisticPos((o) => {
      const n = { ...o };
      for (const u of updates) n[u.doc._id] = u.position;
      return n;
    });
    setSaving((n) => n + 1);
    Promise.all(updates.map((u) => database.put({ ...u.doc, position: u.position })))
      .catch((e) => {
        console.error("[shared-lists] reorder failed", e);
        setOptimisticPos((o) => {
          const n = { ...o };
          for (const u of updates) delete n[u.doc._id];
          return n;
        });
      })
      .finally(() => setSaving((n) => n - 1));
  }

  function nudge(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const a = items[i];
    const b = items[j];
    commitPositions([
      { doc: a, position: b.position },
      { doc: b, position: a.position },
    ]);
  }

  // Pointer-based drag from the grip — works on desktop AND iOS Safari (native
  // HTML5 drag-and-drop never fires on touch). Reorders optimistically on the fly
  // (fast paint), then persists the final position on release.
  function startDrag(e, it) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragIdRef.current = it._id;
    setDragId(it._id);
  }

  function onDragMove(e) {
    const id = dragIdRef.current;
    if (!id) return;
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-item-id]");
    const overId = row?.getAttribute("data-item-id");
    if (!overId || overId === id) return;
    const rect = row.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    const without = items.filter((d) => d._id !== id);
    let idx = without.findIndex((d) => d._id === overId);
    if (idx < 0) return;
    if (after) idx += 1;
    setOptimisticPos((o) => ({ ...o, [id]: positionForDrop(without, idx) }));
  }

  function endDrag() {
    const id = dragIdRef.current;
    if (!id) return;
    dragIdRef.current = null;
    setDragId(null);
    if (!(id in optimisticPos)) return; // a tap with no move — nothing to persist
    const moved = items.find((d) => d._id === id);
    if (moved) commitPositions([{ doc: moved, position: moved.position }]);
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
        <header className="relative px-5 pt-9 pb-4">
          <h1 style={FONT_DISPLAY} className="text-4xl font-bold tracking-tight">
            Shared Lists
          </h1>
          <p style={FONT_MONO} className="mt-1.5 text-xs uppercase tracking-wider text-[var(--comp-muted)]">
            make a list · add friends · drag to reorder
          </p>
          {/* Absolutely positioned so toggling visibility never reflows the header. */}
          <span
            style={FONT_MONO}
            className={
              "absolute right-5 top-9 flex items-center gap-1.5 rounded-full border border-[var(--comp-border)] bg-[var(--comp-surface)] px-2.5 py-1 text-[11px] text-[var(--comp-muted)] transition-opacity " +
              (saving > 0 ? "opacity-100" : "pointer-events-none opacity-0")
            }
            aria-hidden={saving === 0}
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--comp-accent)]" />
            Saving…
          </span>
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
              {items.map((it, i) => (
                <li
                  key={it._id}
                  data-item-id={it._id}
                  className={
                    "group flex select-none items-center gap-2 py-3 pr-4 pl-2 transition " +
                    CARD +
                    (dragId === it._id ? " opacity-60 ring-2 ring-[var(--comp-accent)]" : " hover:border-[var(--comp-accent)]")
                  }
                >
                  <span
                    onPointerDown={(e) => startDrag(e, it)}
                    onPointerMove={onDragMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    className="-my-3 grid shrink-0 cursor-grab touch-none select-none place-items-center self-stretch px-2 text-[var(--comp-muted)] opacity-60 hover:opacity-100"
                    aria-label="drag to reorder"
                  >
                    <IconGrip size={20} />
                  </span>
                  <button
                    onClick={() => toggle(it, it.done)}
                    aria-label={it.done ? "mark not done" : "mark done"}
                    className={
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition " +
                      (it.done
                        ? "border-transparent bg-[var(--comp-done)] text-[var(--comp-accent-text)]"
                        : "border-[var(--comp-border)] bg-transparent text-transparent hover:border-[var(--comp-accent)]")
                    }
                  >
                    <IconCheck size={14} />
                  </button>
                  <span className={"flex-1 break-words " + (it.done ? "text-[var(--comp-muted)] line-through" : "")}>
                    {it.text}
                  </span>
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
                      disabled={i === items.length - 1}
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
              ))}

              {writeVerdict?.ok ? (
                <li>
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
