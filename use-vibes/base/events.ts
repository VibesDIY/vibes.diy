// Shared event and CSS constants for the auth overlay flow
export const AUTH_OVERLAY_READY_EVENT = 'vibes-auth-overlay-ready' as const;

// Class applied to the overlay container to visually hide/minimize it
export const AUTH_OVERLAY_HIDDEN_CLASS = 'fpOverlay--hidden' as const;

// Safety timeout for waiting on the overlay-ready signal
export const AUTH_OVERLAY_TIMEOUT_MS = 5000 as const;

// Data attached to the CustomEvent fired when the overlay is ready
export interface AuthOverlayReadyDetail {
  overlay: HTMLElement | null;
  authLink?: HTMLAnchorElement | null;
}
