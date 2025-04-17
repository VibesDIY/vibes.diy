import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useSession } from '../hooks/useSession';
import { encodeTitle } from '~/components/SessionSidebar/utils';
import type { VibeDocument } from '~/types/chat';

export function meta() {
  return [
    { title: 'Remix App - Vibes DIY' },
    { name: 'description', content: 'Remix an existing app with Vibes DIY' },
  ];
}

export default function Remix() {
  const navigate = useNavigate();
  const { vibeSlug } = useParams<{ vibeSlug?: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appDomain, setAppDomain] = useState<string | null>(null);

  // Get database instances from hooks
  const {
    session,
    // mainDatabase,
    sessionDatabase,
    updateTitle,
  } = useSession(undefined);

  // Effect to get vibe slug from path parameter and fetch code
  useEffect(() => {
    async function processVibeSlug() {
      try {
        // Check if we have a vibe slug in the URL path
        if (!vibeSlug) {
          setError('No vibe slug provided. Use /remix/your-app-slug');
          setIsLoading(false);
          return;
        }

        // Use the slug directly
        const appName = vibeSlug;
        setAppDomain(appName);

        // Fetch the app code
        const appUrl = `https://${appName}.vibecode.garden/App.jsx`;
        const response = await fetch(appUrl);

        if (!response.ok) {
          throw new Error(`Error fetching app code: ${response.status}`);
        }

        const codeContent = await response.text();

        // Create a new session with this code
        const sessionTitle = `Remix of ${appName}`;

        // Update the session title
        await updateTitle(sessionTitle);
        console.log('Session created:', session);
        // get the vibe doc from session database
        const vibeDoc = await sessionDatabase.get<VibeDocument>('vibe');
        console.log('Vibe doc:', vibeDoc);
        vibeDoc.remixOf = appName;
        await sessionDatabase.put(vibeDoc);

        // Create and save user message directly with deterministic ID
        const userMessage = {
          _id: '0001-user-first',
          type: 'user',
          session_id: session._id,
          text: `Please help me remix ${appName}.vibecode.garden`,
          created_at: Date.now(),
        };
        const userResult = await sessionDatabase.put(userMessage);
        console.log('User message saved:', userResult);

        // Clean the code - remove esm.sh references from import statements
        const cleanedCode = codeContent.replace(
          /import\s+(.+)\s+from\s+['"]https:\/\/esm\.sh\/([^'"]+)['"];?/g,
          "import $1 from '$2';"
        );

        // Create and save AI response directly with deterministic ID
        const aiMessage = {
          _id: '0002-ai-first',
          type: 'ai',
          session_id: session._id,
          text: `Certainly, here is the code:\n\n\`\`\`jsx\n${cleanedCode}\n\`\`\`\n\nPlease let me know what you'd like to change.`,
          created_at: Date.now(),
        };
        const aiResult = await sessionDatabase.put(aiMessage);
        console.log('AI message saved:', aiResult);

        // Query to verify data was saved correctly
        const allDocs = await sessionDatabase.query('_id', { includeDocs: true });
        console.log(
          'All docs in session database:',
          allDocs.rows.map((row) => row.doc)
        );

        // Query specifically for documents with our session_id
        const sessionDocs = await sessionDatabase.query('session_id', {
          key: session._id,
          includeDocs: true,
        });
        console.log(
          'Documents with this session_id:',
          sessionDocs.rows.map((row) => row.doc)
        );

        // Navigate to the chat session URL
        navigate(`/chat/${session._id}/${encodeTitle(sessionTitle)}`);
      } catch (error) {
        console.error('Error in remix process:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
        setIsLoading(false);
      }
    }

    // Run the process
    processVibeSlug();
  }, []);

  // TV Static Canvas Effect
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas to full window size
    function resizeCanvas() {
      if (!canvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);

      // Reset canvas size in CSS
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create off-screen buffer
    const scale = 0.25; // 25% of screen resolution for performance
    const staticBuffer = document.createElement('canvas');
    staticBuffer.width = canvas.width * scale;
    staticBuffer.height = canvas.height * scale;
    const staticCtx = staticBuffer.getContext('2d');

    if (!staticCtx) return;

    // Generate the static pattern
    function generateStatic() {
      if (!staticCtx) return;

      const imgData = staticCtx.createImageData(staticBuffer.width, staticBuffer.height);
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
        canvas.height / (window.devicePixelRatio || 1)
      );

      animationRef.current = requestAnimationFrame(render);
    }

    render();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
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
        style={{ filter: 'brightness(0.5) contrast(1.2)' }}
      />

      {/* Content Container */}
      <div className="relative z-10">
        {isLoading ? (
          <div className="rounded-xl border border-white/20 bg-black/40 p-8 text-center shadow-2xl backdrop-blur-md">
            <div className="mb-4 text-4xl font-bold tracking-wider text-white">
              {appDomain ? `REMIXING ${appDomain.toUpperCase()}` : 'LOADING...'}
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
            <div className="mb-4 text-3xl font-bold text-red-500">TRANSMISSION ERROR</div>
            <div className="mt-2 text-lg text-white">{error}</div>
            <button
              onClick={() => navigate('/')}
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
