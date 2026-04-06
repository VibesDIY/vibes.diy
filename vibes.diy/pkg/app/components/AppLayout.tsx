import { VibesSwitch } from "@vibes.diy/base";
import React, { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import type { ReactNode } from "react";
import { useShareableDB } from "../hooks/useShareableDB.js";
import { AllowFireproofSharing } from "./AllowFireproofSharing.js";
import type { ViewType } from "@vibes.diy/prompts";

const MOBILE_TABS = ["preview", "chat", "code", "data", "settings"] as const;
type MobileTab = (typeof MOBILE_TABS)[number];

const MOBILE_TAB_CONFIG: Record<MobileTab, { label: string; bg: string; activeBorder: string; labelColor: string; icon: React.ReactNode }> = {
  preview: {
    label: "App",
    bg: "var(--vibes-red, #DA291C)",
    activeBorder: "#a81f15",
    labelColor: "var(--vibes-cream)",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  },
  chat: {
    label: "Chat",
    bg: "var(--vibes-menu-bg, #CCCDC8)",
    activeBorder: "#b0b1ac",
    labelColor: "var(--vibes-near-black)",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  },
  code: {
    label: "Code",
    bg: "#5398c9",
    activeBorder: "#3d7a9e",
    labelColor: "var(--vibes-cream)",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  },
  data: {
    label: "Data",
    bg: "var(--vibes-yellow, #fedd00)",
    activeBorder: "#c4b000",
    labelColor: "var(--vibes-near-black)",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 15h5m-5-4h10" /></svg>,
  },
  settings: {
    label: "Settings",
    bg: "var(--vibes-green, #22c55e)",
    activeBorder: "#1a9e48",
    labelColor: "var(--vibes-cream)",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
};

interface AppLayoutProps {
  chatPanel: ReactNode;
  previewPanel: ReactNode;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  chatInput?: ReactNode;
  suggestionsComponent?: ReactNode;
  mobilePreviewShown?: boolean;
  appInfo?: ReactNode;
  isSidebarVisible: boolean;
  setIsSidebarVisible: (x: boolean) => void;
  fullWidthChat?: boolean;
  currentView?: string;
  navigateToView?: (view: ViewType) => void;
  title?: string;
}

export default function AppLayout({
  chatPanel,
  previewPanel,
  headerLeft,
  headerRight,
  chatInput,
  suggestionsComponent,
  isSidebarVisible,
  setIsSidebarVisible,
  appInfo,
  currentView,
  navigateToView,
  title,
}: AppLayoutProps) {
  const { sharingState, dbRef, onResult, onDismiss, onLoginRedirect } = useShareableDB();
  useDocumentTitle("vibes.diy");

  const showChatInTabs = currentView === "preview";
  const [pinned, setPinned] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);

  const closeModal = useCallback(() => {
    setModalClosing(true);
    setTimeout(() => {
      setModalOpen(false);
      setModalClosing(false);
      setPinned(true);
    }, 250);
  }, []);

  const togglePin = useCallback(() => {
    if (pinned) {
      setPinned(false);
      setModalOpen(true);
    } else {
      closeModal();
    }
  }, [pinned, closeModal]);

  // Draggable modal state
  const [modalPos, setModalPos] = useState({ x: -1, y: -1 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  const initPos = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const parent = node.parentElement;
      if (parent) {
        const pr = parent.getBoundingClientRect();
        if (pr.width > 0 && modalPos.x === -1) {
          setModalPos({
            x: pr.width - 500 - 10,
            y: pr.height - (pr.height * 0.7) - 20,
          });
        }
      }
    }
    modalRef.current = node;
  }, [modalPos.x]);

  // Recalculate modal position when becoming visible (e.g. switching from mobile to desktop)
  React.useEffect(() => {
    if (modalOpen && modalPos.x === -1 && modalRef.current) {
      const parent = modalRef.current.parentElement;
      if (parent) {
        const pr = parent.getBoundingClientRect();
        if (pr.width > 0) {
          setModalPos({
            x: pr.width - 500 - 10,
            y: pr.height - (pr.height * 0.7) - 20,
          });
        }
      }
    }
  });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("textarea") || target.closest("input")) return;
    e.preventDefault();
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - modalPos.x, y: e.clientY - modalPos.y };
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      setModalPos({ x: ev.clientX - dragOffset.current.x, y: ev.clientY - dragOffset.current.y });
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [modalPos]);

  // === Mobile state ===
  const [mobileTab, setMobileTab] = useState<MobileTab>("preview");
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    const idx = MOBILE_TABS.indexOf(mobileTab);
    if (dx > 0 && idx > 0) {
      const next = MOBILE_TABS[idx - 1];
      setMobileTab(next);
      if (next !== "chat" && navigateToView) navigateToView(next as ViewType);
    } else if (dx < 0 && idx < MOBILE_TABS.length - 1) {
      const next = MOBILE_TABS[idx + 1];
      setMobileTab(next);
      if (next !== "chat" && navigateToView) navigateToView(next as ViewType);
    }
  }, [mobileTab, navigateToView]);

  const handleMobileTabClick = useCallback((tab: MobileTab) => {
    setMobileTab(tab);
    if (tab !== "chat" && navigateToView) navigateToView(tab as ViewType);
  }, [navigateToView]);

  const showMobileInput = mobileTab === "preview" || mobileTab === "code" || mobileTab === "chat";

  return (
    <div className="fixed inset-0 bg-black">
      {/* Single pill portal — works on both mobile and desktop */}
      {createPortal(
        <>
          <div className="vibes-pill-fixed-mobile">
            <VibesSwitch size={50} isActive={isSidebarVisible} onToggle={(v) => {
              setIsSidebarVisible(v);
              if (v && !modalOpen) setModalOpen(true);
            }} className="cursor-pointer" />
          </div>
          <div className="vibes-pill-fixed">
            <VibesSwitch size={75} isActive={isSidebarVisible} onToggle={(v) => {
              setIsSidebarVisible(v);
              if (v && !modalOpen) setModalOpen(true);
            }} className="cursor-pointer" />
          </div>
        </>,
        document.body
      )}

      {/* ========== MOBILE LAYOUT (<768px) ========== */}
      <div className="vibes-mobile-layout">
        <div className="vibes-header">
          <div className="vibes-header-left">
            <div style={{ width: 100 }} />
          </div>
          <div className="vibes-header-center">
            {headerLeft}
          </div>
          <div className="vibes-header-right" />
        </div>

        <div className="vibes-mobile-tabs">
          {MOBILE_TABS.map((tab) => {
            const cfg = MOBILE_TAB_CONFIG[tab];
            const isActive = mobileTab === tab;
            return (
              <div key={tab} className={`navbar-button-wrapper${isActive ? " active" : ""}`}>
                <button
                  type="button"
                  onClick={() => handleMobileTabClick(tab)}
                  style={{
                    background: cfg.bg,
                    "--navbar-active-color": cfg.activeBorder,
                    width: isActive ? "auto" : undefined,
                    justifyContent: isActive ? "flex-start" : undefined,
                  } as React.CSSProperties}
                >
                  <div className="navbar-button-icon">
                    <svg width="28" height="28" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="17.5" cy="17.5" r="17.5" fill="#231F20" />
                      <foreignObject x="5" y="5" width="25" height="25">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color: "var(--vibes-cream, #fffff0)" }}>
                          {cfg.icon}
                        </div>
                      </foreignObject>
                    </svg>
                  </div>
                  <div
                    className="navbar-button-label"
                    style={isActive ? {
                      opacity: 1,
                      width: "auto",
                      maxWidth: 80,
                      padding: "0 10px 0 2px",
                      color: cfg.labelColor,
                    } : { color: cfg.labelColor }}
                  >
                    {cfg.label}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        <div
          className="vibes-mobile-content"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {mobileTab === "chat" ? chatPanel : previewPanel}
        </div>

        {showMobileInput && (
          <div className="vibes-mobile-input">
            {chatInput}
          </div>
        )}
      </div>

      {/* ========== DESKTOP LAYOUT (>=768px) ========== */}
      <div className="vibes-desktop-layout">
        <div className="vibes-border-inner">
          <div className="flex h-full w-full flex-col relative">
            {/* Row 1: Header with pill + url bar + pin button */}
            <div className="vibes-header">
              <div className="vibes-header-left">
                <div style={{ width: 125 }} />
              </div>
              <div className="vibes-header-center">
                {headerLeft}
              </div>
              <div className="vibes-header-right" />
            </div>

            {/* Row 2: Tab bar (only when pinned) */}
            {pinned && (
              <div style={{ display: "flex", flexShrink: 0, justifyContent: "flex-end", background: "var(--vibes-cream)", borderBottom: "1px solid var(--vibes-near-black)" }}>
                <button
                  type="button"
                  className="vibes-pin-btn"
                  onClick={togglePin}
                  title="Unpin to floating modal"
                  style={{ marginRight: "auto" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                </button>
                {(["chat", "code", "data", "settings"] as const).map((tab) => {
                  const cfg = MOBILE_TAB_CONFIG[tab];
                  const isActive = (tab === "chat" && currentView === "preview") || currentView === tab;
                  return (
                    <div key={tab} className={`navbar-button-wrapper${isActive ? " active" : ""}`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (tab === "chat") {
                            navigateToView?.("preview" as ViewType);
                          } else {
                            navigateToView?.(tab as ViewType);
                          }
                        }}
                        style={{
                          background: cfg.bg,
                          "--navbar-active-color": cfg.activeBorder,
                        } as React.CSSProperties}
                      >
                        <div className="navbar-button-icon">
                          <svg width="28" height="28" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="17.5" cy="17.5" r="17.5" fill="#231F20" />
                            <foreignObject x="5" y="5" width="25" height="25">
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color: "var(--vibes-cream, #fffff0)" }}>
                                {cfg.icon}
                              </div>
                            </foreignObject>
                          </svg>
                        </div>
                        <div className="navbar-button-label" style={{ color: cfg.labelColor }}>
                          {cfg.label}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {pinned ? (
              /* Two panels when pinned: left=preview, right=tab content */
              <div className="flex flex-grow overflow-hidden">
                <div className="flex-grow overflow-auto">
                  {previewPanel}
                </div>
                <div className="flex flex-col overflow-hidden" style={{ width: "33.333%", flexShrink: 0, borderLeft: "2px solid var(--vibes-near-black)" }}>
                  <div className="flex-grow overflow-auto">
                    {showChatInTabs ? chatPanel : previewPanel}
                  </div>
                  {showChatInTabs && (
                    <div className="vibes-chat-composer w-full">
                      <div className="w-full">{chatInput}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-grow overflow-auto">
                {previewPanel}
              </div>
            )}

            <div className="w-full">{appInfo}</div>
          </div>

          {/* Floating modal — only when unpinned */}
          {!pinned && (modalOpen || modalClosing) && (
            <div
              ref={initPos}
              className={`vibes-floating-modal${modalClosing ? " closing" : ""}`}
              style={{ left: modalPos.x, top: modalPos.y }}
            >
              <div
                className="vibes-floating-modal-header"
                onMouseDown={handleDragStart}
                style={{ cursor: "grab" }}
              >
                {React.isValidElement(headerRight)
                  ? React.cloneElement(headerRight as React.ReactElement<{ onClose?: () => void }>, { onClose: closeModal })
                  : headerRight}
              </div>

              <div className="vibes-floating-modal-content">
                {showChatInTabs ? chatPanel : previewPanel}
              </div>

              {showChatInTabs && (
                <>
                  {suggestionsComponent && (
                    <div className="w-full">
                      <div className="w-full">{suggestionsComponent}</div>
                    </div>
                  )}
                  <div className="vibes-chat-composer w-full">
                    <div className="w-full">{chatInput}</div>
                  </div>
                </>
              )}
            </div>
          )}

          {sharingState && (
            <AllowFireproofSharing
              state={sharingState}
              dbRef={dbRef}
              onResult={onResult}
              onDismiss={onDismiss}
              onLoginRedirect={onLoginRedirect}
            />
          )}
        </div>
      </div>
    </div>
  );
}
