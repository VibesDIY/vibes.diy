import { VibesSwitch } from "@vibes.diy/base";
import React, { useEffect } from "react";
import type { ReactNode } from "react";
import { toast, Toaster } from "react-hot-toast";
import { useVibeDiy } from "../vibe-diy-provider.js";

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
  const { srvVibeSandbox } = useVibeDiy();
  useEffect(() => {
    srvVibeSandbox.shareableDBs.onSet((_k, v) => {
      toast(`Shareable DB for: ${v.dbName} - (${v.appSlug})`);
    });
  }, [srvVibeSandbox.shareableDBs.size]);

  return (
    <div className="page-grid-background grid-background relative flex h-dvh flex-col md:flex-row md:overflow-hidden">
      <div>
        <Toaster />
      </div>

      {/* Content with relative positioning to appear above the background */}
      <div
        className={`flex w-full flex-col ${fullWidthChat ? "md:w-full" : "md:w-1/3"} ${
          mobilePreviewShown ? "hidden md:flex md:h-full" : "h-full"
        } relative z-10 transition-all duration-300 ease-in-out`}
      >
        <div className="flex h-[4rem] items-center p-2">
          <div className="mb-8 ml-6 relative z-20">
            <VibesSwitch size={75} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
          </div>
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
          className={`flex items-center overflow-hidden p-2 ${fullWidthChat ? "h-0" : "h-[4rem]"} transition-all duration-300 ease-in-out`}
        >
          {headerRight}
        </div>

        <div className="flex-grow overflow-auto">{previewPanel}</div>

        <div className="w-full">{appInfo}</div>
      </div>
    </div>
  );
}
