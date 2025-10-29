// Shared constants for event and class names used across the base package
// Centralizing these avoids magic strings and keeps producer/consumer in sync.

export const VIBES_SYNC_ENABLED_CLASS = 'vibes-connect-true' as const;
export const VIBES_SYNC_ENABLE_EVENT = 'vibes-sync-enable' as const;
export const VIBES_SYNC_DISABLE_EVENT = 'vibes-sync-disable' as const;
export const VIBES_SYNC_ERROR_EVENT = 'vibes-sync-error' as const;
