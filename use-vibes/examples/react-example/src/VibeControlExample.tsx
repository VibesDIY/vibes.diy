import { HiddenMenuWrapper, VibesButton } from 'use-vibes';
import type { ExampleKey } from './App.tsx';

type VibeControlExampleProps = {
  setCurrentExample: (example: ExampleKey) => void;
};

const VibeControlExample = ({ setCurrentExample }: VibeControlExampleProps) => {
  return (
    <HiddenMenuWrapper
      menuContent={
        <div
          style={{
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '12px',
              width: '250px',
            }}
          >
            <VibesButton variant="primary">Login</VibesButton>
            <VibesButton variant="secondary">Remix</VibesButton>
            <VibesButton variant="tertiary">Invite</VibesButton>
          </div>
        </div>
      }
    >
      <div className="container" style={{ padding: '24px' }}>
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
        <h1>VibeControl Component Examples</h1>
        <p style={{ marginBottom: '2rem', color: '#666', fontSize: '1.1rem' }}>
          The VibeControl component provides a floating action button that opens a full-screen
          overlay. It can be used both as a React component and mounted via JavaScript in non-React
          environments.
        </p>
      </div>
    </HiddenMenuWrapper>
  );
};

export default VibeControlExample;
