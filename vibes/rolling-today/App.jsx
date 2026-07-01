import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useFireproof } from "use-fireproof";
import { useViewer, useVibe } from "use-vibes";
import NoteField from "./NoteField.jsx";
import { Icon, ICONS } from "./Icon.jsx";
import { c } from "./styles.js";
import {
  ymd,
  addDays,
  prettyDate,
  pretty12,
  readDayCache,
  fetchDay,
  findNextRideDay,
  AUDIENCE_LABEL,
  AREA_LABEL,
} from "./calendar-utils.js";
import RideCard from "./RideCard.jsx";
import FriendsPanel from "./FriendsPanel.jsx";
import {
  byTypeUser,
  byTypeFriendSlug,
  migrateRollingDoc,
  visibleFavsByRide,
  readFriendParam,
  clearFriendParamFromUrl,
  currentVibeBase,
} from "./friend-utils.js";

export default function App() {
  const today = ymd(new Date());
  const [date, setDate] = useState(today);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skipNotice, setSkipNotice] = useState(null);
  const [view, setView] = useState("rides");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [linkedFriend, setLinkedFriend] = useState(null);

  // anonymousLocal: put/del/useLiveQuery run against a local store while logged out and
  // migrate to the cloud on first sign-in. Optimistic writes are on by default.
  const { database, useLiveQuery, useDocument } = useFireproof("rolling-today", {
    anonymousLocal: true,
    migrate: migrateRollingDoc,
  });
  const { viewer } = useViewer();
  const { can, ready } = useVibe("rolling-today");

  const userId = viewer?.userHandle || "anonymous";
  const signedIn = Boolean(viewer?.userHandle);
  const canFavorite = signedIn ? ready && Boolean(can?.create?.({ type: "favorite", userId })?.ok) : true;

  const { docs: favorites } = useLiveQuery("type", { key: "favorite" });
  const { docs: friends } = useLiveQuery(byTypeUser, { key: ["friend", userId] });
  const { docs: friendedBy } = useLiveQuery(byTypeFriendSlug, { key: ["friend", userId] });
  const { docs: notesDocs } = useLiveQuery(byTypeUser, { key: ["note", userId] });
  const notes = useMemo(() => Object.fromEntries(notesDocs.map((n) => [n.rideId, n.notes])), [notesDocs]);

  // Following = handles you added; followers = handles that added you. Both are
  // "friends" for the purpose of showing picks.
  const friendSlugs = useMemo(() => {
    const s = new Set();
    for (const f of friends) s.add(f.friendSlug);
    for (const f of friendedBy) s.add(f.userId);
    s.delete(userId);
    return s;
  }, [friends, friendedBy, userId]);

  // Favorites are public-read but only *shown* for you + your friends.
  const visibleSlugs = useMemo(() => new Set([userId, ...friendSlugs]), [userId, friendSlugs]);
  const favsByRide = useMemo(() => visibleFavsByRide(favorites, visibleSlugs), [favorites, visibleSlugs]);

  // Ride ids I've personally starred — used by the Favorites filter in the nav.
  const myFavRideIds = useMemo(
    () => new Set(favorites.filter((f) => (f.userId || "anonymous") === userId && f.rideId).map((f) => String(f.rideId))),
    [favorites, userId]
  );

  const loadDate = useCallback(async (target, opts = {}) => {
    setError(null);
    setSkipNotice(null);
    // Instant paint from cache (even stale) while we revalidate.
    const cached = readDayCache(target);
    if (cached && cached.events.length > 0) {
      setDate(target);
      setEvents(cached.events);
    }
    setLoading(true);
    try {
      const first = await fetchDay(target);
      if (first.length > 0) {
        setDate(target);
        setEvents(first);
        return;
      }
      const dir = opts.dir ?? 1;
      const { date: landed, events: found } = await findNextRideDay(addDays(target, dir), dir);
      setDate(landed);
      setEvents(found);
      if (landed !== target) setSkipNotice(`No rides on ${prettyDate(target)} — jumped to ${prettyDate(landed)}`);
    } catch (e) {
      setError(e.message || "Failed to load");
      if (!cached) setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDate(today);
  }, [today, loadDate]);

  // Mobile: render at device width and kill horizontal scroll (the wide banner, box
  // shadows, and the off-canvas "sun" glow can otherwise induce an x-scroll) without
  // touching vertical scroll. Lock it on BOTH html and body — the scrolling element
  // varies, and only clamping both reliably clips fixed/off-canvas decoration.
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "width=device-width, initial-scale=1");
    const html = document.documentElement;
    const body = document.body;
    const prev = { h: html.style.overflowX, b: body.style.overflowX, bw: body.style.maxWidth };
    html.style.overflowX = "hidden";
    body.style.overflowX = "hidden";
    body.style.maxWidth = "100vw";
    return () => {
      html.style.overflowX = prev.h;
      body.style.overflowX = prev.b;
      body.style.maxWidth = prev.bw;
    };
  }, []);

  // Capture a `?friend=<handle>` link once, then strip it. Recording the friendship
  // needs a login, so hold the handle and act on it after sign-in.
  useEffect(() => {
    const fp = readFriendParam();
    if (!fp) return;
    setLinkedFriend(fp);
    setView("friends");
    clearFriendParamFromUrl();
  }, []);

  useEffect(() => {
    if (!signedIn || !linkedFriend || linkedFriend === userId) return;
    database
      .put({ _id: `friend-${userId}-${linkedFriend}`, type: "friend", userId, friendSlug: linkedFriend, createdAt: Date.now() })
      .catch(() => {});
  }, [signedIn, linkedFriend, userId, database]);

  const jump = (dir) => {
    if (loading) return;
    loadDate(addDays(date, dir), { dir });
  };
  const goToday = () => loadDate(today);

  const toggleFavorite = async (event) => {
    const rideId = String(event.id);
    const mine = (favsByRide[rideId] || []).find((f) => (f.userId || "anonymous") === userId);
    if (mine) {
      await database.del(mine._id);
    } else {
      await database.put({
        _id: `favorite-${userId}-${rideId}`,
        type: "favorite",
        rideId,
        userId,
        displayName: viewer?.displayName || userId,
        avatarUrl: viewer?.avatarUrl,
        ts: Date.now(),
      });
    }
  };

  const saveNote = async (rideId, text) => {
    const existing = notesDocs.find((n) => n.rideId === rideId);
    if (existing) await database.put({ ...existing, notes: text });
    else await database.put({ _id: `note-${userId}-${rideId}`, type: "note", rideId, notes: text, userId });
  };

  const addFriend = async (slug) => {
    if (!signedIn || !slug || slug === userId) return;
    await database.put({ _id: `friend-${userId}-${slug}`, type: "friend", userId, friendSlug: slug, createdAt: Date.now() }).catch(() => {});
  };
  const removeFriend = async (slug) => {
    const doc = friends.find((f) => f.friendSlug === slug);
    if (doc) await database.del(doc._id).catch(() => {});
  };

  const connectUrl = `${currentVibeBase()}/?friend=${encodeURIComponent(userId)}`;

  const shownEvents = onlyFavs ? events.filter((e) => myFavRideIds.has(String(e.id))) : events;
  const showCount = !loading && shownEvents.length > 0 && view === "rides";

  return (
    <div className={c.page} style={{ touchAction: "manipulation" }}>
      <div className={c.sun} aria-hidden="true" />
      <div className={c.grid} aria-hidden="true" />

      <div className={c.wrap}>
        <img src="https://www.shift2bikes.org/images/pp/pp2026-banner.jpg" alt="Pedalpalooza Bike Summer 2026" className="w-full mb-6 border-[3px] border-[#1A1A1A] shadow-[5px_5px_0_#1A1A1A]" />

        <header className={c.header}>
          <div className="shrink-0">
            <div className={c.brand}>
              <span className={c.brandMark} />
              <h1 className={c.brandText}>Rolling Today</h1>
            </div>
            <div className={c.sub}>Pedalpalooza · Bike Summer · PDX</div>
          </div>
          <nav className={c.nav}>
            {view === "rides" ? (
              <>
                <button className={c.navBtnLg} onClick={() => jump(-1)} disabled={loading} aria-label="Previous day with rides">
                  <Icon d={ICONS.arrowL} size={27} />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <button className={c.navBtnLg} onClick={goToday} disabled={loading || date === today} aria-label="Jump back to today">
                  <Icon d={ICONS.home} size={27} />
                  <span className="hidden sm:inline">Today</span>
                </button>
                <button className={c.navBtnLg} onClick={() => jump(1)} disabled={loading} aria-label="Next day with rides">
                  <span className="hidden sm:inline">Next</span>
                  <Icon d={ICONS.arrowR} size={27} />
                </button>
              </>
            ) : (
              <button className={c.navBtnLg} onClick={() => setView("rides")}>
                <Icon d={ICONS.arrowL} size={27} />
                <span className="hidden sm:inline">Rides</span>
              </button>
            )}
            <button
              className={onlyFavs && view === "rides" ? c.navBtnLgOn : c.navBtnLg}
              onClick={() => {
                setView("rides");
                setOnlyFavs((v) => !v);
              }}
              aria-label="My favorites"
              aria-pressed={onlyFavs && view === "rides"}
            >
              <Icon d={ICONS.star} size={27} fill={onlyFavs && view === "rides" ? "currentColor" : "none"} />
              <span className="hidden sm:inline">Favorites</span>
            </button>
            <button
              className={view === "friends" ? c.navBtnLgOn : c.navBtnLg}
              onClick={() => setView(view === "friends" ? "rides" : "friends")}
              aria-label="Friends"
            >
              <Icon d={ICONS.users} size={27} />
              <span className="hidden sm:inline">Friends{friendSlugs.size > 0 ? ` (${friendSlugs.size})` : ""}</span>
            </button>
          </nav>
        </header>

        {view === "friends" ? (
          <FriendsPanel
            signedIn={signedIn}
            userId={userId}
            connectUrl={connectUrl}
            linkedFriend={linkedFriend}
            friends={friends}
            friendedBy={friendedBy}
            addFriend={addFriend}
            removeFriend={removeFriend}
          />
        ) : (
          <>
            <section className={c.dateCard} aria-live="polite">
              <div className={c.dateRow}>
                <span className={c.dateLabel}>{date === today ? "Tonight & Today" : "On the wire"}</span>
                {loading && (
                  <svg className={c.spin} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFCB05" strokeWidth="3" aria-hidden="true">
                    <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <div className={c.dateBig}>{prettyDate(date)}</div>
              {showCount && (
                <div className={c.count}>
                  {shownEvents.length} {onlyFavs ? "favorite" : "ride"}
                  {shownEvents.length === 1 ? "" : "s"} rolling
                </div>
              )}
            </section>

            {skipNotice && (
              <div className={c.skip}>
                <Icon d={ICONS.spark} />
                <span>{skipNotice}</span>
              </div>
            )}

            {error && <div className={c.err}>Couldn't reach the feed: {error}</div>}

            {!loading && shownEvents.length === 0 && !error && (
              <div className={c.empty}>
                {onlyFavs
                  ? "No favorites on this day — tap the star on a ride to add one."
                  : "No rides found within the next year. Check back when Bike Summer rolls."}
              </div>
            )}

            <div className={c.list}>
              {shownEvents.map((e) => (
                <RideCard
                  key={e.caldaily_id || e.id}
                  event={e}
                  favs={favsByRide[String(e.id)] || []}
                  userId={userId}
                  canFavorite={canFavorite}
                  toggleFavorite={toggleFavorite}
                  note={notes[String(e.id)]}
                  saveNote={saveNote}
                />
              ))}
            </div>
          </>
        )}

        <footer className={c.foot}>
          <span>
            Data: <a className="underline" href="https://www.shift2bikes.org/bike-summer-calendar/" target="_blank" rel="noreferrer">shift2bikes.org</a>
          </span>
          <span>
            <a className="underline" href="https://www.bike-summer.org/" target="_blank" rel="noreferrer">bike-summer.org</a> · list your ride
          </span>
        </footer>
      </div>

      {!signedIn && view === "rides" && (
        <div className="fixed bottom-[10px] left-3 right-3 z-40 pointer-events-none">
          {/* Full-width bar that cradles the Vibes switch (top-frame chrome on the
              right). An invisible spacer holds the switch's footprint inside the flex
              row, so the text is pushed clear of it — more robust than a magic paddingRight. */}
          <div className={c.signinCallout} style={{ marginBottom: 0 }}>
            <span className="min-w-0 flex-1">Sign in via the Vibes DIY logo to sync your rides and follow friends</span>
            {/* Reserves the Vibes switch column (≈120px wide, docked to the right edge). */}
            <div className="w-[124px] shrink-0 self-stretch" aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  );
}
