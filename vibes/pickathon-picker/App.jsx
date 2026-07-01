import React, { useState, useEffect, useMemo, useRef } from "react";
import { useViewer, useVibe } from "use-vibes";
import { useVibeStore } from "./vibe-store.js";
import {
  FESTIVAL_TZ,
  FESTIVAL_2026,
  LOGO_URL,
  ensureT,
  toFestivalDate,
  festivalDayFor,
  fmtTime,
  fmtDate,
  decodeEntities,
} from "./festival-utils.js";
import { c } from "./styles.js";
import ScheduleView from "./ScheduleView.jsx";
import BandsView from "./BandsView.jsx";
import NowView from "./NowView.jsx";
import BrowseView from "./BrowseView.jsx";
import FavoritesView from "./FavoritesView.jsx";
import FriendsView from "./FriendsView.jsx";
import ShiftsView from "./ShiftsView.jsx";

// Re-stamp a locally-stored doc onto the freshly signed-in handle when vibe-store
// migrates localStorage → Fireproof on first login. Owned docs are keyed by user,
// so favorites/notes re-key deterministically; shifts get a fresh _id.
// A friend-connect link arrives as `?friend=<handle>` on the vibes.diy URL, which
// the platform mirrors onto the app's own iframe URL. Read it, then strip it so a
// visitor who copies their address bar doesn't re-share someone else's friend link.
const readFriendParam = () => {
  try {
    const own = new URLSearchParams(window.location.search).get("friend");
    if (own) return own;
  } catch (e) {}
  try {
    if (window.top && window.top !== window) return new URLSearchParams(window.top.location.search).get("friend");
  } catch (e) {}
  return null;
};
const clearFriendParamFromUrl = () => {
  const strip = (loc, hist) => {
    try {
      const u = new URL(loc.href);
      if (u.searchParams.has("friend")) {
        u.searchParams.delete("friend");
        hist.replaceState(null, "", u.pathname + u.search + u.hash);
      }
    } catch (e) {}
  };
  strip(window.location, window.history);
  // The parent vibes.diy URL is cross-origin, so this usually no-ops — best effort.
  try {
    if (window.top && window.top !== window) strip(window.top.location, window.top.history);
  } catch (e) {}
};

// Stable index functions — passed to useLiveQuery so Fireproof doesn't rebuild the
// query on every render (an inline arrow is a new reference each time).
const byTypeUser = (doc) => [doc.type, doc.userId];
const byTypeFriendSlug = (doc) => [doc.type, doc.friendSlug];

// A layered Pacific-Northwest forestscape for the header's bottom edge: two rows of
// tiered Christmas trees at varying heights that overlap, drawn once as a static SVG
// (no animation → zero repaint tax). Each tree is three stacked tiers with stepped
// ledges down both flanks up to a pointy top. The back row is a shade darker and
// shorter (depth); the interleaved front row is the nav color so it reads continuous
// with the green stripe below. viewBox is 1200 wide, baseline y=40.
const RIDGE_BASELINE = 40;
const tree = (cx, w, h) => {
  const B = RIDGE_BASELINE;
  const y1 = B - h / 3;
  const y2 = B - (2 * h) / 3;
  const y3 = B - h;
  const x = (k) => Math.round((cx + k * w) * 10) / 10;
  const y = (v) => Math.round(v * 10) / 10;
  return (
    `M${x(-1)},${B} L${x(-0.375)},${y(y1)} L${x(-0.7)},${y(y1)} ` +
    `L${x(-0.275)},${y(y2)} L${x(-0.5)},${y(y2)} L${x(0)},${y(y3)} ` +
    `L${x(0.5)},${y(y2)} L${x(0.275)},${y(y2)} L${x(0.7)},${y(y1)} ` +
    `L${x(0.375)},${y(y1)} L${x(1)},${B} Z`
  );
};
// [centerX, halfWidth, height] — heights vary; rows interleave and overlap.
const FOREST_BACK = [
  [40, 60, 26], [175, 68, 31], [310, 55, 22], [450, 70, 29], [590, 58, 24],
  [730, 66, 31], [870, 60, 25], [1010, 68, 30], [1150, 60, 27],
]
  .map((t) => tree(...t))
  .join(" ");
