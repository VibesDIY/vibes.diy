import { gridBackground, cx } from "@vibes.diy/base";
import React from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import type { ReactNode } from "react";
import { useShareableDB } from "../hooks/useShareableDB.js";
import { AllowFireproofSharing } from "./AllowFireproofSharing.js";
import { PillPortal, PILL_CLEARANCE } from "./PillPortal.js";

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
}

export default function AppLayout({
  chatPanel,
  previewPanel,
  headerLeft,
  headerRight,
  chatInput,
  suggestionsComponent,
  mobilePreviewShown = false,
  isSidebarVisible,
  setIsSidebarVisible,
  appInfo,
  fullWidthChat = false,
}: AppLayoutProps) {
  const { sharingState, dbRef, onResult, onDismiss, onLoginRedirect } = useShareableDB();
  useDocumentTitle("vibes.diy");

  return (
    <div className={cx(gridBackground, "page-grid-background relative flex h-dvh flex-col md:flex-row md:overflow-hidden")}>
      <PillPortal isActive={isSidebarVisible} onToggle={setIsSidebarVisible} mobilePreviewShown={mobilePreviewShown} />

      {/* Content with relative positioning to appear above the background */}
      <div
        className={`flex w-full flex-col ${fullWidthChat ? "md:w-full" : "md:w-1/3"} ${
          mobilePreviewShown ? "hidden md:flex md:h-full" : "h-full"
        } relative z-10 transition-all duration-300 ease-in-out`}
      >
        <div className="flex h-[4rem] items-center p-2">
          <div style={{ width: PILL_CLEARANCE }} />
          {headerLeft}
        </div>

        <div className="flex-grow overflow-auto">{chatPanel}</div>

        {suggestionsComponent && (
          <div className={`w-full ${fullWidthChat ? "md:flex md:justify-center" : ""}`}>
            <div className={`${fullWidthChat ? "md:w-4/5" : "w-full"}`}>{suggestionsComponent}</div>
          </div>
        )}

        <div
          className={`w-full ${fullWidthChat ? "md:flex md:justify-center md:pb-[20vh]" : "pb-0"} transition-all duration-300 ease-in-out`}
        >
          <div className={`${fullWidthChat ? "md:w-4/5" : "w-full"} transition-all duration-300 ease-in-out`}>{chatInput}</div>
        </div>
      </div>

      <div
        className={`flex w-full flex-col ${fullWidthChat ? "md:w-0" : "md:w-2/3"} ${
          mobilePreviewShown ? "h-full" : "h-auto overflow-visible opacity-100 md:h-full"
        } relative z-10 transition-all duration-300 ease-in-out`}
      >
        <div
          className={`flex items-center px-2 py-2 md:p-2 ${fullWidthChat && !mobilePreviewShown ? "h-0 overflow-hidden" : "md:h-[4rem] md:overflow-hidden"} transition-all duration-300 ease-in-out`}
        >
          {headerRight}
        </div>

        <div className="flex-grow overflow-auto">{previewPanel}</div>

        <div className="w-full">{appInfo}</div>
      </div>

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
  );
}
