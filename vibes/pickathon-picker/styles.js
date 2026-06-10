// Dark-mode palette is system-responsive via Tailwind's `dark:` (prefers-color-scheme).
// Every surface has a dimmed dark variant so a single light text flip (bodyText) reads
// everywhere. Bright brand hues (lime #BACD32 / green #71AD44) map to dark tints that
// keep the same warm/cool identity.
export const c = {
  pageBg: "bg-[#EEE] dark:bg-[#0e0f12]",
  cardBg: "bg-white dark:bg-[#181a20]",
  headerBg: "bg-[#BACD32] dark:bg-[#2c3510]",
  navBg: "bg-[#71AD44] dark:bg-[#1d3015]",
  bodyText: "text-[#4A4A4A] dark:text-[#e9e9e9]",
  border: "",
  pinkBg: "bg-[#CD6C0C]",
  eventCard: "bg-[#BACD32] dark:bg-[#2c3510] rounded-2xl m-2 p-8 shadow-lg",
  favCard: "bg-[#71AD44] dark:bg-[#1d3015] rounded-2xl m-2 p-8 shadow-lg",
  shiftCard: "bg-[#71AD44] dark:bg-[#1d3015] rounded-2xl m-2 p-8",
  schedDay: "mb-6 bg-[#71AD44] dark:bg-[#1d3015] rounded-2xl m-2 p-8",
  schedShift: "rounded-xl m-2 p-7 bg-[#BACD32] dark:bg-[#2c3510]",
  schedEvent: "rounded-xl m-2 p-7 bg-white dark:bg-[#22252d]",
  input: "p-7 m-2 rounded-xl font-bold text-[#4A4A4A] dark:text-[#e9e9e9] bg-white dark:bg-[#22252d]",
  navBtn: (active) =>
    `px-10 py-7 font-bold rounded-2xl m-2 transition-all ${active ? "bg-[#4A4A4A] dark:bg-[#e9e9e9] text-white dark:text-[#181a20]" : "bg-white dark:bg-[#22252d] text-[#4A4A4A] dark:text-[#e9e9e9] hover:bg-[#BACD32] dark:hover:bg-[#2c3510]"}`,
  btnPink: "bg-[#CD6C0C] text-white font-bold py-7 px-10 rounded-2xl m-2 hover:opacity-90 transition-all",
  btnCyan: "bg-[#71AD44] dark:bg-[#1d3015] text-white font-bold py-7 px-10 rounded-2xl m-2 hover:opacity-90 transition-all",
  badge: "bg-[#CD6C0C] text-white px-3 py-1 rounded-full text-sm font-bold m-2",
  favToggleOn: "p-7 rounded-2xl m-2 font-bold transition-all bg-[#CD6C0C] text-white hover:opacity-90",
  favToggleOff:
    "p-7 rounded-2xl m-2 font-bold transition-all bg-white dark:bg-[#22252d] text-[#4A4A4A] dark:text-[#e9e9e9] hover:bg-[#BACD32] dark:hover:bg-[#2c3510]",
  linkBtn:
    "p-7 bg-white dark:bg-[#22252d] text-[#4A4A4A] dark:text-[#e9e9e9] rounded-2xl m-2 hover:bg-[#BACD32] dark:hover:bg-[#2c3510] transition-all",
  noteArea: "w-full p-6 m-2 rounded-xl resize-none text-sm text-[#4A4A4A] dark:text-[#e9e9e9] bg-white dark:bg-[#22252d]",
  deleteBtn: "p-7 bg-[#B22222] text-white rounded-2xl m-2 hover:opacity-80 transition-all",
  noteBox: "mt-2 p-6 bg-white dark:bg-[#22252d] rounded-lg m-2",
  shiftForm: "bg-[#BACD32] dark:bg-[#2c3510] rounded-2xl m-2 p-10 mb-6",
  spinner: "w-4 h-4 m-2 rounded-full animate-spin",
  readOnlyBanner: "mt-2 bg-white dark:bg-[#22252d] text-[#4A4A4A] dark:text-[#e9e9e9] px-7 py-6 rounded-lg text-sm font-bold m-2",
};

export const lineupTag = (event) => {
  const label = event.lineup?.id || "music";
  return { label, color: event.lineup?.color || "#d7c57d", textColor: event.lineup?.textColor || "#000" };
};

// Light mode: full lineup color. Dark mode: the same hue mixed down into the dark
// surface (via the --lineup custom prop + a `dark:bg-[color-mix(...)]` class on the card).
export const eventCardStyle = (event) => ({ "--lineup": event.lineup?.color || "#d7c57d" });
export const eventCardBg = "bg-[var(--lineup)] dark:bg-[color-mix(in_oklab,var(--lineup)_36%,#14161b)]";

export const viewerTagStyle = {
  "--accent": "#CD6C0C",
  "--accent-text": "#fff",
  "--card-bg": "rgba(255,255,255,0.85)",
  "--border": "#4A4A4A",
  "--text": "#4A4A4A",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 16,
};
