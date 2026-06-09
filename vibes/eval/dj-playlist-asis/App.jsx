function MixtapeCard({ tape }) {
  const [open, setOpen] = React.useState(false);
  return (
    <article className="rounded-2xl bg-[#2a0a2e]/95 border-2 border-[#00f0ff] overflow-hidden shadow-[0_0_16px_rgba(0,240,255,0.35)]">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-4 min-h-[44px]">
        <p className="font-['Share_Tech_Mono'] text-[#00f0ff] text-xs uppercase tracking-widest mb-1">mood</p>
        <p className="font-['Rajdhani'] text-[#ffffff] text-base leading-snug">{tape.mood}</p>
        <p className="font-['Share_Tech_Mono'] text-[#fcee0a]/80 text-xs mt-2">
          {tape.tracks?.length || 0} tracks · tap to {open ? "close" : "open"}
        </p>
      </button>
      {open && (
        <ul className="border-t-2 border-[#00f0ff]/40 divide-y divide-[#00f0ff]/20">
          {tape.tracks?.map((t, i) => (
            <li key={i} className="p-3 bg-[#4d1558]/40">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-['Orbitron'] text-[#fcee0a] text-sm truncate">{t.title}</p>
                  <p className="font-['Rajdhani'] text-[#ffffff] text-sm truncate">{t.artist}</p>
                </div>
                <a
                  href={t.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 min-h-[36px] px-3 inline-flex items-center rounded-md bg-[#f93c94] text-[#ffffff] font-['Orbitron'] text-xs tracking-wider"
                >
                  ▶ YT
                </a>
              </div>
              <p className="font-['Rajdhani'] text-[#ffffff]/70 text-xs mt-1 italic">{t.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function MixtapeFeed({ mixtapes }) {
  return (
    <section id="mixtape-feed" className="space-y-3">
      <h2 className="font-['Orbitron'] text-[#2a0a2e] text-xl tracking-wide px-1">RECENT MIXTAPES</h2>
      {mixtapes.length === 0 ? (
        <p className="font-['Rajdhani'] text-[#2a0a2e]/70 text-sm px-1">No mixtapes yet. The first vibe lands here.</p>
      ) : (
        mixtapes.map((m) => <MixtapeCard key={m._id} tape={m} />)
      )}
    </section>
  );
}
