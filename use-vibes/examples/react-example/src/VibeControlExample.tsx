import { useState } from 'react';
import { VibeControl, mountVibeControl } from 'use-vibes';
import React from 'react';

function VibeControlExample() {
  const [mountInstance, setMountInstance] = useState<ReturnType<typeof mountVibeControl> | null>(null);
  const [reactOpen, setReactOpen] = useState(false);
  const [reactCloseCount, setReactCloseCount] = useState(0);

  // Mount function example
  const handleMountToDiv = () => {
    if (mountInstance) {
      mountInstance.unmount();
    }

    const newInstance = mountVibeControl({
      container: '#mount-container',
      label: 'Mounted Vibes',
      position: 'bottom-left',
      onOpen: () => console.log('Mounted instance opened!'),
      onClose: () => console.log('Mounted instance closed!'),
      children: React.createElement(
        'div',
        {},
        React.createElement('h3', {}, 'This VibeControl was mounted using mountVibeControl()'),
        React.createElement(
          'p',
          {},
          'This demonstrates how to embed VibeControl in non-React environments.'
        ),
        React.createElement(
          'div',
          {
            style: {
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#e3f2fd',
              borderRadius: '4px',
              border: '1px solid #bbdefb',
            },
          },
          React.createElement('strong', {}, 'Mount API Features:'),
          React.createElement(
            'ul',
            { style: { marginTop: '8px', marginBottom: '0' } },
            React.createElement('li', {}, 'mountVibeControl() - Mount to any DOM element'),
            React.createElement('li', {}, 'mountVibeControlToBody() - Mount to document.body'),
            React.createElement('li', {}, 'autoMountVibeControl() - Auto-mount from global config'),
            React.createElement('li', {}, 'instance.update() - Update props dynamically'),
            React.createElement('li', {}, 'instance.unmount() - Clean removal')
          )
        )
      ),
    });

    setMountInstance(newInstance);
  };

  const handleUnmount = () => {
    if (mountInstance) {
      mountInstance.unmount();
      setMountInstance(null);
    }
  };

  const handleUpdateMountInstance = () => {
    if (mountInstance) {
      mountInstance.update({
        label: `Updated ${Date.now()}`,
        position: 'top-right',
      });
    }
  };

  return (
    <div className="container">
      <h1>VibeControl Component Examples</h1>
      <p style={{ marginBottom: '2rem', color: '#666', fontSize: '1.1rem' }}>
        The VibeControl component provides a floating action button that opens a full-screen
        overlay. It can be used both as a React component and mounted via JavaScript in non-React
        environments.
      </p>

      {/* React Component Example */}
      <section style={{ marginBottom: '3rem' }}>
        <h2>React Component Usage</h2>
        <p>Use VibeControl directly as a React component:</p>

        <div
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
          }}
        >
          <strong>Status:</strong> {reactOpen ? 'Open' : 'Closed'} |<strong> Close Count:</strong>{' '}
          {reactCloseCount}
        </div>

        <VibeControl
          label="React Vibes"
          position="bottom-right"
          onOpen={() => {
            console.log('React VibeControl opened!');
            setReactOpen(true);
          }}
          onClose={() => {
            console.log('React VibeControl closed!');
            setReactOpen(false);
            setReactCloseCount((prev) => prev + 1);
          }}
        >
          <div>
            <h3>React Component Example</h3>
            <p>This VibeControl is rendered as a standard React component with custom content.</p>

            <div
              style={{
                marginTop: '20px',
                padding: '16px',
                backgroundColor: '#e8f5e8',
                borderRadius: '8px',
                border: '1px solid #4caf50',
              }}
            >
              <h4 style={{ margin: '0 0 8px 0', color: '#2e7d2e' }}>Component Features:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#2e7d2e' }}>
                <li>Four position options: bottom-right, bottom-left, top-right, top-left</li>
                <li>Custom labels and content via children prop</li>
                <li>onOpen/onClose callbacks for integration</li>
                <li>Escape key and backdrop click to close</li>
                <li>Portal rendering to avoid z-index issues</li>
                <li>Responsive design with proper mobile support</li>
              </ul>
            </div>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                onClick={() => alert('Custom action triggered!')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Custom Action
              </button>
            </div>
          </div>
        </VibeControl>
      </section>

      {/* Mount Function Example */}
      <section style={{ marginBottom: '3rem' }}>
        <h2>Mount Function Usage</h2>
        <p>Use mountVibeControl() to embed in non-React environments:</p>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1rem',
            flexWrap: 'wrap' as const,
          }}
        >
          <button
            onClick={handleMountToDiv}
            disabled={!!mountInstance}
            style={{
              padding: '8px 16px',
              backgroundColor: mountInstance ? '#ccc' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: mountInstance ? 'not-allowed' : 'pointer',
            }}
          >
            Mount to Container
          </button>

          <button
            onClick={handleUpdateMountInstance}
            disabled={!mountInstance}
            style={{
              padding: '8px 16px',
              backgroundColor: mountInstance ? '#ff9800' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: mountInstance ? 'pointer' : 'not-allowed',
            }}
          >
            Update Instance
          </button>

          <button
            onClick={handleUnmount}
            disabled={!mountInstance}
            style={{
              padding: '8px 16px',
              backgroundColor: mountInstance ? '#f44336' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: mountInstance ? 'pointer' : 'not-allowed',
            }}
          >
            Unmount
          </button>
        </div>

        <div
          id="mount-container"
          style={{
            position: 'relative',
            height: '200px',
            border: '2px dashed #ccc',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: mountInstance ? '#f0f8ff' : '#fafafa',
          }}
        >
          {mountInstance ? (
            <div style={{ textAlign: 'center', color: '#666' }}>
              <p>
                <strong>VibeControl mounted!</strong>
              </p>
              <p>Look for the "Mounted Vibes" button at bottom-left of this container.</p>
            </div>
          ) : (
            <p style={{ color: '#999', margin: 0 }}>
              Click "Mount to Container" to see the VibeControl mounted here
            </p>
          )}
        </div>
      </section>

      {/* Code Examples */}
      <section>
        <h2>Code Examples</h2>

        <h3>React Component</h3>
        <pre
          style={{
            backgroundColor: '#f5f5f5',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '0.9em',
          }}
        >
          {`import { VibeControl } from 'use-vibes';

function App() {
  return (
    <VibeControl
      label="My Controls"
      position="bottom-right"
      onOpen={() => console.log('Opened!')}
      onClose={() => console.log('Closed!')}
    >
      <div>
        <h3>Custom Content</h3>
        <p>Any React content can go here!</p>
      </div>
    </VibeControl>
  );
}`}
        </pre>

        <h3>Mount Function</h3>
        <pre
          style={{
            backgroundColor: '#f5f5f5',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '0.9em',
          }}
        >
          {`import { mountVibeControl } from 'use-vibes';

// Mount to a specific element
const control = mountVibeControl({
  container: '#my-container',
  label: 'Controls',
  position: 'bottom-left',
  children: React.createElement('div', {}, 'Custom content'),
  onOpen: () => console.log('Opened!')
});

// Update dynamically
control.update({ label: 'Updated!' });

// Clean up
control.unmount();`}
        </pre>

        <h3>Auto-mount from CDN</h3>
        <pre
          style={{
            backgroundColor: '#f5f5f5',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '0.9em',
          }}
        >
          {`<script>
  window.VIBE_CONTROL_CONFIG = {
    label: 'My App Controls',
    position: 'bottom-right'
  };
</script>
<script src="https://esm.sh/use-vibes/vibe-control-mount.js"></script>
<script>autoMountVibeControl();</script>`}
        </pre>
      </section>
    </div>
  );
}

export default VibeControlExample;
