import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const FIXED_MEMBERS = [
  { id: "m1", name: "ALICE VANGUARD", colorVar: "--red" },
  { id: "m2", name: "BOB KINETIC", colorVar: "--yellow" },
  { id: "m3", name: "CHARLIE APEX", colorVar: "--green" },
  { id: "m4", name: "DANA MATRIX", colorVar: "--blue" }
]

export default function App() {
  const { database, useLiveQuery } = useFireproof("anon-compliments")
  const [currentUser, setCurrentUser] = useState(FIXED_MEMBERS[0].id)
  
  const { docs: allCompliments } = useLiveQuery("type", { key: "compliment", descending: true })
  
  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=optional');
    :root {
      --bg: oklch(0.96 0.01 90);
      --card-bg: oklch(1.00 0 0);
      --text: oklch(0.15 0.02 280);
      --border: oklch(0.15 0.02 280);
      --muted: oklch(0.50 0.02 280);
      --red: oklch(0.55 0.24 28);
      --yellow: oklch(0.85 0.18 85);
      --green: oklch(0.62 0.19 145);
      --blue: oklch(0.52 0.18 255);
    }
    body { font-family: 'Space Grotesk', sans-serif; background: var(--bg); color: var(--text); }
    .bg-grid {
      background-image: 
        linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
        linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
      background-size: 60px 60px;
    }
  `

  const [activeModalUser, setActiveModalUser] = useState(null)
  const [composeText, setComposeText] = useState("")
  const [signVisible, setSignVisible] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleCloseModal() {
    setActiveModalUser(null)
    setComposeText("")
    setSignVisible(false)
  }

  async function handleAiSuggest() {
    if (!activeMember) return
    setIsAiLoading(true)
    try {
      const prompt = `Write a short, creative, hyper-specific and wildly encouraging anonymous 1-2 sentence compliment for a team member named ${activeMember.name}. Make it punchy, neo-brutalist energy, but kind.`
      const res = await callAI(prompt, {
        schema: {
          properties: { compliment: { type: "string" } }
        }
      })
      const data = JSON.parse(res)
      if (data.compliment) setComposeText(data.compliment)
    } catch (err) {
      console.error(err)
    } finally {
      setIsAiLoading(false)
    }
  }

  async function handleSubmitCompliment(e) {
    e.preventDefault()
    if (!composeText.trim() || !activeModalUser) return
    setIsSubmitting(true)

    try {
      const senderName = signVisible ? FIXED_MEMBERS.find(m => m.id === currentUser)?.name : null
      await database.put({
        type: "compliment",
        recipientId: activeModalUser,
        text: composeText.trim(),
        sender: senderName,
        createdAt: Date.now()
      })
      handleCloseModal()
    } finally {
      setIsSubmitting(false)
    }
  }

  const c = {
    page: "min-h-screen p-4 md:p-12 flex flex-col items-center relative z-10 font-['Space_Grotesk']",
    bgGrid: "fixed inset-0 z-0 bg-grid",
    container: "w-full max-w-[920px] mx-auto flex flex-col gap-8 relative",
    nav: "w-full flex justify-between items-center px-4 py-3 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0px_var(--border)]",
    navLeft: "flex items-center gap-3 font-bold text-lg uppercase tracking-tight",
    navRight: "flex items-center gap-2",
    hero: "w-full p-8 md:p-12 flex flex-col relative overflow-hidden bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[6px_6px_0px_var(--border)]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroTitle: "text-4xl md:text-6xl font-black mb-4 uppercase tracking-tighter text-[var(--text)] relative",
    heroSub: "text-[0.8rem] uppercase font-mono tracking-[0.08em] text-[var(--muted)]",
    grid: "grid grid-cols-1 md:grid-cols-2 gap-6 w-full",
    memberCard: "flex flex-col p-6 cursor-pointer bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 group",
    cardTop: "w-full h-8 mb-4 border-b-[3px] border-[var(--border)] relative",
    cardName: "text-2xl font-black uppercase tracking-tight group-hover:text-[var(--blue)] transition-colors",
    overlay: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--border)]/60 backdrop-blur-sm",
    modal: "relative w-full max-w-lg flex flex-col bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[8px_8px_0px_var(--border)] animate-[scale-in_0.15s_ease-out]",
    modalBar: "w-full px-4 py-3 flex justify-between items-center bg-[var(--blue)] text-[var(--bg)] border-b-[3px] border-[var(--border)] font-black tracking-tight uppercase",
    modalBody: "p-6 flex flex-col gap-6",
    inputGroup: "flex flex-col gap-2",
    label: "text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)]",
    textarea: "w-full min-h-[140px] p-3 font-['JetBrains_Mono'] text-[0.82rem] bg-[var(--bg)] border-[3px] border-[var(--border)] rounded-[4px] resize-none outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_var(--border)] focus:bg-white transition-all duration-150",
    actions: "flex gap-2 items-center justify-between pt-4 border-t-[3px] border-[var(--border)] border-dashed",
    btnPrimary: "px-6 py-3 font-bold uppercase text-[0.8rem] tracking-[0.05em] text-white bg-[var(--red)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed",
    btnSecondary: "px-3 py-1 font-bold uppercase text-[0.7rem] bg-[var(--yellow)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[3px_3px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 flex items-center gap-1 disabled:opacity-50",
    btnGhost: "px-4 py-2 font-bold uppercase text-[0.7rem] tracking-[0.05em] text-[var(--text)] border-[3px] border-transparent hover:border-[var(--border)] hover:bg-[var(--bg)] rounded-[4px] transition-all",
    checkboxRow: "flex items-center gap-3 cursor-pointer group select-none",
    checkbox: "w-[22px] h-[22px] border-[3px] border-[var(--border)] rounded-[2px] flex items-center justify-center transition-colors duration-150 shrink-0 bg-white group-hover:translate-x-[-1px] group-hover:translate-y-[-1px] group-hover:shadow-[2px_2px_0px_var(--border)]",
    inboxList: "flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-2",
    inboxItem: "p-4 flex flex-col gap-3 bg-[var(--yellow)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[3px_3px_0px_var(--border)]",
    inboxText: "font-['JetBrains_Mono'] text-[0.82rem] leading-relaxed",
    inboxMeta: "text-[0.65rem] uppercase font-bold tracking-[0.15em] border-t-[2px] border-[var(--border)] pt-2 mt-1 flex justify-between items-center"
  }

  const activeMember = FIXED_MEMBERS.find(m => m.id === activeModalUser)
  const isSelf = activeModalUser === currentUser

  return (
    <div className={c.page}>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <div className={c.bgGrid}>
        <div className="absolute top-10 left-10 w-[40px] h-[40px] rounded-full border-[3px] border-[var(--border)] bg-[var(--yellow)] opacity-30 animate-[spin_8s_linear_infinite]" />
        <div className="absolute bottom-20 right-20 w-[60px] h-[60px] border-[3px] border-[var(--border)] bg-[var(--red)] opacity-20" style={{ animation: "spin 12s linear infinite reverse" }} />
        <div className="absolute top-1/2 right-10 w-[30px] h-[30px] border-[3px] border-[var(--border)] bg-[var(--blue)] opacity-30 rotate-45" />
      </div>
      
      <div className={c.container}>
        <header className={c.nav}>
          <div className={c.navLeft}>
            <div className="flex gap-1">
              <span className="w-3 h-3 block bg-[var(--red)] border-2 border-[var(--border)]" />
              <span className="w-3 h-3 block bg-[var(--yellow)] border-2 border-[var(--border)]" />
              <span className="w-3 h-3 block bg-[var(--green)] border-2 border-[var(--border)]" />
            </div>
            GOOD VIBES INC.
          </div>
          <div className={c.navRight}>
            <span className={c.label}>ACTING AS:</span>
            <select 
              value={currentUser} 
              onChange={e => setCurrentUser(e.target.value)}
              className="px-2 py-1 font-mono text-[0.7rem] uppercase font-bold cursor-pointer bg-[var(--bg)] border-[2px] border-[var(--border)] rounded-[3px] outline-none hover:bg-[var(--yellow)] transition-colors"
            >
              {FIXED_MEMBERS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </header>

        <section className={c.hero}>
          <div className={c.heroBar}>
            <div className="flex-1 bg-[var(--red)] border-r-[3px] border-[var(--border)]" />
            <div className="flex-1 bg-[var(--yellow)] border-r-[3px] border-[var(--border)]" />
            <div className="flex-1 bg-[var(--green)] border-r-[3px] border-[var(--border)]" />
            <div className="flex-1 bg-[var(--blue)]" />
          </div>
          <h1 className={c.heroTitle}>
            <span className="absolute top-[5px] left-[5px] text-[var(--red)] opacity-50 z-0 pointer-events-none" aria-hidden="true">DROP A<br/>COMPLIMENT.</span>
            <span className="relative z-10">Drop a<br/>Compliment.</span>
          </h1>
          <p className={c.heroSub}>Anonymous by default. Unapologetically kind.</p>
        </section>

        <main className={c.grid}>
          {FIXED_MEMBERS.map(member => (
            <div 
              key={member.id} 
              className={c.memberCard}
              onClick={() => setActiveModalUser(member.id)}
            >
              <div className={c.cardTop}>
                <div className="absolute top-[-3px] left-[-3px] right-[-3px] bottom-[-3px] border-[3px] border-[var(--border)] border-b-0 opacity-20" style={{ backgroundColor: `var(${member.colorVar})` }} />
              </div>
              <h2 className={c.cardName}>{member.name}</h2>
              <div className="mt-4 flex items-center justify-between">
                <span className={c.label}>
                  {member.id === currentUser ? "VIEW INBOX" : "SEND COMPLIMENT"}
                </span>
                <svg className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
                  <path d={member.id === currentUser ? "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" : "M5 12h14M12 5l7 7-7 7"} />
                </svg>
              </div>
            </div>
          ))}
        </main>
      </div>

      {activeMember && (
        <div className={c.overlay}>
          <div className={c.modal}>
            <div className={c.modalBar} style={{ backgroundColor: `var(${activeMember.colorVar})` }}>
              <span className={activeMember.colorVar === '--yellow' ? 'text-[var(--text)]' : 'text-white'}>
                {isSelf ? "YOUR VAULT" : `TO: ${activeMember.name}`}
              </span>
              <button onClick={handleCloseModal} className={c.btnGhost}>CLOSE</button>
            </div>
            
            <div className={c.modalBody}>
              {isSelf ? (
                <div className={c.inboxList}>
                  {allCompliments.filter(d => d.recipientId === currentUser).length === 0 ? (
                    <div className={`${c.inboxItem} opacity-50 bg-[var(--bg)]`}>
                      <p className={c.inboxText}>Vault is empty. Broadcast more good vibes to receive.</p>
                      <div className={c.inboxMeta}><span>SYSTEM</span><span>NOW</span></div>
                    </div>
                  ) : (
                    allCompliments
                      .filter(d => d.recipientId === currentUser)
                      .map(doc => (
                        <div key={doc._id} className={c.inboxItem}>
                          <p className={c.inboxText}>"{doc.text}"</p>
                          <div className={c.inboxMeta}>
                            <span>FR: {doc.sender || "ANONYMOUS"}</span>
                            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmitCompliment} className="flex flex-col gap-6">
                  <div className={c.inputGroup}>
                    <div className="flex justify-between items-end">
                      <label className={c.label}>SECURE MESSAGE</label>
                      <button 
                        type="button" 
                        onClick={handleAiSuggest} 
                        className={c.btnSecondary}
                        disabled={isAiLoading || isSubmitting}
                      >
                        {isAiLoading ? (
                          <>
                            <svg className="w-3 h-3 animate-spin text-[var(--text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                              <path d="M12 2a10 10 0 0 1 10 10" />
                            </svg>
                            LOADING
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
                              <path d="M12 2v20M2 12h20M7 7l10 10m0-10L7 17" />
                            </svg>
                            SUGGEST IDEA
                          </>
                        )}
                      </button>
                    </div>
                    <textarea 
                      value={composeText}
                      onChange={e => setComposeText(e.target.value)}
                      placeholder="Write something nice..."
                      className={c.textarea}
                    />
                  </div>
                  
                  <label className={c.checkboxRow}>
                    <div className={`${c.checkbox} ${signVisible ? 'bg-[var(--green)]' : ''}`}>
                      {signVisible && (
                        <svg className="w-4 h-4 text-[var(--border)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                          <path d="M5 13l4 4L19 7" strokeLinecap="square" />
                        </svg>
                      )}
                    </div>
                    <span className={c.label}>SIGN WITH MY NAME (DIGNITY MODE)</span>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={signVisible}
                      onChange={e => setSignVisible(e.target.checked)}
                    />
                  </label>

                  <div className={c.actions}>
                    <button type="button" onClick={handleCloseModal} className={c.btnGhost}>CANCEL</button>
                    <button 
                      type="submit" 
                      className={c.btnPrimary}
                      disabled={isSubmitting || !composeText.trim()}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                             <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                             <path d="M12 2a10 10 0 0 1 10 10" />
                          </svg>
                          TRANSMITTING...
                        </>
                      ) : (
                        "TRANSMIT VIBES"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}