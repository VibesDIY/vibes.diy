import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { encodeTitle } from "../components/SessionSidebar/utils.js";
import { useSession } from "../hooks/useSession.js";
import { VibeDocument } from "@vibes.diy/prompts";

export function meta() {
  return [
    { title: "Remix App - Vibes DIY" },
    { name: "description", content: "Remix an existing app with Vibes DIY" },
  ];
}

interface RemixProps {
  onNavigate?: (url: string) => void;
}

export default function Remix({
  onNavigate = (url) => (window.location.href = url),
}: RemixProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { vibeSlug } = useParams<{ vibeSlug?: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appDomain, setAppDomain] = useState<string | null>(null);

  // Generate a sessionId for this remix session
  const [sessionId] = useState(
    () =>
      `remix-${Date.now().toString(36).padStart(9, "f")}${Math.random().toString(36).slice(2, 11).padEnd(9, "0")}`,
  );

  // Get database instances from hooks
  const { session, sessionDatabase, updateTitle } = useSession(sessionId);

  // Get API key for title generation
  // const { apiKey } = useApiKey(userPayload?.userId);

  // Effect to get vibe slug from path parameter and fetch code
  useEffect(() => {
    async function processVibeSlug() {
      try {
        // Check if we have a vibe slug in the URL path
        if (!vibeSlug) {
          setError("No vibe slug provided. Use /remix/your-app-slug");
          setIsLoading(false);
          return;
        }

        // Get the prompt parameter from the URL right away
        const urlParams = new URLSearchParams(location.search);
        const promptParameter = urlParams.get("prompt");

        // Use the slug directly
        const appName = vibeSlug;
        setAppDomain(appName);

        // Fetch the app code
        const appUrl = `https://${appName}.vibesdiy.app/App.jsx`;
        const response = await fetch(appUrl, {
          headers: {
            "X-VIBES-Token": localStorage.getItem("vibes-diy-auth-token") || "",
          },
        });

        if (!response.ok) {
          throw new Error(`Error fetching app code: ${response.status}`);
        }

        const codeContent = await response.text();

        const vibeDoc = await sessionDatabase
          .get<VibeDocument>("vibe")
          .catch(() => {
            return { _id: "vibe", created_at: Date.now() } as VibeDocument;
          });

        vibeDoc.remixOf = appName;
        await sessionDatabase.put(vibeDoc);

        // Create and save user message directly with deterministic ID - always use the standard message
        const userMessage = {
          _id: "0001-user-first",
          type: "user",
          session_id: session._id,
          text: `Please help me remix ${appName}.vibesdiy.app`,
          created_at: Date.now(),
        };
        await sessionDatabase.put(userMessage);

        // Clean the code - remove esm.sh references from import statements
        const cleanedCode = codeContent.replace(
          /import\s+(.+)\s+from\s+['"]https:\/\/esm\.sh\/([^'"]+)['"];?/g,
          "import $1 from '$2';",
        );

        // Create and save AI response directly with deterministic ID
        const aiMessage = {
          _id: "0002-ai-first",
          type: "ai",
          session_id: session._id,
          text: `Certainly, here is the code:\n\n\`\`\`jsx\n${cleanedCode}\n\`\`\`\n\nPlease let me know what you'd like to change.`,
          created_at: Date.now(),
        };
        await sessionDatabase.put(aiMessage);

        // Generate a better title based on the code content
        const finalTitle = `Remix of ${appName}`;
        // try {
        //   // Parse the content to get segments
        //   const { segments } = parseContent(aiMessage.text);

        //   // Use the title generation model from useSimpleChat
        //   const titleModel = 'meta-llama/llama-3.1-8b-instruct';

        //   finalTitle = await generateTitle(segments, titleModel, apiKey);
        // } catch (titleError) {
        //   console.error('Error generating title:', titleError);
        //   // Keep the initial title if generation fails
        // }
        await updateTitle(finalTitle);

        // Build the target URL, including the prompt parameter if it exists
        let targetUrl = `/chat/${session._id}/${encodeTitle(finalTitle)}/chat`;

        // Forward the prompt parameter to the chat route if it exists
        if (promptParameter && promptParameter.trim()) {
          targetUrl += `?prompt=${encodeURIComponent(promptParameter.trim())}`;
        }

        onNavigate(targetUrl);
      } catch (error) {
        console.error("Error in remix process:", error);
        setError(
          error instanceof Error ? error.message : "Unknown error occurred",
        );
        setIsLoading(false);
      }
    }

    processVibeSlug();
  }, []);

  // TV Static Canvas Effect
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas to full window size
    function resizeCanvas() {
      if (!canvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);

      // Reset canvas size in CSS
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Create off-screen buffer
    const scale = 0.25; // 25% of screen resolution for performance
    const staticBuffer = document.createElement("canvas");
    staticBuffer.width = canvas.width * scale;
    staticBuffer.height = canvas.height * scale;
    const staticCtx = staticBuffer.getContext("2d");

    if (!staticCtx) return;

    // Generate the static pattern
    function generateStatic() {
      if (!staticCtx) return;

      const imgData = staticCtx.createImageData(
        staticBuffer.width,
        staticBuffer.height,
      );
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Random grayscale value
        const val = Math.floor(Math.random() * 256);
        data[i] = val; // Red
        data[i + 1] = val; // Green
        data[i + 2] = val; // Blue
        data[i + 3] = 255; // Alpha
      }

      staticCtx.putImageData(imgData, 0, 0);
    }

    // Animation loop
    function render() {
      if (!ctx || !canvas) return;

      generateStatic();

      ctx.drawImage(
        staticBuffer,
        0,
        0,
        staticBuffer.width,
        staticBuffer.height,
        0,
        0,
        canvas.width / (window.devicePixelRatio || 1),
        canvas.height / (window.devicePixelRatio || 1),
      );

      animationRef.current = requestAnimationFrame(render);
    }

    render();

    // Cleanup
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Loading or error screen
  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden">
      {/* TV Static Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
        style={{ filter: "brightness(0.5) contrast(1.2)" }}
      />

      {/* Content Container */}
      <div className="relative z-10">
        {isLoading ? (
          <div className="rounded-xl border border-white/20 bg-black/40 p-8 text-center shadow-2xl backdrop-blur-md">
            <div className="mb-4 text-4xl font-bold tracking-wider text-white">
              {appDomain ? `REMIXING ${appDomain.toUpperCase()}` : "LOADING..."}
            </div>
            <div className="relative mt-6 h-3 w-64 overflow-hidden rounded-full bg-gray-700">
              <div className="glow-effect absolute top-0 right-0 left-0 h-full animate-pulse bg-green-500"></div>
            </div>
            <style
              dangerouslySetInnerHTML={{
                __html: `
              @keyframes glow {
                0%, 100% { box-shadow: 0 0 10px 2px rgba(74, 222, 128, 0.6); }
                50% { box-shadow: 0 0 20px 5px rgba(74, 222, 128, 0.8); }
              }
              .glow-effect {
                animation: glow 1.5s ease-in-out infinite;
              }
            `,
              }}
            />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/40 bg-black/40 p-8 text-center shadow-2xl backdrop-blur-md">
            <div className="mb-4 text-3xl font-bold text-red-500">
              TRANSMISSION ERROR
            </div>
            <div className="mt-2 text-lg text-white">{error}</div>
            <button
              onClick={() => navigate("/")}
              className="mt-6 rounded-md border border-white/30 bg-white/10 px-6 py-3 text-lg font-medium text-white transition-all duration-300 hover:bg-white/20"
            >
              Return to Base
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
