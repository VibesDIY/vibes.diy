import type React from 'react';

export function getOuterContainerStyle(customStyle?: React.CSSProperties): React.CSSProperties {
  return {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    ...customStyle,
  };
}

export function getButtonContainerStyle(): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '24px',
    flexWrap: 'wrap',
    maxWidth: '100%',
  };
}

export function getInviteFormStyle(): React.CSSProperties {
  return {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };
}

export function getInviteLabelStyle(): React.CSSProperties {
  return {
    alignSelf: 'flex-start',
    fontWeight: 600,
  };
}

export function getInviteInputWrapperStyle(): React.CSSProperties {
  return {
    width: '100%',
  };
}

export function getInviteInputStyle(): React.CSSProperties {
  return {
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    letterSpacing: 'inherit',
    padding: 0,
  };
}

export function getInviteStatusStyle(): React.CSSProperties {
  return {
    textAlign: 'center',
  };
}
