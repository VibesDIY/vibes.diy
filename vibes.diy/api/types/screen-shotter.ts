import { type } from "arktype"

export const screenShotEvent = type({
    type: "'screenShotEvent'",
    shotUrl: "string",
    fsId: "string",
})

export type ScreenShotEvent = typeof screenShotEvent.infer;

export function isScreenShotEvent(obj: unknown): obj is ScreenShotEvent {
    return !(screenShotEvent(obj) instanceof type.errors);
}
