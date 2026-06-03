import React from "react";
import { callAI } from "call-ai";
import { ImgGen } from "img-gen";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function DropZone({ database, viewer }) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);

  async function analyzeImage(docId, file) {
    try {
      const dataUrl = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(file);
      });
      const response = await callAI(
        [
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image. Return 4-7 concise descriptive tags and a one-sentence caption." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        {
          schema: {
            properties: {
              tags: { type: "array", items: { type: "string" }, description: "4-7 short descriptive tags" },
              caption: { type: "string", description: "One-sentence natural-language description" },
            },
          },
        }
      );
      const parsed = JSON.parse(response);
      const doc = await database.get(docId);
      await database.put({ ...doc, tags: parsed.tags || [], caption: parsed.caption || "", analyzed: true });
    } catch (err) {
      const doc = await database.get(docId);
      await database.put({ ...doc, analyzed: true, error: String(err.message || err) });
    }
  }

  async function handleFiles(files) {
    setIsUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const ok = await database.put({
          type: "image",
          authorHandle: viewer.userHandle,
          createdAt: Date.now(),
          tags: [],
          caption: "",
          analyzed: false,
          _files: { photo: file },
        });
        analyzeImage(ok.id, file);
      }
    } finally {
      setIsUploading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }

  return (
    <section
      id="dropzone"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${isDragging ? "border-[oklch(1.00_0.000_0)] bg-[oklch(0.21_0.03_265)]" : "border-[oklch(0.28_0.03_257)] bg-[oklch(0.16_0.000_0)]"}`}
    >
      <label className="cursor-pointer block min-h-[44px]">
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(Array.from(e.target.files))} />
        <p className="text-[oklch(1.00_0.000_0)] font-medium mb-1">
          {isUploading ? (
            <span className="inline-flex items-center gap-2">
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
              </svg>
              Uploading…
            </span>
          ) : (
            "Drop images here"
          )}
        </p>
        <p className="text-sm text-[oklch(0.71_0.02_261)]">or tap to choose files</p>
      </label>
    </section>
  );
}

function ImageCard({ doc, database, viewer, isOwner, ViewerTag }) {
  const canEdit = viewer && (viewer.userHandle === doc.authorHandle || isOwner);
  const [editing, setEditing] = React.useState(false);
  const [draftTags, setDraftTags] = React.useState((doc.tags || []).join(", "));
  const [draftCaption, setDraftCaption] = React.useState(doc.caption || "");

  async function save() {
    const tags = draftTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await database.put({ ...doc, tags, caption: draftCaption });
    setEditing(false);
  }

  return (
    <div className="mb-4 break-inside-avoid rounded-lg overflow-hidden border border-[oklch(0.28_0.03_257)] bg-[oklch(0.16_0.000_0)]">
      {doc._files?.photo?.url && <img src={doc._files.photo.url} alt={doc.caption || "uploaded image"} className="w-full block" />}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <ViewerTag userHandle={doc.authorHandle} />
        </div>
        {!doc.analyzed ? (
          <p className="text-xs text-[oklch(0.71_0.02_261)] inline-flex items-center gap-2">
            <svg
              className="animate-spin"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
            </svg>
            Analyzing…
          </p>
        ) : editing ? (
          <div className="space-y-2 animate-[fadeIn_0.3s_ease-in]">
            <input
              value={draftTags}
              onChange={(e) => setDraftTags(e.target.value)}
              placeholder="tag, tag, tag"
              className="w-full text-xs bg-[oklch(0.14_0.000_0)] border border-[oklch(0.28_0.03_257)] rounded px-2 py-1.5 text-[oklch(1.00_0.000_0)]"
            />
            <textarea
              value={draftCaption}
              onChange={(e) => setDraftCaption(e.target.value)}
              placeholder="Caption"
              rows={2}
              className="w-full text-xs bg-[oklch(0.14_0.000_0)] border border-[oklch(0.28_0.03_257)] rounded px-2 py-1.5 text-[oklch(1.00_0.000_0)]"
            />
            <div className="flex gap-2">
              <button
                onClick={save}
                className="text-xs px-3 py-1.5 rounded bg-[oklch(1.00_0.000_0)] text-[oklch(0.14_0.000_0)] font-medium min-h-[32px]"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-xs px-3 py-1.5 rounded bg-[oklch(1.00_0.000_0_/_0.1)] text-[oklch(1.00_0.000_0)] min-h-[32px]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-[fadeIn_0.5s_ease-in]">
            {doc.tags?.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 mb-2">
                {doc.tags.map((tag, i) => (
                  <li
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full bg-[oklch(1.00_0.000_0_/_0.1)] text-[oklch(1.00_0.000_0)]"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
            {doc.caption && <p className="text-xs text-[oklch(0.71_0.02_261)] leading-relaxed">{doc.caption}</p>}
            {canEdit && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-[oklch(0.71_0.02_261)] hover:text-[oklch(1.00_0.000_0)] mt-2 underline"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Grid({ database, viewer, isOwner, ViewerTag }) {
  const { useLiveQuery } = useFireproof("imageTagger");
  const { docs } = useLiveQuery("createdAt", { descending: true });
  const images = docs.filter((d) => d.type === "image");

  return (
    <section id="grid" className="mt-6">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {images.length === 0 ? (
        <p className="text-[oklch(1.00_0.000_0_/_0.6)] text-sm text-center py-12">No images yet</p>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
          {images.map((doc) => (
            <ImageCard key={doc._id} doc={doc} database={database} viewer={viewer} isOwner={isOwner} ViewerTag={ViewerTag} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database } = useFireproof("imageTagger");

  const c = {
    page: "min-h-screen bg-[oklch(0.14_0.000_0)] text-[oklch(1.00_0.000_0)]",
    header:
      "sticky top-0 z-10 bg-[oklch(0.14_0.000_0)]/95 backdrop-blur border-b border-[oklch(0.28_0.03_257)] px-4 py-3 flex items-center justify-between",
    title: "text-lg font-semibold tracking-tight",
    main: "max-w-5xl mx-auto px-4 py-6",
    muted: "text-[oklch(0.71_0.02_261)]",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page} style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Image Auto-Tagger</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        {viewer ? <DropZone database={database} viewer={viewer} /> : <p className={c.muted}>Sign in to upload images.</p>}
        <Grid database={database} viewer={viewer} isOwner={isOwner} ViewerTag={ViewerTag} />
      </main>
    </div>
  );
}
