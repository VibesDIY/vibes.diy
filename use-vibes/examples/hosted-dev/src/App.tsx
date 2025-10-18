import { useState } from 'react';
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
  const { database, useLiveQuery, enableSync, syncEnabled } = useFireproof('hosted-dev-app');
  const [message, setMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
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
              <li>• Sync Enabled: {syncEnabled ? '✅ Yes' : '❌ No'}</li>
              <li>• Database: Connected</li>
            </ul>
          </div>

          {/* Sync Controls */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={enableSync}
              disabled={syncEnabled || false}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncEnabled ? '✅ Sync Active' : 'Enable Sync'}
            </button>
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

        {/* Development Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">🔧 Development Notes:</h3>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• Edit files in use-vibes/pkg for live HMR</li>
            <li>• Authentication wall will appear when sync is enabled</li>
            <li>• Use URL params: ?api_key=custom&chat_url=custom</li>
            <li>• Check console for detailed initialization logs</li>
            <li>• Vibes control overlay is mounted at #vibe-control</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
