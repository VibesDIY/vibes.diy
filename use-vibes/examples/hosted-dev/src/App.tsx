import { useState, useEffect } from 'react';
import { useFireproof } from 'use-vibes';
import { callAi } from 'call-ai';

// Message document interface
interface MessageDoc {
  _id: string;
  type: string;
  text: string;
  timestamp: string;
}

// Extend global Window interface
declare global {
  interface Window {
    CALLAI_API_KEY?: string;
    CALLAI_CHAT_URL?: string;
    CALLAI_IMG_URL?: string;
  }
}

// Sample app that demonstrates hosted app patterns
export default function App() {
  const { database, useLiveQuery, attach } = useFireproof('hosted-dev-app');
  const [message, setMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);

  // Vibe loading state
  const [vibeSlug, setVibeSlug] = useState('');
  const [vibeCode, setVibeCode] = useState('');
  const [vibeLoading, setVibeLoading] = useState(false);
  const [vibeError, setVibeError] = useState('');

  // Sample data query (like hosted apps would do)
  const { docs: messages } = useLiveQuery('type', {
    key: 'message',
    descending: true,
  }) as { docs: MessageDoc[] };

  const handleAddMessage = async () => {
    if (!message.trim()) return;

    await database.put({
      _id: `msg-${Date.now()}`,
      type: 'message',
      text: message,
      timestamp: new Date().toISOString(),
    });

    setMessage('');
  };

  const handleAiCall = async () => {
    setLoading(true);
    setAiResponse('');

    try {
      // Test AI integration (like hosted apps would do)
      const response = await callAi('Say hello and explain what this app demonstrates');

      setAiResponse(typeof response === 'string' ? response : JSON.stringify(response));
    } catch (error) {
      setAiResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchVibeCode = async (slug: string) => {
    setVibeLoading(true);
    setVibeError('');
    setVibeCode('');

    try {
      // Try both vibesdiy domains
      const domains = ['vibesdiy.app', 'vibesdiy.net'];
      let response: Response | null = null;
      let lastError: Error | null = null;

      for (const domain of domains) {
        try {
          const url = `https://${slug}.${domain}/App.jsx`;
          console.log(`🔍 Fetching vibe from: ${url}`);
          response = await fetch(url);
          if (response.ok) {
            break;
          }
        } catch (error) {
          lastError = error as Error;
          console.log(`❌ Failed to fetch from ${domain}:`, error);
          continue;
        }
      }

      if (!response || !response.ok) {
        throw new Error(
          `Failed to fetch vibe "${slug}" from all domains. Last error: ${lastError?.message}`
        );
      }

      const code = await response.text();
      setVibeCode(code);
      console.log(`✅ Successfully loaded vibe "${slug}" (${code.length} chars)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setVibeError(errorMessage);
      console.error(`💥 Failed to load vibe "${slug}":`, errorMessage);
    } finally {
      setVibeLoading(false);
    }
  };

  // Check for vibe slug in URL path
  useEffect(() => {
    const path = window.location.pathname;
    const vibeMatch = path.match(/\/vibe\/(.+)$/);
    if (vibeMatch) {
      const slug = vibeMatch[1];
      setVibeSlug(slug);
      fetchVibeCode(slug);
    } else if (path === '/vibe' || path === '/vibe/') {
      // Default to lunar-filter-7721
      const defaultSlug = 'lunar-filter-7721';
      setVibeSlug(defaultSlug);
      fetchVibeCode(defaultSlug);
    }
  }, []);

  const handleLoadVibe = () => {
    if (vibeSlug.trim()) {
      fetchVibeCode(vibeSlug.trim());
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🏠 Hosted Dev Environment</h1>
        <p className="text-gray-600 mb-4">
          This example app mimics the hosted environment on vibesdiy.net with live HMR for
          development.
        </p>

        {/* Environment Info */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
          <h3 className="font-semibold text-blue-900 mb-2">Environment Status:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• API Key: {window.CALLAI_API_KEY}</li>
            <li>• Chat URL: {window.CALLAI_CHAT_URL}</li>
            <li>
              • Sync Status: {attach?.state === 'attached' ? '✅ Connected' : '❌ Not Connected'}
            </li>
            <li>• Database: Connected</li>
          </ul>
        </div>

        {/* Sync Info */}
        <div className="mb-4 text-sm text-gray-600">
          <p>Sign in with Clerk to enable automatic cloud sync</p>
        </div>
      </div>

      {/* Database Demo */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Fireproof Database Demo</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAddMessage()}
          />
          <button
            onClick={handleAddMessage}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Add Message
          </button>
        </div>

        <div className="space-y-2">
          {messages.map((msg) => (
            <div key={msg._id} className="p-3 bg-gray-50 rounded border">
              <p className="text-gray-900">{msg.text}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(msg.timestamp).toLocaleString()}
              </p>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-gray-500 italic">No messages yet. Add one above!</p>
          )}
        </div>
      </div>

      {/* AI Integration Demo */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">🤖 AI Integration Demo</h2>

        <button
          onClick={handleAiCall}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 mb-4"
        >
          {loading ? 'Calling AI...' : 'Test AI Call'}
        </button>

        {aiResponse && (
          <div className="p-3 bg-gray-50 rounded border">
            <h3 className="font-semibold text-gray-900 mb-2">AI Response:</h3>
            <p className="text-gray-700">{aiResponse}</p>
          </div>
        )}
      </div>

      {/* Vibe Loading Demo */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">🎨 Vibe Loading Demo</h2>
        <p className="text-gray-600 mb-4">
          Load production vibes from vibesdiy.app or vibesdiy.net to see their code.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={vibeSlug}
            onChange={(e) => setVibeSlug(e.target.value)}
            placeholder="Enter vibe slug (e.g., lunar-filter-7721)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleLoadVibe()}
          />
          <button
            onClick={handleLoadVibe}
            disabled={vibeLoading || !vibeSlug.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {vibeLoading ? 'Loading...' : 'Load Vibe'}
          </button>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          <p>💡 Try these examples:</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {['lunar-filter-7721', 'dynamic-vishnu-1713'].map((example) => (
              <button
                key={example}
                onClick={() => {
                  setVibeSlug(example);
                  fetchVibeCode(example);
                }}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
              >
                {example}
              </button>
            ))}
          </div>
          <p className="mt-2">
            🌐 URL support: visit <code>/vibe/{'{slug}'}</code> to auto-load
          </p>
        </div>

        {vibeError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded mb-4">
            <h3 className="font-semibold text-red-900 mb-2">❌ Error loading vibe:</h3>
            <p className="text-red-700 text-sm">{vibeError}</p>
          </div>
        )}

        {vibeCode && (
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">📄 Vibe Code:</h3>
            <div className="p-3 bg-gray-50 rounded border max-h-96 overflow-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{vibeCode}</pre>
            </div>
            <p className="text-xs text-gray-500">
              Loaded {vibeCode.length} characters from production
            </p>
          </div>
        )}
      </div>

      {/* Development Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
        <h3 className="font-semibold text-yellow-900 mb-2">🔧 Development Notes:</h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Edit files in use-vibes/pkg for live HMR</li>
          <li>• Authentication wall will appear when sync is enabled</li>
          <li>• Use URL params: ?api_key=custom&chat_url=custom</li>
          <li>• Check console for detailed initialization logs</li>
          <li>• Vibes app is mounted to document.body via a portal approach</li>
        </ul>
      </div>
    </div>
  );
}
