import React, { useState } from "react";
import { callAI } from "call-ai";
import { ImgVibes } from "img-vibes";
import { useFireproof } from "use-fireproof";

function ReceiptCard({ receipt, c }) {
  const { useLiveQuery, database } = useFireproof("receipt-theater");
  const { docs: narratives } = useLiveQuery("receiptId", { key: receipt._id, descending: true });
  
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  async function handleUpvote(doc) {
    await database.put({ ...doc, votes: (doc.votes || 0) + 1 });
  }

  async function handleNarrativeSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await database.put({
      type: "narrative",
      receiptId: receipt._id,
      text: text.trim(),
      author: author.trim() || "Anonymous Contributor",
      votes: 0,
      createdAt: Date.now()
    });
    setText("");
  }

  async function handleAiSuggest() {
    setIsSynthesizing(true);
    try {
      const resp = await callAI("Write a single paragraph, humorous and highly speculative archive label explaining why a person might have bought the strange combination of items on this receipt.", {
        schema: {
          properties: {
             theory: { type: "string" }
          }
        }
      });
      const data = JSON.parse(resp);
      setText(data.theory);
    } finally {
      setIsSynthesizing(false);
    }
  }

  return (
    <article className={c.card}>
      <div className={c.cardLeft}>
        <div className={c.imgWrap}>
          {receipt._files?.photo?.url ? (
            <img src={receipt._files.photo.url} className={c.receiptPhoto} alt="Cataloged Receipt" />
          ) : (
            <div className={c.imgPlaceholder}>[ RECEIPT SCAN MISSING ]</div>
          )}
        </div>
        <div className={c.receiptMeta}>
           <span>Catalog ID: {receipt._id}</span>
           <span>Date: {receipt.date}</span>
        </div>
        <h3 className={c.receiptTitle}>{receipt.title}</h3>
      </div>
      
      <div className={c.cardRight}>
        <div className={c.narrativeList}>
          {narratives.map(n => (
            <div key={n._id} className={c.narrativeItem}>
              <p className={c.pullQuote}>{n.text}</p>
              <div className={c.meta}>
                <span>— {n.author}</span>
                <button onClick={() => handleUpvote(n)} className={c.voteBtn}>
                  Agree ({n.votes || 0})
                </button>
              </div>
            </div>
          ))}
          {narratives.length === 0 && (
            <div className="text-sm italic opacity-60">No speculative theories submitted yet.</div>
          )}
        </div>

        <form onSubmit={handleNarrativeSubmit} className={c.form}>
          <label className={c.formLabel}>Submit a Speculative History</label>
          <input 
            type="text" 
            placeholder="Your Alias" 
            className={c.input} 
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <textarea 
            placeholder="The events leading to this purchase were..." 
            className={c.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className={c.formActions}>
            <button type="button" onClick={handleAiSuggest} disabled={isSynthesizing} className={`${c.aiBtn} flex items-center gap-2`}>
              {isSynthesizing ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="30 60"></circle>
                  </svg>
                  Synthesizing
                </>
              ) : "Draft Theory (AI)"}
            </button>
            <button type="submit" className={c.submitBtn}>
              Submit to Archive
            </button>
          </div>
        </form>
      </div>
    </article>
  );
}

