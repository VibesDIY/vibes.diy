import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  useParams,
  useLocation,
  useNavigate,
  useLoaderData,
} from "react-router";
import SessionView from "../components/SessionView.js";
import NewSessionView from "../components/NewSessionView.js";
import { encodeTitle } from "../components/SessionSidebar/utils.js";
import { HomeScreen } from "../pages/index.ts";

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
  const loaderData = useLoaderData<typeof clientLoader>();
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const originalNavigate = useNavigate();

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

  const handleSessionCreate = (newSessionId: string) => {
    setSessionId(newSessionId);
  };

  // Handle prompt query parameter forwarding for root page
  useEffect(() => {
    // Only handle forwarding when on root page (no sessionId) and there's a prompt query
    if (!urlSessionId && search) {
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

        // Use window.location to trigger a real page load instead of React Router navigation
        window.location.href = targetUrl;
      }
    }
  }, [urlSessionId, search, navigate]);

  // Conditional rendering - true deferred session creation
  if (!sessionId) {
    return <HomeScreen />;
    // return <NewSessionView onSessionCreate={handleSessionCreate} />;
  }

  return (
    <SessionView
      sessionId={sessionId}
      pathname={pathname}
      search={search}
      locationState={locationState}
      navigate={navigate}
      urlPrompt={loaderData.urlPrompt}
      urlModel={loaderData.urlModel}
    />
  );
}
