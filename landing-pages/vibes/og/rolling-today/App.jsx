import React, { useEffect, useState, useCallback } from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const API = "https://www.shift2bikes.org/api/events.php";
const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css";
const TILE_STYLE = "https://tiles.openfreemap.org/styles/positron";
const PDX_CENTER = [-122.6765, 45.5231];

function loadMapLibre() {
  if (typeof window === "undefined")
    return Promise.reject(new Error("no window"));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (window.__maplibreLoading) return window.__maplibreLoading;
  if (!document.querySelector("link[data-maplibre]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = MAPLIBRE_CSS;
    link.setAttribute("data-maplibre", "");
    document.head.appendChild(link);
  }
  window.__maplibreLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.setAttribute("data-maplibre", "");
    script.onload = () => resolve(window.maplibregl);
    script.onerror = () => reject(new Error("maplibre load failed"));
    document.head.appendChild(script);
  });
  return window.__maplibreLoading;
}

function MapView({
  rides,
  accent = "#E83D6F",
  borderColor = "#1A1A1A",
  wrapperClass = "",
}) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markersRef = React.useRef([]);
  const [mlib, setMlib] = React.useState(null);
  const { useLiveQuery, database } = useFireproof("rolling-today");
  const { docs: geocodes } = useLiveQuery("type", { key: "geocode" });
  const geoByAddr = React.useMemo(() => {
    const m = {};
    for (const g of geocodes) if (g.address) m[g.address] = g;
    return m;
  }, [geocodes]);

  React.useEffect(() => {
    let cancelled = false;
    loadMapLibre()
      .then((lib) => {
        if (!cancelled) setMlib(lib);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!mlib || !containerRef.current || mapRef.current) return;
    const map = new mlib.Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: PDX_CENTER,
      zoom: 10,
    });
    map.addControl(new mlib.NavigationControl({ showCompass: false }));
    mapRef.current = map;
    return () => {
      try {
        map.remove();
      } catch (_) {}
      mapRef.current = null;
    };
  }, [mlib]);

  React.useEffect(() => {
    if (!rides.length) return;
    const seen = new Set();
    const needed = [];
    for (const r of rides) {
      if (!r.address || seen.has(r.address)) continue;
      seen.add(r.address);
      const cached = geoByAddr[r.address];
      if (!cached || cached.lat == null) needed.push(r);
    }
    if (!needed.length) return;
    let cancelled = false;
    const lookup = async (q) => {
      if (!q) return null;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) return null;
        const arr = await res.json();
        if (!arr[0]) return null;
        return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
      } catch (_) {
        return null;
      }
    };
    (async () => {
      for (const ride of needed) {
        if (cancelled) return;
        let hit = await lookup(ride.address);
        if (!hit) {
          await new Promise((res) => setTimeout(res, 1100));
          if (cancelled) return;
          if (ride.venue) hit = await lookup(`${ride.venue}, Portland, OR`);
        }
        if (hit)
          await database.put({
            type: "geocode",
            address: ride.address,
            lat: hit.lat,
            lng: hit.lng,
            ts: Date.now(),
          });
        await new Promise((res) => setTimeout(res, 1100));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rides, geoByAddr, database]);

  React.useEffect(() => {
    if (!mlib || !mapRef.current) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    const bounds = new mlib.LngLatBounds();
    let any = false;
    for (const r of rides) {
      const g = r.address && geoByAddr[r.address];
      if (!g || g.lat == null) continue;
      const el = document.createElement("div");
      el.title = r.title || "";
      el.style.cssText = `width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${accent};border:3px solid ${borderColor};box-shadow:2px 2px 0 ${borderColor};cursor:pointer;`;
      const popup = new mlib.Popup({ offset: 18, closeButton: false }).setHTML(
        `<strong style="font-family:system-ui">${(r.title || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c])}</strong>`,
      );
      const marker = new mlib.Marker({ element: el, anchor: "bottom" })
        .setLngLat([g.lng, g.lat])
        .setPopup(popup)
        .addTo(mapRef.current);
      markersRef.current.push(marker);
      bounds.extend([g.lng, g.lat]);
      any = true;
    }
    if (any && !bounds.isEmpty()) {
      try {
        mapRef.current.fitBounds(bounds, {
          padding: 60,
          maxZoom: 14,
          duration: 600,
        });
      } catch (_) {}
    }
  }, [mlib, rides, geoByAddr, accent, borderColor]);

  const placedCount = rides.filter(
    (r) =>
      r.address && geoByAddr[r.address] && geoByAddr[r.address].lat != null,
  ).length;
  const pendingCount = rides.filter(
    (r) => r.address && !geoByAddr[r.address],
  ).length;

  return (
    <div className={wrapperClass}>
      <div ref={containerRef} style={{ width: "100%", height: 300 }} />
      <div
        style={{
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 700,
          borderTop: `3px solid ${borderColor}`,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>
          {placedCount} of {rides.length} on the map
        </span>
        {pendingCount > 0 && (
          <span style={{ opacity: 0.7 }}>geocoding {pendingCount}…</span>
        )}
      </div>
    </div>
  );
}
const AUDIENCE_LABEL = { G: "General", F: "Family-Friendly", A: "21+ Only" };
const AREA_LABEL = {
  P: "Portland",
  V: "Vancouver",
  W: "Westside",
  E: "East PDX",
  C: "Clackamas",
};

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

function prettyDate(s) {
  const d = parseYmd(s);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function pretty12(hhmmss) {
  if (!hhmmss) return "";
  const [h, m] = hhmmss.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

async function fetchDay(date) {
  const url = `${API}?startdate=${date}&enddate=${date}`;
  const r = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`shift2bikes ${r.status}`);
  const data = await r.json();
  const list = (data.events || []).filter((e) => !e.cancelled);
  list.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  return list;
}

// Walk forward (dir=+1) or backward (dir=-1) up to maxDays, return first day with rides.
async function findNextRideDay(startDate, dir, maxDays = 60) {
  let cursor = startDate;
  for (let i = 0; i < maxDays; i++) {
    const events = await fetchDay(cursor);
    if (events.length > 0) return { date: cursor, events };
    cursor = addDays(cursor, dir);
  }
  return { date: startDate, events: [] };
}

function Icon({ d, size = 18 }) {
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
      aria-hidden="true"
    >
      {d}
    </svg>
  );
}

const ICONS = {
  pin: (
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4 M8 2v4 M3 10h18" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  arrowL: <path d="M19 12H5 M12 19l-7-7 7-7" />,
  arrowR: <path d="M5 12h14 M12 5l7 7-7 7" />,
  home: <path d="M3 12l9-9 9 9 M5 10v10h14V10" />,
  spark: (
    <path d="M5 3v4 M3 5h4 M19 17v4 M17 19h4 M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
  ),
  heart: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
};

export default function App() {
  const today = ymd(new Date());
  const [date, setDate] = useState(today);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skipNotice, setSkipNotice] = useState(null);

  const { useLiveQuery, database } = useFireproof("rolling-today");
  const { viewer, can } = useViewer();
  const { docs: favorites } = useLiveQuery("type", { key: "favorite" });
  const favsByRide = React.useMemo(() => {
    const m = {};
    for (const f of favorites) {
      if (!f.rideId) continue;
      if (!m[f.rideId]) m[f.rideId] = [];
      if (!m[f.rideId].some((x) => x.userSlug === f.userSlug))
        m[f.rideId].push(f);
    }
    return m;
  }, [favorites]);

  const loadDate = useCallback(async (target, opts = {}) => {
    setLoading(true);
    setError(null);
    setSkipNotice(null);
    try {
      const first = await fetchDay(target);
      if (first.length > 0) {
        setDate(target);
        setEvents(first);
        return;
      }
      // No rides — auto-zoom in the requested direction (default forward).
      const dir = opts.dir ?? 1;
      const { date: landed, events: found } = await findNextRideDay(
        addDays(target, dir),
        dir,
      );
      setDate(landed);
      setEvents(found);
      if (landed !== target) {
        setSkipNotice(
          `No rides on ${prettyDate(target)} — jumped to ${prettyDate(landed)}`,
        );
      }
    } catch (e) {
      setError(e.message || "Failed to load");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDate(today);
  }, [today, loadDate]);

  const jump = (dir) => {
    if (loading) return;
    loadDate(addDays(date, dir), { dir });
  };

  const goToday = () => loadDate(today);

  const c = {
    page: "min-h-screen bg-[#FFF6E5] text-[#1A1A1A]",
    sun: "fixed -top-40 -right-40 w-[720px] h-[720px] rounded-full bg-[#FFCB05] opacity-50 pointer-events-none",
    grid: "fixed inset-0 pointer-events-none opacity-[0.12] bg-[length:48px_48px] bg-[linear-gradient(to_right,#1A1A1A_1px,transparent_1px),linear-gradient(to_bottom,#1A1A1A_1px,transparent_1px)]",
    wrap: "relative max-w-[920px] mx-auto px-5 sm:px-8 py-8 sm:py-12 z-10",
    header: "flex items-end justify-between gap-4 mb-8",
    brand: "flex items-baseline gap-3",
    brandMark:
      "inline-block w-3.5 h-3.5 rounded-full bg-[#E83D6F] border-2 border-[#1A1A1A]",
    brandText:
      "font-black uppercase tracking-tight text-[1.4rem] sm:text-[1.6rem]",
    sub: "text-[0.7rem] uppercase tracking-[0.18em] text-[#1A1A1A]/70",
    nav: "flex gap-2",
    navBtn:
      "inline-flex items-center gap-1.5 px-3 py-2 text-[0.78rem] font-bold uppercase tracking-wider bg-[#FFFDF5] border-[3px] border-[#1A1A1A] shadow-[3px_3px_0_#1A1A1A] hover:shadow-[5px_5px_0_#1A1A1A] hover:-translate-x-[2px] hover:-translate-y-[2px] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all disabled:opacity-40 disabled:pointer-events-none",
    dateCard:
      "relative bg-[#1A1A1A] text-[#FFF6E5] border-[3px] border-[#1A1A1A] shadow-[6px_6px_0_#E83D6F] p-6 sm:p-8 mb-6",
    dateRow: "flex items-center justify-between gap-3 mb-2",
    dateLabel: "text-[0.7rem] uppercase tracking-[0.22em] text-[#FFCB05]",
    dateBig:
      "font-black text-[1.8rem] sm:text-[2.4rem] leading-none tracking-tight",
    count: "mt-3 text-[0.85rem] text-[#FFF6E5]/80",
    skip: "bg-[#FFCB05] text-[#1A1A1A] border-[3px] border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] px-4 py-3 mb-6 font-bold text-[0.92rem] flex items-start gap-2",
    list: "flex flex-col gap-5",
    card: "bg-[#FFFDF5] border-[3px] border-[#1A1A1A] shadow-[5px_5px_0_#1A1A1A] p-5 sm:p-6 hover:shadow-[7px_7px_0_#1A1A1A] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all",
    timeRow: "flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2",
    time: "font-black text-[1.5rem] sm:text-[1.8rem] leading-none tracking-tight text-[#E83D6F]",
    endTime: "text-[0.85rem] text-[#1A1A1A]/70 font-bold",
    title:
      "font-black uppercase tracking-tight text-[1.3rem] sm:text-[1.55rem] leading-tight mb-3",
    badgeRow: "flex flex-wrap gap-2 mb-3",
    badge:
      "inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wider border-2 border-[#1A1A1A]",
    badgeAud: "bg-[#FFCB05]",
    badgeArea: "bg-[#7DD3FC]",
    badgeLoop: "bg-[#C6F08C]",
    venue: "flex items-start gap-2 text-[0.95rem] mb-1",
    venueText: "font-bold",
    addr: "text-[0.85rem] text-[#1A1A1A]/70 underline decoration-[#1A1A1A]/30 hover:decoration-[#E83D6F] hover:text-[#E83D6F]",
    organizer: "flex items-center gap-2 text-[0.85rem] text-[#1A1A1A]/75 mb-3",
    newsflash:
      "bg-[#FFCB05] border-2 border-[#1A1A1A] px-3 py-2 mb-3 text-[0.85rem] font-bold flex items-start gap-2",
    details:
      "text-[0.9rem] leading-relaxed text-[#1A1A1A]/85 whitespace-pre-wrap mb-4",
    actions:
      "flex flex-wrap gap-2 pt-3 border-t-2 border-dashed border-[#1A1A1A]/30",
    actionBtn:
      "inline-flex items-center gap-1.5 px-3 py-2 text-[0.78rem] font-bold uppercase tracking-wider border-[3px] border-[#1A1A1A] shadow-[3px_3px_0_#1A1A1A] hover:shadow-[5px_5px_0_#1A1A1A] hover:-translate-x-[2px] hover:-translate-y-[2px] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all",
    actionCal: "bg-[#C6F08C]",
    actionLink: "bg-[#7DD3FC]",
    actionWeb: "bg-[#FFFDF5]",
    actionFavOff: "bg-[#FFFDF5] text-[#1A1A1A]",
    actionFavOn: "bg-[#E83D6F] text-[#FFFDF5]",
    favStrip: "flex items-center flex-wrap gap-x-3 gap-y-1 mb-3",
    favLabel:
      "text-[0.7rem] uppercase tracking-[0.18em] font-bold text-[#1A1A1A]/70",
    avatarPile: "flex items-center -space-x-2",
    avatar:
      "w-7 h-7 rounded-full border-2 border-[#1A1A1A] bg-[#FFFDF5] object-cover",
    avatarFallback:
      "w-7 h-7 rounded-full border-2 border-[#1A1A1A] bg-[#FFCB05] flex items-center justify-center text-[0.62rem] font-black uppercase",
    avatarMore: "ml-3 text-[0.78rem] font-bold text-[#1A1A1A]/70",
    img: "w-full max-w-[280px] mt-1 mb-4 border-[3px] border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] object-cover",
    empty: "text-center py-16 text-[1.1rem] font-bold",
    err: "bg-[#FFD8D8] border-[3px] border-[#E83D6F] shadow-[4px_4px_0_#E83D6F] px-4 py-3 mb-6 font-bold",
    foot: "mt-12 pt-6 border-t-2 border-[#1A1A1A]/30 text-[0.78rem] text-[#1A1A1A]/65 flex flex-wrap items-center gap-x-4 gap-y-2 justify-between",
    spin: "animate-spin",
  };

  const showCount = !loading && events.length > 0;

  return (
    <div className={c.page}>
      <div className={c.sun} aria-hidden="true" />
      <div className={c.grid} aria-hidden="true" />

      <div className={c.wrap}>
        <img
          src="https://www.shift2bikes.org/images/pp/pp2026-banner.jpg"
          alt="Pedalpalooza Bike Summer 2026"
          className="w-full mb-6 border-[3px] border-[#1A1A1A] shadow-[5px_5px_0_#1A1A1A]"
        />
        {events.length > 0 && (
          <div className="mb-6">
            <MapView
              rides={events}
              accent="#E83D6F"
              borderColor="#1A1A1A"
              wrapperClass="bg-[#FFFDF5] border-[3px] border-[#1A1A1A] shadow-[5px_5px_0_#1A1A1A] overflow-hidden"
            />
          </div>
        )}
        <header className={c.header}>
          <div>
            <div className={c.brand}>
              <span className={c.brandMark} />
              <h1 className={c.brandText}>Rolling Today</h1>
            </div>
            <div className={c.sub}>Pedalpalooza · Bike Summer · PDX</div>
          </div>
          <nav className={c.nav}>
            <button
              className={c.navBtn}
              onClick={() => jump(-1)}
              disabled={loading}
              aria-label="Previous day with rides"
            >
              <Icon d={ICONS.arrowL} />
              <span className="hidden sm:inline">Prev</span>
            </button>
            <button
              className={c.navBtn}
              onClick={goToday}
              disabled={loading || date === today}
              aria-label="Jump back to today"
            >
              <Icon d={ICONS.home} />
              <span className="hidden sm:inline">Today</span>
            </button>
            <button
              className={c.navBtn}
              onClick={() => jump(1)}
              disabled={loading}
              aria-label="Next day with rides"
            >
              <span className="hidden sm:inline">Next</span>
              <Icon d={ICONS.arrowR} />
            </button>
          </nav>
        </header>

        <section className={c.dateCard} aria-live="polite">
          <div className={c.dateRow}>
            <span className={c.dateLabel}>
              {date === today ? "Tonight & Today" : "On the wire"}
            </span>
            {loading && (
              <svg
                className={c.spin}
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFCB05"
                strokeWidth="3"
                aria-hidden="true"
              >
                <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div className={c.dateBig}>{prettyDate(date)}</div>
          {showCount && (
            <div className={c.count}>
              {events.length} ride{events.length === 1 ? "" : "s"} rolling
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

        {!loading && events.length === 0 && !error && (
          <div className={c.empty}>
            No rides found in the next 60 days. Check back when Bike Summer
            rolls.
          </div>
        )}

        <div className={c.list}>
          {events.map((e) => (
            <RideCard
              key={e.caldaily_id || e.id}
              event={e}
              c={c}
              favs={favsByRide[String(e.id)] || []}
              viewer={viewer}
              canWrite={can("write")}
              database={database}
            />
          ))}
        </div>

        <footer className={c.foot}>
          <span>
            Data:{" "}
            <a
              className="underline"
              href="https://www.shift2bikes.org/bike-summer-calendar/"
              target="_blank"
              rel="noreferrer"
            >
              shift2bikes.org
            </a>
          </span>
          <span>
            <a
              className="underline"
              href="https://www.bike-summer.org/"
              target="_blank"
              rel="noreferrer"
            >
              bike-summer.org
            </a>{" "}
            · list your ride
          </span>
        </footer>
      </div>
    </div>
  );
}

function RideCard({ event, c, favs = [], viewer, canWrite, database }) {
  const mapUrl = event.address
    ? `https://maps.google.com/?q=${encodeURIComponent(event.address)}`
    : null;
  const imgUrl = event.image
    ? event.image.startsWith("http")
      ? event.image
      : `https://www.shift2bikes.org${event.image}`
    : null;
  const audLabel = AUDIENCE_LABEL[event.audience] || event.audience || "";
  const areaLabel = AREA_LABEL[event.area] || event.area || "";

  const myFav = viewer
    ? favs.find((f) => f.userSlug === viewer.userSlug)
    : null;
  const toggleFav = async () => {
    if (!viewer || !database) return;
    if (myFav) {
      await database.del(myFav._id);
    } else {
      await database.put({
        type: "favorite",
        rideId: String(event.id),
        userSlug: viewer.userSlug,
        displayName: viewer.displayName || viewer.userSlug,
        avatarUrl: viewer.avatarUrl,
        ts: Date.now(),
      });
    }
  };

  return (
    <article className={c.card}>
      <div className={c.timeRow}>
        <span className={c.time}>{pretty12(event.time)}</span>
        {event.endtime && (
          <span className={c.endTime}>→ {pretty12(event.endtime)}</span>
        )}
        {event.timedetails && (
          <span className={c.endTime}>· {event.timedetails}</span>
        )}
      </div>
      <h2 className={c.title}>{event.title}</h2>

      <div className={c.badgeRow}>
        {audLabel && (
          <span className={`${c.badge} ${c.badgeAud}`}>{audLabel}</span>
        )}
        {areaLabel && (
          <span className={`${c.badge} ${c.badgeArea}`}>{areaLabel}</span>
        )}
        {event.loopride && (
          <span className={`${c.badge} ${c.badgeLoop}`}>Loop Ride</span>
        )}
        {event.ridelength && event.ridelength !== "--" && (
          <span className={c.badge}>{event.ridelength} mi</span>
        )}
      </div>

      {event.newsflash && (
        <div className={c.newsflash}>
          <Icon d={ICONS.spark} />
          <span>{event.newsflash}</span>
        </div>
      )}

      {imgUrl && <img className={c.img} src={imgUrl} alt="" loading="lazy" />}

      {event.venue && (
        <div className={c.venue}>
          <span className="mt-0.5 text-[#E83D6F]">
            <Icon d={ICONS.pin} />
          </span>
          <div>
            <div className={c.venueText}>{event.venue}</div>
            {mapUrl && (
              <a
                className={c.addr}
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                {event.address}
              </a>
            )}
            {event.locend && (
              <div className="text-[0.8rem] text-[#1A1A1A]/65 mt-1">
                Ends: {event.locend}
              </div>
            )}
          </div>
        </div>
      )}

      {event.organizer && (
        <div className={c.organizer}>
          <Icon d={ICONS.user} size={16} />
          <span>{event.organizer}</span>
        </div>
      )}

      {event.details && <p className={c.details}>{event.details}</p>}

      {favs.length > 0 && (
        <div className={c.favStrip}>
          <span className={c.favLabel}>
            {favs.length}{" "}
            {favs.length === 1 ? "rider rolling" : "riders rolling"}
          </span>
          <div className={c.avatarPile}>
            {favs.slice(0, 6).map((f) =>
              f.avatarUrl ? (
                <img
                  key={f._id}
                  src={f.avatarUrl}
                  title={f.displayName}
                  alt={f.displayName || "rider"}
                  className={c.avatar}
                />
              ) : (
                <div
                  key={f._id}
                  className={c.avatarFallback}
                  title={f.displayName}
                >
                  {(f.displayName || "?").slice(0, 2)}
                </div>
              ),
            )}
            {favs.length > 6 && (
              <span className={c.avatarMore}>+{favs.length - 6}</span>
            )}
          </div>
        </div>
      )}

      <div className={c.actions}>
        {canWrite && (
          <button
            onClick={toggleFav}
            aria-pressed={!!myFav}
            className={`${c.actionBtn} ${myFav ? c.actionFavOn : c.actionFavOff}`}
          >
            <Icon d={ICONS.heart} size={16} />
            {myFav ? "Favorited" : "Favorite"}
          </button>
        )}
        {event.exportable && (
          <a
            className={`${c.actionBtn} ${c.actionCal}`}
            href={event.exportable}
          >
            <Icon d={ICONS.cal} size={16} />
            Add to Calendar
          </a>
        )}
        {event.shareable && (
          <a
            className={`${c.actionBtn} ${c.actionLink}`}
            href={event.shareable}
            target="_blank"
            rel="noreferrer"
          >
            <Icon d={ICONS.link} size={16} />
            Details
          </a>
        )}
        {event.weburl && (
          <a
            className={`${c.actionBtn} ${c.actionWeb}`}
            href={event.weburl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon d={ICONS.link} size={16} />
            {event.webname || "Site"}
          </a>
        )}
      </div>
    </article>
  );
}
