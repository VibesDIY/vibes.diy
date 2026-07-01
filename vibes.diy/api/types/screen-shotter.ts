import { type } from "arktype";

export const screenShotEvent = type({
  type: "'screenShotEvent'",
  shotUrl: "string",
  fsId: "string",
});

export type ScreenShotEvent = typeof screenShotEvent.infer;

export function isScreenShotEvent(obj: unknown): obj is ScreenShotEvent {
  return !(screenShotEvent(obj) instanceof type.errors);
}

// Readiness token shared between the viewer route (which renders the
// "Verifying access…" grant-resolution toast) and the screenshot queue (which
// waits for that toast to clear before capturing, so it doesn't shoot the
// loading state). Keeping the copy in one place stops the screenshot readiness
// gate from silently degrading to the fixed settle delay if the toast text is
// reworded in only one location. The screenshotter substring-matches this, so
// the toast may append to it (e.g. an ellipsis) without breaking the probe.
export const VERIFYING_ACCESS_TOAST = "Verifying access";
