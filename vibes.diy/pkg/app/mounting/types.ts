// Type definitions for vibe mounting events

export interface VibesMountReadyDetail {
  unmount(): void;
  readonly containerId: string;
}

export interface VibesMountErrorDetail {
  readonly error: string;
  readonly containerId: string;
}

// Type guards for mount events
export function isVibesMountReadyEvent(
  event: Event,
): event is CustomEvent<VibesMountReadyDetail> {
  return event.type === "vibes-mount-ready";
}

export function isVibesMountErrorEvent(
  event: Event,
): event is CustomEvent<VibesMountErrorDetail> {
  return event.type === "vibes-mount-error";
}
