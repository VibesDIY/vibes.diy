import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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

  // Track previous states to determine transitions
  // const wasStreamingRef = useRef(props.promptProcessing);
  // const hadCodeRef = useRef(props.code && props.code.length > 0);
  // const wasPreviewReadyRef = useRef(props.previewReady);
  // const initialNavigationDoneRef = useRef(false);

  // Auto-navigate based on app state changes
  useEffect(
    () => {
      // Don't auto-navigate if we don't have session and title info for URLs
      // if (promptState.) return;

      // First message (no previous code), show code view when code starts streaming
      // We don't change the URL path so it can later auto-navigate to app view
      if (
        promptState.running &&
        promptState.hasCode &&
        // Don't auto-switch on mobile
        !isMobileViewport()
      ) {
        // For the initial code streaming, we want to display code without changing URL
        // This is handled by the component that uses this hook
        // initialNavigationDoneRef.current = true;
        // Only if we're already at a specific view (app, code, data), should we navigate
        // const path = pathname;
        // const basePath = path.replace(/\/(app|code|data|settings)$/, "");
        // If current path has a view suffix, remove it for auto-navigation to work
        // if (path !== basePath) {
        //   console.log("t-3", sessionId);
        //   navigate(`/chat/${sessionId}/${encodedTitle}`);
        // }
      }

      // As soon as previewReady becomes true, jump to preview view (app), UNLESS user is explicitly in data or code view
      // Removed mobile check to allow consistent behavior across all devices
      // Also skip if there's a capturedPrompt (URL prompt that hasn't been sent yet)
      // if (props.previewReady && !wasPreviewReadyRef.current) {
      //   const isInDataView = pathname.endsWith("/data");
      //   const isInCodeView = pathname.endsWith("/code");
      //   const hasCapturedPrompt = props.capturedPrompt && props.capturedPrompt.trim().length > 0;
      //   if (!isInDataView && !isInCodeView && !hasCapturedPrompt) {
      //     navigate(`/chat/${sessionId}/${encodedTitle}/app`, { replace: true });
      //   }
      // }

      // Update refs for next comparison
      // wasStreamingRef.current = props.promptProcessing;
      // hadCodeRef.current = props.code && props.code.length > 0;
      // wasPreviewReadyRef.current = props.previewReady;
    },
    [
      /*props.promptProcessing, props.previewReady, props.code, sessionId, encodedTitle, navigate*/
    ]
  );

  // We handle the initial view display without changing the URL
  // This allows for proper auto-navigation to app view when preview is ready
  // useEffect(() => {
  //   // The actual display of code view is handled by the component that uses this hook
  //   // We don't navigate to /code on initial load anymore
  // }, []);

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
      console.log(`Navigating to view: ${view}`);
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