const FOREST_FRONT = [
  [105, 52, 38], [250, 60, 40], [395, 47, 33], [535, 62, 40], [675, 50, 35],
  [815, 58, 40], [960, 52, 37], [1100, 60, 40],
]
  .map((t) => tree(...t))
  .join(" ");

const migratePickathonDoc = (doc, handle) => {
  if (doc.type === "favorite") return { ...doc, userId: handle, _id: `favorite-${handle}-${doc.eventId}` };
  if (doc.type === "note") return { ...doc, userId: handle, _id: `note-${handle}-${doc.eventId}` };
  if (doc.type === "shift") {
    const { _id, ...rest } = doc;
    return { ...rest, userId: handle };
  }
  return { ...doc, userId: handle };
};

export default function PickathonPicker() {
  const { viewer, ViewerTag } = useViewer();
  // vibe-store is Fireproof when signed in and localStorage when logged out, with
  // the same put/del/useLiveQuery surface — so nothing below branches on auth.
  const { database, useLiveQuery, useDocument, hasAuthedBefore } = useVibeStore("pickathon", {
    migrate: migratePickathonDoc,
  });
  const { can, ready } = useVibe("pickathon");

  const myHandle = viewer?.userHandle || "anonymous";
  const userId = myHandle;
  const signedIn = Boolean(viewer?.userHandle);
  // A returning visitor who has signed in before but is currently logged out: their
  // schedule lives on their account, so steer them to sign in rather than let them
  // start a throwaway second anonymous session they'd never see again.
  const returningLoggedOut = !signedIn && hasAuthedBefore;

  // New logged-out visitors favorite anonymously (localStorage, migrated on sign-in);
  // returning-logged-out visitors are blocked and prompted to sign in. Notes/shifts/
  // friends stay signed-in. Gate signed-in writes on the app's own access.js via
  // useVibe().can — the same fn the server runs.
  const canFavorite = signedIn ? ready && Boolean(can?.create?.({ type: "favorite", userId })?.ok) : !hasAuthedBefore;
  const canWrite = ready && signedIn && Boolean(can?.create?.({ type: "shift", userId })?.ok);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDay, setSelectedDay] = useState("all");
  const [view, setView] = useState("now");
  const [superMode, setSuperMode] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [optimisticFavs, setOptimisticFavs] = useState(() => new Map());
  const [linkedFriend, setLinkedFriend] = useState(null);
  const friendScrolledRef = useRef(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Mobile-first: lock the iframe viewport to device width and disable pinch-zoom
  // so double-tapping a heart never accidentally zooms the page.
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
  }, []);

  useEffect(() => {
    try {
      const w = typeof window !== "undefined" && window.top && window.top !== window ? window.top : window;
      const params = new URLSearchParams(w.location.search);
      if (params.get("super") === "1") setSuperMode(true);
    } catch (e) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("super") === "1") setSuperMode(true);
    }
  }, []);

  // Capture a `?friend=<handle>` link once, then strip it from the URL. Friend
  // features need a login, so we hold the handle and act on it after sign-in.
  useEffect(() => {
    const fp = readFriendParam();
    if (!fp) return;
    setLinkedFriend(fp);
    clearFriendParamFromUrl();
  }, []);

  // Once signed in, record the friendship and jump to that friend's schedule.
  useEffect(() => {
    if (!signedIn || !linkedFriend || linkedFriend === viewer.userHandle) return;
    database
      .put({
        _id: `friend-${viewer.userHandle}-${linkedFriend}`,
        type: "friend",
        userId: viewer.userHandle,
        friendSlug: linkedFriend,
        createdAt: Date.now(),
      })
      .catch(() => {});
    setSelectedFriend(linkedFriend);
    setView("friends");
  }, [signedIn, linkedFriend, viewer?.userHandle, database]);

  // Scroll to the friend's schedule once it's rendered (one-time).
  useEffect(() => {
    if (friendScrolledRef.current || !signedIn || !linkedFriend) return;
    if (view !== "friends" || selectedFriend !== linkedFriend) return;
    const el = document.getElementById("friend-schedule");
    if (el) {
      friendScrolledRef.current = true;
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
    }
  }, [signedIn, linkedFriend, view, selectedFriend, events.length]);

  useEffect(() => {
    if (!pendingDelete) return;
    const handler = (e) => {
      if (!e.target.closest("[data-pending-delete]")) setPendingDelete(null);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [pendingDelete]);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const getCached = () => {
    const data = localStorage.getItem("pickathon-schedule-cache");
    const ts = +localStorage.getItem("pickathon-schedule-timestamp");
    if (!data || !ts) return null;
    return { data: JSON.parse(data), isStale: Date.now() - ts > 600_000 };
  };
  const setCached = (d) => {
    localStorage.setItem("pickathon-schedule-cache", JSON.stringify(d));
    localStorage.setItem("pickathon-schedule-timestamp", Date.now().toString());
  };

  const fetchSchedule = async () => {
    const cached = getCached();
    if (cached && !cached.isStale) {
      ingest(cached.data);
      setLoading(false);
      return;
    }
    if (cached && cached.isStale) {
      ingest(cached.data);
      setLoading(false);
    }
    try {
      const res = await fetch("https://pickathon.com/wp-content/plugins/pickathon/schedule.php");
      const data = await res.json();
      setCached(data);
      ingest(data);
      setError(null);
    } catch (e) {
      console.error(e);
      if (cached) {
        setError("Using cached data");
        ingest(cached.data);
      } else {
        setError("Failed to load schedule");
      }
    } finally {
      setLoading(false);
    }
  };

  const ingest = (data) => {
    const list = [];
    for (const vid in data) {
      const v = data[vid];
      for (const e of v.events) {
        const start = ensureT(e.start);
        const end = ensureT(e.end);
        list.push({
          eventId: e.id,
          title: decodeEntities(e.title),
          start,
          end,
          url: e.url,
          venueTitle: decodeEntities(v.title),
          venueColor: v.color,
          lineup: e.lineup || {},
          day: toFestivalDate(start).toLocaleDateString("en-US", { weekday: "long", timeZone: FESTIVAL_TZ }),
        });
      }
    }
    setEvents(list);
  };

  const getDateForDay = (day) => {
    const evt = events.find((e) => e.day === day);
    if (evt) return evt.start.split("T")[0];
    if (FESTIVAL_2026.dates[day]) return FESTIVAL_2026.dates[day];
    const base = new Date(FESTIVAL_2026.fallbackStart);
    const idx = FESTIVAL_2026.dayOrder.indexOf(day);
    const d = new Date(base);
    d.setDate(base.getDate() + Math.max(0, idx));
    return d.toISOString().split("T")[0];
  };

  const { docs: shifts } = useLiveQuery(byTypeUser, { key: ["shift", userId] });
  const { docs: notesDocs } = useLiveQuery(byTypeUser, { key: ["note", userId] });
  const notes = Object.fromEntries(notesDocs.map((n) => [n.eventId, n.notes]));

  const { docs: allFavorites } = useLiveQuery("type", { key: "favorite" });

  const favCounts = useMemo(() => {
    const m = {};
    for (const f of allFavorites) m[f.eventId] = (m[f.eventId] || 0) + 1;
    return m;
  }, [allFavorites]);

  const favUsers = useMemo(() => {
    const map = new Map();
    for (const f of allFavorites) {
      const uid = f.userId || "anonymous";
      if (!map.has(uid)) map.set(uid, { userId: uid, count: 0 });
      map.get(uid).count++;
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [allFavorites]);

  const myFavorites = allFavorites.filter((f) => (f.userId || "anonymous") === userId);
  const baseFavIds = new Set(myFavorites.map((f) => f.eventId));
  // Optimistic overlay so a heart flips the instant you press it; the live query
  // reconciles once the (networked) write lands, then the overlay entry is cleared.
  const myFavIds = new Set(baseFavIds);
  optimisticFavs.forEach((want, id) => (want ? myFavIds.add(id) : myFavIds.delete(id)));

  const { docs: friends } = useLiveQuery(byTypeUser, { key: ["friend", userId] });
  const { docs: friendedBy } = useLiveQuery(byTypeFriendSlug, { key: ["friend", userId] });

  const friendSlugs = useMemo(() => {
    const s = new Set();
    for (const f of friends) s.add(f.friendSlug);
    for (const f of friendedBy) s.add(f.userId);
    s.delete(userId);
    return s;
  }, [friends, friendedBy, userId]);

  const friendFavIds = useMemo(() => {
    const s = new Set();
    for (const f of allFavorites) {
      if (friendSlugs.has(f.userId || "anonymous")) s.add(f.eventId);
    }
    return s;
  }, [allFavorites, friendSlugs]);

  const friendFavoriteEvents = useMemo(() => {
    if (!selectedFriend) return [];
    const ids = new Set(allFavorites.filter((f) => (f.userId || "anonymous") === selectedFriend).map((f) => f.eventId));
    return events.filter((e) => ids.has(e.eventId)).sort((a, b) => toFestivalDate(a.start) - toFestivalDate(b.start));
  }, [selectedFriend, allFavorites, events]);

  const { docs: allShifts } = useLiveQuery("type", { key: "shift" });
  const friendShifts = useMemo(() => {
    if (!selectedFriend) return [];
    return allShifts.filter((s) => (s.userId || "anonymous") === selectedFriend && s.shareWithFriends);
  }, [selectedFriend, allShifts]);

  // Once the live query catches up to an optimistic flip, drop that overlay entry.
  const baseFavSig = [...baseFavIds].sort().join("|");
  useEffect(() => {
    setOptimisticFavs((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      next.forEach((want, id) => {
        if (baseFavIds.has(id) === want) {
          next.delete(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFavSig]);

  const eventDays = [...new Set(events.map((e) => e.day))];
  const shiftDays = [...new Set(shifts.map((s) => s.day))];
  const allDays = [...new Set([...FESTIVAL_2026.dayOrder, ...eventDays, ...shiftDays])];
  const displayDays = allDays.sort((a, b) => {
    const o = FESTIVAL_2026.dayOrder;
    const ai = o.indexOf(a),
      bi = o.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const {
    doc: shiftForm,
    merge: mergeShift,
    reset: resetShift,
  } = useDocument({ type: "shift", day: "Thursday", startTime: "09:00", endTime: "17:00", kind: "Shift", shareWithFriends: false });

  const storeShiftTime = (dayISO, time) => `${dayISO}T${time}:00`;

  const submitShift = async (e) => {
    e?.preventDefault();
    const dayISO = getDateForDay(shiftForm.day);
    await database.put({
      type: "shift",
      day: shiftForm.day,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      start: storeShiftTime(dayISO, shiftForm.startTime),
      end: storeShiftTime(dayISO, shiftForm.endTime),
      kind: shiftForm.kind || "Shift",
      shareWithFriends: !!shiftForm.shareWithFriends,
      userId,
    });
    resetShift();
  };

  const toggleFavorite = async (event) => {
    const id = event.eventId;
    const want = !myFavIds.has(id);
    // Paint the flip immediately; the live query is the source of truth once the write lands.
    setOptimisticFavs((prev) => new Map(prev).set(id, want));
    try {
      if (!want) {
        const fav = myFavorites.find((f) => f.eventId === id);
        if (fav) await database.del(fav._id);
      } else {
        await database.put({ _id: `favorite-${userId}-${id}`, type: "favorite", eventId: id, userId });
      }
    } catch (e) {
      // A failed write won't reconcile via live query — drop the overlay so the UI reflects reality.
      setOptimisticFavs((prev) => {
        const m = new Map(prev);
        m.delete(id);
        return m;
      });
    }
  };

  // Called by NoteField on blur (not per keystroke). NoteField buffers the text.
  const saveNote = async (eventId, noteText) => {
    const existing = notesDocs.find((n) => n.eventId === eventId);
    if (existing) await database.put({ ...existing, notes: noteText });
    else await database.put({ _id: `note-${userId}-${eventId}`, type: "note", eventId, notes: noteText, userId });
  };

  const deleteShift = async (shiftId) => {
    await database.del(shiftId);
  };

  const shiftStartRaw = (s) => s.start ?? s.startISO ?? `${getDateForDay(s.day)}T${s.startTime}:00`;
  const shiftEndRaw = (s) => s.end ?? s.endISO ?? `${getDateForDay(s.day)}T${s.endTime}:00`;

  const bandsList = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const key = e.title;
      if (!map.has(key)) map.set(key, { title: key, url: e.url, events: [], lineup: e.lineup, venues: new Set() });
      const band = map.get(key);
      band.events.push(e);
      band.venues.add(e.venueTitle);
    }
    for (const b of map.values()) {
      b.events.sort((a, b) => toFestivalDate(a.start) - toFestivalDate(b.start));
      b.venueList = [...b.venues];
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [events]);

  const nowSets = useMemo(() => {
    const t = nowTick;
    return events
      .filter((e) => {
        const s = toFestivalDate(e.start).getTime();
        const en = toFestivalDate(e.end).getTime();
        return s <= t && en > t;
      })
      .sort((a, b) => a.venueTitle.localeCompare(b.venueTitle));
  }, [events, nowTick]);

  const nextSets = useMemo(() => {
    const t = nowTick;
    const byVenue = new Map();
    const sorted = [...events].sort((a, b) => toFestivalDate(a.start) - toFestivalDate(b.start));
    for (const e of sorted) {
      const s = toFestivalDate(e.start).getTime();
      if (s <= t) continue;
      if (!byVenue.has(e.venueTitle)) byVenue.set(e.venueTitle, e);
    }
    return [...byVenue.values()].sort((a, b) => toFestivalDate(a.start) - toFestivalDate(b.start));
  }, [events, nowTick]);

  const filteredEvents = events
    .filter((e) => e.title.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedDay === "all" || e.day === selectedDay))
    .sort((a, b) => toFestivalDate(a.start) - toFestivalDate(b.start));

  const favoriteEvents = events
    .filter((e) => myFavIds.has(e.eventId))
    .sort((a, b) => toFestivalDate(a.start) - toFestivalDate(b.start));

  const makeSchedule = (day) => {
    const ev = favoriteEvents.filter((e) => festivalDayFor(e.start) === day);
    const sh = shifts.filter((s) => festivalDayFor(shiftStartRaw(s)) === day);
    return [
      ...ev.map((e) => ({
        type: "event",
        id: e.eventId,
        title: e.title,
        sort: toFestivalDate(e.start),
        venue: e.venueTitle,
        data: e,
      })),
      ...sh.map((s) => ({ type: "shift", id: s._id, sort: toFestivalDate(shiftStartRaw(s)), data: s })),
    ].sort((a, b) => a.sort - b.sort || (a.type === "shift" ? -1 : 1));
  };

  const makeFriendSchedule = (day) => {
    const ev = friendFavoriteEvents.filter((e) => festivalDayFor(e.start) === day);
    const sh = friendShifts.filter((s) => festivalDayFor(shiftStartRaw(s)) === day);
    return [
      ...ev.map((e) => ({
        type: "event",
        id: e.eventId,
        title: e.title,
        sort: toFestivalDate(e.start),
        venue: e.venueTitle,
        data: e,
      })),
      ...sh.map((s) => ({ type: "shift", id: s._id, sort: toFestivalDate(shiftStartRaw(s)), data: s })),
    ].sort((a, b) => a.sort - b.sort || (a.type === "shift" ? -1 : 1));
  };

  const renderDeleteX = (docId) => (
    <button
      data-pending-delete
      onClick={(e) => {
        e.stopPropagation();
        if (pendingDelete === docId) {
          database.del(docId).catch(() => {});
          setPendingDelete(null);
        } else {
          setPendingDelete(docId);
        }
      }}
      className={c.deleteX(pendingDelete === docId)}
      title={pendingDelete === docId ? "Tap to confirm" : "Remove"}
    >
      {pendingDelete === docId ? "Confirm" : "×"}
    </button>
  );

  // The schedule feed loads behind the full UI: header + nav render immediately,
  // and only the content area shows a loading/error state until events arrive.
  const scheduleLoading = loading && events.length === 0;
  const scheduleError = error && events.length === 0;

  const connectUrl = `https://vibes.diy/vibe/og/pickathon-picker/?friend=${encodeURIComponent(userId)}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(connectUrl)}`;

  return (
    <div className={`min-h-screen ${c.pageBg}`}>
      <div className={`max-w-6xl mx-auto ${c.cardBg} shadow-2xl ${c.border} overflow-hidden`}>
        <div className={`${c.headerBg} ${c.border} p-10 relative isolate`}>
          <svg
            className="absolute inset-x-0 bottom-0 w-full h-[40px] z-0 pointer-events-none"
            viewBox="0 0 1200 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={FOREST_BACK} className="fill-[#5A8F35] dark:fill-[#17260f]" />
            <path d={FOREST_FRONT} className="fill-[#71AD44] dark:fill-[#1d3015]" />
          </svg>
          <div className="flex items-start justify-between gap-4 flex-wrap relative z-10">
            <div className="flex items-center gap-4">
              <a href="https://pickathon.com" target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img src={LOGO_URL} alt="Pickathon" className="h-32 w-auto" />
              </a>
              <div>
                <h1 className={`text-4xl font-black ${c.bodyText} mb-1`}>
                  {superMode ? "SUPER PICKATHON PICKER" : "PICKATHON PICKER"}
                </h1>
                <p className={`${c.bodyText} text-base font-bold`}>Jul 30 – Aug 2, 2026 · Pendarvis Farm, Happy Valley, OR</p>
              </div>
            </div>
          </div>
          {error && error.includes("cached") && (
            <div className={`mt-2 ${c.pinkBg} text-white px-3 py-2 rounded-lg text-sm font-bold relative z-10`}>{error}</div>
          )}
        </div>

        <div className={`${c.navBg} ${c.border} p-8`}>
          <div className="flex flex-wrap gap-3">
            {["now", "browse", "bands", "favorites", "friends", "shifts", "schedule"]
              .filter((v) => {
                if (v === "now" || v === "browse" || v === "bands") return true;
                if (v === "favorites") return superMode && canWrite; // super-mode peer picker
                if (v === "schedule") return canFavorite; // anon can view their own favorites schedule
                return canWrite; // friends + extras need a real sign-in
              })
              .map((viewName) => (
                <button key={viewName} onClick={() => setView(viewName)} className={c.navBtn(view === viewName)}>
                  {viewName === "now" && `Now`}
                  {viewName === "browse" && `All Events`}
                  {viewName === "bands" && `Bands`}
                  {viewName === "favorites" && `Favorites (${myFavIds.size})`}
                  {viewName === "friends" && `🙋‍♀️ Friends`}
                  {viewName === "shifts" && `Extras`}
                  {viewName === "schedule" && `My Faves${myFavIds.size > 0 ? ` (${myFavIds.size})` : ""}`}
                </button>
              ))}
            {superMode && (
              <a
                href="https://pickathon.com/wp-content/uploads/2025/07/2025-Pickathon-Festival-Map_Web_Hyperlinks.pdf"
                target="map"
                rel="noopener noreferrer"
                className={c.navBtn(false)}
              >
                Map (PDF)
              </a>
            )}
          </div>
        </div>

        <div className="p-6">
          {scheduleLoading ? (
            <div className="flex flex-col items-center justify-center gap-5 py-20">
              <div className="w-16 h-16 rounded-full border-4 border-current border-t-transparent animate-spin"></div>
              <h2 className={`text-3xl font-black text-center ${c.bodyText}`}>Loading the schedule...</h2>
            </div>
          ) : scheduleError ? (
            <div className="py-16 text-center">
              <h2 className={`text-3xl font-black mb-4 ${c.bodyText}`}>Couldn't load the schedule</h2>
              <p className={`text-lg ${c.bodyText} mb-4`}>{error}</p>
              <button onClick={fetchSchedule} className={c.btnPink}>
                Retry
              </button>
            </div>
          ) : (
            <>
              {view === "now" && (
            <NowView
              nowSets={nowSets}
              nextSets={nextSets}
              nowTick={nowTick}
              myFavIds={myFavIds}
              friendFavIds={friendFavIds}
              canWrite={canFavorite}
              toggleFavorite={toggleFavorite}
              c={c}
            />
          )}

          {view === "browse" && (
            <BrowseView
              filteredEvents={filteredEvents}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              displayDays={displayDays}
              myFavIds={myFavIds}
              canWrite={canWrite}
              canFavorite={canFavorite}
              toggleFavorite={toggleFavorite}
              notes={notes}
              saveNote={saveNote}
              superMode={superMode}
              favCounts={favCounts}
              c={c}
            />
          )}

          {view === "bands" && (
            <BandsView
              bandsList={bandsList}
              myFavIds={myFavIds}
              canWrite={canFavorite}
              toggleFavorite={toggleFavorite}
              favCounts={favCounts}
              superMode={superMode}
              c={c}
              database={database}
              userId={userId}
            />
          )}

          {view === "favorites" && superMode && (
            <FavoritesView
              favoriteEvents={favoriteEvents}
              favUsers={favUsers}
              viewingUser={viewingUser}
              setViewingUser={setViewingUser}
              userId={userId}
              myFavIds={myFavIds}
              canWrite={canFavorite}
              toggleFavorite={toggleFavorite}
              notes={notes}
              ViewerTag={ViewerTag}
              c={c}
            />
          )}

          {view === "friends" && (
            <FriendsView
              friends={friends}
              friendedBy={friendedBy}
              selectedFriend={selectedFriend}
              setSelectedFriend={setSelectedFriend}
              friendFavoriteEvents={friendFavoriteEvents}
              friendShifts={friendShifts}
              canWrite={canWrite}
              toggleFavorite={toggleFavorite}
              myFavIds={myFavIds}
              displayDays={displayDays}
              getDateForDay={getDateForDay}
              makeFriendSchedule={makeFriendSchedule}
              shiftStartRaw={shiftStartRaw}
              shiftEndRaw={shiftEndRaw}
              fmtTime={fmtTime}
              connectUrl={connectUrl}
              qrSrc={qrSrc}
              renderDeleteX={renderDeleteX}
              pendingDelete={pendingDelete}
              ViewerTag={ViewerTag}
              c={c}
            />
          )}

          {view === "shifts" && (
            <ShiftsView
              shifts={shifts}
              shiftForm={shiftForm}
              mergeShift={mergeShift}
              submitShift={submitShift}
              displayDays={displayDays}
              getDateForDay={getDateForDay}
              shiftStartRaw={shiftStartRaw}
              shiftEndRaw={shiftEndRaw}
              canWrite={canWrite}
              deleteShift={deleteShift}
              database={database}
              c={c}
            />
          )}

          {view === "schedule" && (
            <div>
              <h2 className={`text-2xl font-black mb-6 ${c.bodyText}`}>My Personal Festival Schedule</h2>
              <ScheduleView
                days={displayDays}
                getDateForDay={getDateForDay}
                buildSchedule={makeSchedule}
                fmtTime={fmtTime}
                notes={notes}
                c={c}
                shiftStartRaw={shiftStartRaw}
                shiftEndRaw={shiftEndRaw}
                emptyMessage="No events or shifts scheduled"
                saveNote={saveNote}
                canWrite={canWrite}
                onToggleFavorite={canFavorite ? toggleFavorite : null}
                myFavIds={myFavIds}
                allEvents={events}
                showGaps={true}
              />
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {!signedIn && (
        <div className="fixed left-4 bottom-7 z-40 pointer-events-none">
          <div className={c.signInCallout}>
            {linkedFriend
              ? "Sign in via the Vibes DIY logo to add friends"
              : returningLoggedOut
                ? "Your saved schedule is on your account — sign in via the Vibes DIY logo to see it."
                : "Sign in via the Vibes DIY logo to share your schedule with friends"}
          </div>
        </div>
      )}
    </div>
  );
}
