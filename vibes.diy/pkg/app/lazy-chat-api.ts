import type { VibesDiyApiIface } from "@vibes.diy/api-types";

// chatApi is a lazy proxy: constructing it does NOT open a WebSocket. The real
// VibesDiyApi (and its ChatSessions socket) is built on the first property
// access via `build()`, which prevents the heavy ChatSessions WS from opening
// on non-chat pages (/settings, /vibes/mine, …) that only touch sharedApi/vibeApi.
// (#2265 Track B, Phase 5 — Option C)
//
// `build` is expected to be idempotent/cached (the provider passes a
// `vibesDiyApis.get(apiUrl).once(...)` lookup) so the instance persists across
// re-renders even though the proxy shell is recreated each render.
//
// Methods are BOUND to the real instance because VibesDiyApi's methods are
// regular (not arrow-bound) and rely on `this` (this.currentConnection, etc.).
// Without binding, `chatApi.openChat()` would run with `this` = the proxy — and
// since the proxy has no `set` trap, `this.x = y` writes would land on the empty
// proxy target while reads resolve from the instance, corrupting connection state.
export function makeLazyChatApi(build: () => VibesDiyApiIface): VibesDiyApiIface {
  let instance: VibesDiyApiIface | undefined;
  return new Proxy({} as VibesDiyApiIface, {
    get(_target, prop) {
      if (!instance) instance = build();
      const val = (instance as unknown as Record<string | symbol, unknown>)[prop];
      return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(instance) : val;
    },
  });
}
