import React, { useState, useEffect } from 'react';
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
type PanelMode = 'default' | 'mutate' | 'invite';

export function VibesPanel({ style, className }: VibesPanelProps = {}) {
  const [mode, setMode] = useState<PanelMode>('default');
  const [email, setEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState('');

  const handleMutateClick = () => {
    if (mode === 'default') {
      setMode('mutate');
    }
  };

  const handleInviteClick = () => {
    if (mode === 'default') {
      setMode('invite');
      setEmail('');
      setInviteStatus('idle');
      setInviteMessage('');
    }
  };

  const handleBackClick = () => {
    setMode('default');
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

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setInviteStatus('sending');
    setInviteMessage('');
    
    // Dispatch share request event
    document.dispatchEvent(new CustomEvent('vibes-share-request', {
      detail: {
        email: email.trim(),
        role: 'member',
        right: 'read'
      }
    }));
  };

  // Listen for share response events
  useEffect(() => {
    const handleShareSuccess = (event: Event) => {
      const customEvent = event as CustomEvent<{ email: string; message?: string }>;
      setInviteStatus('success');
      setInviteMessage(customEvent.detail?.message || `Invitation sent to ${customEvent.detail?.email}!`);
    };

    const handleShareError = (event: Event) => {
      const customEvent = event as CustomEvent<{ error: { message: string } }>;
      setInviteStatus('error');
      setInviteMessage(customEvent.detail?.error?.message || 'Failed to send invitation. Please try again.');
    };

    document.addEventListener('vibes-share-success', handleShareSuccess);
    document.addEventListener('vibes-share-error', handleShareError);

    return () => {
      document.removeEventListener('vibes-share-success', handleShareSuccess);
      document.removeEventListener('vibes-share-error', handleShareError);
    };
  }, []);

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
        {mode === 'mutate' ? (
          // Mutate mode buttons
          <>
            <VibesButton variant="primary" onClick={handleFreshDataClick}>
              Fresh Data
            </VibesButton>
            <VibesButton variant="secondary" onClick={handleChangeCodeClick}>
              Change the Code
            </VibesButton>
            <VibesButton variant="tertiary" onClick={handleBackClick}>
              ← Back
            </VibesButton>
          </>
        ) : mode === 'invite' ? (
          // Invite mode form
          <>
            {inviteStatus === 'idle' ? (
              // Show form when idle
              <form onSubmit={handleInviteSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: '#fff',
                    color: '#1a1a1a',
                    border: '3px solid #1a1a1a',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    boxShadow: '4px 5px 0px 0px #666',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  required
                />
                <VibesButton 
                  variant="primary" 
                  type="submit" 
                  disabled={!email.trim()}
                >
                  Send Invite
                </VibesButton>
              </form>
            ) : (
              // Show status when sending/complete
              <div style={{ 
                padding: '0.75rem 1rem',
                background: '#fff',
                color: '#1a1a1a',
                border: '3px solid #1a1a1a',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontWeight: 500,
                textAlign: 'center',
                letterSpacing: '0.02em',
                boxShadow: inviteStatus === 'sending' 
                  ? '4px 5px 0px 0px #666'
                  : inviteStatus === 'error' 
                    ? '4px 5px 0px 0px #DA291C' 
                    : '4px 5px 0px 0px #51cf66',
                transition: 'all 0.15s ease',
              }}>
                {inviteStatus === 'sending' ? 'Inviting...' : inviteMessage}
              </div>
            )}
            <VibesButton variant="tertiary" onClick={handleBackClick}>
              ← Back
            </VibesButton>
          </>
        ) : (
          // Default buttons
          <>
            <VibesButton variant="primary" onClick={handleLogoutClick}>
              Logout
            </VibesButton>
            <VibesButton variant="secondary" onClick={handleMutateClick}>
              🧟 Mutate
            </VibesButton>
            <VibesButton variant="tertiary" onClick={handleInviteClick}>
              Invite
            </VibesButton>
          </>
        )}
      </div>
    </div>
  );
}
