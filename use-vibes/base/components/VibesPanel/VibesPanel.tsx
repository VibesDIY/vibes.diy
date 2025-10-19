import React from 'react';
import { VibesButton } from '../VibesButton/VibesButton.js';

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
  const handleMutateClick = () => {
    // Extract app slug from current URL (part before underscore)
    const hostname = window.location.hostname;
    const appSlug = hostname.split('.')[0].split('_')[0];
    const mutateUrl = `https://vibes.diy/mutate/${appSlug}`;
    window.open(mutateUrl, '_blank');
  };

  return (
    <div
      style={{
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px',
        ...style,
      }}
      className={className}
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
        <VibesButton variant="primary">Logout</VibesButton>
        <VibesButton variant="secondary" onClick={handleMutateClick}>🧟 Mutate</VibesButton>
        <VibesButton variant="tertiary">Invite</VibesButton>
      </div>
    </div>
  );
}