export default function App() {
  const c = {
    page: "min-h-screen py-8 px-4 md:py-16 md:px-8 bg-[oklch(0.92_0.01_65)] text-[oklch(0.15_0.02_50)] font-['Inter',sans-serif]",
    container: "max-w-[920px] mx-auto flex flex-col gap-16",
    header: "flex flex-col gap-4 border-b border-[oklch(0.20_0.02_50)] pb-8",
    title: "text-4xl md:text-5xl text-center font-['Playfair_Display',serif] font-bold",
    subtitle: "text-xs tracking-widest uppercase text-center",
    uploadSection: "p-8 border border-[oklch(0.20_0.02_50)] bg-[oklch(0.95_0.01_70)] flex flex-col gap-6 items-center justify-center text-center",
    uploadLabel: "text-lg",
    uploadSubLabel: "text-xs tracking-wide uppercase",
    uploadBtn: "px-6 py-3 uppercase tracking-wide text-xs cursor-pointer bg-[oklch(0.35_0.04_50)] text-[oklch(0.95_0.01_70)] hover:bg-[oklch(0.25_0.03_50)] transition-colors",
    hiddenInput: "hidden",
    feed: "flex flex-col gap-24",
    card: "flex flex-col md:flex-row gap-8 border-t border-[oklch(0.20_0.02_50)] pt-8",
    cardLeft: "w-full md:w-[45%] flex flex-col gap-4",
    cardRight: "w-full md:w-[55%] flex flex-col gap-8",
    imgWrap: "w-full aspect-[3/4] border border-[oklch(0.20_0.02_50)] bg-[oklch(0.95_0.01_70)] flex items-center justify-center p-2",
    imgPlaceholder: "text-sm uppercase tracking-widest",
    receiptPhoto: "w-full h-full object-cover",
    receiptMeta: "flex justify-between text-[0.65rem] tracking-[0.12em] uppercase border-b border-[oklch(0.20_0.02_50)] pb-2 text-[oklch(0.55_0.02_50)]",
    receiptTitle: "text-2xl font-['Playfair_Display',serif] font-bold mt-2",
    narrativeList: "flex flex-col gap-10",
    narrativeItem: "flex flex-col gap-3",
    pullQuote: "font-['Playfair_Display',serif] text-lg leading-relaxed px-4 border-l-2 border-[oklch(0.35_0.04_50)] text-[oklch(0.15_0.02_50)]",
    meta: "text-[0.65rem] tracking-[0.12em] uppercase flex justify-between items-center ml-4 text-[oklch(0.55_0.02_50)]",
    voteBtn: "px-3 py-1 text-[0.65rem] uppercase tracking-[0.12em] border border-[oklch(0.20_0.02_50)] hover:bg-[oklch(0.95_0.01_70)] transition-colors text-[oklch(0.15_0.02_50)]",
    form: "flex flex-col gap-4 mt-8 pt-8 border-t border-[oklch(0.20_0.02_50)]",
    formLabel: "text-xs tracking-[0.12em] uppercase text-[oklch(0.35_0.04_50)]",
    input: "w-full py-2 border-b border-[oklch(0.20_0.02_50)] text-sm focus:outline-none bg-transparent placeholder-[oklch(0.55_0.02_50)] focus:border-[oklch(0.35_0.04_50)]",
    textarea: "w-full py-3 border-b border-[oklch(0.20_0.02_50)] text-sm focus:outline-none bg-transparent placeholder-[oklch(0.55_0.02_50)] focus:border-[oklch(0.35_0.04_50)] resize-none min-h-[120px]",
    formActions: "flex justify-between gap-4 mt-2",
    submitBtn: "px-6 py-2 uppercase tracking-[0.12em] text-xs bg-[oklch(0.35_0.04_50)] text-[oklch(0.95_0.01_70)] hover:bg-[oklch(0.25_0.03_50)] transition-colors",
    aiBtn: "px-4 py-2 uppercase tracking-[0.12em] text-[0.65rem] border border-[oklch(0.20_0.02_50)] hover:bg-[oklch(0.95_0.01_70)] transition-colors"
  };

  const { useLiveQuery, database } = useFireproof("receipt-theater");
  const [isUploading, setIsUploading] = useState(false);

  const { docs: receipts } = useLiveQuery("type", { key: "receipt", descending: true });

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await database.put({
        type: "receipt",
        title: "Unidentified Purchase",
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        createdAt: Date.now(),
        _files: { photo: file }
      });
    } finally {
      setIsUploading(false);
      e.target.value = null; // reset
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400&family=Playfair+Display:ital,wght@0,700;1,400;1,700&display=swap');
      `}} />
      <div className={c.page}>
        <div className={c.container}>
          
          <header className={c.header}>
            <h1 className={c.title}>Receipt Theater</h1>
            <p className={c.subtitle}>An archive of speculative purchasing histories</p>
          </header>

          <main className="flex flex-col gap-12">
            
            <section className={c.uploadSection}>
              <h2 className={c.uploadLabel}>Contribute Evidence</h2>
              <p className={c.uploadSubLabel}>Drop a receipt scan or photo</p>
              
              <label className={`${c.uploadBtn} ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="30 60"></circle>
                    </svg>
                    Filing...
                  </span>
                ) : "Select File"}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  className={c.hiddenInput} 
                />
              </label>
            </section>

            <section className={c.feed}>
              {receipts.length === 0 && (
                <div className="text-center italic opacity-60 font-['Playfair_Display',serif]">
                  The archive is currently empty.
                </div>
              )}
              {receipts.map(receipt => (
                <ReceiptCard key={receipt._id} receipt={receipt} c={c} />
              ))}
            </section>

          </main>
        </div>
      </div>
    </>
  );
}