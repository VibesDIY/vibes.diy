import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function MeetingHeader({ ViewerTag, isOwner }) {
  const c = { border: "border-b border-[#cccccc]", muted: "text-[#666666]" };
  return (
    <header id="app-header" className={`px-5 py-4 ${c.border} flex items-baseline justify-between gap-3`}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">MeetingScribe</h1>
        <p className={`text-xs ${c.muted} mt-0.5`}>{isOwner ? "Capturing notes" : "Following along"}</p>
      </div>
      <ViewerTag />
    </header>
  );
}

function BulletCapture() {
  return (
    <section id="bullet-capture" className="px-5 py-4 border-b border-[#cccccc]">
      {/* bullet input + live list lands here */}
      <p className="text-sm text-[#666666] italic">Notes will appear here as they're captured.</p>
    </section>
  );
}

function SummaryPanel() {
  return (
    <section id="summary-panel" className="px-5 py-4">
      {/* Summarize button + AI summary doc lands here */}
      <p className="text-sm text-[#666666] italic">Summary appears after the meeting wraps.</p>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const c = { bg: "bg-white text-[#111111]", font: "font-[Helvetica_Neue,Helvetica,Arial,sans-serif]" };
  if (isViewerPending) return null;
  return (
    <main id="app" className={`min-h-screen ${c.bg} ${c.font} max-w-2xl mx-auto`}>
      <MeetingHeader ViewerTag={ViewerTag} isOwner={isOwner} />
      <BulletCapture isOwner={isOwner} viewer={viewer} />
      <SummaryPanel isOwner={isOwner} viewer={viewer} />
    </main>
  );
}
