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

  const containerStyle: React.CSSProperties = {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    transition: 'all 0.3s ease-in-out',
    ...(isExpanded && {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '75%',
      maxWidth: '600px',
      height: 'auto',
      minHeight: '200px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      zIndex: 9999,
    }),
    ...style,
  };

  return (
    <div style={containerStyle} className={className}>
      {isExpanded && (
        <div style={{ width: '100%', marginBottom: '12px' }}>
          {/* Mutate heading */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#333',
            }}>
              Mutate
            </h2>
          </div>
          
          {/* Close button */}
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#666',
            }}
          >
            ×
          </button>
          
          {/* Two action buttons */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '100%',
          }}>
            <VibesButton 
              variant="primary" 
              onClick={handleFreshDataClick}
              style={{ width: '100%' }}
            >
              Fresh Data
            </VibesButton>
            <VibesButton 
              variant="secondary" 
              onClick={handleChangeCodeClick}
              style={{ width: '100%' }}
            >
              Change the Code
            </VibesButton>
          </div>
        </div>
      )}
      {!isExpanded && (
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
          <VibesButton variant="primary">Logout</VibesButton>
          <VibesButton
            variant="secondary"
            onClick={handleMutateClick}
          >
            🧟 Mutate
          </VibesButton>
          <VibesButton variant="tertiary">Invite</VibesButton>
        </div>
      )}
    </div>
  );
}
