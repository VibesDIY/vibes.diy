import React, { useState, useEffect, useId } from 'react';
import { VibesButton } from '../VibesButton/VibesButton.js';
import { BrutalistCard } from '../BrutalistCard/BrutalistCard.js';
import { generateFreshDataUrl, generateRemixUrl } from '../../utils/appSlug.js';
import {
  getContainerStyle,
  innerContainerStyle,
  formStyle,
  labelStyle,
  inputCardStyle,
  inputStyle,
  statusCardStyle,
} from './VibesPanel.styles.js';

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
type PanelMode = 'default' | 'mutate' | 'invite' | 'accounts';

export function VibesPanel({ style, className }: VibesPanelProps = {}) {
  const emailId = useId();
  const [mode, setMode] = useState<PanelMode>('default');
  const [email, setEmail] = useState('');
  const [currentAccount, setCurrentAccount] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'success' | 'error'>(
    'idle'
  );
  const [inviteMessage, setInviteMessage] = useState('');

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

  useEffect(() => {
    //Logic to get the Current Account
    setCurrentAccount('Amber@vibes.diy');
  }, []);

  const currentlyDisplay: Record<PanelMode, React.ReactNode> = {
    default: (
      <>
        <VibesButton variant="primary" onClick={() => setMode('accounts')}>
          {currentAccount}
        </VibesButton>
        <VibesButton variant="secondary" onClick={() => setMode('mutate')}>
          Mutate
        </VibesButton>
        <VibesButton variant="tertiary" onClick={handleInviteClick}>
          Invite
        </VibesButton>
      </>
    ),
    accounts: (
      <>
        <VibesButton variant="primary" onClick={handleLogoutClick}>
          Logout
        </VibesButton>
        <VibesButton size="small" variant="tertiary" onClick={handleBackClick}>
          ← Back
        </VibesButton>
      </>
    ),
    mutate: (
      <>
        <VibesButton variant="primary" onClick={handleFreshDataClick}>
          Fresh Start
        </VibesButton>
        <VibesButton variant="secondary" onClick={handleChangeCodeClick}>
          Remix Code
        </VibesButton>
        <VibesButton size="small" variant="tertiary" onClick={handleBackClick}>
          ← Back
        </VibesButton>
      </>
    ),
    invite: (
      <>
        {inviteStatus === 'idle' ? (
          <form onSubmit={handleInviteSubmit} style={formStyle}>
            <label htmlFor={emailId} style={labelStyle}>
              Invite by email
            </label>
            <BrutalistCard size="md" style={inputCardStyle}>
              <input
                id={emailId}
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                autoComplete="email"
                required
              />
            </BrutalistCard>
            <VibesButton variant="primary" type="submit" disabled={!email.trim()}>
              Send Invite
            </VibesButton>
          </form>
        ) : (
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
            style={statusCardStyle}
          >
            {inviteStatus === 'sending' ? 'Inviting...' : inviteMessage}
          </BrutalistCard>
        )}
        <VibesButton size="small" variant="tertiary" onClick={handleBackClick}>
          ← Back
        </VibesButton>
      </>
    ),
  };

  return (
    <div style={getContainerStyle(style)} className={className}>
      <div style={innerContainerStyle}>{currentlyDisplay[mode]}</div>
    </div>
  );
}
