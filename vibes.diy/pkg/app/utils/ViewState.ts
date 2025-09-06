import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { encodeTitle } from "../components/SessionSidebar/utils.js";
import { ViewControlsType, ViewState, ViewType } from "@vibes.diy/prompts";

// Helper to detect mobile viewport
export const isMobileViewport = () => {
  return typeof window !== "undefined" && window.innerWidth < 768;
};

export interface ViewStateProps {
  sessionId: string;
  title?: string;
  code: string;
  isStreaming: boolean;
  previewReady: boolean;
  isIframeFetching?: boolean;
  capturedPrompt?: string | null;
}

export function useViewState(
  props: Partial<ViewStateProps>,
): Partial<ViewState> {
  const { sessionId: paramSessionId, title: paramTitle } = useParams<{
    sessionId: string;
    title: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();

  // DEBUG: Track props changes in useViewState (limited to first 20)
  const viewStateLogCountRef = useRef(0);
  useEffect(() => {
    if (viewStateLogCountRef.current < 20) {
      viewStateLogCountRef.current++;
      console.log(`useViewState props CHANGED (#${viewStateLogCountRef.current}):`, {
        propsSessionId: props.sessionId,
        propsTitle: props.title,
        propsCodeLength: props.code?.length || 0,
        propsIsStreaming: props.isStreaming,
        propsPreviewReady: props.previewReady,
        propsIsIframeFetching: props.isIframeFetching,
        propsCapturedPrompt: props.capturedPrompt,
        currentTime: Date.now(),
      });
    } else if (viewStateLogCountRef.current === 20) {
      viewStateLogCountRef.current++;
      console.log(`useViewState props CHANGED (#21) - VIEWSTATE LOGGING DISABLED`);
    }
  }, [
    props.sessionId,
    props.title,
    props.code,
    props.isStreaming,
    props.previewReady,
    props.isIframeFetching,
    props.capturedPrompt
  ]);

  // Consolidate session and title from props or params
  const sessionId = props.sessionId || paramSessionId;
  const title = props.title || paramTitle;
  const encodedTitle = title ? encodeTitle(title) : "";

  // Derive view from URL path
  const getViewFromPath = (): ViewType => {
    if (location.pathname.endsWith("/app")) return "preview";
    if (location.pathname.endsWith("/code")) return "code";
    if (location.pathname.endsWith("/data")) return "data";
    if (location.pathname.endsWith("/chat")) return "chat";
    if (location.pathname.endsWith("/settings")) return "settings";
    return "preview"; // Default
  };

  const currentView = getViewFromPath();

  // Track previous states to determine transitions
  const wasStreamingRef = useRef(props.isStreaming);
  const hadCodeRef = useRef(props.code && props.code.length > 0);
  const wasPreviewReadyRef = useRef(props.previewReady);
  const initialNavigationDoneRef = useRef(false);

  // Auto-navigate based on app state changes
  useEffect(() => {
    // Don't auto-navigate if we don't have session and title info for URLs
    if (!sessionId || !encodedTitle) return;

    // First message (no previous code), show code view when code starts streaming
    // We don't change the URL path so it can later auto-navigate to app view
    if (
      props.isStreaming &&
      !wasStreamingRef.current &&
      (!hadCodeRef.current || props.code?.length === 0) &&
      // Don't auto-switch on mobile
      !isMobileViewport()
    ) {
      // For the initial code streaming, we want to display code without changing URL
      // This is handled by the component that uses this hook
      initialNavigationDoneRef.current = true;

      // Only if we're already at a specific view (app, code, data), should we navigate
      const path = location.pathname;
      const basePath = path.replace(/\/(app|code|data|settings)$/, "");

      // If current path has a view suffix, remove it for auto-navigation to work
      if (path !== basePath) {
        navigate(`/chat/${sessionId}/${encodedTitle}`);
      }
    }

    // As soon as previewReady becomes true, jump to preview view (app), UNLESS user is explicitly in data or code view
    // Removed mobile check to allow consistent behavior across all devices
    // Also skip if there's a capturedPrompt (URL prompt that hasn't been sent yet)
    if (props.previewReady && !wasPreviewReadyRef.current) {
      const isInDataView = location.pathname.endsWith("/data");
      const isInCodeView = location.pathname.endsWith("/code");
      const hasCapturedPrompt =
        props.capturedPrompt && props.capturedPrompt.trim().length > 0;
      if (!isInDataView && !isInCodeView && !hasCapturedPrompt) {
        navigate(`/chat/${sessionId}/${encodedTitle}/app`, { replace: true });
      }
    }

    // Update refs for next comparison
    wasStreamingRef.current = props.isStreaming;
    hadCodeRef.current = props.code && props.code.length > 0;
    wasPreviewReadyRef.current = props.previewReady;
  }, [
    props.isStreaming,
    props.previewReady,
    props.code,
    sessionId,
    encodedTitle,
    navigate,
  ]);

  // We handle the initial view display without changing the URL
  // This allows for proper auto-navigation to app view when preview is ready
  useEffect(() => {
    // The actual display of code view is handled by the component that uses this hook
    // We don't navigate to /code on initial load anymore
  }, []);

  // Access control data
  const viewControls: ViewControlsType = {
    preview: {
      enabled:
        props.previewReady ||
        !!(props.code && props.code.length > 0) ||
        !!(sessionId && sessionId.length > 0),
      icon: "app-icon",
      label: "App",
      loading: props.isIframeFetching,
    },
    code: {
      enabled: true,
      icon: "code-icon",
      label: "Code",
      loading: !!(
        props.isStreaming &&
        !props.previewReady &&
        props.code &&
        props.code?.length > 0
      ),
    },
    data: {
      enabled: !props.isStreaming,
      icon: "data-icon",
      label: "Data",
      loading: false,
    },
    settings: {
      enabled: !props.isStreaming,
      icon: "export-icon",
      label: "Settings",
      loading: false,
    },
  };

  // Navigate to a view (explicit user action)
  const navigateToView = (view: ViewType) => {
    // Skip navigation for chat view or if control doesn't exist/isn't enabled
    if (
      view === "chat" ||
      !viewControls[view as keyof typeof viewControls]?.enabled
    )
      return;

    if (sessionId && encodedTitle) {
      const suffix = view === "preview" ? "app" : view;
      navigate(`/chat/${sessionId}/${encodedTitle}/${suffix}`);
    }
  };

  // Only show view controls when we have content or a valid session
  const showViewControls = !!(
    (props.code && props.code.length > 0) ||
    (sessionId && sessionId.length > 0)
  );

  // Determine what view should be displayed (may differ from URL-based currentView)
  // If user has explicitly navigated to a view (indicated by URL path), respect that choice
  // Otherwise, if preview is ready, prioritize showing it
  // Finally, during streaming on desktop (without explicit navigation), show code view
  const hasExplicitViewInURL =
    location.pathname.endsWith("/app") ||
    location.pathname.endsWith("/code") ||
    location.pathname.endsWith("/data") ||
    location.pathname.endsWith("/settings");

  const displayView = hasExplicitViewInURL
    ? currentView // Respect user's explicit view choice from URL
    : props.previewReady
      ? "preview"
      : props.isStreaming && !isMobileViewport()
        ? "code"
        : currentView;

  return {
    currentView, // The view based on URL (for navigation)
    displayView, // The view that should actually be displayed
    navigateToView,
    viewControls,
    showViewControls,
    sessionId,
    encodedTitle,
  };
}
