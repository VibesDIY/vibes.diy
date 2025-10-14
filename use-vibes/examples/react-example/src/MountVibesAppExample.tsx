import { useEffect, useState } from 'react';
import { mountVibesApp, type MountVibesAppResult } from 'use-vibes';

type ExampleKey =
  | 'home'
  | 'image-generator'
  | 'todo-list'
  | 'vibes-generator'
  | 'vibe-control'
  | 'share'
  | 'vibe-auth-wall'
  | 'mount-vibes-app';

type MountVibesAppExampleProps = {
  setCurrentExample: (example: ExampleKey) => void;
};

const MountVibesAppExample = ({ setCurrentExample }: MountVibesAppExampleProps) => {
  const [status, setStatus] = useState<string>('Loading...');
  const [clickCount, setClickCount] = useState(0);
  const [inputValue, setInputValue] = useState('Test interactivity');
  const [timeStamp, setTimeStamp] = useState('');

  useEffect(() => {
    let mounted = true;
    let currentMountResult: MountVibesAppResult | null = null;

    // Mount the app (targets document.body automatically)
    try {
      setStatus('Mounting VibesApp...');

      // Mount the app to wrap document.body (like real usage)
      // This will wrap the entire React app, demonstrating the z-index layering issue
      currentMountResult = mountVibesApp({
        title: 'Mount Test App',
        database: 'mount-test-db',
      });

      if (mounted) {
        setStatus('Success: mountVibesApp working with local bundler!');
        console.log('Mount result:', currentMountResult);
      }
    } catch (error) {
      if (mounted) {
        setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('Mount error:', error);
      }
    }

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (currentMountResult) {
        currentMountResult.unmount();
      }
    };
  }, []); // Remove mountResult dependency to avoid re-running

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div
        style={{
          padding: '1rem 0',
          borderBottom: '1px solid #eee',
          marginBottom: '1rem',
          width: '100%',
        }}
      >
        <button
          onClick={() => setCurrentExample('home')}
          style={{
            background: 'none',
            border: 'none',
            color: '#007acc',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          ← Back to Examples
        </button>
      </div>

      <h1>mountVibesApp Test</h1>
      <p style={{ marginBottom: '2rem', color: '#666', fontSize: '1.1rem' }}>
        Testing the unified mount function that wraps existing content with auth wall → vibes switch
        flow. This uses the local bundler for faster iteration.
      </p>

      <div
        id="status"
        style={{
          padding: '12px',
          background: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '4px',
          marginBottom: '20px',
          fontFamily: 'monospace',
        }}
      >
        {status}
      </div>

      {/* Content that will be wrapped by mountVibesApp */}
      <div>
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '20px',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9',
          }}
        >
          <h2 style={{ color: '#333', marginTop: '0' }}>Interactive Test Elements</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            These elements test that DOM interactivity is preserved after mountVibesApp wrapping:
          </p>

          {/* Button test */}
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={() => {
                setClickCount((count) => count + 1);
                setTimeStamp(new Date().toLocaleTimeString());
              }}
              style={{
                padding: '12px 20px',
                fontSize: '16px',
                backgroundColor: '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px',
              }}
            >
              Click Me! ({clickCount})
            </button>
            {timeStamp && (
              <span style={{ color: '#666', fontSize: '14px' }}>Last clicked: {timeStamp}</span>
            )}
          </div>

          {/* Input test */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#333' }}>
              Text Input (should maintain state):
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
              placeholder="Type here - should persist after mount"
            />
            <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 0 0' }}>
              Current value: "{inputValue}"
            </p>
          </div>

          {/* Visual indicator */}
          <div
            style={{
              width: '200px',
              height: '100px',
              backgroundColor: clickCount > 0 ? '#22c55e' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'white',
              fontFamily: 'Arial, sans-serif',
              margin: '20px auto',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              borderRadius: '8px',
              transition: 'background-color 0.3s ease',
            }}
          >
            {clickCount > 0 ? '✓ Interactive!' : '✗ Not Clicked'}
          </div>

          <p style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
            If this content loses interactivity after mountVibesApp wraps it,
            <br />
            the buttons won't work and inputs will reset - indicating innerHTML cloning.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MountVibesAppExample;
