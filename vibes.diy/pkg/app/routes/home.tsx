import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  useParams,
  useLocation,
  useNavigate,
} from "react-router";
import SessionView from "../components/SessionView.js";
import NewSessionView from "../components/NewSessionView.js";
import { encodeTitle } from "../components/SessionSidebar/utils.js";
import { HomeScreen } from "../pages/HomeScreen/HomeScreen.js";
import { useAuth } from "@clerk/clerk-react";

export function meta() {
  return [
    { title: "Vibes DIY - AI App Builder" },
    { name: "description", content: "Generate apps in one prompt" },
  ];
}

// Client loader to extract URL parameters as source of truth
export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const promptParam = url.searchParams.get("prompt");
  const modelParam = url.searchParams.get("model");

  return {
    urlPrompt: promptParam || null,
    urlModel: modelParam || null,
  };
}

export default function SessionWrapper() {
  // Check authentication state
  const { isSignedIn } = useAuth();

  // Always call all hooks unconditionally (Rules of Hooks)
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const originalNavigate = useNavigate();

  // Extract loader data from URL search params
  const searchParams = new URLSearchParams(location.search);
  const loaderData = {
    urlPrompt: searchParams.get("prompt") || null,
    urlModel: searchParams.get("model") || null,
  };

  // Extract all location properties as stable strings to prevent useEffect dependency issues
  const pathname = useMemo(
    () => location?.pathname || "",
    [location?.pathname],
  );
  const search = useMemo(() => location?.search || "", [location?.search]);
  const locationState = useMemo(
    () => location?.state || null,
    [location?.state],
  );

  // Create stable navigate function
  const navigate = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      return originalNavigate(to, options);
    },
    [originalNavigate],
  );

  const [sessionId, setSessionId] = useState<string | null>(
    () => urlSessionId || null,
  );

  // Keep local state in sync with the URL when params change after navigation
  useEffect(() => {
    if (urlSessionId !== sessionId) {
      setSessionId(urlSessionId ?? null);
    }
  }, [urlSessionId, sessionId]);

  const handleSessionCreate = (newSessionId: string) => {
    setSessionId(newSessionId);
  };

  // Handle prompt query parameter forwarding for root page
  useEffect(() => {
    // Skip if not signed in
    if (!isSignedIn) return;

    // Only handle forwarding when on root page (no sessionId) and there's a prompt query
    // Guard against duplicate navigations by checking local sessionId state
    if (!urlSessionId && !sessionId && search) {
      const searchParams = new URLSearchParams(search);
      const promptParam = searchParams.get("prompt");

      if (promptParam && promptParam.trim()) {
        // Generate a new session ID
        const newSessionId = `session-${Date.now()}`;

        // Generate a title slug from the prompt (first 50 chars)
        const promptTitle = promptParam.trim().slice(0, 50);
        const encodedPromptTitle = encodeTitle(promptTitle);

        // Build query string preserving both prompt and model parameters
        const forwardParams = new URLSearchParams();
        forwardParams.set("prompt", promptParam.trim());
        const modelParam = searchParams.get("model");
        if (modelParam && modelParam.trim()) {
          forwardParams.set("model", modelParam.trim());
        }

        // Forward to the new chat session URL with all parameters
        const targetUrl = `/chat/${newSessionId}/${encodedPromptTitle}?${forwardParams.toString()}`;

        // Set local state so render is consistent until the router updates params
        setSessionId(newSessionId);

        // Use React Router navigation to avoid hook count mismatch errors
        // Preserve browser history (no replace) to maintain back-button behavior
        navigate(targetUrl);
      }
    }
  }, [isSignedIn, urlSessionId, search, navigate, sessionId]);

  // If not signed in AND URL is empty, show HomeScreen
  if (!isSignedIn && !urlSessionId && !search) {
    return <HomeScreen />;
  }

  // Conditional rendering - true deferred session creation
  // Use either the URL param or local state during the initial transition
  const effectiveSessionId = urlSessionId ?? sessionId;

  if (!effectiveSessionId) {
    return <NewSessionView onSessionCreate={handleSessionCreate} />;
  }

  return (
    <SessionView
      sessionId={effectiveSessionId}
      pathname={pathname}
      search={search}
      locationState={locationState}
      navigate={navigate}
      urlPrompt={loaderData.urlPrompt}
      urlModel={loaderData.urlModel}
    />
  );
}
