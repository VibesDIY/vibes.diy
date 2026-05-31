import React, { useState, useEffect, useMemo } from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const FESTIVAL_TZ = "America/Los_Angeles";

const hasExplicitTZ = (s) => /([+-]\d\d:\d\d|Z)$/.test(s);
const ensureT = (s = "") => (s.includes("T") ? s : s.replace(" ", "T"));

// Offset (in minutes) between `tz` and UTC at the moment `date` represents.
const tzOffsetMinutes = (date, tz) => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asIfUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asIfUTC - date.getTime()) / 60000;
};

// Parse a naive "YYYY-MM-DDTHH:MM:SS" as a wall-clock time in `tz`.
const parseInTZ = (naive, tz) => {
  const utcGuess = new Date(naive + "Z");
  if (isNaN(utcGuess)) return new Date(NaN);
  const offset = tzOffsetMinutes(utcGuess, tz);
  return new Date(utcGuess.getTime() - offset * 60000);
};

// Turn either a TZ-aware ISO string or a naive Pacific string into an absolute Date.
const toFestivalDate = (s) => {
  if (!s) return new Date(NaN);
  const t = ensureT(s);
  return hasExplicitTZ(t) ? new Date(t) : parseInTZ(t, FESTIVAL_TZ);
};

const FESTIVAL_2026 = {
  dayOrder: ["Thursday", "Friday", "Saturday", "Sunday", "Monday"],
  dates: {
    Thursday: "2026-07-30",
    Friday: "2026-07-31",
    Saturday: "2026-08-01",
    Sunday: "2026-08-02",
    Monday: "2026-08-03",
  },
  fallbackStart: "2026-07-30T00:00:00",
};

const LOGO_URL = "https://pickathon.com/wp-content/themes/pickathon/images/2026/_logo_head.png";

