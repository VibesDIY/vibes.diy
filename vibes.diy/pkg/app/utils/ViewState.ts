import { useSearchParams } from "react-router";
import { ViewControlsType, ViewType } from "@vibes.diy/prompts";
import { PromptState } from "../routes/chat/chat.$userSlug.$appSlug.js";

// Helper to detect mobile viewport
export const isMobileViewport = () => {
  return typeof window !== "undefined" && window.innerWidth < 768;
};

// export interface ViewStateProps {
//   // chatId: string;
//   // sessionId: string;
//   // title: string;
//   // code: string;
//   // promptProcessing: boolean;
//   // previewReady: boolean;
//   // isIframeFetching?: boolean;
//   // capturedPrompt?: string | null;
// }

function getViewFromPath(searchParams: URLSearchParams): ViewType {
  switch (searchParams.get("view")) {
    case "code":
    case "data":
    case "chat":
    case "settings":
      return searchParams.get("view") as ViewType;
    case "app":
    default:
      return "preview";
  }
}

export interface ViewState {
  readonly currentView: ViewType;
  // readonly displayView: ViewType;
  readonly navigateToView: (view: ViewType) => void;
  readonly viewControls: ViewControlsType;
  // readonly showViewControls: boolean;
  // readonly sessionId: string;
  // readonly encodedTitle: string;
}

export function useViewState(promptState: PromptState): ViewState {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = getViewFromPath(searchParams);

  // Note: switch to app view happens in fsIdClick (chat route) when the
  // fsId arrives, so both pathname and view update atomically

  // Access control data
  const viewControls: ViewControlsType = {
    preview: {
      enabled: !promptState.running || promptState.hasCode /* || !!(sessionId && sessionId.length > 0) */,
      icon: "app-icon",
      label: "App",
      // loading: props.isIframeFetching,
      loading: false,
    },
    code: {
      enabled: true,
      icon: "code-icon",
      label: "Code",
      loading: !!(promptState.running && /*!promptState.previewReady && */ promptState.hasCode),
    },
    data: {
      enabled: !promptState.running,
      icon: "data-icon",
      label: "Data",
      loading: false,
    },
    settings: {
      enabled: !promptState.running,
      icon: "export-icon",
      label: "Settings",
      loading: false,
    },
  };

  // Navigate to a view (explicit user action)
  function navigateToView(view: ViewType) {
    // Skip navigation for chat view or if control doesn't exist/isn't enabled
    // if (view === "chat" || !viewControls[view as keyof typeof viewControls]?.enabled) return;
    setSearchParams((prev) => {
      console.log(`Navigating to view: ${view}:${searchParams.toString()}`);
      prev.set("view", view);
      return prev;
    });

    // if (sessionId && encodedTitle) {
    //   const suffix = view === "preview" ? "app" : view;
    //   navigate(`/chat/${sessionId}/${encodedTitle}/${suffix}`);
    // }
  }

  // Only show view controls when we have content or a valid session
  // const showViewControls = !!((props.code && props.code.length > 0) || (sessionId && sessionId.length > 0));

  // Determine what view should be displayed (may differ from URL-based currentView)
  // If user has explicitly navigated to a view (indicated by URL path), respect that choice
  // Otherwise, if preview is ready, prioritize showing it
  // Finally, during streaming on desktop (without explicit navigation), show code view
  // const hasExplicitViewInURL =
  //   pathname.endsWith("/app") || pathname.endsWith("/code") || pathname.endsWith("/data") || pathname.endsWith("/settings");

  // const displayView = hasExplicitViewInURL
  //   ? currentView // Respect user's explicit view choice from URL
  //   : props.previewReady
  //     ? "preview"
  //     : props.promptProcessing && !isMobileViewport()
  //       ? "code"
  //       : currentView;

  return {
    currentView, // The view based on URL (for navigation)
    // displayView, // The view that should actually be displayed
    navigateToView,
    viewControls,
    // showViewControls,
    // sessionId,
    // encodedTitle,
  };
}
