import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthWall, HiddenMenuWrapper, VibesPanel } from '../../Components';
import { getContainerStyle } from './WelcomeToVibes.styles';

export const WelcomeToVibes: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [shouldBounce, setShouldBounce] = useState(false);
  const [showApp, setShowApp] = useState(false);

  useEffect(() => {
    // Manage showApp based on isLoggedIn
    if (isLoggedIn) {
      const timeout = setTimeout(() => {
        setShowApp(true);
      }, 1000);

      return () => clearTimeout(timeout);
    } else {
      setShowApp(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (showApp) {
      const startBounceTimeout = setTimeout(() => {
        setShouldBounce(true);
        const stopBounceTimeout = setTimeout(() => {
          setShouldBounce(false);
        }, 1700);
        return () => clearTimeout(stopBounceTimeout);
      }, 2300);

      return () => clearTimeout(startBounceTimeout);
    }
  }, [showApp]);

  return (
    <>
      {!showApp && (
        <AuthWall
          onLogin={() => setIsLoggedIn(true)}
          imageUrl="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1470&q=80"
          title="Random Vibe App"
          open={!isLoggedIn}
        />
      )}

      {showApp && (
        <HiddenMenuWrapper triggerBounce={shouldBounce} menuContent={<VibesPanel />}>
          <div style={getContainerStyle()}>
            <button onClick={() => setIsLoggedIn(false)} className="back-button">
              Reestart Tutorial
            </button>
            <Link to="/menu" className="back-button">
              Back to Menu
            </Link>
          </div>
        </HiddenMenuWrapper>
      )}
    </>
  );
};