export default function PickathonPicker() {
  const { database, useLiveQuery, useDocument } = useFireproof("pickathon-festival");
  const { viewer, can, ViewerTag } = useViewer();
  const canWrite = can("write");
  const userId = viewer?.userSlug || "anonymous";

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDay, setSelectedDay] = useState("all");
  const [view, setView] = useState("browse");
  const [superMode, setSuperMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("super") === "true";
  });
  const [viewingUser, setViewingUser] = useState(null);
  const [eventNotes, setEventNotes] = useState({});
  const [savingNotes, setSavingNotes] = useState({});
  const [originalNotes, setOriginalNotes] = useState({});

  useEffect(() => {
    fetchSchedule();
  }, []);

  useEffect(() => {
    if (!canWrite && view !== "browse") setView("browse");
  }, [canWrite, view]);

  // If arriving via a connect link, record the friendship once we know who we are
  useEffect(() => {
    if (typeof window === "undefined" || !canWrite || !viewer?.userSlug) return;
    const params = new URLSearchParams(window.location.search);
    const friendSlug = params.get("friend");
    if (!friendSlug || friendSlug === viewer.userSlug) return;
    database
      .put({
        _id: `friend-${viewer.userSlug}-${friendSlug}`,
        type: "friend",
        userId: viewer.userSlug,
        friendSlug,
        createdAt: Date.now(),
      })
      .catch(() => {});
  }, [canWrite, viewer?.userSlug]);

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
          title: e.title,
          start,
          end,
          url: e.url,
          venueTitle: v.title,
          venueColor: v.color,
          lineup: e.lineup || {},
          day: toFestivalDate(start).toLocaleDateString("en-US", { weekday: "long", timeZone: FESTIVAL_TZ }),
        });
      }
    }
    setEvents(list);
  };

  const toDate = toFestivalDate;
  const fmtTime = (s) => toDate(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: FESTIVAL_TZ });
  const fmtDate = (s) =>
    toDate(s).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: FESTIVAL_TZ });

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

  // Shifts and notes are user-scoped via compound index
  const { docs: shifts } = useLiveQuery((doc) => [doc.type, doc.userId], { key: ["shift", userId] });
  const { docs: notesDocs } = useLiveQuery((doc) => [doc.type, doc.userId], { key: ["note", userId] });
  const notes = Object.fromEntries(notesDocs.map((n) => [n.eventId, n.notes]));

  // Favorites are fetched globally for peer-mode counts and viewer switching
  const { docs: allFavorites } = useLiveQuery("type", { key: "favorite" });

  // Friends recorded by the current viewer
  const { docs: friends } = useLiveQuery((doc) => [doc.type, doc.userId], { key: ["friend", userId] });

  // People who have added me as a friend (reverse direction)
  const { docs: friendedBy } = useLiveQuery((doc) => [doc.type, doc.friendSlug], { key: ["friend", userId] });

  // Global counts: how many distinct users have favorited each event
  const favCounts = useMemo(() => {
    const m = {};
    for (const f of allFavorites) {
      m[f.eventId] = (m[f.eventId] || 0) + 1;
    }
    return m;
  }, [allFavorites]);

  // Unique users who have favorited anything (for super-mode peer list)
  const favUsers = useMemo(() => {
    const map = new Map();
    for (const f of allFavorites) {
      const uid = f.userId || "anonymous";
      if (!map.has(uid)) map.set(uid, { userId: uid, count: 0 });
      map.get(uid).count++;
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [allFavorites]);

  // My own favorites are always based on userId, regardless of viewingUser
  const myFavorites = allFavorites.filter((f) => (f.userId || "anonymous") === userId);
  const myFavIds = new Set(myFavorites.map((f) => f.eventId));

  // In super mode we can view another user's favorites; otherwise show mine
  const activeUserId = superMode && viewingUser ? viewingUser : userId;
  const viewFavorites = allFavorites.filter((f) => (f.userId || "anonymous") === activeUserId);
  const favIds = new Set(viewFavorites.map((f) => f.eventId));

  useEffect(() => {
    const newEventNotes = {},
      newOriginalNotes = {};
    notesDocs.forEach((n) => {
      newEventNotes[n.eventId] = n.notes;
      newOriginalNotes[n.eventId] = n.notes;
    });
    setEventNotes((prev) => ({ ...newEventNotes, ...prev }));
    setOriginalNotes((prev) => ({ ...newOriginalNotes, ...prev }));
  }, [notesDocs]);

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
  } = useDocument({ type: "shift", day: "Thursday", startTime: "09:00", endTime: "17:00", kind: "Shift" });

  // Store extras as naive Pacific wall-clock time. toFestivalDate() interprets
  // them in FESTIVAL_TZ on read, so they stay anchored to the festival regardless
  // of what timezone the device is in when reading or writing.
  const storeShiftTime = (dayISO, time) => `${dayISO}T${time}:00`;

  const submitShift = async (e) => {
    e?.preventDefault();
    const dayISO = getDateForDay(shiftForm.day);
    await database.put({
      type: "shift",
      userId,
      day: shiftForm.day,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      start: storeShiftTime(dayISO, shiftForm.startTime),
      end: storeShiftTime(dayISO, shiftForm.endTime),
      kind: shiftForm.kind || "Shift",
    });
    resetShift();
  };

  const toggleFavorite = async (event) => {
    const myFav = myFavorites.find((f) => f.eventId === event.eventId);
    if (myFav) {
      await database.del(myFav._id);
    } else {
      await database.put({ _id: `favorite-${userId}-${event.eventId}`, type: "favorite", userId, eventId: event.eventId });
    }
  };

  const saveEventNote = async (eventId) => {
    const noteText = eventNotes[eventId] || "";
    setSavingNotes((prev) => ({ ...prev, [eventId]: true }));
    try {
      const existing = notesDocs.find((n) => n.eventId === eventId);
      if (existing) await database.put({ ...existing, notes: noteText });
      else await database.put({ _id: `note-${userId}-${eventId}`, type: "note", userId, eventId, notes: noteText });
      setOriginalNotes((prev) => ({ ...prev, [eventId]: noteText }));
      setTimeout(() => setSavingNotes((prev) => ({ ...prev, [eventId]: false })), 500);
    } catch (err) {
      console.error("Failed to save note:", err);
      setSavingNotes((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const handleNoteChange = (eventId, value) => setEventNotes((prev) => ({ ...prev, [eventId]: value }));
  const handleNoteBlur = (eventId) => {
    if ((eventNotes[eventId] || "") !== (originalNotes[eventId] || "")) saveEventNote(eventId);
  };
  const handleNoteFocus = (eventId) => setOriginalNotes((prev) => ({ ...prev, [eventId]: eventNotes[eventId] || "" }));
  const deleteShift = async (shiftId) => {
    await database.del(shiftId);
  };

  const shiftStartRaw = (s) => s.start ?? s.startISO ?? `${getDateForDay(s.day)}T${s.startTime}:00`;
  const shiftEndRaw = (s) => s.end ?? s.endISO ?? `${getDateForDay(s.day)}T${s.endTime}:00`;

  const filteredEvents = events
    .filter((e) => e.title.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedDay === "all" || e.day === selectedDay))
    .sort((a, b) => toDate(a.start) - toDate(b.start));

  // favoriteEvents reflects the active viewer (me or a peer in super mode)
  const favoriteEvents = events.filter((e) => favIds.has(e.eventId)).sort((a, b) => toDate(a.start) - toDate(b.start));

  const makeSchedule = (day) => {
    const ev = favoriteEvents.filter((e) => e.day === day);
    const sh = shifts.filter((s) => s.day === day);
    return [
      ...ev.map((e) => ({ type: "event", id: e.eventId, title: e.title, sort: toDate(e.start), venue: e.venueTitle, data: e })),
      ...sh.map((s) => ({ type: "shift", id: s._id, sort: toDate(shiftStartRaw(s)), data: s })),
    ].sort((a, b) => a.sort - b.sort || (a.type === "shift" ? -1 : 1));
  };

  const c = {
    pageBg: "bg-[#EEE]",
    cardBg: "bg-white",
    headerBg: "bg-[#BACD32]",
    navBg: "bg-[#71AD44]",
    bodyText: "text-[#4A4A4A]",
    border: "border-[#4A4A4A]",
    pinkBg: "bg-[#CD6C0C]",
    eventCard: "bg-[#BACD32] rounded-2xl border-4 border-[#4A4A4A] p-4 shadow-lg",
    favCard: "bg-[#71AD44] rounded-2xl border-4 border-[#4A4A4A] p-4 shadow-lg",
    shiftCard: "bg-[#71AD44] rounded-2xl border-4 border-[#4A4A4A] p-4",
    schedDay: "mb-6 bg-[#71AD44] rounded-2xl border-4 border-[#4A4A4A] p-4",
    schedShift: "rounded-xl border-2 border-[#4A4A4A] p-3 bg-[#BACD32]",
    schedEvent: "rounded-xl border-2 border-[#4A4A4A] p-3 bg-white",
    input: "p-3 border-4 border-[#4A4A4A] rounded-xl font-bold text-[#4A4A4A] bg-white",
    navBtn: (active) =>
      `px-6 py-3 font-bold rounded-2xl border-4 border-[#4A4A4A] transition-all ${active ? "bg-[#4A4A4A] text-white" : "bg-white text-[#4A4A4A] hover:bg-[#BACD32]"}`,
    btnPink: "bg-[#CD6C0C] text-white font-bold py-3 px-6 rounded-2xl border-4 border-[#4A4A4A] hover:opacity-90 transition-all",
    btnCyan: "bg-[#71AD44] text-white font-bold py-3 px-6 rounded-2xl border-4 border-[#4A4A4A] hover:opacity-90 transition-all",
    badge: "bg-[#CD6C0C] text-white px-3 py-1 rounded-full text-sm font-bold border-2 border-[#4A4A4A]",
    favToggleOn: "p-3 rounded-2xl border-4 border-[#4A4A4A] font-bold transition-all bg-[#CD6C0C] text-white hover:opacity-90",
    favToggleOff: "p-3 rounded-2xl border-4 border-[#4A4A4A] font-bold transition-all bg-white text-[#4A4A4A] hover:bg-[#BACD32]",
    linkBtn: "p-3 bg-white text-[#4A4A4A] rounded-2xl border-4 border-[#4A4A4A] hover:bg-[#BACD32] transition-all",
    noteArea: "w-full p-2 border-2 border-[#4A4A4A] rounded-xl resize-none text-sm text-[#4A4A4A] bg-white",
    deleteBtn: "p-3 bg-[#B22222] text-white rounded-2xl border-2 border-[#4A4A4A] hover:opacity-80 transition-all",
    noteBox: "mt-2 p-2 bg-white rounded-lg border-2 border-[#4A4A4A]",
    shiftForm: "bg-[#BACD32] rounded-2xl border-4 border-[#4A4A4A] p-6 mb-6",
    spinner: "w-4 h-4 border-2 border-[#4A4A4A] rounded-full animate-spin border-t-transparent",
    readOnlyBanner: "mt-2 bg-white text-[#4A4A4A] px-3 py-2 rounded-lg text-sm font-bold border-2 border-[#4A4A4A]",
  };

  if (loading && events.length === 0) {
    return (
      <div className={`min-h-screen ${c.pageBg} p-4`}>
        <div className={`max-w-4xl mx-auto ${c.cardBg} rounded-3xl shadow-2xl border-8 ${c.border} p-8`}>
          <div className="flex items-center justify-center gap-4">
            <div className={`w-16 h-16 border-8 border-[#71AD44] rounded-full animate-spin border-t-transparent`}></div>
            <h2 className={`text-3xl font-black ${c.bodyText}`}>Loading Pickathon Schedule...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className={`min-h-screen ${c.pageBg} p-4`}>
        <div className={`max-w-4xl mx-auto ${c.cardBg} rounded-3xl shadow-2xl border-8 ${c.border} p-8`}>
          <h2 className={`text-3xl font-black mb-4 ${c.bodyText}`}>Error Loading Schedule</h2>
          <p className={`text-lg ${c.bodyText} mb-4`}>{error}</p>
          <button onClick={fetchSchedule} className={c.btnPink}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${c.pageBg} p-4`}>
      <div className={`max-w-6xl mx-auto ${c.cardBg} rounded-3xl shadow-2xl border-8 ${c.border} overflow-hidden`}>
        {/* Header */}
        <div className={`${c.headerBg} border-b-8 ${c.border} p-6`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <a href="https://pickathon.com" target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img src={LOGO_URL} alt="Pickathon" className="h-32 w-auto" />
              </a>
              <div>
                <h1 className={`text-4xl font-black ${c.bodyText} mb-1`}>
                  {superMode ? "🎶 PICKATHON PICKER" : "PICKATHON PICKER"}
                </h1>
                <p className={`${c.bodyText} text-base font-bold`}>Jul 30 – Aug 2, 2026 · Pendarvis Farm, OR</p>
                <p className={`${c.bodyText} text-sm mt-1`}>
                  <em>Discover, favorite, and organize your perfect festival experience</em>
                </p>
              </div>
            </div>
            <ViewerTag />
          </div>
          {error && error.includes("cached") && (
            <div className={`mt-2 ${c.pinkBg} text-white px-3 py-2 rounded-lg text-sm font-bold`}>{error}</div>
          )}
          {!canWrite && <div className={c.readOnlyBanner}>Sign in to save your favorites.</div>}
        </div>

        {/* Navigation */}
        <div className={`${c.navBg} border-b-8 ${c.border} p-4`}>
          <div className="flex flex-wrap gap-3">
            {["browse", "favorites", "friends", "shifts", "schedule"]
              .filter((v) => v === "browse" || (v === "favorites" ? superMode && canWrite : v === "friends" ? canWrite : canWrite))
              .map((viewName) => (
                <button key={viewName} onClick={() => setView(viewName)} className={c.navBtn(view === viewName)}>
                  {viewName === "browse" && `Browse Events`}
                  {viewName === "favorites" && `Favorites (${myFavIds.size})`}
                  {viewName === "friends" && `Friends`}
                  {viewName === "shifts" && `Extras (${shifts.length})`}
                  {viewName === "schedule" && `My Schedule`}
                </button>
              ))}
            <a
              href="https://pickathon.com/wp-content/uploads/2025/07/2025-Pickathon-Festival-Map_Web_Hyperlinks.pdf"
              target="map"
              rel="noopener noreferrer"
              className={c.navBtn(false)}
            >
              Map (PDF)
            </a>
          </div>
        </div>

        <div className="p-6">
          {/* ——— BROWSE ——— */}
          {view === "browse" && (
            <div>
              <div className="mb-6 flex flex-wrap gap-4">
                <input
                  type="text"
                  placeholder="Search for artists..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`flex-1 min-w-64 p-4 border-4 ${c.border} rounded-2xl text-lg font-bold ${c.bodyText}`}
                />
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className={`p-4 border-4 ${c.border} rounded-2xl font-bold bg-white ${c.bodyText}`}
                >
                  <option value="all">All Days</option>
                  {displayDays.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4">
                {filteredEvents.map((event) => (
                  <div key={event.eventId} className={myFavIds.has(event.eventId) ? c.favCard : c.eventCard}>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {superMode && favCounts[event.eventId] > 0 && (
                            <span className={c.badge} title="People who picked this">
                              ★ {favCounts[event.eventId]}
                            </span>
                          )}
                          <h3 className={`text-xl font-black ${c.bodyText}`}>{event.title}</h3>
                          <span className={c.badge}>{event.lineup?.id || "music"}</span>
                          {savingNotes[event.eventId] && <div className={c.spinner}></div>}
                        </div>
                        <div className={`space-y-1 text-sm font-bold ${c.bodyText}`}>
                          <p>{event.venueTitle}</p>
                          <p>{fmtDate(event.start)}</p>
                          <p>
                            {fmtTime(event.start)} – {fmtTime(event.end)}
                          </p>
                        </div>
                        {canWrite ? (
                          <div className="mt-3">
                            <textarea
                              placeholder="Add your notes about this artist..."
                              value={eventNotes[event.eventId] || ""}
                              onChange={(e) => handleNoteChange(event.eventId, e.target.value)}
                              onBlur={() => handleNoteBlur(event.eventId)}
                              onFocus={() => handleNoteFocus(event.eventId)}
                              className={c.noteArea}
                              rows="2"
                            />
                          </div>
                        ) : notes[event.eventId] ? (
                          <div className={c.noteBox}>
                            <p className={`text-sm font-bold ${c.bodyText}`}>{notes[event.eventId]}</p>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        {canWrite && (
                          <button
                            onClick={() => toggleFavorite(event)}
                            className={myFavIds.has(event.eventId) ? c.favToggleOn : c.favToggleOff}
                          >
                            {myFavIds.has(event.eventId) ? "♥" : "♡"}
                          </button>
                        )}
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={c.linkBtn}
                          title="View artist page"
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#4A4A4A"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {searchTerm && filteredEvents.length === 0 && (
                <div className="text-center py-12">
                  <h3 className={`text-2xl font-black mb-2 ${c.bodyText}`}>No events found</h3>
                  <p className={c.bodyText}>Try searching for a different artist name</p>
                </div>
              )}
            </div>
          )}

          {/* ——— FAVORITES ——— */}
          {view === "favorites" && superMode && (
            <div className="mb-6 p-4 bg-[#BACD32] rounded-2xl border-4 border-[#4A4A4A]">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className={`text-lg font-black ${c.bodyText}`}>
                  {viewingUser ? `Viewing ${viewingUser}'s picks` : "Pickers (tap to view their picks)"}
                </h3>
                {viewingUser && (
                  <button onClick={() => setViewingUser(null)} className={c.btnCyan}>
                    Back to my picks
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {favUsers.map((u) => (
                  <button
                    key={u.userId}
                    onClick={() => setViewingUser(u.userId === userId ? null : u.userId)}
                    className={`flex items-center gap-2 p-1 rounded-full border-2 border-[#4A4A4A] transition-all ${
                      viewingUser === u.userId || (!viewingUser && u.userId === userId)
                        ? "bg-[#CD6C0C]"
                        : "bg-white hover:bg-[#71AD44]"
                    }`}
                    title={`${u.count} pick${u.count === 1 ? "" : "s"}`}
                  >
                    <ViewerTag userSlug={u.userId} />
                    <span className={`pr-3 font-bold text-sm ${c.bodyText}`}>{u.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === "favorites" && (
            <div>
              <h2 className={`text-2xl font-black mb-6 ${c.bodyText}`}>Your Favorite Events</h2>
              {favoriteEvents.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className={`text-2xl font-black mb-2 ${c.bodyText}`}>No favorites yet!</h3>
                  <p className={c.bodyText}>Browse events and click the heart to add them here</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {favoriteEvents.map((event) => (
                    <div key={event.eventId} className={c.favCard}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-xl font-black text-white mb-1">{event.title}</h3>
                          <div className="space-y-1 text-sm font-bold text-white">
                            <p>{event.venueTitle}</p>
                            <p>{fmtDate(event.start)}</p>
                            <p>
                              {fmtTime(event.start)} – {fmtTime(event.end)}
                            </p>
                          </div>
                          {notes[event.eventId] && (
                            <div className={c.noteBox}>
                              <p className={`text-sm font-bold ${c.bodyText}`}>{notes[event.eventId]}</p>
                            </div>
                          )}
                        </div>
                        {canWrite && (
                          <button
                            onClick={() => toggleFavorite(event)}
                            className="p-2 bg-white rounded-2xl border-2 border-[#4A4A4A] hover:bg-[#BACD32] transition-all ml-3"
                          >
                            <span className="text-[#CD6C0C] font-black text-lg">♥</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ——— FRIENDS ——— */}
          {view === "friends" && (
            <div>
              <h2 className={`text-2xl font-black mb-6 ${c.bodyText}`}>Connect with Friends</h2>

              <div className="mb-6 p-6 bg-white rounded-2xl border-4 border-[#4A4A4A]">
                <h3 className={`text-xl font-black mb-4 ${c.bodyText}`}>Added You ({friendedBy.length})</h3>
                {friendedBy.length === 0 ? (
                  <p className={`font-bold ${c.bodyText}`}>Nobody has scanned your QR yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-3 mb-6">
                    {friendedBy.map((f) => (
                      <div
                        key={`by-${f._id}`}
                        className="flex items-center gap-2 p-2 bg-[#71AD44] rounded-full border-2 border-[#4A4A4A]"
                      >
                        <ViewerTag userSlug={f.userId} />
                      </div>
                    ))}
                  </div>
                )}
                <h3 className={`text-xl font-black mb-4 ${c.bodyText}`}>Your Friends ({friends.length})</h3>
                {friends.length === 0 ? (
                  <p className={`font-bold ${c.bodyText}`}>No friends yet — share your QR code below to connect.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {friends.map((f) => (
                      <div key={f._id} className="flex items-center gap-2 p-2 bg-[#BACD32] rounded-full border-2 border-[#4A4A4A]">
                        <ViewerTag userSlug={f.friendSlug} />
                        {canWrite && (
                          <button
                            onClick={() => database.del(f._id)}
                            className="px-2 py-1 bg-[#B22222] text-white rounded-full border-2 border-[#4A4A4A] text-xs font-bold hover:opacity-80"
                            title="Remove friend"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-4 p-6 bg-[#BACD32] rounded-2xl border-4 border-[#4A4A4A]">
                {(() => {
                  const url = new URL("https://vibes.diy/vibe/og/pickathon-picker/");
                  url.searchParams.set("friend", userId);
                  const connectUrl = url.toString();
                  return (
                    <>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(connectUrl)}`}
                        alt="Connect QR"
                        className="w-60 h-60 bg-white p-2 rounded-2xl border-4 border-[#4A4A4A]"
                      />
                      <a href={connectUrl} target="_blank" rel="noopener noreferrer" className={c.btnPink}>
                        Connect
                      </a>
                      <p className={`text-xs font-bold ${c.bodyText} break-all text-center max-w-md`}>{connectUrl}</p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ——— SHIFTS ——— */}
          {view === "shifts" && (
            <div>
              <h2 className={`text-2xl font-black mb-6 ${c.bodyText}`}>Manage Your Extras</h2>
              {canWrite && (
                <div className={c.shiftForm}>
                  <h3 className={`text-xl font-black mb-4 ${c.bodyText}`}>Add Extra Events</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <select value={shiftForm.day} onChange={(e) => mergeShift({ day: e.target.value })} className={c.input}>
                      {displayDays.map((day) => (
                        <option key={day} value={day}>
                          {day} ({getDateForDay(day)})
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={shiftForm.startTime}
                      onChange={(e) => mergeShift({ startTime: e.target.value })}
                      className={c.input}
                    />
                    <input
                      type="time"
                      value={shiftForm.endTime}
                      onChange={(e) => mergeShift({ endTime: e.target.value })}
                      className={c.input}
                    />
                    <input
                      type="text"
                      placeholder="Shift, Meal, Break, …"
                      value={shiftForm.kind || ""}
                      onChange={(e) => mergeShift({ kind: e.target.value })}
                      className={c.input}
                    />
                  </div>
                  <button onClick={submitShift} className={`mt-4 ${c.btnCyan}`}>
                    Add Extra
                  </button>
                </div>
              )}

              <div className="grid gap-4">
                {shifts.map((shift) => {
                  const shiftStart = shiftStartRaw(shift);
                  const shiftEnd = shiftEndRaw(shift);
                  return (
                    <div key={shift._id} className={c.shiftCard}>
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className={`text-xl font-black ${c.bodyText}`}>{shift.kind || shift.title || "Shift"}</h3>
                          <p className={`font-bold ${c.bodyText}`}>
                            {shift.day} ({getDateForDay(shift.day)}) — {fmtTime(shiftStart)} to {fmtTime(shiftEnd)}
                          </p>
                        </div>
                        {canWrite && (
                          <button onClick={() => deleteShift(shift._id)} className={c.deleteBtn} title="Delete shift">
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {shifts.length === 0 && (
                <div className="text-center py-12">
                  <h3 className={`text-2xl font-black mb-2 ${c.bodyText}`}>No extras scheduled</h3>
                  <p className={c.bodyText}>Use the form above to add shifts, meals, breaks, or anything else</p>
                </div>
              )}
            </div>
          )}

          {/* ——— SCHEDULE ——— */}
          {view === "schedule" && (
            <div>
              <h2 className={`text-2xl font-black mb-6 ${c.bodyText}`}>My Personal Festival Schedule</h2>
              {displayDays.map((day) => {
                const daySchedule = makeSchedule(day);
                if (daySchedule.length === 0) return null;
                return (
                  <div key={day} className={c.schedDay}>
                    <h3 className="text-xl font-black mb-4 text-white">
                      {day} — {getDateForDay(day)}
                    </h3>
                    <div className="space-y-3">
                      {daySchedule.map((item) => {
                        const itemStart = item.type === "shift" ? shiftStartRaw(item.data) : item.data.start;
                        const itemEnd = item.type === "shift" ? shiftEndRaw(item.data) : item.data.end;
                        return (
                          <div key={`${item.type}-${item.id}`} className={item.type === "shift" ? c.schedShift : c.schedEvent}>
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h4 className={`font-black ${c.bodyText}`}>
                                    {item.type === "shift" ? item.data.kind || item.data.title || "Shift" : item.title}
                                  </h4>
                                  {item.type === "event" && (
                                    <button
                                      onClick={() => toggleFavorite(item.data)}
                                      className="p-1 bg-[#CD6C0C] text-white rounded-lg border-2 border-[#4A4A4A] text-xs font-bold px-2"
                                    >
                                      ♥
                                    </button>
                                  )}
                                </div>
                                <p className={`text-sm font-bold ${c.bodyText}`}>
                                  {fmtTime(itemStart)} – {fmtTime(itemEnd)}
                                  {item.type === "event" && ` · ${item.venue}`}
                                </p>
                                {item.type === "event" && notes[item.data.eventId] && (
                                  <div className={`mt-2 p-2 bg-[#EEE] rounded-lg border border-[#4A4A4A]`}>
                                    <p className={`text-sm font-bold ${c.bodyText}`}>{notes[item.data.eventId]}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {favoriteEvents.length === 0 && shifts.length === 0 && (
                <div className="text-center py-12">
                  <h3 className={`text-2xl font-black mb-2 ${c.bodyText}`}>No events or shifts scheduled</h3>
                  <p className={c.bodyText}>Add some favorites and shifts to see your personalized schedule!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
