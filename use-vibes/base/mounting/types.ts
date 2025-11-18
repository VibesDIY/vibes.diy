// Type definitions for vibe mounting events

export interface VibesMountReadyDetail {
  unmount: () => void;
  containerId: string;
}

export interface VibesMountErrorDetail {
  error: string;
  containerId: string;
}

// Outcome type for mount lifecycle
export type MountOutcome = 'success' | 'error' | 'timeout';

/**
* Result of attempting to mount a vibe.
*
* Note: when outcome is 'error' or 'timeout', the returned `unmount` function
* is a no-op because no reliable React root was established.
*/
export interface MountResult {
  unmount: () => void;
  outcome: MountOutcome;
}

// Type guards for mount events
export function isVibesMountReadyEvent(event: Event): event is CustomEvent<VibesMountReadyDetail> {
  return event.type === 'vibes-mount-ready';
}

export function isVibesMountErrorEvent(event: Event): event is CustomEvent<VibesMountErrorDetail> {
  return event.type === 'vibes-mount-error';
}
