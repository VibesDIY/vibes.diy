import { useState } from 'react';
import { AuthWall, VibesButton } from 'use-vibes';

type VibeAuthWallExampleProps = {};

const VibeAuthWallExample = ({}: VibeAuthWallExampleProps) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  return (
    <div
      style={{
        height: '80vh',
        width: '80vw',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ width: 400 }}>
        <VibesButton variant="tertiary" onClick={() => setIsLoggedIn(false)}>
          {' '}
          Restart Auth Wall{' '}
        </VibesButton>
      </div>
      <AuthWall
        onLogin={() => setIsLoggedIn(true)}
        imageUrl="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1470&q=80"
        title="Random Vibe App"
        open={!isLoggedIn}
      />
    </div>
  );
};

export default VibeAuthWallExample;
