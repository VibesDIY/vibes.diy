import { SetURLSearchParams } from "react-router";
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

export function useViewState(
  promptState: PromptState,
  [searchParams, setSearchParams]: [URLSearchParams, SetURLSearchParams]
): ViewState {
  // const [searchParams, setSearchParams] = useSearchParams();
  const currentView = getViewFromPath(searchParams);
  // console.log(`useViewState initialized with view: ${currentView}, searchParams: ${searchParams.toString()}`);

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
      // console.log(`Navigating to view: ${view}:${searchParams.toString()}`);
      prev.set("view", view);
      return prev;
    });
  }

  return {
    currentView, // The view based on URL (for navigation)
    navigateToView,
    viewControls,
  };
}
