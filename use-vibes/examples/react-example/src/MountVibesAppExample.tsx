import { useEffect, useRef, useState } from 'react';
import { mountVibesApp, type MountVibesAppResult } from 'use-vibes';
import type { ExampleKey } from './App.tsx';

type MountVibesAppExampleProps = {
  setCurrentExample: (example: ExampleKey) => void;
};

const MountVibesAppExample = ({ setCurrentExample }: MountVibesAppExampleProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mountResult, setMountResult] = useState<MountVibesAppResult | null>(null);
  const [status, setStatus] = useState<string>('Loading...');

  useEffect(() => {
    let mounted = true;
    let currentMountResult: MountVibesAppResult | null = null;

    // Simulate mounting like in vanilla JS environment
    if (containerRef.current) {
      try {
        setStatus('Mounting VibesApp...');

        // Mount the app to wrap document.body (like real usage)
        // This will wrap the entire React app, demonstrating the z-index layering issue
        currentMountResult = mountVibesApp({
          title: 'Mount Test App',
          database: 'mount-test-db',
        });

        if (mounted) {
          setMountResult(currentMountResult);
          setStatus('Success: mountVibesApp working with local bundler!');
          console.log('Mount result:', currentMountResult);
        }
      } catch (error) {
        if (mounted) {
          setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.error('Mount error:', error);
        }
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

      {/* Container that will be wrapped by mountVibesApp */}
      <div ref={containerRef}>
        {/* Content that should be wrapped - similar to test-use-vibes.html */}
        <div
          style={{
            width: '512px',
            height: '512px',
            backgroundColor: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            fontWeight: 'bold',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            margin: '20px auto',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            borderRadius: '8px',
          }}
        >
          Vibe
        </div>

        <p style={{ textAlign: 'center', color: '#666' }}>
          This green square should be wrapped by the auth wall initially,
          <br />
          then show with the vibes switch after authentication.
        </p>
      </div>
    </div>
  );
};

export default MountVibesAppExample;
