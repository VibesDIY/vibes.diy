import React, { useState } from 'react';
import { VibesButton } from '../VibesButton/VibesButton.js';
import { generateFreshDataUrl, generateRemixUrl } from '../../utils/appSlug.js';

export interface VibesPanelProps {
  /** Optional custom styling for the panel container */
  style?: React.CSSProperties;
  /** Optional className for the panel container */
  className?: string;
}

/**
 * VibesPanel - Standard panel with Login, Remix, and Invite buttons
 *
 * This component provides the standard three-button layout used
 * throughout the Vibes DIY platform for authentication and actions.
 */
export function VibesPanel({ style, className }: VibesPanelProps = {}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleMutateClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
    }
  };

  const handleFreshDataClick = () => {
    window.open(generateFreshDataUrl(), '_top');
  };

  const handleChangeCodeClick = () => {
    window.open(generateRemixUrl(), '_top');
  };

  const handleLogoutClick = () => {
    document.dispatchEvent(new CustomEvent('vibes-sync-disable'));
    // Reload the page after logout
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const containerStyle: React.CSSProperties = {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    ...style,
  };

  return (
    <div style={containerStyle} className={className}>
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
        {isExpanded ? (
          // Mutate mode buttons
          <>
            <VibesButton variant="primary" onClick={handleFreshDataClick}>
              Fresh Data
            </VibesButton>
            <VibesButton variant="secondary" onClick={handleChangeCodeClick}>
              Change the Code
            </VibesButton>
            <VibesButton variant="tertiary" onClick={() => setIsExpanded(false)}>
              ← Back
            </VibesButton>
          </>
        ) : (
          // Normal buttons
          <>
            <VibesButton variant="primary" onClick={handleLogoutClick}>
              Logout
            </VibesButton>
            <VibesButton variant="secondary" onClick={handleMutateClick}>
              🧟 Mutate
            </VibesButton>
            <VibesButton variant="tertiary">Invite</VibesButton>
          </>
        )}
      </div>
    </div>
  );
}
