import React, { useState, useEffect, useMemo } from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const FESTIVAL_TZ = "America/Los_Angeles";

const hasExplicitTZ = (s) => /([+-]\d\d:\d\d|Z)$/.test(s);
const ensureT = (s = "") => (s.includes("T") ? s : s.replace(" ", "T"));

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

const parseInTZ = (naive, tz) => {
  const utcGuess = new Date(naive + "Z");
  if (isNaN(utcGuess)) return new Date(NaN);
  const offset = tzOffsetMinutes(utcGuess, tz);
  return new Date(utcGuess.getTime() - offset * 60000);
};

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

// Map an event's actual datetime to its festival-day bucket using a 4am cutoff.
const festivalDayFor = (dateStr) => {
  const d = toFestivalDate(dateStr);
  if (isNaN(d)) return null;
  const partsFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: FESTIVAL_TZ,
    weekday: "long",
    hourCycle: "h23",
    hour: "2-digit",
  });
  const parts = Object.fromEntries(partsFmt.formatToParts(d).map((p) => [p.type, p.value]));
  const hour = +parts.hour;
  if (hour < 4) {
    const prev = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat("en-US", { timeZone: FESTIVAL_TZ, weekday: "long" }).format(prev);
  }
  return parts.weekday;
};

function ScheduleView({
  days,
  getDateForDay,
  buildSchedule,
  fmtTime,
  notes,
  c,
  shiftStartRaw,
  shiftEndRaw,
  emptyMessage,
  eventNotes,
  savingNotes,
  onNoteChange,
  onNoteBlur,
  onNoteFocus,
  canWrite,
  focusedNote,
  onToggleFavorite,
  myFavIds,
}) {
  const anyContent = days.some((day) => buildSchedule(day).length > 0);
  if (!anyContent) {
    return (
      <div className="text-center py-12">
        <h3 className={`text-2xl font-black mb-2 ${c.bodyText}`}>{emptyMessage}</h3>
      </div>
    );
  }
  return (
    <>
      {days.map((day) => {
        const daySchedule = buildSchedule(day);
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
                          {item.type === "event" && onToggleFavorite && (
                            <button
                              onClick={() => onToggleFavorite(item.data)}
                              className="p-1 bg-[#CD6C0C] text-white rounded-lg border-2 border-[#4A4A4A] text-xs font-bold px-2"
                            >
                              {myFavIds && myFavIds.has(item.data.eventId) ? "♥" : "♡"}
                            </button>
                          )}
                        </div>
                        <p className={`text-sm font-bold ${c.bodyText}`}>
                          {fmtTime(itemStart)} – {fmtTime(itemEnd)}
                          {item.type === "event" && ` · ${item.venue}`}
                        </p>
                        {item.type === "event" &&
                          (canWrite && onNoteChange ? (
                            (() => {
                              const val = (eventNotes && eventNotes[item.data.eventId]) || "";
                              const expanded = focusedNote === item.data.eventId || val.length > 0;
                              return (
                                <div className="mt-2 flex items-center gap-2">
                                  <textarea
                                    placeholder="Add note..."
                                    value={val}
                                    onChange={(e) => onNoteChange(item.data.eventId, e.target.value)}
                                    onBlur={() => onNoteBlur && onNoteBlur(item.data.eventId)}
                                    onFocus={() => onNoteFocus && onNoteFocus(item.data.eventId)}
                                    className={c.noteArea}
                                    rows={expanded ? 2 : 1}
                                  />
                                  {savingNotes && savingNotes[item.data.eventId] && <div className={c.spinner}></div>}
                                </div>
                              );
                            })()
                          ) : notes && notes[item.data.eventId] ? (
                            <div className={`mt-2 p-2 bg-[#EEE] rounded-lg border border-[#4A4A4A]`}>
                              <p className={`text-sm font-bold ${c.bodyText}`}>{notes[item.data.eventId]}</p>
                            </div>
                          ) : null)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function PickathonPicker() {
  const { viewer, can, ViewerTag } = useViewer();
  const { database, useLiveQuery, useDocument } = useFireproof("pickathon");

  const canWrite = can("write");
  const myHandle = viewer?.userHandle || "anonymous";
  const userId = myHandle;

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDay, setSelectedDay] = useState("all");
  const [view, setView] = useState("now");
  const [eventNotes, setEventNotes] = useState({});
  const [savingNotes, setSavingNotes] = useState({});
  const [originalNotes, setOriginalNotes] = useState({});
  const [focusedNote, setFocusedNote] = useState(null);
  const [superMode, setSuperMode] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());

  // Tick every 30s so Now stays fresh
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Super mode is URL-only — easter egg style
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

  // Auto-record friendship from ?friend=<slug>
  useEffect(() => {
    if (!viewer?.userHandle) return;
    let friendParam = null;
    try {
      const w = typeof window !== "undefined" && window.top && window.top !== window ? window.top : window;
      friendParam = new URLSearchParams(w.location.search).get("friend");
    } catch (e) {
      friendParam = new URLSearchParams(window.location.search).get("friend");
    }
    if (friendParam && friendParam !== viewer.userHandle) {
      database
        .put({
          _id: `friend-${viewer.userHandle}-${friendParam}`,
          type: "friend",
          userId: viewer.userHandle,
          friendSlug: friendParam,
          createdAt: Date.now(),
        })
        .catch(() => {});
    }
  }, [viewer?.userHandle, database]);

  // Reset pendingDelete on any unrelated click
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

  const { docs: shifts } = useLiveQuery((doc) => [doc.type, doc.userId], { key: ["shift", userId] });
  const { docs: notesDocs } = useLiveQuery((doc) => [doc.type, doc.userId], { key: ["note", userId] });
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
  const myFavIds = new Set(myFavorites.map((f) => f.eventId));

  const activeUserId = superMode && viewingUser ? viewingUser : userId;
  const viewFavorites = allFavorites.filter((f) => (f.userId || "anonymous") === activeUserId);
  const favIds = new Set(viewFavorites.map((f) => f.eventId));

  // Friends — both directions
  const { docs: friends } = useLiveQuery((doc) => [doc.type, doc.userId], { key: ["friend", userId] });
  const { docs: friendedBy } = useLiveQuery((doc) => [doc.type, doc.friendSlug], { key: ["friend", userId] });

  // Selected friend's favorites
  // All friend user slugs (both directions, deduped)
  const friendSlugs = useMemo(() => {
    const s = new Set();
    for (const f of friends) s.add(f.friendSlug);
    for (const f of friendedBy) s.add(f.userId);
    s.delete(userId);
    return s;
  }, [friends, friendedBy, userId]);

  // Event IDs any friend has favorited — used to highlight in Now view
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
    return events.filter((e) => ids.has(e.eventId)).sort((a, b) => toDate(a.start) - toDate(b.start));
  }, [selectedFriend, allFavorites, events]);

  // Selected friend's shared extras (only those flagged shareWithFriends)
  const { docs: allShifts } = useLiveQuery("type", { key: "shift" });
  const friendShifts = useMemo(() => {
    if (!selectedFriend) return [];
    return allShifts.filter((s) => (s.userId || "anonymous") === selectedFriend && s.shareWithFriends);
  }, [selectedFriend, allShifts]);

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
    if (myFavIds.has(event.eventId)) {
      const fav = myFavorites.find((f) => f.eventId === event.eventId);
      if (fav) await database.del(fav._id);
    } else {
      await database.put({
        _id: `favorite-${userId}-${event.eventId}`,
        type: "favorite",
        eventId: event.eventId,
        userId,
      });
    }
  };

  const saveEventNote = async (eventId) => {
    const noteText = eventNotes[eventId] || "";
    setSavingNotes((prev) => ({ ...prev, [eventId]: true }));
    try {
      const existing = notesDocs.find((n) => n.eventId === eventId);
      if (existing) await database.put({ ...existing, notes: noteText });
      else await database.put({ _id: `note-${userId}-${eventId}`, type: "note", eventId, notes: noteText, userId });
      setOriginalNotes((prev) => ({ ...prev, [eventId]: noteText }));
      setTimeout(() => setSavingNotes((prev) => ({ ...prev, [eventId]: false })), 500);
    } catch (err) {
      console.error("Failed to save note:", err);
      setSavingNotes((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const handleNoteChange = (eventId, value) => setEventNotes((prev) => ({ ...prev, [eventId]: value }));
  const handleNoteBlur = (eventId) => {
    setFocusedNote(null);
    if ((eventNotes[eventId] || "") !== (originalNotes[eventId] || "")) saveEventNote(eventId);
  };
  const handleNoteFocus = (eventId) => {
    setFocusedNote(eventId);
    setOriginalNotes((prev) => ({ ...prev, [eventId]: eventNotes[eventId] || "" }));
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
      b.events.sort((a, b) => toDate(a.start) - toDate(b.start));
      b.venueList = [...b.venues];
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [events]);

  const nowSets = useMemo(() => {
    const t = nowTick;
    return events
      .filter((e) => {
        const s = toDate(e.start).getTime();
        const en = toDate(e.end).getTime();
        return s <= t && en > t;
      })
      .sort((a, b) => a.venueTitle.localeCompare(b.venueTitle));
  }, [events, nowTick]);

  const nextSets = useMemo(() => {
    const t = nowTick;
    const byVenue = new Map();
    const sorted = [...events].sort((a, b) => toDate(a.start) - toDate(b.start));
    for (const e of sorted) {
      const s = toDate(e.start).getTime();
      if (s <= t) continue;
      if (!byVenue.has(e.venueTitle)) byVenue.set(e.venueTitle, e);
    }
    return [...byVenue.values()].sort((a, b) => toDate(a.start) - toDate(b.start));
  }, [events, nowTick]);

  const filteredEvents = events
    .filter((e) => e.title.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedDay === "all" || e.day === selectedDay))
    .sort((a, b) => toDate(a.start) - toDate(b.start));

  const favoriteEvents = events.filter((e) => myFavIds.has(e.eventId)).sort((a, b) => toDate(a.start) - toDate(b.start));

  const makeSchedule = (day) => {
    const ev = favoriteEvents.filter((e) => festivalDayFor(e.start) === day);
    const sh = shifts.filter((s) => festivalDayFor(shiftStartRaw(s)) === day);
    return [
      ...ev.map((e) => ({ type: "event", id: e.eventId, title: e.title, sort: toDate(e.start), venue: e.venueTitle, data: e })),
      ...sh.map((s) => ({ type: "shift", id: s._id, sort: toDate(shiftStartRaw(s)), data: s })),
    ].sort((a, b) => a.sort - b.sort || (a.type === "shift" ? -1 : 1));
  };

  const makeFriendSchedule = (day) => {
    const ev = friendFavoriteEvents.filter((e) => festivalDayFor(e.start) === day);
    const sh = friendShifts.filter((s) => festivalDayFor(shiftStartRaw(s)) === day);
    return [
      ...ev.map((e) => ({ type: "event", id: e.eventId, title: e.title, sort: toDate(e.start), venue: e.venueTitle, data: e })),
      ...sh.map((s) => ({ type: "shift", id: s._id, sort: toDate(shiftStartRaw(s)), data: s })),
    ].sort((a, b) => a.sort - b.sort || (a.type === "shift" ? -1 : 1));
  };

  const friendCount = friends.length + friendedBy.length;

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
      className={`px-2 py-1 rounded-full border-2 border-[#4A4A4A] text-xs font-bold transition-all ${pendingDelete === docId ? "bg-[#B22222] text-white" : "bg-white text-[#4A4A4A] hover:bg-[#B22222] hover:text-white"}`}
      title={pendingDelete === docId ? "Tap to confirm" : "Remove"}
    >
      {pendingDelete === docId ? "Confirm" : "×"}
    </button>
  );

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

  // this is hardcoded on purpose
  const connectUrl = `https://vibes.diy/vibe/og/pickathon-picker/?friend=${encodeURIComponent(userId)}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(connectUrl)}`;

  return (
    <div className={`min-h-screen ${c.pageBg} p-4`}>
      <div className={`max-w-6xl mx-auto ${c.cardBg} rounded-3xl shadow-2xl border-8 ${c.border} overflow-hidden`}>
        <div className={`${c.headerBg} border-b-8 ${c.border} p-6`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <a href="https://pickathon.com" target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img src={LOGO_URL} alt="Pickathon" className="h-32 w-auto" />
              </a>
              <div>
                <h1 className={`text-4xl font-black ${c.bodyText} mb-1`}>
                  {superMode ? "SUPER PICKATHON PICKER" : "PICKATHON PICKER"}
                </h1>
                <p className={`${c.bodyText} text-base font-bold`}>Jul 30 – Aug 2, 2026 · Pendarvis Farm, Happy Valley, OR</p>
                <p className={`${c.bodyText} text-sm mt-1`}>
                  <em>Discover, favorite, and organize your perfect festival experience</em>
                </p>
              </div>
            </div>
            <ViewerTag
              style={{
                "--accent": "#CD6C0C",
                "--accent-text": "#fff",
                "--card-bg": "rgba(255,255,255,0.85)",
                "--border": "#4A4A4A",
                "--text": "#4A4A4A",
                border: "3px solid #4A4A4A",
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 16,
              }}
            />
          </div>
          {error && error.includes("cached") && (
            <div className={`mt-2 ${c.pinkBg} text-white px-3 py-2 rounded-lg text-sm font-bold`}>{error}</div>
          )}
          {!canWrite && <div className={c.readOnlyBanner}>Sign in to save your favorites and build your schedule.</div>}
        </div>

        <div className={`${c.navBg} border-b-8 ${c.border} p-4`}>
          <div className="flex flex-wrap gap-3">
            {["now", "browse", "bands", "favorites", "friends", "shifts", "schedule"]
              .filter(
                (v) => v === "now" || v === "browse" || v === "bands" || (v === "favorites" ? superMode && canWrite : canWrite)
              )
              .map((viewName) => (
                <button key={viewName} onClick={() => setView(viewName)} className={c.navBtn(view === viewName)}>
                  {viewName === "now" && `Now`}
                  {viewName === "browse" && `Browse Events`}
                  {viewName === "bands" && `Bands`}
                  {viewName === "favorites" && `Favorites (${myFavIds.size})`}
                  {viewName === "friends" && `Friends (${friendCount})`}
                  {viewName === "shifts" && `Extras (${shifts.length})`}
                  {viewName === "schedule" && `My Schedule (${myFavIds.size})`}
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
                          (() => {
                            const val = eventNotes[event.eventId] || "";
                            const expanded = focusedNote === event.eventId || val.length > 0;
                            return (
                              <div className="mt-3">
                                <textarea
                                  placeholder="Add note..."
                                  value={val}
                                  onChange={(e) => handleNoteChange(event.eventId, e.target.value)}
                                  onBlur={() => handleNoteBlur(event.eventId)}
                                  onFocus={() => handleNoteFocus(event.eventId)}
                                  className={c.noteArea}
                                  rows={expanded ? 2 : 1}
                                />
                              </div>
                            );
                          })()
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

          {view === "now" && (
            <div>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 className={`text-2xl font-black ${c.bodyText}`}>Right Now</h2>
                <p className={`text-sm font-bold ${c.bodyText}`}>
                  {new Date(nowTick).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: FESTIVAL_TZ })}{" "}
                  festival time
                </p>
              </div>

              <h3 className={`text-xl font-black mb-3 ${c.bodyText}`}>Playing Now ({nowSets.length})</h3>
              {nowSets.length === 0 ? (
                <div className="mb-6 p-4 bg-white rounded-2xl border-4 border-[#4A4A4A]">
                  <p className={`font-bold ${c.bodyText}`}>Nothing is on stage right now.</p>
                </div>
              ) : (
                <div className="grid gap-3 mb-8">
                  {nowSets.map((event) => {
                    const isMine = myFavIds.has(event.eventId);
                    const isFriendPick = friendFavIds.has(event.eventId);
                    return (
                      <div
                        key={event.eventId}
                        className={
                          isMine
                            ? c.favCard
                            : isFriendPick
                              ? "bg-[#FFE680] rounded-2xl border-4 border-[#4A4A4A] p-4 shadow-lg"
                              : c.eventCard
                        }
                      >
                        <div className="flex justify-between items-start gap-3 flex-wrap">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className={`text-lg font-black ${isMine ? "text-white" : c.bodyText}`}>{event.title}</h4>
                              {isFriendPick && !isMine && (
                                <span className={c.badge} title="A friend favorited this">
                                  friend pick
                                </span>
                              )}
                            </div>
                            <p className={`text-sm font-bold ${isMine ? "text-white" : c.bodyText}`}>
                              {event.venueTitle} · {fmtTime(event.start)}–{fmtTime(event.end)}
                            </p>
                          </div>
                          {canWrite && (
                            <button onClick={() => toggleFavorite(event)} className={isMine ? c.favToggleOn : c.favToggleOff}>
                              {isMine ? "♥" : "♡"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <h3 className={`text-xl font-black mb-3 ${c.bodyText}`}>Up Next ({nextSets.length})</h3>
              {nextSets.length === 0 ? (
                <div className="p-4 bg-white rounded-2xl border-4 border-[#4A4A4A]">
                  <p className={`font-bold ${c.bodyText}`}>No more sets scheduled.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {nextSets.map((event) => {
                    const isMine = myFavIds.has(event.eventId);
                    const isFriendPick = friendFavIds.has(event.eventId);
                    return (
                      <div
                        key={event.eventId}
                        className={
                          isMine
                            ? c.favCard
                            : isFriendPick
                              ? "bg-[#FFE680] rounded-2xl border-4 border-[#4A4A4A] p-4 shadow-lg"
                              : c.eventCard
                        }
                      >
                        <div className="flex justify-between items-start gap-3 flex-wrap">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className={`text-lg font-black ${isMine ? "text-white" : c.bodyText}`}>{event.title}</h4>
                              {isFriendPick && !isMine && (
                                <span className={c.badge} title="A friend favorited this">
                                  friend pick
                                </span>
                              )}
                            </div>
                            <p className={`text-sm font-bold ${isMine ? "text-white" : c.bodyText}`}>
                              {event.venueTitle} · {fmtDate(event.start)} {fmtTime(event.start)}–{fmtTime(event.end)}
                            </p>
                          </div>
                          {canWrite && (
                            <button onClick={() => toggleFavorite(event)} className={isMine ? c.favToggleOn : c.favToggleOff}>
                              {isMine ? "♥" : "♡"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {view === "bands" && (
            <div>
              <h2 className={`text-2xl font-black mb-6 ${c.bodyText}`}>Bands ({bandsList.length})</h2>
              <div className="grid gap-3">
                {bandsList.map((band) => {
                  const anyFav = band.events.some((e) => myFavIds.has(e.eventId));
                  const lineupLabel = band.lineup?.id || "music";
                  const lineupColor = band.lineup?.color || "#d7c57d";
                  const lineupText = band.lineup?.textColor || "#000";
                  return (
                    <div key={band.title} className={anyFav ? c.favCard : c.eventCard}>
                      <div className="flex justify-between items-start gap-3 flex-wrap">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className={`text-xl font-black ${anyFav ? "text-white" : c.bodyText}`}>{band.title}</h3>
                            <span
                              className="px-3 py-1 rounded-full text-xs font-black border-2 border-[#4A4A4A] uppercase"
                              style={{ backgroundColor: lineupColor, color: lineupText }}
                            >
                              {lineupLabel}
                            </span>
                            {superMode && band.events.some((e) => favCounts[e.eventId] > 0) && (
                              <span className={c.badge} title="Total picks across sets">
                                ★ {band.events.reduce((n, e) => n + (favCounts[e.eventId] || 0), 0)}
                              </span>
                            )}
                          </div>
                          <p className={`text-sm font-bold mb-2 ${anyFav ? "text-white/80" : "text-[#4A4A4A]/70"}`}>
                            {band.venueList.join(" · ")} · {band.events.length} set{band.events.length > 1 ? "s" : ""}
                          </p>
                          <div className="space-y-1">
                            {band.events.map((e) => (
                              <div key={e.eventId} className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-bold ${anyFav ? "text-white" : c.bodyText}`}>
                                  {fmtDate(e.start)} · {fmtTime(e.start)}–{fmtTime(e.end)} · {e.venueTitle}
                                </span>
                                {canWrite && (
                                  <button
                                    onClick={() => toggleFavorite(e)}
                                    className={myFavIds.has(e.eventId) ? c.favToggleOn : c.favToggleOff}
                                  >
                                    {myFavIds.has(e.eventId) ? "♥" : "♡"}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <a
                          href={band.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={c.linkBtn}
                          title="View on pickathon.com"
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
                  );
                })}
              </div>
            </div>
          )}

          {view === "favorites" && superMode && (
            <div>
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
                      className={`flex items-center gap-2 p-1 rounded-full border-2 border-[#4A4A4A] transition-all ${viewingUser === u.userId || (!viewingUser && u.userId === userId) ? "bg-[#CD6C0C]" : "bg-white hover:bg-[#71AD44]"}`}
                      title={`${u.count} pick${u.count === 1 ? "" : "s"}`}
                    >
                      <ViewerTag userHandle={u.userId} />
                      <span className={`pr-3 font-bold text-sm ${c.bodyText}`}>{u.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <h2 className={`text-2xl font-black mb-6 ${c.bodyText}`}>Favorite Events</h2>
              {favoriteEvents.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className={`text-2xl font-black mb-2 ${c.bodyText}`}>No favorites yet!</h3>
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

          {view === "friends" && (
            <div>
              <div className="flex flex-col items-center gap-4 p-6 bg-[#BACD32] rounded-2xl border-4 border-[#4A4A4A] mb-6">
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <p className={`text-lg font-bold ${c.bodyText}`}>Scan to follow</p>
                  <ViewerTag />
                  <p className={`text-lg font-bold ${c.bodyText}`}>schedule</p>
                </div>
                <div className="bg-white rounded-2xl border-4 border-[#4A4A4A] p-4">
                  <img src={qrSrc} alt="Connect QR code" width="320" height="320" />
                </div>
                <a href={connectUrl} target="_blank" rel="noopener noreferrer" className={c.btnPink}>
                  Connect
                </a>
                <p className={`text-xs font-bold ${c.bodyText} break-all text-center max-w-md`}>{connectUrl}</p>
              </div>

              <div className="mb-6 p-6 bg-white rounded-2xl border-4 border-[#4A4A4A]">
                <p className={`text-sm font-bold mb-4 ${c.bodyText} italic`}>
                  {friends.length + friendedBy.length > 0
                    ? "Click a friend to see their schedule"
                    : "Add a friend to see their schedule"}
                </p>
                <h3 className={`text-xl font-black mb-4 ${c.bodyText}`}>Added You ({friendedBy.length})</h3>
                {friendedBy.length === 0 ? (
                  <p className={`font-bold ${c.bodyText} mb-6`}>Nobody has scanned your QR yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-3 mb-6">
                    {friendedBy.map((f) => (
                      <div
                        key={`by-${f._id}`}
                        className={`flex items-center gap-2 p-2 rounded-full border-2 border-[#4A4A4A] transition-all ${selectedFriend === f.userId ? "bg-[#CD6C0C]" : "bg-[#71AD44]"}`}
                      >
                        <button
                          onClick={() => setSelectedFriend(selectedFriend === f.userId ? null : f.userId)}
                          className="flex items-center"
                        >
                          <ViewerTag userHandle={f.userId} />
                        </button>
                        {canWrite && renderDeleteX(f._id)}
                      </div>
                    ))}
                  </div>
                )}

                <h3 className={`text-xl font-black mb-4 ${c.bodyText}`}>Following ({friends.length})</h3>
                {friends.length === 0 ? (
                  <p className={`font-bold ${c.bodyText}`}>No friends yet — share your QR code above to connect.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {friends.map((f) => (
                      <div
                        key={f._id}
                        className={`flex items-center gap-2 p-2 rounded-full border-2 border-[#4A4A4A] transition-all ${selectedFriend === f.friendSlug ? "bg-[#CD6C0C]" : "bg-[#BACD32]"}`}
                      >
                        <button
                          onClick={() => setSelectedFriend(selectedFriend === f.friendSlug ? null : f.friendSlug)}
                          className="flex items-center"
                        >
                          <ViewerTag userHandle={f.friendSlug} />
                        </button>
                        {canWrite && renderDeleteX(f._id)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedFriend && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-2xl font-black ${c.bodyText}`}>Picks by</h3>
                      <ViewerTag userHandle={selectedFriend} />
                    </div>
                    <button onClick={() => setSelectedFriend(null)} className={c.btnCyan}>
                      Close
                    </button>
                  </div>
                  <ScheduleView
                    days={displayDays}
                    getDateForDay={getDateForDay}
                    buildSchedule={makeFriendSchedule}
                    fmtTime={fmtTime}
                    notes={null}
                    c={c}
                    shiftStartRaw={shiftStartRaw}
                    shiftEndRaw={shiftEndRaw}
                    emptyMessage="This friend hasn't picked any events yet."
                    canWrite={false}
                    onToggleFavorite={canWrite ? toggleFavorite : null}
                    myFavIds={myFavIds}
                  />
                </div>
              )}
            </div>
          )}

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
                  <label className={`mt-4 flex items-center gap-2 font-bold ${c.bodyText}`}>
                    <input
                      type="checkbox"
                      checked={!!shiftForm.shareWithFriends}
                      onChange={(e) => mergeShift({ shareWithFriends: e.target.checked })}
                      className="w-5 h-5"
                    />
                    Show in friends view
                  </label>
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
                          {canWrite && (
                            <label className={`mt-2 inline-flex items-center gap-2 text-sm font-bold ${c.bodyText}`}>
                              <input
                                type="checkbox"
                                checked={!!shift.shareWithFriends}
                                onChange={(e) => database.put({ ...shift, shareWithFriends: e.target.checked })}
                                className="w-4 h-4"
                              />
                              Show in friends view
                            </label>
                          )}
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
                eventNotes={eventNotes}
                savingNotes={savingNotes}
                onNoteChange={handleNoteChange}
                onNoteBlur={handleNoteBlur}
                onNoteFocus={handleNoteFocus}
                canWrite={canWrite}
                focusedNote={focusedNote}
                onToggleFavorite={canWrite ? toggleFavorite : null}
                myFavIds={myFavIds}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
