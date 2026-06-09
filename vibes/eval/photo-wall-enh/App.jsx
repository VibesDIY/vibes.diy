import React from "react";
import { callAI } from "call-ai";
import { ImgGen } from "img-gen";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function AlbumBar() {
  return (
    <section id="albums" className="px-4 py-3 bg-[oklch(0.97_0.01_80)] border-b-2 border-dashed border-[oklch(0.12_0.01_0)]">
      <h2 className="font-['Caveat'] text-2xl text-[oklch(0.12_0.01_0)] mb-2">Albums</h2>
      <div className="flex gap-2 overflow-x-auto pb-1" id="album-list">
        {/* album chips land here */}
      </div>
    </section>
  );
}

function Uploader({ viewer, activeAlbum, albums, database }) {
  const [file, setFile] = React.useState(null);
  const [caption, setCaption] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const albumName = albums.find((a) => a._id === activeAlbum)?.name || "";

  async function upload(e) {
    e.preventDefault();
    if (!file || !viewer || !activeAlbum) return;
    setBusy(true);
    try {
      let tags = [];
      try {
        const res = await callAI(
          `Suggest 3-6 short tags for a trip photo in album "${albumName}" with caption "${caption || "(none)"}". Categories: location, activity, people, mood.`,
          {
            schema: { properties: { tags: { type: "array", items: { type: "string" } } } },
          }
        );
        tags = JSON.parse(res).tags || [];
      } catch {}
      await database.put({
        type: "photo",
        albumId: activeAlbum,
        caption: caption.trim(),
        tags,
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
        _files: { image: file },
      });
      setFile(null);
      setCaption("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="uploader" className="px-4 py-4 bg-[oklch(0.93_0.12_95)] border-b-2 border-[oklch(0.12_0.01_0)]">
      <h2 className="font-['Caveat'] text-2xl text-[oklch(0.12_0.01_0)] mb-2">Drop a photo</h2>
      {!viewer && <p className="text-sm text-[oklch(0.45_0.01_0)]">Sign in to upload.</p>}
      {viewer && !activeAlbum && <p className="text-sm text-[oklch(0.45_0.01_0)] italic">Pick or create an album first.</p>}
      {viewer && activeAlbum && (
        <form onSubmit={upload} className="space-y-2">
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="w-full px-3 py-2 min-h-[44px] border-2 border-[oklch(0.12_0.01_0)] rounded bg-white text-sm"
          />
          <button
            type="submit"
            disabled={!file || busy}
            className="w-full px-4 py-3 min-h-[44px] bg-[oklch(0.12_0.01_0)] text-[oklch(0.97_0.01_80)] rounded font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && (
              <svg
                className="animate-spin"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
              </svg>
            )}
            {busy ? "Tagging & saving..." : "Drop it in"}
          </button>
        </form>
      )}
    </section>
  );
}

function PhotoFeed({ photos, activeAlbum, isOwner, deletePhoto, ViewerTag }) {
  const filtered = activeAlbum ? photos.filter((p) => p.albumId === activeAlbum) : photos;
  return (
    <section id="feed" className="px-4 py-4 bg-[oklch(0.93_0.03_130)] min-h-[60vh]">
      <h2 className="font-['Caveat'] text-2xl text-[oklch(0.12_0.01_0)] mb-3">Recent drops</h2>
      {filtered.length === 0 && (
        <p className="text-sm text-[oklch(0.45_0.01_0)] italic">No photos yet — be the first to drop one.</p>
      )}
      <ul id="photo-list" className="grid grid-cols-2 gap-3">
        {filtered.map((p) => (
          <li
            key={p._id}
            className="bg-[oklch(0.97_0.01_80)] border-2 border-[oklch(0.12_0.01_0)] rounded p-2 shadow-[3px_3px_0_oklch(0.12_0.01_0)]"
          >
            {p._files?.image?.url && (
              <img src={p._files.image.url} alt={p.caption || "photo"} className="w-full aspect-square object-cover rounded mb-2" />
            )}
            {p.caption && <p className="text-sm font-medium text-[oklch(0.12_0.01_0)] mb-1">{p.caption}</p>}
            {p.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {p.tags.map((t, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 bg-[oklch(0.90_0.05_240)] border border-[oklch(0.12_0.01_0)] rounded-full"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-[oklch(0.45_0.01_0)]">
              <ViewerTag userHandle={p.authorHandle} />
              {isOwner && (
                <button
                  onClick={() => deletePhoto(p._id)}
                  className="px-2 py-1 bg-[oklch(0.90_0.06_10)] border border-[oklch(0.12_0.01_0)] rounded text-[oklch(0.12_0.01_0)] font-semibold"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  if (isViewerPending) return null;

  return (
    <main id="app" className="min-h-screen bg-[oklch(0.93_0.03_130)] font-['Inter']">
      <header
        id="app-header"
        className="px-4 py-3 bg-[oklch(0.90_0.06_10)] border-b-2 border-[oklch(0.12_0.01_0)] flex items-center justify-between sticky top-0 z-10"
      >
        <h1 className="font-['Caveat'] text-3xl text-[oklch(0.12_0.01_0)]">Trip Board</h1>
        <ViewerTag />
      </header>
      <AlbumBar
        albums={albums}
        activeAlbum={activeAlbum}
        setActiveAlbum={setActiveAlbum}
        isOwner={isOwner}
        newAlbum={newAlbum}
        setNewAlbum={setNewAlbum}
        createAlbum={createAlbum}
      />
      <Uploader viewer={viewer} activeAlbum={activeAlbum} albums={albums} database={database} />
      <PhotoFeed photos={photos} activeAlbum={activeAlbum} isOwner={isOwner} deletePhoto={deletePhoto} ViewerTag={ViewerTag} />
    </main>
  );
}
