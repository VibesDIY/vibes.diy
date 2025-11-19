import React, { useState, useEffect, useId } from 'react';
import { VibesButton, BLUE, RED, YELLOW, GRAY } from '../VibesButton/index.js';
import { BrutalistCard } from '../BrutalistCard/BrutalistCard.js';
import { generateFreshDataUrl, generateRemixUrl } from '../../utils/appSlug.js';
import { styles } from './VibesPanel.styles.js';

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
  const emailId = useId();
  const [mode, setMode] = useState<PanelMode>('default');
  const [email, setEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'success' | 'error'>(
    'idle'
  );
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
    document.dispatchEvent(
      new CustomEvent('vibes-share-request', {
        detail: {
          email: email.trim(),
          role: 'member',
          right: 'read',
        },
      })
    );
  };

  // Listen for share response events
  useEffect(() => {
    const handleShareSuccess = (event: Event) => {
      const customEvent = event as CustomEvent<{ email: string; message?: string }>;
      setInviteStatus('success');
      setInviteMessage(
        customEvent.detail?.message || `Invitation sent to ${customEvent.detail?.email}!`
      );
    };

    const handleShareError = (event: Event) => {
      const customEvent = event as CustomEvent<{ error: { message: string } }>;
      setInviteStatus('error');
      setInviteMessage(
        customEvent.detail?.error?.message || 'Failed to send invitation. Please try again.'
      );
    };

    document.addEventListener('vibes-share-success', handleShareSuccess);
    document.addEventListener('vibes-share-error', handleShareError);

    return () => {
      document.removeEventListener('vibes-share-success', handleShareSuccess);
      document.removeEventListener('vibes-share-error', handleShareError);
    };
  }, []);

  // Inject styles
  useEffect(() => {
    const styleId = 'vibes-panel-styles';
    if (!document.getElementById(styleId)) {
      const styleTag = document.createElement('style');
      styleTag.id = styleId;
      styleTag.textContent = styles;
      document.head.appendChild(styleTag);
    }
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

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '24px',
    flexWrap: 'wrap',
    maxWidth: '100%',
  };

  return (
    <div style={containerStyle} className={className}>
      <div className="vibes-panel-container">
        <div className="vibes-panel-label">Settings</div>
        <div className="vibes-panel-button-wrapper">
          <div style={buttonContainerStyle}>
            {mode === 'mutate' ? (
              // Mutate mode buttons
              <>
                <VibesButton color={BLUE} onClick={handleFreshDataClick}>
                  Fresh Start
                </VibesButton>
                <VibesButton color={RED} onClick={handleChangeCodeClick} icon="remix">
                  Remix Code
                </VibesButton>
                <VibesButton color={YELLOW} onClick={handleBackClick} icon="back">
                  Back
                </VibesButton>
              </>
            ) : mode === 'invite' ? (
              // Invite mode form
              <>
                {inviteStatus === 'idle' ? (
                  // Show form when idle
                  <form
                    onSubmit={handleInviteSubmit}
                    style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}
                  >
                    <label htmlFor={emailId} style={{ alignSelf: 'flex-start', fontWeight: 600 }}>
                      Invite by email
                    </label>
                    <BrutalistCard size="md" style={{ width: '100%' }}>
                      <input
                        id={emailId}
                        type="email"
                        placeholder="friend@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          color: 'inherit',
                          fontSize: 'inherit',
                          fontWeight: 'inherit',
                          letterSpacing: 'inherit',
                          padding: 0,
                        }}
                        autoComplete="email"
                        required
                      />
                    </BrutalistCard>
                    <VibesButton color={BLUE} type="submit" disabled={!email.trim()}>
                      Send Invite
                    </VibesButton>
                  </form>
                ) : (
                  // Show status when sending/complete
                  <BrutalistCard
                    id="invite-status"
                    role="status"
                    aria-live="polite"
                    size="sm"
                    variant={
                      inviteStatus === 'sending'
                        ? 'default'
                        : inviteStatus === 'error'
                          ? 'error'
                          : 'success'
                    }
                    style={{ textAlign: 'center' }}
                  >
                    {inviteStatus === 'sending' ? 'Inviting...' : inviteMessage}
                  </BrutalistCard>
                )}
                <VibesButton color={YELLOW} onClick={handleBackClick} icon="back">
                  Back
                </VibesButton>
              </>
            ) : (
              // Default buttons
              <>
                <VibesButton color={BLUE} onClick={handleLogoutClick} icon="logout">
                  Logout
                </VibesButton>
                <VibesButton color={RED} onClick={handleMutateClick} icon="remix">
                  Remix
                </VibesButton>
                <VibesButton color={YELLOW} onClick={handleInviteClick} icon="invite">
                  Invite
                </VibesButton>
                <VibesButton color={GRAY} icon="settings">
                  Settings
                </VibesButton>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
