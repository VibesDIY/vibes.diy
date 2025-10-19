import React, { useState } from 'react';
import { VibesButton } from '../VibesButton/VibesButton.js';
import { getAppSlug } from '../../utils/appSlug.js';

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

  const getFormAction = () => {
    const appSlug = getAppSlug();
    return `https://vibes.diy/remix/${appSlug}`;
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
          <form
            id="mutate-form"
            action={getFormAction()}
            target="_top"
            method="GET"
            style={{ width: '100%' }}
          >
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                name="prompt"
                placeholder="Make it pink..."
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: '1px solid rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  outline: 'none',
                }}
                autoFocus
              />
            </div>
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
          </form>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          width: isExpanded ? '100%' : '250px',
        }}
      >
        <VibesButton variant="primary">Logout</VibesButton>
        <VibesButton
          variant="secondary"
          onClick={handleMutateClick}
          type={isExpanded ? 'submit' : 'button'}
          form={isExpanded ? 'mutate-form' : undefined}
        >
          {isExpanded ? '🚀 Submit' : '🧟 Mutate'}
        </VibesButton>
        <VibesButton variant="tertiary">Invite</VibesButton>
      </div>
    </div>
  );
}
